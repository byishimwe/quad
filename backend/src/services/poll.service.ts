import { Poll } from "../models/Poll.model.js";
import { PollVote } from "../models/PollVote.model.js";
import type { IPollVoteDocument } from "../models/PollVote.model.js";
import { User } from "../models/User.model.js";
import { deleteOwnedAssets } from "../utils/upload.util.js";
import type {
  CreatePollSchemaType,
  GetPollsQuerySchemaType,
  UpdatePollSchemaType,
} from "../schemas/poll.schema.js";
import type { IPollMedia } from "../types/poll.types.js";
import { getSocketIO } from "../config/socket.config.js";
import {
  emitContentDeleted,
  emitEngagementUpdate,
} from "../sockets/feed.socket.js";
import {
  canViewResults,
  canVoteOnPoll,
  formatPollResponse,
  validateVoteIndices,
} from "../utils/poll.util.js";
import { createNotification } from "../utils/notification.util.js";
import { AppError } from "../utils/appError.util.js";

export class PollService {
  static async createPoll(userId: string, pollData: CreatePollSchemaType) {
    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      throw new AppError("User not found", 404);
    }

    const options = pollData.options.map((opt) => ({
      text: opt.text,
      votesCount: 0,
    }));

    const poll = await Poll.create({
      author: {
        clerkId: user.clerkId,
        username: user.username,
        ...(user.email ? { email: user.email } : {}),
        ...(user.displayName !== undefined
          ? { displayName: user.displayName }
          : {}),
        ...(user.firstName !== undefined ? { firstName: user.firstName } : {}),
        ...(user.lastName !== undefined ? { lastName: user.lastName } : {}),
        ...(user.profileImage !== undefined
          ? { profileImage: user.profileImage }
          : {}),
        ...(user.bio !== undefined ? { bio: user.bio } : {}),
      },
      question: pollData.question,
      ...(pollData.questionMedia !== undefined
        ? { questionMedia: pollData.questionMedia as IPollMedia }
        : {}),
      options,
      settings: {
        anonymousVoting: pollData.settings?.anonymousVoting ?? false,
      },
      status: "active",
      ...(pollData.expiresAt !== undefined
        ? { expiresAt: pollData.expiresAt }
        : {}),
      totalVotes: 0,
      reactionsCount: 0,
    });

    const io = getSocketIO();
    io.emit("newPoll", poll);

