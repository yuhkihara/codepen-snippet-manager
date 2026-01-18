-- Text Styles table for customizable toolbar options
-- Run this in Supabase SQL Editor

CREATE TABLE text_styles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
  html_template TEXT NOT NULL CHECK (char_length(html_template) <= 500),
  icon_color TEXT DEFAULT '#000000',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_id, name)
);

-- Index for faster lookups
CREATE INDEX idx_text_styles_owner ON text_styles(owner_id, sort_order);

-- Trigger for updated_at
CREATE TRIGGER text_styles_updated_at
  BEFORE UPDATE ON text_styles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE text_styles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "text_styles_select_own" ON text_styles
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "text_styles_insert_own" ON text_styles
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "text_styles_update_own" ON text_styles
  FOR UPDATE USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "text_styles_delete_own" ON text_styles
  FOR DELETE USING (auth.uid() = owner_id);
