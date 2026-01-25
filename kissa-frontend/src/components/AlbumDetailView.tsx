"use client";

import { useState, useEffect } from "react";
import { Loader2, Sparkles, ExternalLink, Trash2, Play, Disc } from "lucide-react";

interface Album {
  id: string;
  display: { artist: string; title: string; cover_image: string };
  links: { spotify_url: string; discogs_url: string; spotify_id?: string };
  details: { year: string; label: string; genre: string[]; tracklist?: string[] };
  purchase_data?: { date?: string; location?: string; price?: number; condition?: string } | null;
  editorial_notes?: string | null;
  storage_location?: string | null;
  focus_track_indices?: number[];
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
  const [activeTab, setActiveTab] = useState<"tracklist" | "sleeve" | "story">("tracklist");
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);
  const [isSavingPurchaseData, setIsSavingPurchaseData] = useState(false);
  const [isTogglingTrack, setIsTogglingTrack] = useState(false);
  const [localAlbum, setLocalAlbum] = useState<Album>(initialAlbum);

  // Synchroniser localAlbum avec initialAlbum si l'album change
  useEffect(() => {
    setLocalAlbum(initialAlbum);
  }, [initialAlbum.id]);

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

  // Fonction pour toggle le statut "Focus Track" d'une piste
  const handleToggleFocusTrack = async (albumId: string, trackIndex: number) => {
    if (isTogglingTrack) return; // Éviter les clics multiples
    
    setIsTogglingTrack(true);

    try {
      const response = await fetch(`${API_URL}/albums/${albumId}/toggle-track/${trackIndex}`, {
        method: "PATCH",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Erreur ${response.status}`);
      }

      const updatedAlbum = await response.json();
      
      // Mettre à jour l'album local avec les nouveaux focus_track_indices
      const updated = {
        ...localAlbum,
        focus_track_indices: updatedAlbum.focus_track_indices || [],
      };
      setLocalAlbum(updated);
      
      if (onUpdateAlbum) {
        onUpdateAlbum(updated);
      }
    } catch (error) {
      console.error("❌ Erreur lors du toggle focus track:", error);
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
          <div className={compact ? "space-y-1" : "space-y-2"}>
            {localAlbum.details.tracklist && localAlbum.details.tracklist.length > 0 ? (
              localAlbum.details.tracklist.map((track, i) => {
                const isFocus = localAlbum.focus_track_indices?.includes(i) || false;
                return (
                  <button
                    key={i}
                    onClick={() => handleToggleFocusTrack(localAlbum.id, i)}
                    disabled={isTogglingTrack}
                    className={`flex items-center gap-2 w-full text-left transition-colors ${
                      isFocus 
                        ? 'text-[#FFB347]' 
                        : 'text-zinc-300 hover:text-zinc-200'
                    } ${contentSize} ${compact ? 'py-0.5' : 'py-1'} disabled:opacity-50 disabled:cursor-not-allowed group`}
                  >
                    {isFocus ? (
                      <Sparkles className="w-4 h-4 flex-shrink-0" style={{ filter: 'drop-shadow(0 0 2px rgba(255, 179, 71, 0.5))' }} />
                    ) : (
                      <Disc className="w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-20 transition-opacity text-zinc-600" />
                    )}
                    <span className="font-medium">{i + 1}.</span>
                    <span>{track}</span>
                  </button>
                );
              })
            ) : (
              <p className={`text-zinc-500 ${contentSize}`}>Aucune piste disponible</p>
            )}
          </div>
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
              onClick={onDelete}
              className="amp-label bg-red-600 hover:bg-red-700 text-white py-3 px-4 rounded-sm font-semibold transition-colors flex items-center justify-center gap-2"
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
    </div>
  );
}
