import express from "express";
import cors from "cors";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createCorsOptions } from "../../config/cors.config.js";
import { limitWrites } from "../../middlewares/rateLimiter.middleware.js";
import { errorHandler } from "../../middlewares/error.middleware.js";

describe("production request middleware", () => {
  it("allows configured browser origins, preflight, and no-Origin server traffic", async () => {
    const app = express();
    app.use(cors(createCorsOptions(true, ["https://joinquad.vercel.app"])));
    app.get("/health", (_req, res) => res.sendStatus(200));
    app.post("/api/webhooks/clerk", (_req, res) => res.sendStatus(200));
    app.use(errorHandler);

    const browser = await request(app).get("/health").set("Origin", "https://joinquad.vercel.app");
    expect(browser.status).toBe(200);
    expect(browser.headers["access-control-allow-origin"]).toBe("https://joinquad.vercel.app");
    expect((await request(app).get("/health").set("Origin", "https://evil.example")).status).toBe(403);
    expect((await request(app).get("/health")).status).toBe(200);
    expect((await request(app).post("/api/webhooks/clerk")).status).toBe(200);
    const preflight = await request(app).options("/api/webhooks/clerk")
      .set("Origin", "https://joinquad.vercel.app")
      .set("Access-Control-Request-Method", "POST");
    expect(preflight.status).toBe(204);
  });

  it("does not charge GET requests to the write quota", async () => {
    const app = express();
    app.use(limitWrites);
    app.get("/resource", (_req, res) => res.sendStatus(200));
    app.post("/resource", (_req, res) => res.sendStatus(200));
    for (let i = 0; i < 125; i++) {
      expect((await request(app).get("/resource")).status).toBe(200);
    }
    expect((await request(app).post("/resource")).status).toBe(200);
  });

  it("trusts only the configured proxy hop", async () => {
    const app = express();
    app.set("trust proxy", 1);
    app.get("/ip", (req, res) => res.json({ ip: req.ip }));
    const response = await request(app).get("/ip")
      .set("X-Forwarded-For", "203.0.113.1, 198.51.100.2");
    expect(response.body.ip).toBe("198.51.100.2");
  });
});
