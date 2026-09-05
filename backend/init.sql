-- Database initialization script
-- Runs automatically on first PostgreSQL container startup

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create indexes for better performance (will be created by Alembic but good to have)
-- These are handled by Alembic migrations

-- Insert default admin user (password will be hashed by application on first login)
-- The application handles user creation via API

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE label_compliance TO label_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO label_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO label_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO label_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO label_user;