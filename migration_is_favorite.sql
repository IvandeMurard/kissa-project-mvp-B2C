-- Migration: is_favorite for Favorites filter
-- Run in Supabase SQL Editor.
-- Adds is_favorite (boolean) to albums so the frontend filter works.

ALTER TABLE albums ADD COLUMN IF NOT EXISTS is_favorite boolean DEFAULT false;
