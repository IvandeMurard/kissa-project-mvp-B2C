-- Migration : Table settings pour la configuration des Moods
-- À exécuter manuellement dans Supabase SQL Editor

-- Créer la table settings si elle n'existe pas
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  mood_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insérer la configuration par défaut (ID 1)
INSERT INTO settings (id, mood_config)
VALUES (
  1,
  '{
    "#ef4444": "Peak Time / Banger",
    "#eab308": "Groove / Warm Up",
    "#3b82f6": "Deep / Mental",
    "#a855f7": "After / Hypnotic",
    "#22c55e": "Organic / Chill",
    "#171717": "Dark / Obscure"
  }'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Créer un trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
