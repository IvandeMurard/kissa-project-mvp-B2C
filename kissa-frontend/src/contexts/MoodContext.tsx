"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useMemo } from "react";

// Couleurs fixes (ne peuvent pas être modifiées)
const MOOD_COLORS = ['#ef4444', '#eab308', '#3b82f6', '#a855f7', '#22c55e', '#171717'];

// Labels par défaut (fallback)
const DEFAULT_MOOD_LABELS: Record<string, string> = {
  '#ef4444': 'Peak Time / Banger',
  '#eab308': 'Groove / Warm Up',
  '#3b82f6': 'Deep / Mental',
  '#a855f7': 'After / Hypnotic',
  '#22c55e': 'Organic / Chill',
  '#171717': 'Dark / Obscure',
};

interface MoodOption {
  color: string;
  label: string;
  shortLabel: string;
}

interface MoodContextType {
  moodLabels: Record<string, string>;
  moodOptions: MoodOption[];
  updateMoodLabel: (color: string, newLabel: string) => Promise<void>;
  isLoading: boolean;
}

const MoodContext = createContext<MoodContextType | undefined>(undefined);

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

// Fonction helper pour fetch avec timeout
const fetchWithTimeout = (url: string, options: RequestInit = {}, timeout = 5000): Promise<Response> => {
  return Promise.race([
    fetch(url, options),
    new Promise<Response>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout: API non accessible après 5 secondes')), timeout)
    ),
  ]);
};

// Fonction pour générer un shortLabel à partir d'un label
function generateShortLabel(label: string): string {
  // Prendre les 2-3 premiers mots ou tronquer à 15 caractères
  const words = label.split(' ');
  if (words.length <= 2) {
    return label;
  }
  // Prendre les 2 premiers mots
  const short = words.slice(0, 2).join(' ');
  return short.length > 15 ? short.substring(0, 15) + '...' : short;
}

export function MoodProvider({ children }: { children: ReactNode }) {
  const [moodLabels, setMoodLabels] = useState<Record<string, string>>(DEFAULT_MOOD_LABELS);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Fetch la configuration au mount
  useEffect(() => {
    const fetchMoodConfig = async () => {
      try {
        setIsLoading(true);
        console.log("🔄 Chargement de la config Mood depuis:", `${API_URL}/settings`);
        const response = await fetchWithTimeout(`${API_URL}/settings`, {}, 5000);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        const config = data.mood_config || {};
        
        // S'assurer que toutes les couleurs ont un label
        const completeConfig: Record<string, string> = {};
        MOOD_COLORS.forEach(color => {
          completeConfig[color] = config[color] || DEFAULT_MOOD_LABELS[color];
        });
        
        console.log("✅ Config Mood chargée:", completeConfig);
        setMoodLabels(completeConfig);
      } catch (error) {
        console.error("❌ Erreur lors du chargement de la config Mood:", error);
        // En cas d'erreur, utiliser les valeurs par défaut immédiatement
        console.log("⚠️ Utilisation des valeurs par défaut");
        setMoodLabels(DEFAULT_MOOD_LABELS);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMoodConfig();
  }, []);

  // Générer moodOptions à partir de moodLabels
  const moodOptions = useMemo<MoodOption[]>(() => {
    return MOOD_COLORS.map(color => ({
      color,
      label: moodLabels[color] || DEFAULT_MOOD_LABELS[color],
      shortLabel: generateShortLabel(moodLabels[color] || DEFAULT_MOOD_LABELS[color]),
    }));
  }, [moodLabels]);

  // Fonction pour mettre à jour un label
  const updateMoodLabel = async (color: string, newLabel: string): Promise<void> => {
    const previousLabels = { ...moodLabels }; // Sauvegarder l'état précédent
    const updatedLabels = { ...moodLabels, [color]: newLabel };
    
    console.log(`💾 Sauvegarde du label Mood: ${color} -> "${newLabel}"`);
    
    // Mise à jour optimiste
    setMoodLabels(updatedLabels);

    try {
      // Sauvegarder sur le serveur avec timeout
      const response = await fetchWithTimeout(`${API_URL}/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mood_config: updatedLabels,
        }),
      }, 5000);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      // Confirmer avec la réponse serveur
      if (data.mood_config) {
        console.log("✅ Label Mood sauvegardé avec succès:", data.mood_config);
        setMoodLabels(data.mood_config);
      } else {
        // Si pas de mood_config dans la réponse, garder notre mise à jour optimiste
        console.log("⚠️ Pas de mood_config dans la réponse, conservation de la mise à jour optimiste");
        setMoodLabels(updatedLabels);
      }
    } catch (error) {
      console.error("❌ Erreur lors de la sauvegarde du label Mood:", error);
      // En cas d'erreur, restaurer l'état précédent
      console.log("🔄 Restauration de l'état précédent");
      setMoodLabels(previousLabels);
      throw error;
    }
  };

  return (
    <MoodContext.Provider value={{ moodLabels, moodOptions, updateMoodLabel, isLoading }}>
      {children}
    </MoodContext.Provider>
  );
}

export function useMoodContext() {
  const context = useContext(MoodContext);
  if (context === undefined) {
    throw new Error("useMoodContext must be used within a MoodProvider");
  }
  return context;
}
