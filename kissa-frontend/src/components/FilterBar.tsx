"use client";

import { useKissaSound } from "@/hooks/useKissaSound";

const MOOD_OPTIONS = [
  { color: '#ef4444', label: 'Peak Time / Banger', shortLabel: 'Peak' },
  { color: '#eab308', label: 'Groove / Warm Up', shortLabel: 'Groove' },
  { color: '#3b82f6', label: 'Deep / Mental', shortLabel: 'Deep' },
  { color: '#a855f7', label: 'After / Hypnotic', shortLabel: 'After' },
  { color: '#22c55e', label: 'Organic / Chill', shortLabel: 'Organic' },
  { color: '#171717', label: 'Dark / Obscure', shortLabel: 'Dark' },
];

interface FilterBarProps {
  availableGenres: string[];
  selectedGenre: string | null;
  onGenreChange: (genre: string | null) => void;
  selectedMood: string | null;
  onMoodChange: (mood: string | null) => void;
  sounds?: ReturnType<typeof useKissaSound>;
}

export function FilterBar({
  availableGenres,
  selectedGenre,
  onGenreChange,
  selectedMood,
  onMoodChange,
  sounds,
}: FilterBarProps) {
  // Fonction pour positionner le tooltip intelligemment
  const getTooltipPosition = (index: number) => {
    if (index === 0) return 'left-0';
    if (index >= 4) return 'right-0';
    return 'left-1/2 -translate-x-1/2';
  };

  return (
    <div className="px-6 py-4 flex gap-2 items-center overflow-x-auto scrollbar-hide">
      {/* Section Genres */}
      {availableGenres.length > 0 && (
        <>
          <button
            onClick={() => onGenreChange(null)}
            className={`amp-label text-sm font-semibold px-3 py-1 rounded-sm transition-all duration-300 ease-in-out shrink-0 ${
              !selectedGenre
                ? 'amp-button-active font-bold'
                : 'text-zinc-500 border border-zinc-800 bg-transparent hover:border-zinc-500 hover:text-zinc-200'
            }`}
          >
            ALL
          </button>
          {availableGenres.map((g) => (
            <button
              key={g}
              onClick={() => {
                sounds?.playSwitch();
                onGenreChange(selectedGenre === g ? null : g);
              }}
              className={`amp-label text-sm font-semibold uppercase tracking-wider px-3 py-1 rounded-sm transition-all duration-300 ease-in-out shrink-0 ${
                selectedGenre === g
                  ? 'amp-button-active font-bold'
                  : 'text-zinc-500 border border-zinc-800 bg-transparent hover:border-zinc-500 hover:text-zinc-200'
              }`}
            >
              {g}
            </button>
          ))}
        </>
      )}

      {/* Séparateur vertical */}
      {availableGenres.length > 0 && (
        <div className="w-px h-6 bg-white/10 mx-2 shrink-0" />
      )}

      {/* Section Mood Colors */}
      <div className="flex items-center gap-2 shrink-0">
        {MOOD_OPTIONS.map((mood, index) => {
          const isSelected = selectedMood === mood.color;
          return (
            <button
              key={mood.color}
              onClick={() => {
                sounds?.playSwitch();
                onMoodChange(isSelected ? null : mood.color);
              }}
              className="group relative cursor-pointer"
            >
              {/* Cercle de couleur */}
              <div
                className={`w-4 h-4 rounded-full transition-all duration-200 ${
                  isSelected
                    ? 'opacity-100 ring-2 ring-white ring-offset-2 ring-offset-black'
                    : 'opacity-60 hover:opacity-100 hover:scale-110'
                }`}
                style={{
                  backgroundColor: mood.color,
                  border: mood.color === '#171717' ? '1px solid white' : 'none',
                }}
              />

              {/* Tooltip Smart Anchor */}
              <span
                className={`absolute top-full mt-2 hidden opacity-0 group-hover:block group-hover:opacity-100 transition-all duration-200 pointer-events-none z-50 whitespace-nowrap bg-black/90 text-white text-[10px] px-2 py-1 rounded shadow-lg border border-white/10 ${getTooltipPosition(index)}`}
              >
                {mood.shortLabel}
                {/* Flèche pointant vers le haut */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-b-[4px] border-transparent border-b-black/90"></div>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}