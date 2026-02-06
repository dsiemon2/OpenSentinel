-- OpenSentinel Database Initialization
-- This script runs when the PostgreSQL container is first created

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE opensentinel TO opensentinel;

-- Create schemas (optional, for organization)
-- CREATE SCHEMA IF NOT EXISTS opensentinel;

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'OpenSentinel database initialized successfully';
END $$;
