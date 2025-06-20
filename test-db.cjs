const { Pool } = require("pg");
const bcrypt = require("bcrypt");

const pool = new Pool({
  connectionString:
    "postgresql://eventsentinel:eventsentinel123@localhost:5432/eventsentinel",
});

async function testRegistration() {
  try {
    console.log("Testing database operations...");

    // Test 1: Check if we can connect to the database
    const client = await pool.connect();
    console.log("✅ Database connection successful");

    // Test 2: Check if tables exist
    const tablesResult = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
    );
    console.log(
      "✅ Tables found:",
      tablesResult.rows.map((r) => r.tablename)
    );

    // Test 3: Try to insert a user
    const hashedPassword = await bcrypt.hash("testpass123", 10);
    const insertResult = await client.query(
      "INSERT INTO users (username, password, display_name, status) VALUES ($1, $2, $3, $4) RETURNING *",
      ["testuser_direct", hashedPassword, "Test User Direct", "online"]
    );
    console.log("✅ User created successfully:", insertResult.rows[0]);

    // Test 4: Try to create a workspace
    const workspaceResult = await client.query(
      "INSERT INTO workspaces (name, owner_id, icon_text, icon_color) VALUES ($1, $2, $3, $4) RETURNING *",
      ["Test Workspace", insertResult.rows[0].id, "T", "#3b82f6"]
    );
    console.log("✅ Workspace created successfully:", workspaceResult.rows[0]);

    client.release();
    console.log("✅ All database operations successful!");
  } catch (error) {
    console.error("❌ Database test failed:", error);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      detail: error.detail,
    });
  } finally {
    await pool.end();
  }
}

testRegistration();
