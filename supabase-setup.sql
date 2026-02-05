-- ============================================
-- Family Tree App - Database Setup
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Create the members table
-- Stores family member information, linked to auth.users
CREATE TABLE IF NOT EXISTS members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    birth_year INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies

-- Policy: Users can only SELECT their own members
CREATE POLICY "Users can view own members"
    ON members
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can only INSERT their own members
CREATE POLICY "Users can insert own members"
    ON members
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only UPDATE their own members
CREATE POLICY "Users can update own members"
    ON members
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only DELETE their own members
CREATE POLICY "Users can delete own members"
    ON members
    FOR DELETE
    USING (auth.uid() = user_id);

-- 4. Create indexes for better performance
CREATE INDEX idx_members_user_id ON members(user_id);
CREATE INDEX idx_members_created_at ON members(created_at);

-- 5. Optional: Add some sample data for testing
-- (Remove these if you don't want test data)
-- INSERT INTO members (user_id, name, birth_year)
-- SELECT 
--     auth.uid(),  -- Only works if you run this while logged in via SQL Editor
--     'Grandma Rose',
--     1950;

-- ============================================
-- Verification Queries (run these to check)
-- ============================================

-- Check table structure
-- SELECT * FROM information_schema.columns WHERE table_name = 'members';

-- Check RLS is enabled
-- SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'members';

-- List all policies
-- SELECT * FROM pg_policies WHERE tablename = 'members';
