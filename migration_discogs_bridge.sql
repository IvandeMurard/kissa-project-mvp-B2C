-- Migration : Discogs Bridge (discogs_id + tags sur albums)
-- À exécuter manuellement dans Supabase SQL Editor

-- Colonne discogs_id pour dédoublonnage et cohérence avec le frontend
ALTER TABLE albums ADD COLUMN IF NOT EXISTS discogs_id integer UNIQUE;

-- Colonne tags pour le tag "Imported" sur les albums importés par lots
ALTER TABLE albums ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
