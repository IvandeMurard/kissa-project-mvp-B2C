"use client";

import { useState, useEffect } from "react";
import { Loader2, Sparkles, ExternalLink, Trash2, Play } from "lucide-react";
import { useHaptic } from "@/hooks/useHaptic";

const MOOD_OPTIONS = [
  { color: '#ef4444', label: 'Peak Time / Banger', shortLabel: 'Peak' },
  { color: '#eab308', label: 'Groove / Warm Up', shortLabel: 'Groove' },
  { color: '#3b82f6', label: 'Deep / Mental', shortLabel: 'Deep' },
  { color: '#a855f7', label: 'After / Hypnotic', shortLabel: 'After' },
  { color: '#22c55e', label: 'Organic / Chill', shortLabel: 'Organic' },
  { color: '#171717', label: 'Dark / Obscure', shortLabel: 'Dark' },
];

interface Album {
  id: string;
  display: { artist: string; title: string; cover_image: string };
  links: { spotify_url: string; discogs_url: string; spotify_id?: string };
  details: { year: string; label: string; genre: string[]; tracklist?: string[] };
  purchase_data?: { date?: string; location?: string; price?: number; condition?: string } | null;
  editorial_notes?: string | null;
  storage_location?: string | null;
  focus_track_indices?: number[];
  mood_colors?: string[] | null;
}

interface AlbumDetailViewProps {
  album: Album;
  onUpdateAlbum?: (updatedAlbum: Album) => void;
  onDelete?: () => void;
  showActions?: boolean;
  isManageMode?: boolean;
  onPlay?: () => void;
  API_URL: string;
  sounds?: { playVinylStart: () => void };
  compact?: boolean;
  onTabChange?: (tab: "tracklist" | "sleeve" | "story") => void;
}

