"use client";

import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { useKissaSound } from "@/hooks/useKissaSound";
import { useMoodContext } from "@/contexts/MoodContext";

interface FilterBarProps {
  availableGenres: string[];
  selectedGenre: string | null;
  onGenreChange: (genre: string | null) => void;
  selectedMoods: string[];
  onMoodChange: (moods: string[]) => void;
  sounds?: ReturnType<typeof useKissaSound>;
}

export function FilterBar({
  availableGenres,
  selectedGenre,
  onGenreChange,
  selectedMoods,
  onMoodChange,
  sounds,
}: FilterBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { moodOptions } = useMoodContext();

  // Fonction pour positionner le tooltip intelligemment
  const getTooltipPosition = (index: number) => {
    if (index === 0) return 'left-0';
    if (index >= 4) return 'right-0';
    return 'left-1/2 -translate-x-1/2';
  };

  const handleMoodClick = (color: string) => {
    if (selectedMoods.includes(color)) {
      // Si déjà présent, on l'enlève
      onMoodChange(selectedMoods.filter(c => c !== color));
    } else {
      // Sinon on l'ajoute
      onMoodChange([...selectedMoods, color]);
    }
  };

  return (
    <>
      {/* Mobile: Ligne Résumé (Fermé) */}
      <div className="md:hidden px-6 py-3 flex items-center gap-2 overflow-x-auto scrollbar-hide">
        {/* Bouton ALL */}
        <button
          onClick={() => {
            onGenreChange(null);
            sounds?.playSwitch();
          }}
          className={`amp-label text-sm font-semibold px-3 py-1.5 rounded-sm transition-all duration-300 ease-in-out shrink-0 ${
            !selectedGenre && selectedMoods.length === 0
              ? 'amp-button-active font-bold'
              : 'text-zinc-500 border border-zinc-800 bg-transparent hover:border-zinc-500 hover:text-zinc-200'
          }`}
        >
          ALL
        </button>

        {/* Chips des filtres actifs - Genres */}
        {selectedGenre && (
          <button
            onClick={() => {
              sounds?.playSwitch();
              onGenreChange(null);
            }}
            className="amp-label text-sm font-semibold uppercase tracking-wider px-3 py-1.5 rounded-sm transition-all duration-300 ease-in-out shrink-0 amp-button-active font-bold flex items-center gap-1.5"
          >
            {selectedGenre}
            <span className="text-xs">×</span>
          </button>
        )}

        {/* Chips des filtres actifs - Couleurs */}
        {selectedMoods.map((color) => {
          const mood = moodOptions.find((m) => m.color === color);
          return (
            <button
              key={color}
              onClick={() => {
                sounds?.playSwitch();
                handleMoodClick(color);
              }}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-sm shrink-0 amp-button-active transition-all duration-300 ease-in-out"
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{
                  backgroundColor: color,
                  border: color === '#171717' ? '1px solid white' : 'none',
                }}
              />
              <span className="text-xs">×</span>
            </button>
          );
        })}

        {/* Bouton Toggle */}
        <button
          onClick={() => {
            sounds?.playSwitch();
            setIsExpanded(!isExpanded);
          }}
          className="ml-auto flex items-center gap-1.5 amp-label text-sm font-semibold px-3 py-1.5 rounded-sm border border-zinc-800 bg-transparent hover:border-zinc-500 hover:text-zinc-200 transition-all duration-300 ease-in-out shrink-0"
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>FILTER</span>
        </button>
      </div>

      {/* Mobile: Panneau Dépliant (Ouvert) */}
      {isExpanded && (
        <div className="md:hidden bg-zinc-900/90 border-b border-zinc-800 px-6 py-4 space-y-4 transition-all duration-300">
          {/* Header avec bouton fermer */}
          <div className="flex justify-between items-center">
            <span className="amp-label text-sm">FILTERS</span>
            <button
              onClick={() => {
                sounds?.playSwitch();
                setIsExpanded(false);
              }}
              className="text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Section VIBE - Gommettes centrées */}
          <div>
            <h4 className="amp-label text-xs text-zinc-400 mb-3 uppercase tracking-wider">VIBE</h4>
            <div className="flex justify-center gap-4">
              {moodOptions.map((mood, index) => {
                const isSelected = selectedMoods.includes(mood.color);
                return (
                  <button
                    key={mood.color}
                    onClick={() => {
                      sounds?.playSwitch();
                      handleMoodClick(mood.color);
                    }}
                    className="group relative cursor-pointer"
                  >
                    {/* Cercle de couleur - Plus gros sur mobile */}
                    <div
                      className={`w-6 h-6 rounded-full transition-all duration-200 ${
                        isSelected
                          ? 'opacity-100 ring-2 ring-white ring-offset-2 ring-offset-zinc-900'
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

          {/* Section GENRES - Flex wrap */}
          {availableGenres.length > 0 && (
            <div>
              <h4 className="amp-label text-xs text-zinc-400 mb-3 uppercase tracking-wider">GENRES</h4>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    sounds?.playSwitch();
                    onGenreChange(null);
                  }}
                  className={`amp-label text-sm font-semibold py-2 px-3 rounded-sm transition-all duration-300 ease-in-out ${
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
                    className={`amp-label text-sm font-semibold uppercase tracking-wider py-2 px-3 rounded-sm transition-all duration-300 ease-in-out ${
                      selectedGenre === g
                        ? 'amp-button-active font-bold'
                        : 'text-zinc-500 border border-zinc-800 bg-transparent hover:border-zinc-500 hover:text-zinc-200'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Desktop: Comportement actuel */}
      <div className="hidden md:flex px-6 py-4 gap-2 items-center overflow-x-auto scrollbar-hide">
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
          {moodOptions.map((mood, index) => {
            const isSelected = selectedMoods.includes(mood.color);
            return (
              <button
                key={mood.color}
                onClick={() => {
                  sounds?.playSwitch();
                  handleMoodClick(mood.color);
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
                  {mood.label}
                  {/* Flèche pointant vers le haut */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-b-[4px] border-transparent border-b-black/90"></div>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}