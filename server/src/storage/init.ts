import sqlite3 from "sqlite3";

export async function initializeDatabase(db: sqlite3.Database): Promise<void> {
  // ... existing table creation ...

  // Create reactions table
  await db.run(`
    CREATE TABLE IF NOT EXISTS reactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      messageId INTEGER NOT NULL,
      userId INTEGER NOT NULL,
      emoji TEXT NOT NULL,
      name TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (messageId) REFERENCES messages(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // ... existing code ...
}
