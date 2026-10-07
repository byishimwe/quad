import { Story, type IStoryDocument } from "../models/Story.model.js";
import { User } from "../models/User.model.js";
import { deleteOwnedAssets } from "../utils/upload.util.js";
import type {
  CreateStorySchemaType,
  GetStoriesQuerySchemaType,
  UpdateStorySchemaType,
} from "../schemas/story.schema.js";
import { getSocketIO } from "../config/socket.config.js";
import { extractMentions } from "../utils/chat.util.js";
import {
  createNotification,
  generateNotificationMessage,
} from "../utils/notification.util.js";
import { findUserByUsername } from "../utils/userLookup.util.js";
import {
  calculateReadingTime,
  generateExcerpt,
  sanitizeHtmlContent,
  validateHtmlContent,
} from "../utils/story.util.js";
import { AppError } from "../utils/appError.util.js";

export class StoryService {
  static async createStory(userId: string, storyData: CreateStorySchemaType) {
    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      throw new AppError("User not found", 404);
    }

    const sanitizedContent = sanitizeHtmlContent(storyData.content);

    if (!validateHtmlContent(sanitizedContent)) {
      throw new AppError("Invalid or empty HTML content", 400);
    }

    const readTime = calculateReadingTime(sanitizedContent);
    const excerpt = generateExcerpt(sanitizedContent, 200);

    const newStory = await Story.create({
      userId,
      author: {
        clerkId: user.clerkId,
        username: user.username,
        email: user.email,
        ...(user.profileImage !== undefined
          ? { profileImage: user.profileImage }
          : {}),
        ...(user.bio !== undefined ? { bio: user.bio } : {}),
      },
      title: storyData.title,
      content: sanitizedContent,
      excerpt,
      ...(storyData.coverImage !== undefined
        ? { coverImage: storyData.coverImage }
        : {}),
      status: storyData.status || "draft",
      tags: storyData.tags || [],
      readTime,
      reactionsCount: 0,
      commentsCount: 0,
    });

    if (newStory.status === "published") {
      const io = getSocketIO();
      io.emit("newStory", newStory);

      const mentions = extractMentions(newStory.content);
      if (mentions.length > 0) {
        for (const mentionedUsername of mentions) {
          const mentionedUser = await findUserByUsername(mentionedUsername);
          if (mentionedUser && mentionedUser.clerkId !== userId) {
            await createNotification({
              userId: mentionedUser.clerkId,
              type: "mention_story",
              actorId: userId,
              contentId: String(newStory._id),
              contentType: "Story",
              message: generateNotificationMessage(
                "mention_story",
                user.username,
              ),
            });
          }
        }
      }
    }

    return newStory;
  }

  static async getAllStories(
    _userId: string | undefined,
    query: GetStoriesQuerySchemaType,
  ) {
    const filter: Record<string, unknown> = {
      status: "published",
    };

    const stories = await Story.find(filter)
      .sort({ publishedAt: -1, createdAt: -1 })
      .limit(query.limit)
      .skip(query.skip)
      .lean();

    const total = await Story.countDocuments(filter);

    return {
      stories,
      pagination: {
        total,
        limit: query.limit,
        skip: query.skip,
        hasMore: query.skip + stories.length < total,
      },
    };
  }

  static async getStory(id: string, userId?: string) {
    const story = await Story.findById(id);
    if (!story) {
      throw new AppError("Story not found", 404);
    }

    if (story.status === "draft" && story.author.clerkId !== userId) {
      throw new AppError("You don't have permission to view this draft", 403);
    }

    return story;
  }

  static async updateStory(
    userId: string,
    id: string,
    inputUpdates: UpdateStorySchemaType,
  ) {
    const story = await Story.findById(id);
    if (!story) {
      throw new AppError("Story not found", 404);
    }

    if (story.author.clerkId !== userId) {
      throw new AppError("Only the author can update this story", 403);
    }

    let sanitizedContent: string | undefined;
    if (inputUpdates.content) {
      sanitizedContent = sanitizeHtmlContent(inputUpdates.content);

      if (!validateHtmlContent(sanitizedContent)) {
        throw new AppError("Invalid or empty HTML content", 400);
      }
    }

    const updates: Partial<IStoryDocument> = {
      ...inputUpdates,
    } as Partial<IStoryDocument>;

    if (sanitizedContent) {
      updates.content = sanitizedContent;
      updates.readTime = calculateReadingTime(sanitizedContent);
      updates.excerpt = generateExcerpt(sanitizedContent, 200);
    }

    const wasPublished = story.status === "published";
    const nowPublished = inputUpdates.status === "published";

    Object.assign(story, updates);
    await story.save();

    if (nowPublished) {
      if (!wasPublished) {
        const io = getSocketIO();
        io.emit("newStory", story);

        const mentions = extractMentions(story.content);
        if (mentions.length > 0) {
          for (const mentionedUsername of mentions) {
            const mentionedUser = await findUserByUsername(mentionedUsername);
            if (mentionedUser && mentionedUser.clerkId !== userId) {
              await createNotification({
                userId: mentionedUser.clerkId,
                type: "mention_story",
                actorId: userId,
                contentId: String(story._id),
                contentType: "Story",
                message: generateNotificationMessage(
                  "mention_story",
                  story.author.username,
                ),
              });
            }
          }
        }
      } else {
        getSocketIO().emit("storyUpdated", story.toObject());
      }
    }

    return story;
  }

  static async deleteStory(userId: string, id: string) {
    const story = await Story.findById(id);
    if (!story) {
      throw new AppError("Story not found", 404);
    }

    if (story.author.clerkId !== userId) {
      throw new AppError("Only the author can delete this story", 403);
    }

    await Story.findByIdAndDelete(id);
    if (story.coverImage) await deleteOwnedAssets(userId, [story.coverImage]);

    if (story.status === "published") {
      const io = getSocketIO();
      io.emit("storyDeleted", id);
    }
  }

  static async getMyStories(
    userId: string,
    opts: { limit?: string; skip?: string; status?: string },
  ) {
    const { limit = "20", skip = "0", status } = opts;

    const filter: Record<string, unknown> = { "author.clerkId": userId };

    if (status === "draft" || status === "published") {
      filter.status = status;
    }

    const stories = await Story.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(Number(skip))
      .lean();

    const total = await Story.countDocuments(filter);

    return {
      stories,
      pagination: {
        total,
        limit: Number(limit),
        skip: Number(skip),
        hasMore: Number(skip) + stories.length < total,
      },
    };
  }
}
