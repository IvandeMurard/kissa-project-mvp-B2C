-- Migration : Notes personnelles (onglet SLEEVE)
-- Run in Supabase SQL Editor.

ALTER TABLE albums ADD COLUMN IF NOT EXISTS personal_notes text;
