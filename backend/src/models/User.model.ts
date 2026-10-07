import mongoose, { Schema, Types, Document } from "mongoose";
import type { IUser } from "../types/user.types.js";

export interface IUserDocument
  extends Document<Types.ObjectId, unknown, IUser>, IUser {
  _id: Types.ObjectId;
}

const UserSchema = new Schema<IUserDocument>(
  {
    clerkId: { type: String, required: true, unique: true }, // Clerk user ID - AUTO INDEXED (unique)
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true }, // AUTO INDEXED (unique)
    displayName: { type: String },
    firstName: { type: String },
    lastName: { type: String },
    profileImage: { type: String },
    coverImage: { type: String },
    bio: { type: String },
    isVerified: { type: Boolean, default: false },
    followersCount: { type: Number, default: 0, min: 0 },
    followingCount: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true, // adds createdAt & updatedAt
  },
);

// ===========================
// INDEXES FOR PERFORMANCE
// ===========================
// Note: clerkId and email already have unique indexes (defined in schema)
// Index for searching users by creation date (e.g., newest users)
UserSchema.index({ createdAt: -1 });

// Text search index for user search

export const User = mongoose.model<IUserDocument>("User", UserSchema);
