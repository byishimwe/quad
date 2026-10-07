import mongoose, { Schema } from "mongoose";

interface UploadedAsset {
  ownerClerkId: string;
  url: string;
  publicId: string;
  resourceType: "image" | "video";
  createdAt: Date;
}

const uploadedAssetSchema = new Schema<UploadedAsset>({
  ownerClerkId: { type: String, required: true, index: true },
  url: { type: String, required: true, unique: true },
  publicId: { type: String, required: true, unique: true },
  resourceType: { type: String, enum: ["image", "video"], required: true },
  createdAt: { type: Date, default: Date.now },
});

export const UploadedAsset = mongoose.model<UploadedAsset>("UploadedAsset", uploadedAssetSchema);