export function AlbumDetailView({
  album: initialAlbum,
  onUpdateAlbum,
  onDelete,
  showActions = true,
  isManageMode = false,
  onPlay,
  API_URL,
  sounds,
  compact = false,
  onTabChange,
}: AlbumDetailViewProps) {
  const haptic = useHaptic();
  const [activeTab, setActiveTab] = useState<"tracklist" | "sleeve" | "story">("tracklist");
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);
  const [isSavingPurchaseData, setIsSavingPurchaseData] = useState(false);
  const [isTogglingTrack, setIsTogglingTrack] = useState(false);
  const [localAlbum, setLocalAlbum] = useState<Album>(initialAlbum);
  const [optimisticFocusIndices, setOptimisticFocusIndices] = useState<number[]>(
    initialAlbum.focus_track_indices || []
  );
  const [optimisticMoodColors, setOptimisticMoodColors] = useState<string[]>(
    initialAlbum.mood_colors || []
  );
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // Synchroniser localAlbum et optimisticFocusIndices avec initialAlbum si l'album change
  useEffect(() => {
    setLocalAlbum(initialAlbum);
    setOptimisticFocusIndices(initialAlbum.focus_track_indices || []);
    setOptimisticMoodColors(initialAlbum.mood_colors || []);
  }, [initialAlbum.id]);

  // Auto-dismiss du toast d'erreur
  useEffect(() => {
    if (!errorToast) return;
    const timer = setTimeout(() => setErrorToast(null), 3000);
    return () => clearTimeout(timer);
  }, [errorToast]);

  // Fonction helper pour afficher le toast d'erreur
  const showErrorToast = (message: string) => {
    setErrorToast(message);
  };

  // Fonction pour générer les notes éditoriales
  const handleGenerateNotes = async (albumId: string) => {
    setIsGeneratingNotes(true);

    try {
      const response = await fetch(`${API_URL}/albums/${albumId}/generate-notes`, {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Erreur ${response.status}`);
      }

      const result = await response.json();
      
      // Mettre à jour l'album local
      const updated = { ...localAlbum, editorial_notes: result.editorial_notes };
      setLocalAlbum(updated);
      
      // Notifier le parent
      if (onUpdateAlbum) {
        onUpdateAlbum(updated);
      }
    } catch (error) {
      console.error("❌ Erreur lors de la génération de notes:", error);
    } finally {
      setIsGeneratingNotes(false);
    }
  };

  // Fonction pour mettre à jour les données d'achat et la localisation
  const handleUpdatePurchaseData = async (
    albumId: string,
    data: { date?: string; location?: string; price?: number; condition?: string; storage_location?: string | null }
  ) => {
    setIsSavingPurchaseData(true);

    try {
      const response = await fetch(`${API_URL}/albums/${albumId}/context`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Erreur ${response.status}`);
      }

      const updatedAlbum = await response.json();
      
      const updated = {
        ...localAlbum,
        purchase_data: updatedAlbum.purchase_data ?? localAlbum.purchase_data,
        storage_location: updatedAlbum.storage_location ?? localAlbum.storage_location,
      };
      setLocalAlbum(updated);
      
      if (onUpdateAlbum) {
        onUpdateAlbum(updated);
      }
    } catch (error) {
      console.error("❌ Erreur lors de la mise à jour:", error);
    } finally {
      setIsSavingPurchaseData(false);
    }
  };

  // Fonction pour mettre à jour les mood colors (Optimistic UI)
  const handleUpdateMoodColors = async (albumId: string, newColors: string[]) => {
    // Sauvegarder l'état actuel pour rollback en cas d'erreur
    const previousColors = [...optimisticMoodColors];
    
    // Mise à jour optimiste immédiate
    setOptimisticMoodColors(newColors);
    
    // Mettre à jour localAlbum immédiatement
    const updated = {
      ...localAlbum,
      mood_colors: newColors,
    };
    setLocalAlbum(updated);

    // Appel API en arrière-plan
    try {
      const response = await fetch(`${API_URL}/albums/${albumId}/context`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mood_colors: newColors }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Erreur ${response.status}`);
      }

      const updatedAlbum = await response.json();
      
      // Synchroniser avec la réponse serveur
      const serverColors = updatedAlbum.mood_colors || [];
      setOptimisticMoodColors(serverColors);
      
      // Mettre à jour localAlbum et notifier le parent
      const finalUpdated = {
        ...localAlbum,
        mood_colors: serverColors,
      };
      setLocalAlbum(finalUpdated);
      
      if (onUpdateAlbum) {
        onUpdateAlbum(finalUpdated);
      }
    } catch (error) {
      // Rollback en cas d'erreur
      setOptimisticMoodColors(previousColors);
      const rollbackUpdated = {
        ...localAlbum,
        mood_colors: previousColors,
      };
      setLocalAlbum(rollbackUpdated);
      showErrorToast("Erreur lors de la mise à jour. Veuillez réessayer.");
      console.error("❌ Erreur lors de la mise à jour des mood colors:", error);
    }
  };

  // Fonction pour toggle le statut "Focus Track" d'une piste (Optimistic UI)
  const handleToggleFocusTrack = async (albumId: string, trackIndex: number) => {
    if (isTogglingTrack) return; // Éviter les clics multiples simultanés
    
    // Sauvegarder l'état actuel pour rollback en cas d'erreur
    const previousIndices = [...optimisticFocusIndices];
    
    // Calculer la nouvelle liste immédiatement
    const newIndices = previousIndices.includes(trackIndex)
      ? previousIndices.filter(i => i !== trackIndex)
      : [...previousIndices, trackIndex].sort((a, b) => a - b);
    
    // Mise à jour optimiste immédiate
    setOptimisticFocusIndices(newIndices);
    setIsTogglingTrack(true);

    // Appel API en arrière-plan
    try {
      const response = await fetch(`${API_URL}/albums/${albumId}/toggle-track/${trackIndex}`, {
        method: "PATCH",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Erreur ${response.status}`);
      }

      const updatedAlbum = await response.json();
      
      // Synchroniser avec la réponse serveur
      const serverIndices = updatedAlbum.focus_track_indices || [];
      setOptimisticFocusIndices(serverIndices);
      
      // Mettre à jour localAlbum et notifier le parent
      const updated = {
        ...localAlbum,
        focus_track_indices: serverIndices,
      };
      setLocalAlbum(updated);
      
      if (onUpdateAlbum) {
        onUpdateAlbum(updated);
      }
    } catch (error) {
      // Rollback différé ~1 s : la piste reste ambrée puis s'éteint pour signaler que l'action n'a pas été enregistrée
      setTimeout(() => {
        setOptimisticFocusIndices(previousIndices);
        showErrorToast("Erreur lors de la mise à jour. Veuillez réessayer.");
        console.error("❌ Erreur lors du toggle focus track:", error);
      }, 1000);
    } finally {
      setIsTogglingTrack(false);
    }
  };

  // Fonction simple pour rendre le markdown avec lettrine
  const renderMarkdown = (text: string) => {
    // Remplacer **texte** par <strong> (en premier pour éviter les conflits)
    let html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Remplacer *texte* par <em> (mais seulement si ce n'est pas déjà dans un strong)
    html = html.replace(/\*([^*]+)\*/g, (match, content) => {
      // Vérifier si le contenu est déjà dans un strong
      if (match.includes('<strong>') || match.includes('</strong>')) {
        return match;
      }
      return `<em>${content}</em>`;
    });
    // Diviser en paragraphes (double saut de ligne)
    const paragraphs = html.split(/\n\n+/).filter(para => para.trim());
    
    return paragraphs.map((para, i) => {
      const trimmedPara = para.trim();
      const paraHtml = trimmedPara.replace(/\n/g, '<br />');
      
      // Ajouter la lettrine uniquement au premier paragraphe et en mode non-compact
      if (i === 0 && !compact && trimmedPara.length > 0) {
        // Extraire la première lettre (en ignorant les balises HTML et les espaces)
        const textWithoutTags = trimmedPara.replace(/<[^>]*>/g, '');
        const firstCharMatch = textWithoutTags.match(/^\s*(\S)/);
        if (firstCharMatch) {
          const firstChar = firstCharMatch[1];
          // Trouver la position de la première lettre dans le HTML original
          const firstCharIndex = trimmedPara.indexOf(firstChar);
          const beforeFirstChar = trimmedPara.substring(0, firstCharIndex);
          const afterFirstChar = trimmedPara.substring(firstCharIndex + 1);
          const beforeHtml = beforeFirstChar.replace(/\n/g, '<br />');
          const afterHtml = afterFirstChar.replace(/\n/g, '<br />');
          
          return (
            <p key={i}>
              <span dangerouslySetInnerHTML={{ __html: beforeHtml }} />
              <span className="text-5xl float-left mr-4 leading-none" style={{ fontFamily: "var(--font-serif)" }}>
                {firstChar}
              </span>
              <span dangerouslySetInnerHTML={{ __html: afterHtml }} />
            </p>
          );
        }
      }
      
      return (
        <p key={i} dangerouslySetInnerHTML={{ __html: paraHtml }} />
      );
    });
  };

  // Styles adaptatifs selon le mode compact
  const headerSize = compact ? "text-sm" : "text-2xl";
  const artistSize = compact ? "text-xs" : "text-lg";
  const tabSize = compact ? "text-xs" : "text-sm";
  const contentSize = compact ? "text-xs" : "text-sm";
  const padding = compact ? "p-3" : "p-6";

  return (
    <div className={`flex flex-col flex-1 h-full ${padding} relative ${compact ? 'overflow-y-auto' : 'overflow-y-auto'}`}>
      {/* Header */}
      <div className={`mb-4 ${compact ? 'mb-2' : ''} ${showActions && !compact ? 'pr-8' : ''} ${
        activeTab === "story" ? "md:mb-4" : ""
      }`}>
        {activeTab === "story" && (
          <div className="flex items-center gap-3 mb-2 md:hidden transition-opacity duration-300">
            <img 
              src={localAlbum.display.cover_image || "/placeholder.png"} 
              alt={localAlbum.display.title}
              className="w-10 h-10 rounded object-cover"
            />
          </div>
        )}
        <h3 className={`${headerSize} font-bold text-white leading-tight mb-1`}>
          {localAlbum.display.title}
        </h3>
        <p className={`${artistSize} text-zinc-400`}>
          {localAlbum.display.artist}
        </p>
      </div>

      {/* Tags */}
      <div className={`flex flex-wrap gap-2 ${compact ? 'mb-2' : 'mb-4'}`}>
        {localAlbum.details.year && (
          <span className="amp-label bg-zinc-800 text-zinc-300 px-2 py-1 rounded text-xs">
            {localAlbum.details.year}
          </span>
        )}
        {localAlbum.details.genre && localAlbum.details.genre.length > 0 && (
          localAlbum.details.genre.map((genre, i) => (
            <span key={i} className="amp-label bg-zinc-800 text-zinc-300 px-2 py-1 rounded text-xs">
              {genre}
            </span>
          ))
        )}
      </div>

      {/* Onglets */}
      <div className={`flex gap-6 ${compact ? 'mb-3' : 'mb-6'} border-b border-white/10`}>
        <button
          onClick={() => {
            setActiveTab("tracklist");
            onTabChange?.("tracklist");
          }}
          className={`${tabSize} pb-2 px-1 font-medium transition-colors ${
            activeTab === "tracklist"
              ? "text-white border-b-2 border-white"
              : "text-zinc-400 hover:text-zinc-300"
          }`}
        >
          TRACKLIST
        </button>
        <button
          onClick={() => {
            setActiveTab("sleeve");
            onTabChange?.("sleeve");
          }}
          className={`${tabSize} pb-2 px-1 font-medium transition-colors ${
            activeTab === "sleeve"
              ? "text-white border-b-2 border-white"
              : "text-zinc-400 hover:text-zinc-300"
          }`}
        >
          SLEEVE NOTES
        </button>
        <button
          onClick={() => {
            setActiveTab("story");
            onTabChange?.("story");
          }}
          className={`${tabSize} pb-2 px-1 font-medium transition-colors ${
            activeTab === "story"
              ? "text-white border-b-2 border-white"
              : "text-zinc-400 hover:text-zinc-300"
          }`}
        >
          STORY
        </button>
      </div>

      {/* Contenu des onglets */}
      <div className={`flex-1 ${compact ? '' : 'overflow-y-auto'}`}>
        {activeTab === "tracklist" ? (
          /* Onglet TRACKLIST */
          localAlbum.details.tracklist && localAlbum.details.tracklist.length > 0 ? (
            <ul className={compact ? "space-y-0" : "space-y-1"} role="list">
              {localAlbum.details.tracklist.map((track, i) => {
                const isFocus = optimisticFocusIndices.includes(i);
                return (
                  <li
                    key={i}
                    onClick={() => handleToggleFocusTrack(localAlbum.id, i)}
                    className="flex items-center w-full py-1 cursor-pointer group border-l border-transparent hover:border-amber-500/40 pl-2 transition-all"
                  >
                    <span
                      className={`w-8 flex-shrink-0 font-mono ${isFocus ? "text-[#FFB347] font-bold" : "text-zinc-600"}`}
                    >
                      {i + 1}.
                    </span>
                    <span
                      className={`flex-1 font-sans ${isFocus ? "text-[#FFB347] font-medium" : "text-zinc-300 group-hover:text-zinc-100"}`}
                    >
                      {track}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={`text-zinc-500 ${contentSize}`}>Aucune piste disponible</p>
          )
        ) : activeTab === "sleeve" ? (
          /* Onglet SLEEVE NOTES - Acquisition Log uniquement */
          <div className={`${compact ? "space-y-3" : "space-y-6"} transition-opacity duration-300`}>
            {/* Section Acquisition Log */}
            <div className={`bg-zinc-800/50 border border-zinc-700/50 rounded-lg ${compact ? 'p-3' : 'p-4'}`}>
              <h4 className={`text-xs uppercase tracking-wider text-zinc-400 ${compact ? 'mb-2' : 'mb-3'} amp-label`}>
                Acquisition Log
              </h4>
              <div className={compact ? "space-y-2" : "space-y-3"}>
                <div>
                  <label className={`text-xs text-zinc-500 mb-1 block`}>Lieu</label>
                  <input
                    type="text"
                    placeholder="Acquired at..."
                    value={localAlbum.purchase_data?.location || ""}
                    onBlur={(e) => {
                      if (e.target.value !== localAlbum.purchase_data?.location) {
                        handleUpdatePurchaseData(localAlbum.id, {
                          location: e.target.value || undefined,
                        });
                      }
                    }}
                    className="w-full bg-transparent border-none text-white text-sm focus:outline-none focus:ring-0 placeholder:text-zinc-600"
                  />
                </div>
                <div>
                  <label className={`text-xs text-zinc-500 mb-1 block`}>Date</label>
                  <input
                    type="text"
                    placeholder="Date"
                    value={localAlbum.purchase_data?.date || ""}
                    onBlur={(e) => {
                      if (e.target.value !== localAlbum.purchase_data?.date) {
                        handleUpdatePurchaseData(localAlbum.id, {
                          date: e.target.value || undefined,
                        });
                      }
                    }}
                    className="w-full bg-transparent border-none text-white text-sm focus:outline-none focus:ring-0 placeholder:text-zinc-600"
                  />
                </div>
                <div>
                  <label className={`text-xs text-zinc-500 mb-1 block`}>Prix</label>
                  <input
                    type="number"
                    placeholder="Price paid"
                    value={localAlbum.purchase_data?.price || ""}
                    onBlur={(e) => {
                      const price = e.target.value ? parseFloat(e.target.value) : undefined;
                      if (price !== localAlbum.purchase_data?.price) {
                        handleUpdatePurchaseData(localAlbum.id, {
                          price: price,
                        });
                      }
                    }}
                    className="w-full bg-transparent border-none text-white text-sm focus:outline-none focus:ring-0 placeholder:text-zinc-600"
                  />
                </div>
                <div>
                  <label className={`text-xs text-zinc-500 mb-1 block`}>Condition</label>
                  <input
                    type="text"
                    placeholder="Condition"
                    value={localAlbum.purchase_data?.condition || ""}
                    onBlur={(e) => {
                      if (e.target.value !== localAlbum.purchase_data?.condition) {
                        handleUpdatePurchaseData(localAlbum.id, {
                          condition: e.target.value || undefined,
                        });
                      }
                    }}
                    className="w-full bg-transparent border-none text-white text-sm focus:outline-none focus:ring-0 placeholder:text-zinc-600"
                  />
                </div>
                <div>
                  <label className={`text-xs text-zinc-500 mb-1 block amp-label`}>LOCATION / SHELF</label>
                  <input
                    type="text"
                    placeholder="Ex: Box A, Top Shelf..."
                    value={localAlbum.storage_location ?? ""}
                    onBlur={(e) => {
                      const val = e.target.value.trim();
                      const prev = (localAlbum.storage_location ?? "").trim();
                      if (val !== prev) {
                        handleUpdatePurchaseData(localAlbum.id, {
                          storage_location: val ? val : "",
                        });
                      }
                    }}
                    className="w-full bg-transparent border-none text-white text-sm focus:outline-none focus:ring-0 placeholder:text-zinc-600 amp-label uppercase"
                    style={{ fontFamily: "var(--font-technical)" }}
                  />
                </div>
              </div>
            </div>

            {/* Section VIBE / ENERGY */}
            <div className={`bg-zinc-800/50 border border-zinc-700/50 rounded-lg ${compact ? 'p-3' : 'p-4'}`}>
              <h4 className={`text-xs uppercase tracking-wider text-zinc-400 ${compact ? 'mb-2' : 'mb-3'} amp-label`}>
                VIBE / ENERGY
              </h4>
              <div className="flex flex-wrap gap-3 overflow-visible">
                {MOOD_OPTIONS.map((mood, index) => {
                  const isSelected = optimisticMoodColors.includes(mood.color);
                  // Logique de positionnement intelligent
                  const getTooltipPosition = () => {
                    if (index === 0) return 'left-0';
                    if (index >= 4) return 'right-0';
                    return 'left-1/2 -translate-x-1/2';
                  };
                  
                  return (
                    <button
                      key={mood.color}
                      onClick={() => {
                        const newColors = isSelected
                          ? optimisticMoodColors.filter(c => c !== mood.color)
                          : [...optimisticMoodColors, mood.color];
                        handleUpdateMoodColors(localAlbum.id, newColors);
                      }}
                      className="group relative cursor-pointer"
                    >
                      {/* Cercle de couleur */}
                      <div
                        className={`${compact ? 'w-5 h-5' : 'w-6 h-6'} rounded-full transition-all duration-200 ${
                          isSelected
                            ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900'
                            : 'opacity-80 hover:opacity-100 hover:scale-110'
                        }`}
                        style={{
                          backgroundColor: mood.color,
                          border: mood.color === '#171717' ? '1px solid white' : 'none',
                        }}
                      />
                      
                      {/* Tooltip en dessous */}
                      <span
                        className={`absolute top-full mt-2 hidden opacity-0 group-hover:block group-hover:opacity-100 transition-all duration-200 pointer-events-none z-50 whitespace-nowrap bg-black/90 text-white text-[10px] px-2 py-1 rounded shadow-lg border border-white/10 ${getTooltipPosition()}`}
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
          </div>
        ) : (
          /* Onglet STORY - Editorial uniquement */
          <div className={`${compact ? 'space-y-3' : activeTab === "story" ? 'flex-1 flex flex-col' : 'space-y-6'}`}>
            {/* Section Editorial */}
            <div className={`${compact ? 'bg-zinc-900/80 border border-zinc-800/50 p-4' : activeTab === "story" ? 'bg-white/5 border border-zinc-800/30 p-6 md:p-10 flex-1 flex flex-col' : 'bg-white/5 border border-zinc-800/30 p-10'} rounded-lg transition-opacity duration-300`}>
              <h4 className={`text-xs uppercase tracking-wider text-zinc-400 ${compact ? 'mb-3' : 'mb-4'} amp-label ${
                activeTab === "story" ? "hidden md:block" : ""
              }`}>
                Editorial
              </h4>
              {localAlbum.editorial_notes ? (
                <div className="flex-1 flex flex-col">
                  <div 
                    className={`${
                      compact 
                        ? 'text-sm leading-relaxed' 
                        : activeTab === "story" 
                          ? 'text-lg md:text-xl leading-relaxed md:leading-loose px-0 md:px-0' 
                          : 'text-xl leading-loose'
                    } text-zinc-300 text-justify space-y-3 flex-1`}
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {renderMarkdown(localAlbum.editorial_notes)}
                  </div>
                  {!compact && (
                    <div className="amp-label text-xs text-zinc-500 mt-6 italic">
                      — ARCHIVED IN KISSA
                    </div>
                  )}
                </div>
              ) : (
                <div className={`flex flex-col items-center justify-center ${compact ? 'py-4' : 'py-8'}`}>
                  <button
                    onClick={() => handleGenerateNotes(localAlbum.id)}
                    disabled={isGeneratingNotes}
                    className={`border border-zinc-600 hover:border-zinc-400 text-zinc-300 hover:text-white ${compact ? 'py-2 px-4 text-xs' : 'py-3 px-6 text-sm'} font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed rounded-sm`}
                  >
                    {isGeneratingNotes ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {compact ? "Loading..." : "Digging into archives..."}
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        GENERATE NOTES
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      {showActions && (
        <div className={`${compact ? 'mt-3' : 'mt-6'} flex flex-col gap-3`}>
          {localAlbum.links.spotify_url && (
            <a
              href={localAlbum.links.spotify_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => sounds?.playVinylStart()}
              className={`bg-[#1DB954] hover:bg-[#1ed760] text-white py-3 px-4 rounded-sm text-sm font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 ${
                activeTab === "story" ? "hidden md:flex" : ""
              }`}
            >
              <ExternalLink className="w-4 h-4" />
              Listen on Spotify
            </a>
          )}
          {isManageMode && onDelete && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (confirm("Supprimer cet album ?")) {
                  haptic.heavy();
                  onDelete();
                }
              }}
              className="amp-label bg-red-600 hover:bg-red-700 text-white py-3 px-4 rounded-sm font-semibold transition-colors flex items-center justify-center gap-2 touch-manipulation"
            >
              <Trash2 className="w-4 h-4" />
              DISCARD
            </button>
          )}
        </div>
      )}

      {/* Bouton Play pour mode compact (hover desktop) */}
      {compact && onPlay && localAlbum.links.spotify_id && (
        <button 
          onClick={onPlay}
          className={`amp-label mt-3 w-full bg-white text-black ${compact ? 'py-2 text-xs' : 'py-3'} rounded-sm font-semibold hover:bg-neutral-200 transition-colors flex items-center justify-center gap-2`}
        >
          <Play className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} fill-current`} /> PLAY
        </button>
      )}

      {/* Toast d'erreur */}
      {errorToast && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-in slide-in-from-bottom-4">
          {errorToast}
        </div>
      )}
    </div>
  );
}
