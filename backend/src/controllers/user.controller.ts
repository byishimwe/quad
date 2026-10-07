import type { Request, Response } from "express";
import mongoose from "mongoose";
import { User } from "../models/User.model.js";
import type {
  CreateUserSchemaType,
  UpdateUserProfileSchemaType,
} from "../schemas/user.schema.js";
import { logger } from "../utils/logger.util.js";
import { getAuth, clerkClient } from "@clerk/express";
import { propagateUserSnapshotUpdates } from "../utils/userSnapshotPropagation.util.js";
import { asyncHandler } from "../utils/asyncHandler.util.js";
import { AppError } from "../utils/appError.util.js";

/**
 * =========================
 * CREATE USER
 * =========================
 */
export const createUser = asyncHandler(async (req: Request, res: Response) => {
  // ✅ Get Clerk userId from request
  const { userId } = getAuth(req);
  if (!userId) {
    throw new AppError("Unauthenticated", 401);
  }

  // ✅ Check if user already exists
  const existingUser = await User.findOne({ clerkId: userId });
  if (existingUser) {
    return res.status(200).json({ success: true, data: existingUser });
  }

  // ✅ Optionally fetch user info from Clerk
  const clerkUser = await clerkClient.users.getUser(userId);

  const body = req.body as Partial<CreateUserSchemaType>;

  const displayName =
    body.displayName ||
    [body.firstName, body.lastName].filter(Boolean).join(" ").trim() ||
    undefined;

  // ✅ Create new user in MongoDB
  const newUser = await User.create({
    clerkId: userId,
    username: clerkUser.username ?? body.username ?? "Anonymous",
    email: clerkUser.emailAddresses[0]?.emailAddress ?? body.email ?? "",
    displayName,
    firstName: body.firstName,
    lastName: body.lastName,
    profileImage: body.profileImage, // will use default avatar in model if not provided
    coverImage: body.coverImage,
    bio: body.bio,
  });

  return res.status(201).json({ success: true, data: newUser });
});

/**
 * =========================
 * GET USER
 * =========================
 */
export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const { clerkId } = req.params;

  const { userId } = getAuth(req);
  if (!userId) {
    throw new AppError("Unauthenticated", 401);
  }

  // ✅ Only allow access to own user data (or admin logic could be added)
  if (userId !== clerkId) {
    throw new AppError("Forbidden", 403);
  }

  const user = await User.findOne({ clerkId });
  if (!user) {
    throw new AppError("User not found", 404);
  }

  return res.status(200).json({ success: true, data: user });
});

/**
 * =========================
 * UPDATE USER
 * =========================
 */
export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const { clerkId } = req.params;
  const { userId } = getAuth(req);

  if (!userId) {
    throw new AppError("Unauthenticated", 401);
  }

  // ✅ Only allow updating own profile
  if (userId !== clerkId) {
    throw new AppError("Forbidden", 403);
  }

  const safeUpdates = req.body as Partial<UpdateUserProfileSchemaType>;

  const existingUser = await User.findOne({ clerkId });
  if (!existingUser) {
    throw new AppError("User not found", 404);
  }

  const nextUsername = safeUpdates.username;
  if (
    typeof nextUsername === "string" &&
    nextUsername !== existingUser.username
  ) {
    const conflict = await User.findOne({ username: nextUsername })
      .select("clerkId")
      .lean();
    if (conflict && conflict.clerkId !== clerkId) {
      throw new AppError("Username already taken", 409);
    }
  }

  const updateOps: {
    $set: Record<string, unknown>;
  } = { $set: safeUpdates as Record<string, unknown> };

  let updatedUser = null;

  // Strong consistency: update user + propagate snapshots in one transaction.
  // If transactions aren't supported (e.g. standalone Mongo), fall back to awaited propagation.
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    updatedUser = await User.findOneAndUpdate({ clerkId }, updateOps, {
      returnDocument: "after",
      session,
    });

    if (!updatedUser) {
      await session.abortTransaction();
      throw new AppError("User not found", 404);
    }

    const propagationResult = await propagateUserSnapshotUpdates(
      {
        clerkId: updatedUser.clerkId,
        username: updatedUser.username,
        email: updatedUser.email,
        displayName: updatedUser.displayName,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        profileImage: updatedUser.profileImage,
        coverImage: updatedUser.coverImage,
        bio: updatedUser.bio,
      },
      { session },
    );

    await session.commitTransaction();

    logger.info("Propagated user snapshot updates after updateUser", {
      clerkId: updatedUser.clerkId,
      ...propagationResult,
    });
  } catch (propagationError: unknown) {
    try {
      await session.abortTransaction();
    } catch {
      // ignore
    }

    // Check if it's an AppError we threw inside the try block
    if (propagationError instanceof AppError) {
      throw propagationError;
    }

    // Fallback for deployments without transaction support.
    const msg =
      propagationError instanceof Error ? propagationError.message : "";
    const isTxnUnsupported =
      msg.includes("does not support retryable writes") ||
      (msg.includes("Transaction") &&
        (msg.includes("replica set") ||
          msg.includes("mongos") ||
          msg.includes("not supported")));

    if (!isTxnUnsupported) {
      logger.error(
        "Failed to propagate user snapshot updates after updateUser",
        propagationError,
      );
      throw new AppError("Failed to update user snapshots", 500);
    }

    logger.warn(
      "Transactions not supported; falling back to awaited non-transactional snapshot propagation",
      { clerkId },
    );

    // Non-transactional path (still awaited; request fails if propagation fails)
    updatedUser = await User.findOneAndUpdate({ clerkId }, updateOps, {
      returnDocument: "after",
    });
    if (!updatedUser) {
      throw new AppError("User not found", 404);
    }

    const propagationResult = await propagateUserSnapshotUpdates({
      clerkId: updatedUser.clerkId,
      username: updatedUser.username,
      email: updatedUser.email,
      displayName: updatedUser.displayName,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      profileImage: updatedUser.profileImage,
      coverImage: updatedUser.coverImage,
      bio: updatedUser.bio,
    });

    logger.info(
      "Propagated user snapshot updates after updateUser (no transaction)",
      {
        clerkId: updatedUser.clerkId,
        ...propagationResult,
      },
    );
  } finally {
    session.endSession();
  }

  return res.status(200).json({ success: true, data: updatedUser });
});

