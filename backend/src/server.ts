import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import helmet from "helmet";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { env } from "./config/env.config.js";
import {
  corsOptions,
  getSocketCorsOptions,
  logCorsConfig,
} from "./config/cors.config.js";
import { connectDB } from "./config/db.config.js";
import { setSocketIO } from "./config/socket.config.js";
import { ensureIndexes } from "./utils/indexes.util.js";
import { startPollExpiryJob } from "./jobs/poll.cron.js";
import { logger } from "./utils/logger.util.js";
import { setupChatSocket } from "./sockets/chat.socket.js";
import { setupNotificationSocket } from "./sockets/notification.socket.js";
import { setupFeedSocket } from "./sockets/feed.socket.js";
import webhookRoutes from "./routes/webhook.routes.js";
import healthRoutes from "./routes/health.routes.js";
import apiRouter from "./routes/index.js";
import { clerkMiddleware } from "@clerk/express";
import { verifyToken } from "@clerk/backend";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger.config.js";
import { swaggerUiOptions } from "./config/swagger-ui.config.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { requestLogger } from "./middlewares/requestLogger.middleware.js";

// --- Initialize Express ---
const app = express();
// Set this to the number of trusted reverse proxies only when direct access is blocked.
app.set("trust proxy", env.TRUST_PROXY_HOPS);

// Security Headers with CSP and HSTS
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:", "blob:"], // Allow Cloudinary images
        connectSrc: ["'self'", env.FRONTEND_URL || "http://localhost:5173"],
        fontSrc: ["'self'", "data:"],
        objectSrc: ["'none'"], // Disallow Flash/Java applets
        mediaSrc: ["'self'", "https:"], // Allow video/audio from Cloudinary
        frameSrc: ["'none'"], // Prevent clickjacking via frames
        upgradeInsecureRequests: [], // Upgrade HTTP to HTTPS
      },
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true, // Allow browser preload list
    },
    referrerPolicy: {
      policy: "strict-origin-when-cross-origin",
    },
    xFrameOptions: { action: "deny" }, // Prevent clickjacking
    crossOriginEmbedderPolicy: false, // Disable for API compatibility
    crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow Cloudinary resources
  }),
);

// Configure CORS (imported from cors.config.ts)
app.use(cors(corsOptions));

// Request logging
app.use(requestLogger);

// API Documentation (Must be before health and other catch-alls)
if (env.NODE_ENV !== "production" || env.ENABLE_API_DOCS === "true") {
  app.use(
    "/api-docs",
    helmet.contentSecurityPolicy({
      directives: {
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    }),
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, swaggerUiOptions),
  );
}

// Health check routes (no auth required, before body parsing)
app.use("/health", healthRoutes);

// Because Clerk webhooks need raw body for signature verification
app.use("/api/webhooks", webhookRoutes);

// Parse JSON body for all other routes (limit prevents oversized payloads)
app.use(express.json({ limit: "1mb" }));

// 🔐 Clerk middleware
app.use(clerkMiddleware());

// Centralized API Routes
app.use("/api", apiRouter);

// --- Simple test route ---
app.get("/", (_, res) => {
  res.send("Quad API is running 🚀");
});

app.use(errorHandler);

// --- Initialize HTTP server and Socket.IO ---
const server = createServer(app);

// Configure Socket.IO with proper CORS (imported from cors.config.ts)
const io = new SocketIOServer(server, {
  cors: getSocketCorsOptions(),
  // Additional Socket.IO options for production
  pingTimeout: env.SOCKET_PING_TIMEOUT_MS,
  pingInterval: env.SOCKET_PING_INTERVAL_MS,
  transports: ["websocket", "polling"],
});

// Set the Socket.IO instance globally
setSocketIO(io);

// Socket.IO authentication middleware — verify Clerk token on connection
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    logger.warn(`Socket auth rejected (no token): ${socket.id}`);
    return next(new Error("Authentication required"));
  }

  try {
    // 🔐 Verify Clerk session token
    // The frontend sends the Clerk session token (obtained via getToken())
    const verified = await verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY,
    });

    // Store the clerkId (sub) from the verified token for downstream handlers
    socket.data.userId = verified.sub;

    logger.debug(`Socket authenticated for user: ${verified.sub}`);
    next();
  } catch (error) {
    logger.error(`Socket auth failed (invalid token): ${socket.id}`, error);
    next(new Error("Invalid authentication token"));
  }
});

// Setup chat socket handlers
setupChatSocket(io);

// Setup notification socket handlers
setupNotificationSocket(io);

// Setup feed socket handlers
setupFeedSocket(io);

// Socket.IO connection logging
io.on("connection", (socket) => {
  logger.socket(`User connected (userId: ${socket.data.userId})`, socket.id);
  socket.on("disconnect", () => {
    logger.socket("User disconnected", socket.id);
  });
});

// --- Start server after DB connection ---
const startServer = async () => {
  try {
    await connectDB(); // Connect to MongoDB first
    await ensureIndexes(); // Create database indexes
    startPollExpiryJob(); // Start poll expiry cron job
    logCorsConfig(); // Log CORS configuration
    server.listen(env.PORT, () => {
      logger.server(`Server running on port ${env.PORT}`);
    });

    // Set server timeout to 5 minutes (configured via SERVER_TIMEOUT_MS) to support large file uploads
    server.setTimeout(env.SERVER_TIMEOUT_MS);
  } catch (error) {
    logger.error("Failed to start server", error);
    process.exit(1);
  }
};

startServer().catch((error) => {
  logger.error("Unhandled error during startup", error);
  process.exit(1);
});

// --- Graceful Shutdown ---
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  
  // Close Socket.IO first (gracefully disconnects clients)
  io.close(() => {
    logger.info("Socket.IO server closed.");
    
    // Then close HTTP server
    server.close(() => {
      logger.info("HTTP server closed.");
      
      // Finally close database connection
      mongoose.connection.close().then(() => {
        logger.info("MongoDB connection closed.");
        process.exit(0);
      });
    });
  });
  
  // Force exit after 10s if graceful shutdown hangs
  setTimeout(() => {
    logger.error("Graceful shutdown timed out, forcing exit.");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
