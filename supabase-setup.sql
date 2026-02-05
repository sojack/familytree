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

-- 2. Create the relationships table
-- Stores connections between family members (parent, spouse, etc.)
CREATE TABLE IF NOT EXISTS relationships (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('parent', 'spouse')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Prevent duplicate relationships
    UNIQUE(source_id, target_id, type)
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies for members
CREATE POLICY "Users can view own members"
    ON members
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own members"
    ON members
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own members"
    ON members
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own members"
    ON members
    FOR DELETE
    USING (auth.uid() = user_id);

-- 5. Create RLS Policies for relationships
CREATE POLICY "Users can view own relationships"
    ON relationships
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own relationships"
    ON relationships
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own relationships"
    ON relationships
    FOR DELETE
    USING (auth.uid() = user_id);

-- 6. Create indexes for performance
CREATE INDEX idx_members_user_id ON members(user_id);
CREATE INDEX idx_members_created_at ON members(created_at);
CREATE INDEX idx_relationships_user_id ON relationships(user_id);
CREATE INDEX idx_relationships_source ON relationships(source_id);
CREATE INDEX idx_relationships_target ON relationships(target_id);

-- ============================================
-- Migration: Add relationships to existing setup
-- ============================================
-- If you already have the members table, just run sections 2, 5, and 6
