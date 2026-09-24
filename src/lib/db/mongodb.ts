import mongoose from "mongoose";
import { PrepKit } from "@/types/kit";
import fs from "fs";
import path from "path";

// Memory / Local File Cache Fallback for Zero-Config Local Runs
class LocalStore {
  private users: Map<string, any> = new Map();
  private kits: Map<string, any> = new Map();
  private filePath: string;

  constructor() {
    this.filePath = path.resolve(process.cwd(), ".local-db.json");
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = JSON.parse(fs.readFileSync(this.filePath, "utf-8"));
        if (data.users) this.users = new Map(Object.entries(data.users));
        if (data.kits) this.kits = new Map(Object.entries(data.kits));
      }
    } catch {
      // start clean
    }
  }

  private save() {
    try {
      const data = {
        users: Object.fromEntries(this.users.entries()),
        kits: Object.fromEntries(this.kits.entries()),
      };
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), "utf-8");
    } catch {
      // silent
    }
  }

  // Users
  async findUserByEmail(email: string) {
    const userList = Array.from(this.users.values());
    for (const u of userList) {
      if (u.email.toLowerCase() === email.toLowerCase()) return u;
    }
    return null;
  }

  async findUserById(id: string) {
    return this.users.get(id) || null;
  }

  async createUser(user: { id: string; email: string; passwordHash: string; name?: string; createdAt: string }) {
    this.users.set(user.id, user);
    this.save();
    return user;
  }

  // Kits
  async saveKit(kitData: { id: string; userId: string; kit: PrepKit; createdAt: string; updatedAt: string }) {
    this.kits.set(kitData.id, kitData);
    this.save();
    return kitData;
  }

  async findKitById(id: string) {
    return this.kits.get(id) || null;
  }

  async findKitsByUserId(userId: string) {
    const list: any[] = [];
    const allKits = Array.from(this.kits.values());
    for (const k of allKits) {
      if (k.userId === userId) {
        list.push(k);
      }
    }
    // Sort newest first
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async updateKit(id: string, kit: PrepKit) {
    const existing = this.kits.get(id);
    if (!existing) return null;
    existing.kit = kit;
    existing.updatedAt = new Date().toISOString();
    this.kits.set(id, existing);
    this.save();
    return existing;
  }

  async deleteKit(id: string, userId: string) {
    const existing = this.kits.get(id);
    if (!existing || existing.userId !== userId) return false;
    this.kits.delete(id);
    this.save();
    return true;
  }
}

export const localStore = new LocalStore();

// Optional MongoDB Connection
let isConnected = false;

export async function connectDB() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri || uri === "mongodb://localhost:27017/interview_prep_db") {
    // If no explicit remote MongoDB URI is configured, use fast local store
    return null;
  }

  if (isConnected) return mongoose.connection;

  try {
    const db = await mongoose.connect(uri, {
      bufferCommands: false,
    });
    isConnected = true;
    return db.connection;
  } catch (err: any) {
    console.warn(`[MongoDB] Connection failed (${err.message}). Using resilient local store.`);
    return null;
  }
}
