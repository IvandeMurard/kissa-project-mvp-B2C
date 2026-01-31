"use client";

import { useState } from "react";
import { LayoutGrid, Square, Grid3X3, Heart, Search, ArrowUpNarrowWide, ArrowDownNarrowWide } from "lucide-react";
import { useKissaSound } from "@/hooks/useKissaSound";
import { useMoodContext } from "@/contexts/MoodContext";

export type GridDensity = "large" | "medium" | "small";

export type SortCriteria = "recent" | "artist" | "year" | "location" | "color";

export type FilterBarSlot = "genres" | "search" | "moods" | "toolbar";

interface FilterBarProps {
  slot: FilterBarSlot;
  availableGenres: string[];
  selectedGenre: string | null;
  onGenreChange: (genre: string | null) => void;
  selectedMoods: string[];
  onMoodChange: (moods: string[]) => void;
  showFavoritesOnly: boolean;
  onFavoritesChange: (value: boolean) => void;
  gridDensity: GridDensity;
  onGridDensityChange: (density: GridDensity) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  sortOption: SortCriteria;
  onSortOptionChange: (value: SortCriteria) => void;
  sortOrder: "asc" | "desc";
  onSortOrderChange: (value: "asc" | "desc") => void;
  sounds?: ReturnType<typeof useKissaSound>;
}

const DENSITY_PRESETS: { density: GridDensity; icon: typeof Square; label: string; ariaLabel: string }[] = [
  { density: "large", icon: Square, label: "Grand", ariaLabel: "Densité : Grand (1 carré)" },
  { density: "medium", icon: LayoutGrid, label: "Moyen", ariaLabel: "Densité : Moyen (4 carrés)" },
  { density: "small", icon: Grid3X3, label: "Petit", ariaLabel: "Densité : Petit (9 carrés)" },
];

