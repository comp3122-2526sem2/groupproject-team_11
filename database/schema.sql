-- ============================================================
-- Supabase PostgreSQL Schema for Math Exploration Hub
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Saved Problems (Geometry + Algebra)
CREATE TABLE IF NOT EXISTS saved_problems (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     TEXT NOT NULL,
    type        TEXT NOT NULL CHECK (type IN ('geometry', 'algebra')),
    title       TEXT NOT NULL DEFAULT '',
    topic       TEXT NOT NULL DEFAULT '',
    subtopic    TEXT,
    difficulty  TEXT NOT NULL DEFAULT 'DSE_Level_4',
    question_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    variables   JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for listing user's problems efficiently
CREATE INDEX IF NOT EXISTS idx_saved_problems_user
    ON saved_problems (user_id, created_at DESC);

-- 2. Learning Plans
CREATE TABLE IF NOT EXISTS learning_plans (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         TEXT NOT NULL,
    assessment_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    plan_data       JSONB NOT NULL DEFAULT '{}'::jsonb,
    module_progress JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learning_plans_user
    ON learning_plans (user_id, created_at DESC);

-- 3. Solver Attempts (Problem Solver step-by-step records)
CREATE TABLE IF NOT EXISTS solver_attempts (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         TEXT NOT NULL,
    problem_text    TEXT NOT NULL DEFAULT '',
    steps           JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_steps     INTEGER NOT NULL DEFAULT 0,
    is_completed    BOOLEAN NOT NULL DEFAULT FALSE,
    summary         TEXT,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ,
    duration_seconds INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_solver_attempts_user
    ON solver_attempts (user_id, started_at DESC);

-- ============================================================
-- Row Level Security (RLS)
-- For demo/prototype: RLS disabled. 
-- In production, enable RLS and add policies.
-- ============================================================
-- ALTER TABLE saved_problems ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE learning_plans ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE solver_attempts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Auto-update updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_saved_problems_updated_at
    BEFORE UPDATE ON saved_problems
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_learning_plans_updated_at
    BEFORE UPDATE ON learning_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
