-- Moltbot Database Initialization
-- This script runs when the PostgreSQL container is first created

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE moltbot TO moltbot;

-- Create schemas (optional, for organization)
-- CREATE SCHEMA IF NOT EXISTS moltbot;

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'Moltbot database initialized successfully';
END $$;
