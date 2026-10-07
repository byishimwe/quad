import { Router } from "express";
import { validateSchema } from "../utils/validation.util.js";
import { requireApiAuth } from "../middlewares/auth.middleware.js";
import {
  createPollSchema,
  updatePollSchema,
  voteOnPollSchema,
  pollIdSchema,
  getPollsQuerySchema,
} from "../schemas/poll.schema.js";
import {
  createPoll,
  getAllPolls,
  getPollById,
  getMyPolls,
  updatePoll,
  deletePoll,
  voteOnPoll,
} from "../controllers/poll.controller.js";

const router = Router();

// ===========================
// POLL CRUD ROUTES
// ===========================

/**
 * @openapi
 * /polls:
 *   post:
 *     summary: Create a new poll
 *     tags: [Polls]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreatePoll'
 *     responses:
 *       201:
 *         description: Poll created successfully
 */
router.post(
  "/",
  requireApiAuth,
  validateSchema(createPollSchema, "body"),
  createPoll,
);

/**
 * @openapi
 * /polls:
 *   get:
 *     summary: Get all polls
 *     tags: [Polls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, expired, closed, all]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of polls
 */
router.get(
  "/",
  requireApiAuth,
  validateSchema(getPollsQuerySchema, "query"),
  getAllPolls,
);

// Get my polls (polls created by current user)
router.get("/me", requireApiAuth, getMyPolls);

// Get poll by ID
router.get(
  "/:id",
  requireApiAuth,
  validateSchema(pollIdSchema, "params"),
  getPollById,
);

// Update poll (author only)
router.put(
  "/:id",
  requireApiAuth,
  validateSchema(pollIdSchema, "params"),
  validateSchema(updatePollSchema, "body"),
  updatePoll,
);

// Delete poll (author only)
router.delete(
  "/:id",
  requireApiAuth,
  validateSchema(pollIdSchema, "params"),
  deletePoll,
);

// ===========================
// VOTING ROUTES
// ===========================

// Vote on poll
router.post(
  "/:id/vote",
  requireApiAuth,
  validateSchema(pollIdSchema, "params"),
  validateSchema(voteOnPollSchema, "body"),
  voteOnPoll,
);

export default router;