/**
 * =========================
 * DELETE USER
 * =========================
 */
/**
 * =========================
 * CHECK USERNAME AVAILABILITY
 * =========================
 */
export const checkUsername = asyncHandler(
  async (req: Request, res: Response) => {
    const { username } = req.params;

    if (!username || username.length < 4 || username.length > 64) {
      return res.status(200).json({ success: true, available: false });
    }

    const existingUser = await User.findOne({ username })
      .collation({ locale: "en", strength: 2 })
      .lean();

    return res.status(200).json({
      success: true,
      available: !existingUser,
    });
  },
);

export const checkEmail = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.params;

  const normalizedEmail = Array.isArray(email) ? email[0] : email;

  if (
    !normalizedEmail ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
  ) {
    return res.status(200).json({ success: true, available: false });
  }

  const existingUser = await User.findOne({
    email: normalizedEmail.toLowerCase(),
  }).lean();

  return res.status(200).json({
    success: true,
    available: !existingUser,
  });
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const { clerkId } = req.params;
  const { userId } = getAuth(req);

  if (!userId) {
    throw new AppError("Unauthenticated", 401);
  }

  // Only allow deleting own account
  if (userId !== clerkId) {
    throw new AppError("Forbidden", 403);
  }

  // Cascade delete all user data
  const { Post } = await import("../models/Post.model.js");
  const { Story } = await import("../models/Story.model.js");
  const { Poll } = await import("../models/Poll.model.js");
  const { PollVote } = await import("../models/PollVote.model.js");
  const { Reaction } = await import("../models/Reaction.model.js");
  const { ChatMessage } = await import("../models/ChatMessage.model.js");
  const { Notification } = await import("../models/Notification.model.js");
  const { Bookmark } = await import("../models/Bookmark.model.js");
  const { Follow } = await import("../models/Follow.model.js");
  const { Comment } = await import("../models/Comment.model.js");
  const { CommentLike } = await import("../models/CommentLike.model.js");

  const [deletedUser] = await Promise.all([
    User.findOneAndDelete({ clerkId }),
    Post.deleteMany({ "author.clerkId": clerkId }),
    Story.deleteMany({ "author.clerkId": clerkId }),
    Poll.deleteMany({ "author.clerkId": clerkId }),
    PollVote.deleteMany({ userId: clerkId }),
    Reaction.deleteMany({ userId: clerkId }),
    ChatMessage.deleteMany({ "author.clerkId": clerkId }),
    Notification.deleteMany({ userId: clerkId }),
    Notification.deleteMany({ actorId: clerkId }),
    Bookmark.deleteMany({ userId: clerkId }),
    Follow.deleteMany({ $or: [{ userId: clerkId }, { followingId: clerkId }] }),
    Comment.deleteMany({ "author.clerkId": clerkId }),
    CommentLike.deleteMany({ userId: clerkId }),
  ]);

  if (!deletedUser) {
    throw new AppError("User not found", 404);
  }

  return res
    .status(200)
    .json({ success: true, message: "User and all related data deleted successfully" });
});
