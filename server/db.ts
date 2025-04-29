import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

// Verify that the DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}

// Create a connection pool
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Disable SSL for local Postgres container
  ssl: false,
});

// Initialize the Drizzle ORM with our schema
export const db = drizzle(pool, { schema });

// Log successful connection
pool
  .connect()
  .then(() => console.log("Connected to PostgreSQL database"))
  .catch((err) => console.error("Database connection error:", err));