    return poll;
  }

  static async getAllPolls(
    userId: string | undefined,
    query: GetPollsQuerySchemaType,
  ) {
    const { page, limit, status, author, voted } = query;

    const filter: Record<string, unknown> = {};

    if (status && status !== "all") {
      filter.status = status;
    }

    if (author) {
      filter["author.clerkId"] = author;
    }

    if (voted !== undefined && userId) {
      const userVotes = await PollVote.find({ userId }).select("pollId");
      const votedPollIds = userVotes.map((v) => v.pollId);

      filter._id =
        voted === true ? { $in: votedPollIds } : { $nin: votedPollIds };
    }

    const skip = (page - 1) * limit;

    const [polls, total] = await Promise.all([
      Poll.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Poll.countDocuments(filter),
    ]);

    let userVotes: Partial<Record<string, IPollVoteDocument>> = {};
    if (userId) {
      const votes = await PollVote.find({
        userId,
        pollId: { $in: polls.map((p) => p._id) },
      });
      userVotes = votes.reduce<Partial<Record<string, IPollVoteDocument>>>(
        (acc, v) => {
          acc[v.pollId.toString()] = v;
          return acc;
        },
        {},
      );
    }

    const formattedPolls = polls.map((poll) => {
      const pollId = poll._id ? poll._id.toString() : "";
      const userVote = userVotes[pollId];
      const hasVoted = !!userVote;
      const showResults = canViewResults(poll, hasVoted);
      return formatPollResponse(poll, userVote, showResults);
    });

    return {
      polls: formattedPolls,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasMore: page < Math.ceil(total / limit),
      },
    };
  }

  static async getMyPolls(userId: string, pageNum: number, limitNum: number) {
    const skip = (pageNum - 1) * limitNum;

    const [polls, total] = await Promise.all([
      Poll.find({ "author.clerkId": userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Poll.countDocuments({ "author.clerkId": userId }),
    ]);

    const formattedPolls = polls.map((poll) =>
      formatPollResponse(poll, undefined, true),
    );

    return {
      polls: formattedPolls,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
        hasMore: pageNum < Math.ceil(total / limitNum),
      },
    };
  }

  static async getPollById(userId: string, id: string) {
    const poll = await Poll.findById(id);
    if (!poll) {
      throw new AppError("Poll not found", 404);
    }

    const userVote = await PollVote.findOne({ pollId: id, userId });
    const hasVoted = !!userVote;
    const showResults = canViewResults(poll, hasVoted);

    return formatPollResponse(poll, userVote || undefined, showResults);
  }

  static async updatePoll(
    userId: string,
    id: string,
    updates: UpdatePollSchemaType,
  ) {
    const poll = await Poll.findById(id);
    if (!poll) {
      throw new AppError("Poll not found", 404);
    }

    if (poll.author.clerkId !== userId) {
      throw new AppError("Only the author can update this poll", 403);
    }

    const hasVotes =
      poll.totalVotes > 0 || (await PollVote.exists({ pollId: id })) !== null;
    if (hasVotes) {
      throw new AppError("Cannot edit a poll after votes have been cast", 400);
    }

    const now = new Date();
    const isExpired =
      poll.status === "expired" ||
      (poll.expiresAt !== undefined &&
        poll.expiresAt.getTime() <= now.getTime());

    if (isExpired) {
      throw new AppError("Cannot edit an expired poll", 400);
    }

    if (updates.question) {
      poll.question = updates.question;
    }

    if (updates.questionMedia !== undefined) {
      if (updates.questionMedia === null) {
        delete poll.questionMedia;
      } else {
        const { url, type, aspectRatio } = updates.questionMedia;

        if (type !== "image") {
          throw new AppError("Poll questionMedia must be an image", 400);
        }

        const questionMedia: IPollMedia = {
          url,
          type: "image",
          ...(aspectRatio !== undefined ? { aspectRatio } : {}),
        };

        poll.questionMedia = questionMedia;
      }
    }

    if (updates.settings?.anonymousVoting !== undefined) {
      poll.settings.anonymousVoting = updates.settings.anonymousVoting;
    }

    if (updates.expiresAt !== undefined) {
      if (updates.expiresAt === null) {
        delete poll.expiresAt;
      } else {
        poll.expiresAt = updates.expiresAt;
      }
    }

    if (updates.options !== undefined) {
      poll.options = updates.options.map((opt) => ({
        text: opt.text,
        votesCount: 0,
      }));
    }

    await poll.save();

    const showResults = canViewResults(poll, false);
    const formattedPoll = formatPollResponse(poll, undefined, showResults);

    getSocketIO().emit("pollUpdated", formattedPoll);

    return formattedPoll;
  }

  static async deletePoll(userId: string, id: string) {
    const poll = await Poll.findById(id);
    if (!poll) {
      throw new AppError("Poll not found", 404);
    }

    if (poll.author.clerkId !== userId) {
      throw new AppError("Only the author can delete this poll", 403);
    }

    await Promise.all([
      Poll.findByIdAndDelete(id),
      PollVote.deleteMany({ pollId: id }),
    ]);
    if (poll.questionMedia?.url) await deleteOwnedAssets(userId, [poll.questionMedia.url]);

    const io = getSocketIO();
    io.emit("pollDeleted", id);
    emitContentDeleted(io, "poll", id);
  }

  static async voteOnPoll(userId: string, id: string, optionIndices: number[]) {
    const poll = await Poll.findById(id);
    if (!poll) {
      throw new AppError("Poll not found", 404);
    }

    if (!canVoteOnPoll(poll)) {
      throw new AppError("This poll is not accepting votes", 400);
    }

    const validation = validateVoteIndices(poll, optionIndices);
    if (!validation.valid) {
      throw new AppError(validation.error || "Invalid vote", 400);
    }

    let vote;
    try {
      vote = await PollVote.create({
        pollId: id,
        userId,
        optionIndices,
        votedAt: new Date(),
      });
    } catch (err: unknown) {
      const mongoError = err as { code?: number };
      if (mongoError.code === 11000) {
        throw new AppError("You have already voted on this poll", 400);
      }
      throw err;
    }

    const previousTotalVotes = poll.totalVotes;

    optionIndices.forEach((index) => {
      if (poll.options[index]) {
        poll.options[index].votesCount += 1;
      }
    });

    poll.totalVotes += 1;
    const newTotalVotes = poll.totalVotes;
    await poll.save();

    const milestones = [10, 50, 100, 250, 500, 1000, 5000, 10000];
    const reachedMilestone = milestones.find(
      (milestone) =>
        previousTotalVotes < milestone && newTotalVotes >= milestone,
    );

    if (reachedMilestone) {
      const pollOwnerId = poll.author.clerkId;
      const pollId = poll._id ? poll._id.toString() : id;
      if (pollOwnerId && pollId) {
        await createNotification({
          userId: pollOwnerId,
          type: "poll_milestone",
          contentId: pollId,
          contentType: "Poll",
          message: `Your poll reached ${reachedMilestone} votes!`,
        });
      }
    }

    const io = getSocketIO();
    io.emit("pollVoted", {
      pollId: id,
      updatedVoteCounts: poll.options.map((opt) => opt.votesCount),
      totalVotes: poll.totalVotes,
    });

    emitEngagementUpdate(
      io,
      "poll",
      id,
      poll.reactionsCount,
      undefined,
      poll.totalVotes,
    );

    const formattedPoll = formatPollResponse(poll, vote, true);

    return { vote, formattedPoll };
  }
}
