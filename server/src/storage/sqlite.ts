import { IStorage } from "./interface";
import { Reaction } from "@shared/schema";
import sqlite3 from "sqlite3";

interface DBRow {
  id: number;
  messageId: number;
  userId: number;
  emoji: string;
  name: string;
  createdAt: string;
  userDisplayName: string;
}

export class SQLiteStorage implements IStorage {
  private db: sqlite3.Database;

  constructor(db: sqlite3.Database) {
    this.db = db;
  }

  // ... existing methods ...

  async getMessageReactions(messageId: number): Promise<Reaction[]> {
    const query = `
      SELECT r.*, u.displayName as userDisplayName
      FROM reactions r
      JOIN users u ON r.userId = u.id
      WHERE r.messageId = ?
      ORDER BY r.createdAt ASC
    `;

    const rows = await this.db.all(query, [messageId]);
    return rows.map((row: DBRow) => ({
      id: row.id,
      messageId: row.messageId,
      emoji: row.emoji,
      name: row.name,
      userId: row.userId,
      createdAt: new Date(row.createdAt),
      user: {
        id: row.userId,
        displayName: row.userDisplayName,
      },
    }));
  }

  async toggleReaction(
    messageId: number,
    userId: number,
    emoji: string,
    name: string
  ): Promise<Reaction[]> {
    // First check if the reaction exists
    const existingReaction = await this.db.get(
      "SELECT * FROM reactions WHERE messageId = ? AND userId = ? AND emoji = ?",
      [messageId, userId, emoji]
    );

    if (existingReaction) {
      // If it exists, remove it
      await this.db.run("DELETE FROM reactions WHERE id = ?", [
        existingReaction.id,
      ]);
    } else {
      // If it doesn't exist, add it
      await this.db.run(
        "INSERT INTO reactions (messageId, userId, emoji, name, createdAt) VALUES (?, ?, ?, ?, ?)",
        [messageId, userId, emoji, name, new Date().toISOString()]
      );
    }

    // Return updated list of reactions
    return this.getMessageReactions(messageId);
  }

  // ... existing methods ...
}
