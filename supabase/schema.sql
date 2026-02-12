-- Videomaker Log - Supabase Schema
-- Run this in Supabase SQL Editor

-- 1. Profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  email TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('master', 'member')),
  user_color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)), NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Meetings table
CREATE TABLE public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  meeting_date DATE NOT NULL,
  progress_review TEXT NOT NULL DEFAULT '',
  deliverable_review TEXT NOT NULL DEFAULT '',
  retrospective TEXT NOT NULL DEFAULT '',
  next_week_plan TEXT NOT NULL DEFAULT '',
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  edited_by UUID REFERENCES public.profiles(id),
  edited_at TIMESTAMPTZ,
  edit_status TEXT NOT NULL DEFAULT 'original' CHECK (edit_status IN ('original', 'edited')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON public.meetings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_meetings_date ON public.meetings(meeting_date DESC);

-- 3. Resources table (chat messages)
CREATE TABLE public.resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  url TEXT,
  author_id UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON public.resources FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_resources_created ON public.resources(created_at DESC);

-- Enable Realtime for resources
ALTER PUBLICATION supabase_realtime ADD TABLE public.resources;

-- 4. Tasks table (kanban)
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  assignee_id UUID REFERENCES public.profiles(id),
  position INTEGER NOT NULL DEFAULT 0,
  archived_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  checklist JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON public.tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_tasks_status ON public.tasks(status, position);
CREATE INDEX idx_tasks_archived ON public.tasks(archived_at) WHERE archived_at IS NOT NULL;

-- 5. Portfolio items table
CREATE TABLE public.portfolio_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT NOT NULL,
  video_type TEXT NOT NULL CHECK (video_type IN ('youtube', 'instagram', 'other')),
  video_id TEXT NOT NULL,
  thumbnail_url TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  account TEXT,
  upload_date TEXT,
  view_count INTEGER,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON public.portfolio_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public can view all" ON public.portfolio_items FOR SELECT TO anon USING (true);
CREATE INDEX idx_portfolio_tags ON public.portfolio_items USING GIN(tags);

-- 6. Email queue table
CREATE TABLE public.email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_queue_pending ON public.email_queue(scheduled_for) WHERE sent_at IS NULL;

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.meetings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.portfolio_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Migration SQL (run separately if upgrading from existing schema):
-- ALTER TABLE public.profiles ADD COLUMN role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('master', 'member'));
-- ALTER TABLE public.profiles ADD COLUMN user_color TEXT;
-- ALTER TABLE public.meetings ADD COLUMN edited_by UUID REFERENCES public.profiles(id);
-- ALTER TABLE public.meetings ADD COLUMN edited_at TIMESTAMPTZ;
-- ALTER TABLE public.meetings ADD COLUMN edit_status TEXT NOT NULL DEFAULT 'original' CHECK (edit_status IN ('original', 'edited'));
-- ALTER TABLE public.tasks ADD COLUMN archived_at TIMESTAMPTZ;
-- CREATE INDEX idx_tasks_archived ON public.tasks(archived_at) WHERE archived_at IS NOT NULL;
-- ALTER TABLE public.portfolio_items DROP COLUMN is_public;
-- DROP POLICY "Public can view published" ON public.portfolio_items;
-- CREATE POLICY "Public can view all" ON public.portfolio_items FOR SELECT TO anon USING (true);
-- DROP INDEX idx_portfolio_public;
-- UPDATE public.profiles SET role = 'master' WHERE id = (SELECT id FROM auth.users WHERE email = 'redant23ai@gmail.com');

-- Board: checklist column
-- ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS checklist JSONB DEFAULT '[]';

-- Portfolio: upload_date, view_count columns
-- ALTER TABLE public.portfolio_items ADD COLUMN IF NOT EXISTS upload_date TEXT;
-- ALTER TABLE public.portfolio_items ADD COLUMN IF NOT EXISTS view_count INTEGER;

-- Email column migration (for @mention email notifications):
-- ALTER TABLE public.profiles ADD COLUMN email TEXT;
-- UPDATE public.profiles SET email = au.email FROM auth.users au WHERE profiles.id = au.id;
-- CREATE OR REPLACE FUNCTION public.handle_new_user()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   INSERT INTO public.profiles (id, display_name, email)
--   VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)), NEW.email);
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;
