-- Initialize the database for EventSentinel
-- This script runs when the PostgreSQL container starts for the first time

-- Create the database if it doesn't exist (this is already handled by POSTGRES_DB)
-- But we can add any additional setup here

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON DATABASE eventsentinel TO eventsentinel;

-- Create any extensions you might need
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- You can add any initial data or additional setup here
SELECT 'Database initialized successfully' as status; 