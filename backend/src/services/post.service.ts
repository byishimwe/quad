import { Post } from "../models/Post.model.js";
import { User } from "../models/User.model.js";
import { getSocketIO } from "../config/socket.config.js";
import { emitContentDeleted } from "../sockets/feed.socket.js";
import { extractMentions } from "../utils/chat.util.js";
import {
  createNotification,
  generateNotificationMessage,
} from "../utils/notification.util.js";
import { findUserByUsername } from "../utils/userLookup.util.js";
import { sanitizePostText } from "../utils/content.util.js";
import { AppError } from "../utils/appError.util.js";
import { deleteOwnedAssets } from "../utils/upload.util.js";

export interface CreatePostInput {
  text?: string;
  media: Array<{
    url: string;
    type: "image" | "video";
    aspectRatio?: "1:1" | "16:9" | "9:16";
  }>;
}

export interface UpdatePostInput {
  text?: string;
  media?: Array<{
    url: string;
    type: "image" | "video";
    aspectRatio?: "1:1" | "16:9" | "9:16";
  }>;
}

export class PostService {
  static async createPost(userId: string, data: CreatePostInput) {
    const author = await User.findOne({ clerkId: userId });
    if (!author) {
      throw new AppError(
        "User not found. Please create a user profile first.",
        404,
      );
    }

    if (!Array.isArray(data.media) || data.media.length === 0) {
      throw new AppError("Post must have at least one media", 400);
    }

    const sanitizedText = data.text ? sanitizePostText(data.text) : undefined;

    const newPost = await Post.create({
      ...data,
      ...(sanitizedText !== undefined ? { text: sanitizedText } : {}),
      userId: author.clerkId,
      author: {
        clerkId: author.clerkId,
        username: author.username,
        email: author.email,
        ...(author.displayName !== undefined
          ? { displayName: author.displayName }
          : {}),
        ...(author.firstName !== undefined
          ? { firstName: author.firstName }
          : {}),
        ...(author.lastName !== undefined ? { lastName: author.lastName } : {}),
        ...(author.profileImage !== undefined
          ? { profileImage: author.profileImage }
          : {}),
      },
    });

    const newPostId = String(newPost._id);

    const io = getSocketIO();
    io.emit("newPost", newPost);

    if (newPost?.text) {
      await this.processMentions(
        newPost.text,
        userId,
        newPostId,
        author.username,
      );
    }

    return newPost;
  }

  static async getAllPosts(limit: number = 20, skip: number = 0) {
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Post.countDocuments();

    return {
      posts,
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + posts.length < total,
      },
    };
  }

  static async getPost(id: string) {
    const post = await Post.findById(id);
    if (!post) {
      throw new AppError("Post not found", 404);
    }
    return post;
  }

  static async updatePost(
    userId: string,
    id: string,
    updates: UpdatePostInput,
  ) {
    const post = await Post.findById(id);
    if (!post) {
      throw new AppError("Post not found", 404);
    }

    if (post.author.clerkId !== userId) {
      throw new AppError("Unauthorized", 403);
    }

    // Schema validation should prevent author updates, but keep this defensive.
    const safeUpdates: UpdatePostInput = updates;

    if (safeUpdates.media !== undefined && safeUpdates.media.length === 0) {
      throw new AppError("Post must have at least one media", 400);
    }

    const nextMedia = safeUpdates.media ?? post.media;
    if (!Array.isArray(nextMedia) || nextMedia.length === 0) {
      throw new AppError("Post must have at least one media", 400);
    }

    const sanitizedUpdates = {
      ...safeUpdates,
      ...(typeof safeUpdates.text === "string"
        ? { text: sanitizePostText(safeUpdates.text) }
        : {}),
    };

    const updatedPost = await Post.findByIdAndUpdate(id, sanitizedUpdates, {
      returnDocument: "after",
    });

    if (!updatedPost) {
      throw new AppError("Post not found", 404);
    }

    getSocketIO().emit("updatePost", updatedPost);

    if (updatedPost?.text) {
      await this.processMentions(
        updatedPost.text,
        userId,
        id,
        post.author.username,
      );
    }

    return updatedPost;
  }

  static async deletePost(userId: string, id: string) {
    const post = await Post.findById(id);
    if (!post) {
      throw new AppError("Post not found", 404);
    }

    if (post.author.clerkId !== userId) {
      throw new AppError("Unauthorized", 403);
    }

    await Post.findByIdAndDelete(id);
    await deleteOwnedAssets(userId, post.media.map((item) => item.url));

    const io = getSocketIO();
    io.emit("deletePost", id);
    emitContentDeleted(io, "post", id);
  }

  private static async processMentions(
    text: string,
    actorId: string,
    postId: string,
    actorUsername: string,
  ) {
    const mentions = extractMentions(text);
    if (mentions.length === 0) return;

    for (const mentionedUsername of mentions) {
      const mentionedUser = await findUserByUsername(mentionedUsername);
      if (mentionedUser && mentionedUser.clerkId !== actorId) {
        await createNotification({
          userId: mentionedUser.clerkId,
          type: "mention_post",
          actorId,
          contentId: postId,
          contentType: "Post",
          message: generateNotificationMessage("mention_post", actorUsername),
        });
      }
    }
  }
}
