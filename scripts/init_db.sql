-- Initial DB setup (runs once on fresh postgres container)
-- Idempotent — safe to re-run

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE asset_inventory TO asset_user;
