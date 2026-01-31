"use client";

import { useState, useRef, useEffect } from "react";
import { SlidersHorizontal, X, LayoutGrid, Square, Maximize2, Heart, Search, ArrowUpNarrowWide, ArrowDownNarrowWide } from "lucide-react";
import { useKissaSound } from "@/hooks/useKissaSound";
import { useMoodContext } from "@/contexts/MoodContext";

export type GridDensity = "large" | "medium" | "small";

export type SortCriteria = "recent" | "artist" | "year" | "location" | "color";

interface FilterBarProps {
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

const DENSITY_PRESETS: { density: GridDensity; icon: typeof LayoutGrid; label: string; ariaLabel: string }[] = [
  { density: "large", icon: Maximize2, label: "Grand", ariaLabel: "Densité : Grand (2/4 colonnes)" },
  { density: "medium", icon: Square, label: "Moyen", ariaLabel: "Densité : Moyen (3/6 colonnes)" },
  { density: "small", icon: LayoutGrid, label: "Petit", ariaLabel: "Densité : Petit (4/8 colonnes)" },
];

export function FilterBar({
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
  const [isExpanded, setIsExpanded] = useState(false);
  const [viewOptionsOpen, setViewOptionsOpen] = useState(false);
  const viewOptionsRef = useRef<HTMLDivElement>(null);
  const { moodOptions } = useMoodContext();
  const [hoveredMood, setHoveredMood] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!viewOptionsOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (viewOptionsRef.current && !viewOptionsRef.current.contains(e.target as Node)) {
        setViewOptionsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [viewOptionsOpen]);

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
      {/* Mobile: deux zones - gauche scrollable, droite fixe */}
      <div className="md:hidden max-w-full px-6 py-3 flex items-center gap-2">
        {/* Zone gauche: recherche + ALL + FAV + genres */}
        <div className="flex-1 min-w-0 flex items-center gap-2 overflow-x-auto scrollbar-hide">
          <div className="relative shrink-0 w-32">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-500" />
            <input
              type="text"
              placeholder="Artist, Title..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-zinc-900/50 border border-zinc-800 rounded-full py-1 pl-7 pr-2 text-xs text-zinc-500 focus:outline-none focus:border-[#FFB347] focus:bg-zinc-900 caret-[#FFB347]"
            />
          </div>
          <button
            onClick={() => {
              onGenreChange(null);
              onFavoritesChange(false);
              sounds?.playSwitch();
            }}
            className={`amp-label text-sm font-semibold px-3 py-1.5 rounded-sm transition-all duration-300 ease-in-out shrink-0 ${
              !selectedGenre && selectedMoods.length === 0 && !showFavoritesOnly
                ? 'amp-button-active font-bold'
                : 'text-zinc-500 border border-zinc-800 bg-transparent hover:border-zinc-500 hover:text-zinc-200'
            }`}
          >
            ALL
          </button>
          <button
            onClick={() => {
              sounds?.playSwitch();
              onFavoritesChange(!showFavoritesOnly);
            }}
            className={`flex items-center gap-1.5 amp-label text-sm font-semibold px-3 py-1.5 rounded-sm transition-all duration-300 ease-in-out shrink-0 ${
              showFavoritesOnly
                ? 'amp-button-active font-bold'
                : 'text-zinc-500 border border-zinc-800 bg-transparent hover:border-zinc-500 hover:text-zinc-200'
            }`}
            title="Favoris"
          >
            <Heart className={`w-3.5 h-3.5 ${showFavoritesOnly ? "fill-current" : "fill-none"}`} />
            <span>FAV</span>
          </button>
          {selectedGenre && (
            <button
              onClick={() => { sounds?.playSwitch(); onGenreChange(null); }}
              className="amp-label text-sm font-semibold uppercase tracking-wider px-3 py-1.5 rounded-sm transition-all duration-300 ease-in-out shrink-0 amp-button-active font-bold flex items-center gap-1.5"
            >
              {selectedGenre}
              <span className="text-xs">×</span>
            </button>
          )}
          {availableGenres.map((g) => (
            <button
              key={g}
              onClick={() => { sounds?.playSwitch(); onGenreChange(selectedGenre === g ? null : g); }}
              className={`amp-label text-sm font-semibold uppercase tracking-wider px-3 py-1.5 rounded-sm shrink-0 transition-all duration-300 ease-in-out ${
                selectedGenre === g
                  ? 'amp-button-active font-bold'
                  : 'text-zinc-500 border border-zinc-800 bg-transparent hover:border-zinc-500 hover:text-zinc-200'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
        {/* Zone droite: gommettes + SORT + ordre + View Options + FILTER */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="flex items-center gap-1">
            {moodOptions.map((mood) => {
              const isSelected = selectedMoods.includes(mood.color);
              return (
                <button
                  key={mood.color}
                  onClick={() => { sounds?.playSwitch(); handleMoodClick(mood.color); }}
                  className="cursor-pointer"
                >
                  <div
                    className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                      isSelected ? 'opacity-100 ring-2 ring-white ring-offset-1 ring-offset-zinc-900' : 'opacity-60 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: mood.color, border: mood.color === '#171717' ? '1px solid white' : 'none' }}
                  />
                </button>
              );
            })}
          </div>
          <select
            value={sortOption}
            onChange={(e) => { sounds?.playSwitch(); onSortOptionChange(e.target.value as SortCriteria); }}
            className="bg-[#111] border border-white/10 rounded px-2 py-1 text-[10px] text-white focus:outline-none focus:border-white/20 cursor-pointer shrink-0 max-w-[80px]"
          >
            <option value="recent">Recent</option>
            <option value="artist">Artist</option>
            <option value="year">Year</option>
            <option value="location">Location</option>
            <option value="color">Color</option>
          </select>
          <button
            type="button"
            onClick={() => { sounds?.playSwitch(); onSortOrderChange(sortOrder === "asc" ? "desc" : "asc"); }}
            aria-label={sortOrder === "asc" ? "Ordre croissant" : "Ordre décroissant"}
            className="p-1.5 rounded-sm text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-500 shrink-0"
          >
            {sortOrder === "asc" ? <ArrowUpNarrowWide className="w-3.5 h-3.5" /> : <ArrowDownNarrowWide className="w-3.5 h-3.5" />}
          </button>
          <div className="relative shrink-0" ref={viewOptionsRef}>
            <button
              type="button"
              onClick={() => { sounds?.playSwitch(); setViewOptionsOpen((o) => !o); }}
              aria-label="View Options"
              className="p-1.5 rounded-sm text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-500"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
            {viewOptionsOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl py-2 px-3 min-w-[140px]">
                <div className="amp-label text-xs text-zinc-400 mb-2 uppercase">Densité</div>
                <div className="flex gap-1 mb-3">
                  {DENSITY_PRESETS.map(({ density, icon: Icon, ariaLabel }) => (
                    <button
                      key={density}
                      type="button"
                      onClick={() => { sounds?.playSwitch(); onGridDensityChange(density); }}
                      aria-label={ariaLabel}
                      className={`p-1.5 rounded-sm transition-all duration-200 ${
                        gridDensity === density ? "amp-button-active text-white" : "text-zinc-500 border border-zinc-800 hover:border-zinc-500 hover:text-zinc-200"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  ))}
                </div>
                <div className="amp-label text-xs text-zinc-400 mb-1 uppercase">Ordre</div>
                <button
                  type="button"
                  onClick={() => { sounds?.playSwitch(); onSortOrderChange(sortOrder === "asc" ? "desc" : "asc"); }}
                  className="flex items-center gap-2 w-full py-1.5 px-2 rounded-sm text-sm text-zinc-300 hover:bg-zinc-800"
                >
                  {sortOrder === "asc" ? <ArrowUpNarrowWide className="w-4 h-4" /> : <ArrowDownNarrowWide className="w-4 h-4" />}
                  <span>{sortOrder === "asc" ? "A → Z" : "Z → A"}</span>
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => { sounds?.playSwitch(); setIsExpanded(!isExpanded); }}
            className="flex items-center gap-1.5 amp-label text-sm font-semibold px-3 py-1.5 rounded-sm border border-zinc-800 bg-transparent hover:border-zinc-500 hover:text-zinc-200 transition-all duration-300 ease-in-out shrink-0"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>FILTER</span>
          </button>
        </div>
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
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setTooltipPosition({
                        x: rect.left + rect.width / 2,
                        y: rect.top - 8
                      });
                      setHoveredMood(mood.color);
                    }}
                    onMouseLeave={() => {
                      setHoveredMood(null);
                      setTooltipPosition(null);
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
                  </button>
                );
              })}
            </div>
            {/* Tooltip avec position fixed */}
            {hoveredMood && tooltipPosition && (
              <div
                className="fixed z-[9999] pointer-events-none whitespace-nowrap bg-zinc-800 text-white text-[10px] font-medium px-2 py-1 rounded border border-white/10 shadow-xl"
                style={{
                  left: `${tooltipPosition.x}px`,
                  top: `${tooltipPosition.y}px`,
                  transform: 'translate(-50%, -100%)',
                  opacity: hoveredMood ? 1 : 0,
                  transition: 'opacity 200ms ease-out'
                }}
              >
                {moodOptions.find(m => m.color === hoveredMood)?.shortLabel || moodOptions.find(m => m.color === hoveredMood)?.label}
                {/* Flèche */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-800"></div>
              </div>
            )}
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
                    onFavoritesChange(false);
                  }}
                  className={`amp-label text-sm font-semibold py-2 px-3 rounded-sm transition-all duration-300 ease-in-out ${
                    !selectedGenre && !showFavoritesOnly
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

      {/* Desktop: deux zones - gauche scrollable, droite fixe */}
      <div className="hidden md:flex max-w-full px-6 py-4 gap-4 items-center">
        {/* Zone gauche: recherche + ALL + FAV + genres */}
        <div className="flex-1 min-w-0 flex items-center gap-2 overflow-x-auto scrollbar-hide">
          <div className="relative shrink-0 w-48 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-500 group-focus-within:text-white" />
            <input
              type="text"
              placeholder="Artist, Title, Cat. No..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-zinc-900/50 border border-zinc-800 rounded-full py-1.5 pl-9 pr-4 text-xs text-zinc-500 focus:outline-none focus:border-[#FFB347] focus:shadow-[0_0_15px_rgba(255,179,71,0.3)] focus:bg-zinc-900 caret-[#FFB347] transition-all duration-300 placeholder:text-zinc-500"
            />
          </div>
          <button
            onClick={() => {
              onGenreChange(null);
              onFavoritesChange(false);
              sounds?.playSwitch();
            }}
            className={`amp-label text-sm font-semibold px-3 py-1 rounded-sm transition-all duration-300 ease-in-out shrink-0 ${
              !selectedGenre && !showFavoritesOnly
                ? 'amp-button-active font-bold'
                : 'text-zinc-500 border border-zinc-800 bg-transparent hover:border-zinc-500 hover:text-zinc-200'
            }`}
          >
            ALL
          </button>
          <button
            onClick={() => {
              sounds?.playSwitch();
              onFavoritesChange(!showFavoritesOnly);
            }}
            className={`flex items-center gap-1.5 amp-label text-sm font-semibold px-3 py-1 rounded-sm transition-all duration-300 ease-in-out shrink-0 ${
              showFavoritesOnly
                ? 'amp-button-active font-bold'
                : 'text-zinc-500 border border-zinc-800 bg-transparent hover:border-zinc-500 hover:text-zinc-200'
            }`}
            title="Favoris"
          >
            <Heart className={`w-3.5 h-3.5 ${showFavoritesOnly ? "fill-current" : "fill-none"}`} />
            <span>FAV</span>
          </button>
          {availableGenres.length > 0 && (
            <>
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
        </div>

        {/* Séparateur vertical */}
        <div className="w-px h-6 bg-white/10 shrink-0" />

        {/* Zone droite: gommettes (gap-1) + SORT + ordre + View Options */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 shrink-0">
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
                    setTooltipPosition({
                      x: rect.left + rect.width / 2,
                      y: rect.top - 8
                    });
                    setHoveredMood(mood.color);
                  }}
                  onMouseLeave={() => {
                    setHoveredMood(null);
                    setTooltipPosition(null);
                  }}
                  className="group relative cursor-pointer"
                >
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
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <label className="amp-label text-neutral-500 text-xs sr-only md:not-sr-only">SORT:</label>
            <select
              value={sortOption}
              onChange={(e) => {
                sounds?.playSwitch();
                onSortOptionChange(e.target.value as SortCriteria);
              }}
              className="bg-[#111] border border-white/10 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-white/20 transition-all cursor-pointer"
            >
              <option value="recent">Ajouté récemment</option>
              <option value="artist">Artiste (A-Z)</option>
              <option value="year">Année</option>
              <option value="location">Rangement (A-Z)</option>
              <option value="color">Couleur (Rainbow)</option>
            </select>
            <button
              type="button"
              onClick={() => {
                sounds?.playSwitch();
                onSortOrderChange(sortOrder === "asc" ? "desc" : "asc");
              }}
              aria-label={sortOrder === "asc" ? "Ordre croissant" : "Ordre décroissant"}
              title={sortOrder === "asc" ? "Z → A" : "A → Z"}
              className="p-1.5 rounded-sm text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-500 transition-all duration-200"
            >
              {sortOrder === "asc" ? <ArrowUpNarrowWide className="w-4 h-4" /> : <ArrowDownNarrowWide className="w-4 h-4" />}
            </button>
          </div>
          <div className="relative shrink-0" ref={viewOptionsRef}>
            <button
              type="button"
              onClick={() => {
                sounds?.playSwitch();
                setViewOptionsOpen((o) => !o);
              }}
              aria-label="View Options"
              title="View Options"
              className="p-1.5 rounded-sm text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-500 transition-all duration-200"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
            {viewOptionsOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl py-3 px-4 min-w-[160px]">
                <div className="amp-label text-xs text-zinc-400 mb-2 uppercase tracking-wider">Densité</div>
                <div className="flex gap-1 mb-3" role="group" aria-label="Densité de grille">
                  {DENSITY_PRESETS.map(({ density, icon: Icon, label, ariaLabel }) => (
                    <button
                      key={density}
                      type="button"
                      onClick={() => {
                        sounds?.playSwitch();
                        onGridDensityChange(density);
                      }}
                      aria-label={ariaLabel}
                      title={label}
                      className={`p-1.5 rounded-sm transition-all duration-200 ${
                        gridDensity === density
                          ? "amp-button-active text-white"
                          : "text-zinc-500 border border-zinc-800 bg-transparent hover:border-zinc-500 hover:text-zinc-200"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  ))}
                </div>
                <div className="amp-label text-xs text-zinc-400 mb-1 uppercase tracking-wider">Ordre</div>
                <button
                  type="button"
                  onClick={() => {
                    sounds?.playSwitch();
                    onSortOrderChange(sortOrder === "asc" ? "desc" : "asc");
                  }}
                  className="flex items-center gap-2 w-full py-1.5 px-2 rounded-sm text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
                >
                  {sortOrder === "asc" ? <ArrowUpNarrowWide className="w-4 h-4" /> : <ArrowDownNarrowWide className="w-4 h-4" />}
                  <span>{sortOrder === "asc" ? "A → Z" : "Z → A"}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tooltip mood desktop */}
        {hoveredMood && tooltipPosition && (
          <div
            className="fixed z-[9999] pointer-events-none whitespace-nowrap bg-zinc-800 text-white text-[10px] font-medium px-2 py-1 rounded border border-white/10 shadow-xl"
            style={{
              left: `${tooltipPosition.x}px`,
              top: `${tooltipPosition.y}px`,
              transform: 'translate(-50%, -100%)',
              opacity: hoveredMood ? 1 : 0,
              transition: 'opacity 200ms ease-out'
            }}
          >
            {moodOptions.find(m => m.color === hoveredMood)?.label}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-800"></div>
          </div>
        )}
      </div>
    </>
  );
}