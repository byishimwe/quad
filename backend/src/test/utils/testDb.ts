import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { mkdtemp, rm } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

let mongoServer: MongoMemoryServer | null = null;
let mongoDir: string | null = null;

async function removeMongoDir(): Promise<void> {
  if (!mongoDir) return;
  const workspace = resolve(process.cwd());
  const target = resolve(mongoDir);
  if (!target.startsWith(workspace + sep) || !target.split(sep).at(-1)?.startsWith(".mongo-test-")) {
    throw new Error("Refusing to remove MongoDB test data outside the workspace");
  }
  await rm(target, { recursive: true, force: true });
  mongoDir = null;
}

export const startTestDb = async (): Promise<string> => {
  if (!mongoServer) {
    // Windows MongoDB can fail when its data path contains spaces in the user temp path.
    mongoDir = await mkdtemp(join(process.cwd(), ".mongo-test-"));
    try {
      mongoServer = await MongoMemoryServer.create({
        instance: { dbPath: mongoDir, launchTimeout: 60_000 },
      });
    } catch (error) {
      await removeMongoDir();
      throw error;
    }
  }

  const uri = mongoServer.getUri("quad_test");

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(uri);
  }

  return uri;
};

export const clearTestDb = async (): Promise<void> => {
  const collections = mongoose.connection.collections;
  const ops = Object.values(collections).map((collection) => collection.deleteMany({}));
  await Promise.all(ops);
};

export const stopTestDb = async (): Promise<void> => {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  } finally {
    if (mongoServer) {
      await mongoServer.stop();
      mongoServer = null;
    }
    await removeMongoDir();
  }
};
