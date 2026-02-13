-- Migration : Dominant color & hue for Rainbow Shelf
-- Run in Supabase SQL Editor.
-- Adds dominant_color (hex, e.g. #3a7d44) and dominant_hue (0-360) for sorting by cover color.

ALTER TABLE albums ADD COLUMN IF NOT EXISTS dominant_color text;
ALTER TABLE albums ADD COLUMN IF NOT EXISTS dominant_hue real;
