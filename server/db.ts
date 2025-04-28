import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure WebSockets for NeonDB connection
neonConfig.webSocketConstructor = ws;

// Verify that the DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}

// Create a connection pool
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  // Enable SSL to ensure secure connections to the database
  ssl: true,
});

// Initialize the Drizzle ORM with our schema
export const db = drizzle(pool, { schema });

// Log successful connection
pool.connect()
  .then(() => console.log('Connected to PostgreSQL database'))
  .catch(err => console.error('Database connection error:', err));