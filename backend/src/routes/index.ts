import { Router } from "express";
import {
  generalRateLimiter,
  uploadRateLimiter,
  limitWrites,
} from "../middlewares/rateLimiter.middleware.js";
import userRoutes from "./user.routes.js";
import postRoutes from "./post.routes.js";
import storyRoutes from "./story.routes.js";
import pollRoutes from "./poll.routes.js";
import chatRoutes from "./chat.routes.js";
import profileRoutes from "./profile.routes.js";
import followRoutes from "./follow.routes.js";
import notificationRoutes from "./notification.routes.js";
import feedRoutes from "./feed.routes.js";
import reactionRoutes from "./reaction.routes.js";
import commentRoutes from "./comment.routes.js";
import bookmarkRoutes from "./bookmark.routes.js";
import uploadRoutes from "./upload.routes.js";

const router = Router();

// Apply general rate limiting to all API routes
router.use(generalRateLimiter);
router.use((req, res, next) => req.path.startsWith("/upload") ? next() : limitWrites(req, res, next));

router.use("/users", userRoutes);
router.use("/posts", postRoutes);
router.use("/stories", storyRoutes);
router.use("/polls", pollRoutes);
router.use("/chat", chatRoutes);
router.use("/profile", profileRoutes);
router.use("/follow", followRoutes);
router.use("/notifications", notificationRoutes);
router.use("/feed", feedRoutes);
router.use("/reactions", reactionRoutes);
router.use("/comments", commentRoutes);
router.use("/bookmarks", bookmarkRoutes);
router.use("/upload", (req, res, next) => {
  if (req.method === "POST") return uploadRateLimiter(req, res, next);
  next();
}, uploadRoutes);

export default router;