export function FilterBar({
  slot,
  availableGenres,
  selectedGenre,
  onGenreChange,
  selectedMoods,
  onMoodChange,
  showFavoritesOnly,
  onFavoritesChange,
  gridDensity,
  onGridDensityChange,
  searchQuery,
  onSearchChange,
  sortOption,
  onSortOptionChange,
  sortOrder,
  onSortOrderChange,
  sounds,
}: FilterBarProps) {
  const { moodOptions } = useMoodContext();
  const [hoveredMood, setHoveredMood] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [searchExpanded, setSearchExpanded] = useState(false);

  const handleMoodClick = (color: string) => {
    if (selectedMoods.includes(color)) {
      onMoodChange(selectedMoods.filter((c) => c !== color));
    } else {
      onMoodChange([...selectedMoods, color]);
    }
  };

  if (slot === "genres") {
    return (
      <div className="min-w-0 flex items-center gap-2 overflow-x-auto scrollbar-hide">
        <button
          onClick={() => {
            onGenreChange(null);
            onFavoritesChange(false);
            sounds?.playSwitch();
          }}
          className={`amp-label text-sm font-semibold px-3 py-1.5 md:py-1 rounded-sm transition-all duration-300 ease-in-out shrink-0 ${
            !selectedGenre && selectedMoods.length === 0 && !showFavoritesOnly
              ? "amp-button-active font-bold"
              : "text-zinc-500 border border-zinc-800 bg-transparent hover:border-zinc-500 hover:text-zinc-200"
          }`}
        >
          ALL
        </button>
        <button
          onClick={() => {
            sounds?.playSwitch();
            onFavoritesChange(!showFavoritesOnly);
          }}
          className={`flex items-center gap-1.5 amp-label text-sm font-semibold px-3 py-1.5 md:py-1 rounded-sm transition-all duration-300 ease-in-out shrink-0 ${
            showFavoritesOnly
              ? "amp-button-active font-bold"
              : "text-zinc-500 border border-zinc-800 bg-transparent hover:border-zinc-500 hover:text-zinc-200"
          }`}
          title="Favoris"
        >
          <Heart className={`w-3.5 h-3.5 ${showFavoritesOnly ? "fill-current" : "fill-none"}`} />
          <span>FAV</span>
        </button>
        {selectedGenre && (
          <button
            onClick={() => {
              sounds?.playSwitch();
              onGenreChange(null);
            }}
            className="amp-label text-sm font-semibold uppercase tracking-wider px-3 py-1.5 md:py-1 rounded-sm transition-all duration-300 ease-in-out shrink-0 amp-button-active font-bold flex items-center gap-1.5"
          >
            {selectedGenre}
            <span className="text-xs">×</span>
          </button>
        )}
        {availableGenres.map((g) => (
          <button
            key={g}
            onClick={() => {
              sounds?.playSwitch();
              onGenreChange(selectedGenre === g ? null : g);
            }}
            className={`amp-label text-sm font-semibold uppercase tracking-wider px-3 py-1.5 md:py-1 rounded-sm shrink-0 transition-all duration-300 ease-in-out ${
              selectedGenre === g
                ? "amp-button-active font-bold"
                : "text-zinc-500 border border-zinc-800 bg-transparent hover:border-zinc-500 hover:text-zinc-200"
            }`}
          >
            {g}
          </button>
        ))}
      </div>
    );
  }

  if (slot === "search") {
    return (
      <>
        {/* Desktop: full search input */}
        <div className="hidden md:block relative shrink-0 w-48 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-500 group-focus-within:text-white" />
          <input
            type="text"
            placeholder="Artist, Title, Cat. No..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-full py-1.5 pl-9 pr-4 text-xs text-zinc-500 focus:outline-none focus:border-[#FFB347] focus:shadow-[0_0_15px_rgba(255,179,71,0.3)] focus:bg-zinc-900 caret-[#FFB347] transition-all duration-300 placeholder:text-zinc-500"
          />
        </div>
        {/* Mobile: icon that expands to input, or compact input */}
        <div className="md:hidden flex items-center shrink-0">
          {searchExpanded ? (
            <div className="relative w-28">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-500" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                onBlur={() => setSearchExpanded(false)}
                autoFocus
                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-full py-1 pl-7 pr-2 text-xs text-zinc-500 focus:outline-none focus:border-[#FFB347] focus:bg-zinc-900 caret-[#FFB347]"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setSearchExpanded(true);
                sounds?.playSwitch();
              }}
              aria-label="Rechercher"
              className="p-2 rounded-full text-zinc-500 hover:text-white border border-zinc-800 hover:border-zinc-500 transition-colors"
            >
              <Search className="w-4 h-4" />
            </button>
          )}
        </div>
      </>
    );
  }

  if (slot === "moods") {
    return (
      <>
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide min-w-0">
          {moodOptions.map((mood) => {
            const isSelected = selectedMoods.includes(mood.color);
            return (
              <button
                key={mood.color}
                onClick={() => {
                  sounds?.playSwitch();
                  handleMoodClick(mood.color);
                }}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setTooltipPosition({ x: rect.left + rect.width / 2, y: rect.top - 8 });
                  setHoveredMood(mood.color);
                }}
                onMouseLeave={() => {
                  setHoveredMood(null);
                  setTooltipPosition(null);
                }}
                className="shrink-0 cursor-pointer"
              >
                <div
                  className={`w-4 h-4 md:w-4 md:h-4 rounded-full transition-all duration-200 ${
                    isSelected
                      ? "opacity-100 ring-2 ring-white ring-offset-2 ring-offset-zinc-950"
                      : "opacity-60 hover:opacity-100 hover:scale-110"
                  }`}
                  style={{
                    backgroundColor: mood.color,
                    border: mood.color === "#171717" ? "1px solid white" : "none",
                  }}
                />
              </button>
            );
          })}
        </div>
        {hoveredMood && tooltipPosition && (
          <div
            className="fixed z-[9999] pointer-events-none whitespace-nowrap bg-zinc-800 text-white text-[10px] font-medium px-2 py-1 rounded border border-white/10 shadow-xl"
            style={{
              left: `${tooltipPosition.x}px`,
              top: `${tooltipPosition.y}px`,
              transform: "translate(-50%, -100%)",
              opacity: 1,
              transition: "opacity 200ms ease-out",
            }}
          >
            {moodOptions.find((m) => m.color === hoveredMood)?.label}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-800" />
          </div>
        )}
      </>
    );
  }

  if (slot === "toolbar") {
    return (
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide shrink-0 flex-wrap justify-end">
        <select
          value={sortOption}
          onChange={(e) => {
            sounds?.playSwitch();
            onSortOptionChange(e.target.value as SortCriteria);
          }}
          className="bg-[#111] border border-white/10 rounded px-2 md:px-3 py-1 md:py-1.5 text-[10px] md:text-sm text-white focus:outline-none focus:border-white/20 cursor-pointer shrink-0 max-w-[90px] md:max-w-none"
        >
          <option value="recent">Recent</option>
          <option value="artist">Artist</option>
          <option value="year">Year</option>
          <option value="location">Location</option>
          <option value="color">Color</option>
        </select>
        <button
          type="button"
          onClick={() => {
            sounds?.playSwitch();
            onSortOrderChange(sortOrder === "asc" ? "desc" : "asc");
          }}
          aria-label={sortOrder === "asc" ? "Ordre croissant" : "Ordre décroissant"}
          title={sortOrder === "asc" ? "Z → A" : "A → Z"}
          className="p-1.5 rounded-sm text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-500 transition-all duration-200 shrink-0"
        >
          {sortOrder === "asc" ? <ArrowUpNarrowWide className="w-3.5 h-3.5 md:w-4 md:h-4" /> : <ArrowDownNarrowWide className="w-3.5 h-3.5 md:w-4 md:h-4" />}
        </button>
        <div className="flex items-center gap-0.5 shrink-0" role="group" aria-label="Densité de grille">
          {DENSITY_PRESETS.map(({ density, icon: Icon, ariaLabel }) => (
            <button
              key={density}
              type="button"
              onClick={() => {
                sounds?.playSwitch();
                onGridDensityChange(density);
              }}
              aria-label={ariaLabel}
              className={`p-1.5 rounded-sm transition-all duration-200 ${
                gridDensity === density
                  ? "amp-button-active text-white"
                  : "text-zinc-500 border border-zinc-800 hover:border-zinc-500 hover:text-zinc-200"
              }`}
            >
              <Icon className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  return null;
}
