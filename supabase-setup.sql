-- ============================================
-- Family Tree App - Database Setup
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Create the trees table
-- Each tree is owned by a user and acts as the top-level grouping
CREATE TABLE IF NOT EXISTS trees (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'My Family Tree',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create the members table
-- Stores family member information, linked to a tree
CREATE TABLE IF NOT EXISTS members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tree_id UUID NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    birth_year INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create the relationships table
-- Stores connections between family members (parent, spouse, etc.)
CREATE TABLE IF NOT EXISTS relationships (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tree_id UUID NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
    source_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('parent', 'spouse')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Prevent duplicate relationships
    UNIQUE(source_id, target_id, type)
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE trees ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS Policies for trees (owner-only CRUD)
CREATE POLICY "Owners can view own trees"
    ON trees
    FOR SELECT
    USING (auth.uid() = owner_id);

CREATE POLICY "Owners can insert own trees"
    ON trees
    FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update own trees"
    ON trees
    FOR UPDATE
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can delete own trees"
    ON trees
    FOR DELETE
    USING (auth.uid() = owner_id);

-- 6. Create RLS Policies for members (via tree ownership)
CREATE POLICY "Users can view members in own trees"
    ON members
    FOR SELECT
    USING (EXISTS (SELECT 1 FROM trees WHERE trees.id = members.tree_id AND trees.owner_id = auth.uid()));

CREATE POLICY "Users can insert members in own trees"
    ON members
    FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM trees WHERE trees.id = members.tree_id AND trees.owner_id = auth.uid()));

CREATE POLICY "Users can update members in own trees"
    ON members
    FOR UPDATE
    USING (EXISTS (SELECT 1 FROM trees WHERE trees.id = members.tree_id AND trees.owner_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM trees WHERE trees.id = members.tree_id AND trees.owner_id = auth.uid()));

CREATE POLICY "Users can delete members in own trees"
    ON members
    FOR DELETE
    USING (EXISTS (SELECT 1 FROM trees WHERE trees.id = members.tree_id AND trees.owner_id = auth.uid()));

-- 7. Create RLS Policies for relationships (via tree ownership)
CREATE POLICY "Users can view relationships in own trees"
    ON relationships
    FOR SELECT
    USING (EXISTS (SELECT 1 FROM trees WHERE trees.id = relationships.tree_id AND trees.owner_id = auth.uid()));

CREATE POLICY "Users can insert relationships in own trees"
    ON relationships
    FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM trees WHERE trees.id = relationships.tree_id AND trees.owner_id = auth.uid()));

CREATE POLICY "Users can delete relationships in own trees"
    ON relationships
    FOR DELETE
    USING (EXISTS (SELECT 1 FROM trees WHERE trees.id = relationships.tree_id AND trees.owner_id = auth.uid()));

-- 8. Create indexes for performance
CREATE INDEX idx_trees_owner_id ON trees(owner_id);
CREATE INDEX idx_members_tree_id ON members(tree_id);
CREATE INDEX idx_members_created_at ON members(created_at);
CREATE INDEX idx_relationships_tree_id ON relationships(tree_id);
CREATE INDEX idx_relationships_source ON relationships(source_id);
CREATE INDEX idx_relationships_target ON relationships(target_id);

-- 9. Auto-create a default tree on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.trees (owner_id, name)
    VALUES (NEW.id, 'My Family Tree');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- Migration: From user_id to tree_id schema
-- ============================================
-- If you have existing data with user_id columns, run this migration:
--
-- Step 1: Create trees for existing users
--   INSERT INTO trees (owner_id, name)
--   SELECT DISTINCT user_id, 'My Family Tree'
--   FROM members
--   ON CONFLICT DO NOTHING;
--
-- Step 2: Add tree_id column and backfill
--   ALTER TABLE members ADD COLUMN tree_id UUID REFERENCES trees(id) ON DELETE CASCADE;
--   UPDATE members SET tree_id = (SELECT id FROM trees WHERE trees.owner_id = members.user_id LIMIT 1);
--   ALTER TABLE members ALTER COLUMN tree_id SET NOT NULL;
--   ALTER TABLE members DROP COLUMN user_id;
--
--   ALTER TABLE relationships ADD COLUMN tree_id UUID REFERENCES trees(id) ON DELETE CASCADE;
--   UPDATE relationships SET tree_id = (SELECT id FROM trees WHERE trees.owner_id = relationships.user_id LIMIT 1);
--   ALTER TABLE relationships ALTER COLUMN tree_id SET NOT NULL;
--   ALTER TABLE relationships DROP COLUMN user_id;
--
-- Step 3: Drop old indexes and create new ones
--   DROP INDEX IF EXISTS idx_members_user_id;
--   DROP INDEX IF EXISTS idx_relationships_user_id;
--   (Then run the CREATE INDEX statements from section 8 above)
--
-- Step 4: Drop old RLS policies and create new ones
--   (Drop old policies, then run sections 5-7 above)
