import express, { type Request, type Response } from "express";
import mongoose from "mongoose";
import { Webhook } from "svix";
import type { WebhookEvent } from "@clerk/express";
import rateLimit from "express-rate-limit";
import { env } from "../config/env.config.js";
import { User } from "../models/User.model.js";
import { propagateUserSnapshotUpdates } from "../utils/userSnapshotPropagation.util.js";
import { logger } from "../utils/logger.util.js";
import { deleteOwnedAssets } from "../utils/upload.util.js";

// Strict rate limiter for webhooks to prevent DoS against signature verification
const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 webhook requests per minute
  message: {
    success: false,
    message: "Too many webhook requests, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = express.Router();
const webhookSecret = env.CLERK_WEBHOOK_SECRET as string;

// Clerk requires raw body parsing for signature verification
// Rate limited to prevent DoS attacks against expensive signature verification
router.post(
  "/clerk",
  webhookRateLimiter,
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response) => {
    let signatureVerified = false;
    logger.info("Clerk webhook endpoint hit", {
      path: req.path,
      bodyLength: (req.body as Buffer | undefined)?.length ?? 0,
    });

    try {
      const payload = req.body;
      const headers = req.headers as Record<string, string>;

      if (!webhookSecret) {
        logger.error("CLERK_WEBHOOK_SECRET is missing", {});
        return res.status(500).json({ success: false });
      }

      const wh = new Webhook(webhookSecret);
      const evt = wh.verify(payload, headers) as WebhookEvent;
      signatureVerified = true;
      const eventType = evt.type;

      logger.info("Clerk webhook received", { eventType });

      switch (eventType) {
        case "user.created": {
          const email = evt.data.email_addresses?.[0]?.email_address;
          const username = evt.data.username || email?.split("@")[0] || "user";
          const firstName = (evt.data as { first_name?: string }).first_name;
          const lastName = (evt.data as { last_name?: string }).last_name;
          const displayName =
            [firstName, lastName].filter(Boolean).join(" ").trim() || username;
          const insert = (name: string) => ({
            clerkId: evt.data.id,
            username: name,
            ...(email ? { email } : {}),
            displayName,
            ...(firstName ? { firstName } : {}),
            ...(lastName ? { lastName } : {}),
            ...(evt.data.image_url ? { profileImage: evt.data.image_url } : {}),
          });

          try {
            await User.findOneAndUpdate(
              { clerkId: evt.data.id },
              { $setOnInsert: insert(username) },
              { upsert: true, returnDocument: "after" },
            );
          } catch (error) {
            const duplicateUsername =
              typeof error === "object" && error !== null &&
              "code" in error && error.code === 11000 &&
              "keyPattern" in error &&
              !!(error.keyPattern as Record<string, unknown>)?.username;
            if (!duplicateUsername) throw error;
            await User.findOneAndUpdate(
              { clerkId: evt.data.id },
              { $setOnInsert: insert(`${username}_${evt.data.id}`) },
              { upsert: true, returnDocument: "after" },
            );
          }

          logger.info("User created via Clerk webhook", {
            clerkId: evt.data.id,
          });
          break;
        }

        case "user.updated": {
          const email = evt.data.email_addresses?.[0]?.email_address;
          const username = evt.data.username || email?.split("@")[0] || "user";

          const profileImage = evt.data.image_url;
          const firstName = (evt.data as { first_name?: string }).first_name;
          const lastName = (evt.data as { last_name?: string }).last_name;

          const usernameConflict = await User.findOne({ username })
            .select("clerkId")
            .lean();

          const updateOps: Record<string, unknown> = {
            $set: {
              ...(usernameConflict && usernameConflict.clerkId !== evt.data.id
                ? {}
                : { username }),
              ...(email ? { email } : {}),
              ...(profileImage ? { profileImage } : {}),
              ...(firstName ? { firstName } : {}),
              ...(lastName ? { lastName } : {}),
            },
          };

          const session = await mongoose.startSession();
          try {
            session.startTransaction();

            const updatedUser = await User.findOneAndUpdate(
              { clerkId: evt.data.id },
              updateOps,
              { returnDocument: "after", upsert: true, session },
            );

            if (updatedUser) {
              await propagateUserSnapshotUpdates(
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
            }

            await session.commitTransaction();
          } catch (propagationError: unknown) {
            try {
              await session.abortTransaction();
            } catch {
              // ignore
            }

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
                "Clerk user.updated webhook failed",
                propagationError,
              );
              return res.status(500).json({ success: false });
            }

            logger.warn(
              "Transactions not supported; falling back to awaited non-transactional propagation for Clerk webhook",
              { clerkId: evt.data.id },
            );

            const updatedUser = await User.findOneAndUpdate(
              { clerkId: evt.data.id },
              updateOps,
              { returnDocument: "after", upsert: true },
            );

            if (updatedUser) {
              await propagateUserSnapshotUpdates({
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
            }
          } finally {
            session.endSession();
          }

          logger.info("User updated via Clerk webhook + snapshots propagated", {
            clerkId: evt.data.id,
          });
          break;
        }

        case "user.deleted": {
          const userId = evt.data.id;

          if (!userId) {
            logger.warn("Clerk user.deleted received without user id", {
              eventType,
            });
            break;
          }

          // Cascade delete all user data
          // We use dynamic imports or assume models are available
          const { Post } = await import("../models/Post.model.js");
          const { Story } = await import("../models/Story.model.js");
          const { Poll } = await import("../models/Poll.model.js");
          const { PollVote } = await import("../models/PollVote.model.js");
          const { Reaction } = await import("../models/Reaction.model.js");
          const { ChatMessage } =
            await import("../models/ChatMessage.model.js");
          const { Notification } =
            await import("../models/Notification.model.js");
          const { Bookmark } = await import("../models/Bookmark.model.js");
          const { Follow } = await import("../models/Follow.model.js");
          const { Comment } = await import("../models/Comment.model.js");
          const { CommentLike } = await import("../models/CommentLike.model.js");

          // Run these in parallel for speed
          await Promise.all([
            User.findOneAndDelete({ clerkId: userId }),
            Post.deleteMany({ "author.clerkId": userId }),
            Story.deleteMany({ "author.clerkId": userId }),
            Poll.deleteMany({ "author.clerkId": userId }),
            PollVote.deleteMany({ userId }),
            Reaction.deleteMany({ userId }),
            ChatMessage.deleteMany({ "author.clerkId": userId }),
            Notification.deleteMany({ userId }), // Notifications received by user
            Notification.deleteMany({ actorId: userId }), // Notifications triggered by user
            Bookmark.deleteMany({ userId }),
            Follow.deleteMany({ $or: [{ userId }, { followingId: userId }] }),
            Comment.deleteMany({ "author.clerkId": userId }),
            CommentLike.deleteMany({ userId }),
          ]);

          // References must be removed before the shared-asset guard can safely
          // determine which uploads are no longer in use.
          if (await deleteOwnedAssets(userId)) {
            throw new Error("Cloudinary account cleanup incomplete");
          }

          logger.info("User and related data deleted via Clerk webhook", {
            clerkId: userId,
          });
          break;
        }

        default:
          logger.info("Unhandled Clerk webhook event", { eventType });
      }

      return res.status(200).json({ success: true });
    } catch (err: unknown) {
      logger.error("Clerk webhook request failed", {
        message: err instanceof Error ? err.message : undefined,
        name: err instanceof Error ? err.name : undefined,
      });
      return signatureVerified
        ? res.status(500).json({ error: "Webhook processing failed" })
        : res.status(400).json({ error: "Invalid webhook signature" });
    }
  },
);

export default router;
