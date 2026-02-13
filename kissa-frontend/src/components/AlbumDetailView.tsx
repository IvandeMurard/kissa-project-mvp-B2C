"use client";

import { useState, useEffect } from "react";
import { Loader2, Sparkles, ExternalLink, Trash2, Play, RefreshCw, Check, Heart, X } from "lucide-react";
import { useHaptic } from "@/hooks/useHaptic";
import { useMoodContext } from "@/contexts/MoodContext";

/** Track item can be a string (title) or an object with title/name/duration */
type TrackItem = string | { title?: string; name?: string; duration?: string | number };

interface Album {
  id: string;
  display: { artist: string; title: string; cover_image: string };
  links: { spotify_url: string; discogs_url: string; spotify_id?: string };
  details: { year: string; label: string; genre: string[]; tracklist?: TrackItem[] };
  purchase_data?: { date?: string; location?: string; price?: number; condition?: string } | null;
  editorial_notes?: string | null;
  storage_location?: string | null;
  focus_track_indices?: number[];
  mood_colors?: string[] | null;
  personal_notes?: string | null;
  is_favorite?: boolean;
}

interface AlbumDetailViewProps {
  album: Album;
  onUpdate?: (album: Album) => void;
  onUpdateAlbum?: (updatedAlbum: Album) => void;
  onDelete?: () => void;
  showActions?: boolean;
  isManageMode?: boolean;
  onPlay?: () => void;
  API_URL: string;
  sounds?: { playVinylStart: () => void };
  compact?: boolean;
  onTabChange?: (tab: "tracklist" | "sleeve" | "story" | "vibe") => void;
  /** Quand fourni, l'onglet actif est contrôlé par le parent (ex. modale). */
  activeTab?: "tracklist" | "sleeve" | "story" | "vibe";
  /** Quand fourni, le nom de l'artiste devient cliquable (ferme modale + filtre par artiste). */
  onArtistClick?: (artist: string) => void;
  /** Callback pour fermer la modale (affichage du bouton Close dans le header). */
  onClose?: () => void;
}

export function AlbumDetailView({
  album: initialAlbum,
  onUpdate,
  onUpdateAlbum,
  onDelete,
  showActions = true,
  isManageMode = false,
  onPlay,
  API_URL,
  sounds,
  compact = false,
  onTabChange,
  activeTab: activeTabControlled,
  onArtistClick,
  onClose,
}: AlbumDetailViewProps) {
  const { moodOptions } = useMoodContext();
  const haptic = useHaptic();
  const [internalTab, setInternalTab] = useState<"tracklist" | "sleeve" | "story" | "vibe">("tracklist");
  const tab = activeTabControlled ?? internalTab;
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);
  const [isSavingPurchaseData, setIsSavingPurchaseData] = useState(false);
  const [isTogglingTrack, setIsTogglingTrack] = useState(false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);
  const [isRefetchingTracklist, setIsRefetchingTracklist] = useState(false);
  const [localAlbum, setLocalAlbum] = useState<Album>(initialAlbum);
  const [optimisticFocusIndices, setOptimisticFocusIndices] = useState<number[]>(
    initialAlbum.focus_track_indices || []
  );
  const [optimisticMoodColors, setOptimisticMoodColors] = useState<string[]>(
    initialAlbum.mood_colors || []
  );
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [storyError, setStoryError] = useState<string | null>(null);
  const [hoveredMoodVibe, setHoveredMoodVibe] = useState<string | null>(null);
  const [tooltipPositionVibe, setTooltipPositionVibe] = useState<{ x: number; y: number } | null>(null);
  const [isSavingMoodColors, setIsSavingMoodColors] = useState(false);
  const [moodColorsJustSaved, setMoodColorsJustSaved] = useState(false);

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

  // Auto-dismiss du toast de succès
  useEffect(() => {
    if (!successToast) return;
    const timer = setTimeout(() => setSuccessToast(null), 3000);
    return () => clearTimeout(timer);
  }, [successToast]);

  // Fonction helper pour afficher le toast d'erreur
  const showErrorToast = (message: string) => {
    setErrorToast(message);
  };

  // Fonction helper pour afficher le toast de succès
  const showSuccessToast = (message: string) => {
    setSuccessToast(message);
  };

  // Fonction pour générer les notes éditoriales
  const handleGenerateNotes = async (albumId: string) => {
    setIsGeneratingNotes(true);
    setStoryError(null);

    try {
      const response = await fetch(`${API_URL}/albums/${albumId}/generate-notes`, {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.detail || `Erreur ${response.status}`;
        setStoryError(errorMessage);
        console.error("❌ Erreur lors de la génération de notes:", errorMessage);
        return;
      }

      const result = await response.json();
      
      // Mettre à jour l'album local
      const updated = { ...localAlbum, editorial_notes: result.editorial_notes };
      setLocalAlbum(updated);
      
      // Notifier le parent
      (onUpdate ?? onUpdateAlbum)?.(updated);
      
      // Réinitialiser l'erreur en cas de succès
      setStoryError(null);
    } catch (error) {
      console.error("❌ Erreur lors de la génération de notes:", error);
      setStoryError("Erreur de connexion. Réessayez.");
    } finally {
      setIsGeneratingNotes(false);
    }
  };

  // Fonction pour mettre à jour les données d'achat, la localisation et les notes personnelles
  const handleUpdatePurchaseData = async (
    albumId: string,
    data: { date?: string; location?: string; price?: number; condition?: string; storage_location?: string | null; personal_notes?: string | null }
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
        personal_notes: updatedAlbum.personal_notes ?? localAlbum.personal_notes,
      };
      setLocalAlbum(updated);

      (onUpdate ?? onUpdateAlbum)?.(updated);
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

    // Déduire ajout vs retrait pour le toast
    const addedColor = newColors.find((c) => !previousColors.includes(c));
    const removedColor = previousColors.find((c) => !newColors.includes(c));
    const affectedColor = addedColor ?? removedColor;
    const label = affectedColor ? moodOptions.find((m) => m.color === affectedColor)?.label : null;

    // Mise à jour optimiste immédiate
    setOptimisticMoodColors(newColors);

    // Mettre à jour localAlbum immédiatement
    const updated = {
      ...localAlbum,
      mood_colors: newColors,
    };
    setLocalAlbum(updated);

    // Notifier le parent tout de suite (instantané)
    (onUpdate ?? onUpdateAlbum)?.(updated);

    // Toast succès immédiat (add / remove)
    if (addedColor) {
      showSuccessToast(`Mood added: ${label ?? "Mood"} 🔵`);
    } else if (removedColor) {
      showSuccessToast("Mood removed");
    }

    setIsSavingMoodColors(true);

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

      (onUpdate ?? onUpdateAlbum)?.(finalUpdated);

      setMoodColorsJustSaved(true);
      setTimeout(() => setMoodColorsJustSaved(false), 2000);
    } catch (error) {
      // Rollback en cas d'erreur
      setOptimisticMoodColors(previousColors);
      const rollbackUpdated = {
        ...localAlbum,
        mood_colors: previousColors,
      };
      setLocalAlbum(rollbackUpdated);
      (onUpdate ?? onUpdateAlbum)?.(rollbackUpdated);
      showErrorToast("Erreur lors de la mise à jour. Veuillez réessayer.");
      console.error("❌ Erreur lors de la mise à jour des mood colors:", error);
    } finally {
      setIsSavingMoodColors(false);
    }
  };

  // Fonction pour refetch la tracklist depuis Spotify
  const handleRefetchTracklist = async () => {
    setIsRefetchingTracklist(true);
    try {
      const response = await fetch(`${API_URL}/admin/refetch-album-tracks/${localAlbum.id}`, {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.reason || `Erreur ${response.status}`);
      }

      const result = await response.json();
      
      if (result.status === "success" && result.new_tracklist) {
        // Mettre à jour l'album local
        const updated = {
          ...localAlbum,
          details: {
            ...localAlbum.details,
            tracklist: result.new_tracklist,
          },
        };
        setLocalAlbum(updated);
        
        // Notifier le parent
        (onUpdate ?? onUpdateAlbum)?.(updated);
        
        // Afficher un message de succès
        showSuccessToast(`Tracklist mise à jour : ${result.new_tracklist_count} pistes`);
      } else {
        // Afficher un message d'erreur contextuel selon la raison
        let errorMessage = result.reason || "Échec de la récupération de la tracklist";
        
        if (result.reason === "Pas de spotify_url dans la BDD") {
          errorMessage = "Aucun lien Spotify disponible pour cet album";
        } else if (result.reason === "Client Spotify non disponible") {
          errorMessage = "Service Spotify temporairement indisponible";
        } else if (result.reason === "Aucune piste trouvée sur Spotify pour cet album") {
          errorMessage = "Aucune piste trouvée sur Spotify pour cet album";
        }
        
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error("❌ Erreur lors du refetch de tracklist:", error);
      showErrorToast(error instanceof Error ? error.message : "Erreur lors de la récupération");
    } finally {
      setIsRefetchingTracklist(false);
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
      
      (onUpdate ?? onUpdateAlbum)?.(updated);
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

  const handleToggleFavorite = async () => {
    if (isTogglingFavorite) return;
    const previousFavorite = localAlbum.is_favorite === true;
    const nextFavorite = !previousFavorite;

    setLocalAlbum((prev) => ({ ...prev, is_favorite: nextFavorite }));
    (onUpdate ?? onUpdateAlbum)?.({ ...localAlbum, is_favorite: nextFavorite });
    setIsTogglingFavorite(true);

    try {
      const response = await fetch(`${API_URL}/albums/${localAlbum.id}/favorite`, {
        method: "PATCH",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Erreur ${response.status}`);
      }

      const updated = await response.json();
      const serverFavorite = updated.is_favorite === true;
      const finalAlbum = { ...localAlbum, is_favorite: serverFavorite };
      setLocalAlbum(finalAlbum);
      (onUpdate ?? onUpdateAlbum)?.(finalAlbum);
    } catch (error) {
      setLocalAlbum((prev) => ({ ...prev, is_favorite: previousFavorite }));
      (onUpdate ?? onUpdateAlbum)?.({ ...localAlbum, is_favorite: previousFavorite });
      showErrorToast("Erreur lors de la mise à jour. Veuillez réessayer.");
      console.error("❌ Erreur lors du toggle favori:", error);
    } finally {
      setIsTogglingFavorite(false);
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

  // Mode Modal (Glass UI) - Header/Body/Footer layout
  if (!compact) {
    return (
      <div className="flex flex-col h-full relative overflow-hidden">
        {/* Indicateur Saving/Saved - fixed en haut pour mobile */}
        {(isSavingMoodColors || moodColorsJustSaved) && tab === "vibe" && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900/95 border border-white/10 text-xs text-zinc-400">
            {isSavingMoodColors && (
              <>
                <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />
                <span>Saving...</span>
              </>
            )}
            {!isSavingMoodColors && moodColorsJustSaved && (
              <>
                <Check className="w-3 h-3 text-green-500 flex-shrink-0" />
                <span className="text-green-500">Saved</span>
              </>
            )}
          </div>
        )}

        {/* 1. HEADER (Fixe) */}
        <div className="p-6 pb-2 border-b border-white/5 flex justify-between items-start flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight mb-1 truncate">{localAlbum.display.title}</h2>
            {onArtistClick ? (
              <button
                type="button"
                onClick={() => onArtistClick(localAlbum.display.artist)}
                className="text-lg text-amber-500 font-medium cursor-pointer hover:underline text-left"
              >
                {localAlbum.display.artist}
              </button>
            ) : (
              <p className="text-lg text-amber-500 font-medium">{localAlbum.display.artist}</p>
            )}
            <div className="flex flex-wrap gap-2 mt-3">
              {/* Tags Année / Genre */}
              {localAlbum.details.year && (
                <span className="px-2 py-0.5 rounded text-xs border border-white/10 text-white/60">{localAlbum.details.year}</span>
              )}
              {localAlbum.details.genre?.slice(0, 3).map((g, i) => (
                <span key={i} className="px-2 py-0.5 rounded text-xs bg-white/5 text-white/60">{g}</span>
              ))}
            </div>
          </div>
          
          {/* Actions Header (Desktop) */}
          <div className="hidden md:flex items-center gap-2 flex-shrink-0 ml-4">
            {showActions && (
              <button
                type="button"
                onClick={handleToggleFavorite}
                disabled={isTogglingFavorite}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/60 hover:text-red-500 disabled:opacity-50"
                aria-label={localAlbum.is_favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
              >
                <Heart size={20} className={localAlbum.is_favorite ? "fill-current text-red-500" : ""} />
              </button>
            )}
            {onClose && (
              <button 
                onClick={onClose} 
                className="p-2 hover:bg-white/10 rounded-full text-white/60 transition-colors"
                aria-label="Fermer"
              >
                <X size={24} />
              </button>
            )}
          </div>
        </div>

        {/* 2. BODY SCROLLABLE (C'est ici que ça corrige le bug tracklist) */}
        <div className="flex-1 overflow-y-auto p-6 pb-24 space-y-6 custom-scrollbar min-h-0">
          
          {/* Onglets (Tracklist / Notes...) */}
          <div className="flex gap-6 border-b border-white/10 pb-2 text-sm font-medium tracking-wide text-white/50">
            <button
              onClick={() => {
                if (activeTabControlled === undefined) setInternalTab("tracklist");
                onTabChange?.("tracklist");
              }}
              className={`${tab === "tracklist" ? "text-white border-b-2 border-amber-500 pb-2 -mb-2.5" : "hover:text-white transition-colors"}`}
            >
              TRACKLIST
            </button>
            <button
              onClick={() => {
                if (activeTabControlled === undefined) setInternalTab("sleeve");
                onTabChange?.("sleeve");
              }}
              className={`${tab === "sleeve" ? "text-white border-b-2 border-amber-500 pb-2 -mb-2.5" : "hover:text-white transition-colors"}`}
            >
              SLEEVE NOTES
            </button>
            <button
              onClick={() => {
                if (activeTabControlled === undefined) setInternalTab("story");
                onTabChange?.("story");
              }}
              className={`${tab === "story" ? "text-white border-b-2 border-amber-500 pb-2 -mb-2.5" : "hover:text-white transition-colors"}`}
            >
              STORY
            </button>
            <button
              onClick={() => {
                if (activeTabControlled === undefined) setInternalTab("vibe");
                onTabChange?.("vibe");
              }}
              className={`${tab === "vibe" ? "text-white border-b-2 border-amber-500 pb-2 -mb-2.5" : "hover:text-white transition-colors"}`}
            >
              VIBE
            </button>
          </div>

          {/* Contenu des onglets */}
          <div>
            {tab === "tracklist" ? (
              /* Onglet TRACKLIST */
              localAlbum.details.tracklist && localAlbum.details.tracklist.length > 0 ? (
                <div className="space-y-1">
                  {localAlbum.details.tracklist.map((track, i) => {
                    const isFocus = optimisticFocusIndices.includes(i);
                    // Handle both string and object formats
                    const trackTitle = typeof track === 'string' ? track : (track.title || track.name || '');
                    const trackDuration = typeof track === 'object' && track.duration ? track.duration : null;
                    
                    return (
                      <div
                        key={i}
                        onClick={() => handleToggleFocusTrack(localAlbum.id, i)}
                        className="group flex items-center py-3 px-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                      >
                        <span className="w-8 text-right text-white/30 text-xs font-mono mr-4">{i + 1}.</span>
                        <span className={`flex-1 font-medium truncate ${isFocus ? "text-[#FFB347]" : "text-white/80 group-hover:text-white"}`}>
                          {trackTitle}
                        </span>
                        {trackDuration && (
                          <span className="text-white/30 text-xs ml-2">{trackDuration}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-white/30 italic py-4">No tracklist available.</p>
                  {localAlbum.links.spotify_url && (
                    <button
                      onClick={handleRefetchTracklist}
                      disabled={isRefetchingTracklist}
                      className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-white text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isRefetchingTracklist ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Récupération en cours...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          <span>Récupérer la tracklist depuis Spotify</span>
                        </>
                      )}
                    </button>
                  )}
                  {!localAlbum.links.spotify_url && (
                    <p className="text-zinc-600 text-xs">Aucun lien Spotify disponible pour cet album</p>
                  )}
                </div>
              )
            ) : tab === "sleeve" ? (
              /* Onglet SLEEVE NOTES - Simplifié */
              <div className="transition-opacity duration-300">
                {/* Section Acquisition Log */}
                <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-4">
                  <h4 className="text-xs uppercase tracking-wider text-zinc-400 mb-3 amp-label">
                    Acquisition Log
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-zinc-500 mb-1 block">Lieu</label>
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
                      <label className="text-xs text-zinc-500 mb-1 block">Date</label>
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
                      <label className="text-xs text-zinc-500 mb-1 block">Prix</label>
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
                      <label className="text-xs text-zinc-500 mb-1 block">Condition</label>
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
                      <label className="text-xs text-zinc-500 mb-1 block amp-label">LOCATION / SHELF</label>
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
                {/* Notes personnelles */}
                <div className="mt-4 p-4 border border-zinc-700/50 rounded-lg bg-transparent">
                  <h4 className="text-xs uppercase tracking-wider text-zinc-400 mb-3 amp-label">
                    Notes personnelles
                  </h4>
                  <textarea
                    placeholder="Pensées, date d'écoute, souvenir…"
                    value={localAlbum.personal_notes ?? ""}
                    onBlur={(e) => {
                      const val = e.target.value;
                      const prev = localAlbum.personal_notes ?? "";
                      if (val !== prev) {
                        handleUpdatePurchaseData(localAlbum.id, { personal_notes: val || null });
                      }
                    }}
                    onChange={(e) => setLocalAlbum((prev) => ({ ...prev, personal_notes: e.target.value ?? null }))}
                    className="w-full min-h-[100px] bg-transparent border-none text-white text-sm font-mono focus:outline-none focus:ring-0 placeholder:text-zinc-600 resize-y"
                    rows={4}
                  />
                </div>
              </div>
            ) : tab === "vibe" ? (
              /* Onglet VIBE - Gommettes centrées */
              <div className="flex flex-col items-center py-12">
                <div className="grid grid-cols-3 gap-6 max-w-md">
                  {moodOptions.map((mood) => {
                    const isSelected = optimisticMoodColors.includes(mood.color);
                    return (
                      <button
                        key={mood.color}
                        onClick={() => {
                          const newColors = isSelected
                            ? optimisticMoodColors.filter(c => c !== mood.color)
                            : [...optimisticMoodColors, mood.color];
                          handleUpdateMoodColors(localAlbum.id, newColors);
                        }}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setTooltipPositionVibe({
                            x: rect.left + rect.width / 2,
                            y: rect.bottom + 8
                          });
                          setHoveredMoodVibe(mood.color);
                        }}
                        onMouseLeave={() => {
                          setHoveredMoodVibe(null);
                          setTooltipPositionVibe(null);
                        }}
                        className="group relative flex items-center justify-center w-12 h-12 outline-none cursor-pointer"
                      >
                        {/* Cercle de couleur - Affiné */}
                        <div 
                          className={`w-8 h-8 rounded-full transition-all duration-200 group-hover:scale-105 ${
                            isSelected 
                              ? 'ring-1 ring-white ring-offset-1 ring-offset-black' 
                              : 'opacity-70 hover:opacity-100'
                          }`}
                          style={{ backgroundColor: mood.color }}
                        />
                      </button>
                    );
                  })}
                </div>
                {/* Tooltip avec position fixed pour VIBE */}
                {hoveredMoodVibe && tooltipPositionVibe && (
                  <div
                    className="fixed z-[9999] pointer-events-none whitespace-nowrap bg-zinc-800 text-white text-[10px] font-medium px-2 py-1 rounded border border-white/10 shadow-xl"
                    style={{
                      left: `${tooltipPositionVibe.x}px`,
                      top: `${tooltipPositionVibe.y}px`,
                      transform: 'translate(-50%, 0)',
                      opacity: hoveredMoodVibe ? 1 : 0,
                      transition: 'opacity 200ms ease-out'
                    }}
                  >
                    {moodOptions.find(m => m.color === hoveredMoodVibe)?.label}
                    {/* Flèche pointant vers le haut */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-zinc-800"></div>
                  </div>
                )}
              </div>
            ) : (
              /* Onglet STORY - Editorial uniquement */
              <div className="flex-1 flex flex-col">
                {/* Section Editorial */}
                <div className="bg-white/5 border border-zinc-800/30 p-6 md:p-10 flex-1 flex flex-col rounded-lg transition-opacity duration-300">
                  <h4 className="text-xs uppercase tracking-wider text-zinc-400 mb-4 amp-label hidden md:block">
                    Editorial
                  </h4>
                  {localAlbum.editorial_notes ? (
                    <div className="flex-1 flex flex-col">
                      <div 
                        className="text-lg md:text-xl leading-relaxed md:leading-loose text-zinc-300 text-justify space-y-3 flex-1"
                        style={{ fontFamily: "var(--font-serif)" }}
                      >
                        {renderMarkdown(localAlbum.editorial_notes)}
                      </div>
                      <div className="amp-label text-xs text-zinc-500 mt-6 italic">
                        — ARCHIVED IN KISSA
                      </div>
                    </div>
                  ) : isGeneratingNotes ? (
                    /* Skeleton loader pendant la génération */
                    <div className="flex flex-col py-8">
                      <div className="flex items-center justify-center gap-2 mb-6 text-zinc-400 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Digging in the crates...</span>
                      </div>
                      <div className="space-y-3">
                        <div className="bg-zinc-800 rounded h-4 animate-pulse w-full"></div>
                        <div className="bg-zinc-800 rounded h-4 animate-pulse w-5/6"></div>
                        <div className="bg-zinc-800 rounded h-4 animate-pulse w-full"></div>
                        <div className="bg-zinc-800 rounded h-4 animate-pulse w-4/5"></div>
                        <div className="bg-zinc-800 rounded h-4 animate-pulse w-3/4"></div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 gap-4">
                      {storyError && (
                        <div className="text-red-400 text-sm text-center max-w-md">
                          {storyError}
                        </div>
                      )}
                      <button
                        onClick={() => handleGenerateNotes(localAlbum.id)}
                        disabled={isGeneratingNotes}
                        className="border border-zinc-600 hover:border-zinc-400 text-zinc-300 hover:text-white py-3 px-6 text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed rounded-sm"
                      >
                        {isGeneratingNotes ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Digging in the crates...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            GENERATE STORY
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
        </div>

        {/* 3. FOOTER (Sticky en bas - toujours visible au-dessus du scroll) */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-zinc-950 via-zinc-900/95 to-transparent flex flex-col items-center gap-3 pointer-events-none">
          <div className="w-full flex flex-col items-center gap-3 pointer-events-auto">
            {localAlbum.links.spotify_url ? (
              <a
                href={localAlbum.links.spotify_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => sounds?.playVinylStart()}
                className="w-full flex items-center justify-center gap-3 bg-white text-black font-bold py-3.5 rounded-full hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-white/10"
              >
                <Play size={20} fill="currentColor" />
                <span>LISTEN ON SPOTIFY</span>
              </a>
            ) : (
              <div className="w-full flex items-center justify-center gap-3 bg-zinc-800/50 text-zinc-500 font-bold py-3.5 rounded-full cursor-not-allowed">
                <Play size={20} />
                <span>NO SPOTIFY LINK</span>
              </div>
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
                className="w-full amp-label bg-red-600 hover:bg-red-700 text-white py-3 px-4 rounded-full font-semibold transition-colors flex items-center justify-center gap-2 touch-manipulation"
              >
              <Trash2 className="w-4 h-4" />
              DISCARD
            </button>
          )}
          </div>
        </div>

        {/* Toast d'erreur */}
        {errorToast && (
          <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-in slide-in-from-bottom-4">
            {errorToast}
          </div>
        )}

        {/* Toast de succès */}
        {successToast && (
          <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-in slide-in-from-bottom-4">
            {successToast}
          </div>
        )}
      </div>
    );
  }

  // Mode Compact (Grid Hover Overlay) - Layout existant
  return (
    <div className="flex flex-col h-full relative overflow-hidden bg-zinc-950">
      {/* Indicateur Saving/Saved - fixed en haut pour mobile */}
      {(isSavingMoodColors || moodColorsJustSaved) && tab === "vibe" && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900/95 border border-white/10 text-xs text-zinc-400">
          {isSavingMoodColors && (
            <>
              <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />
              <span>Saving...</span>
            </>
          )}
          {!isSavingMoodColors && moodColorsJustSaved && (
            <>
              <Check className="w-3 h-3 text-green-500 flex-shrink-0" />
              <span className="text-green-500">Saved</span>
            </>
          )}
        </div>
      )}
      {/* Zone A : Contenu scrollable (Haut) */}
      <div className="flex-1 overflow-y-auto scrollbar-hide p-4 pb-20">
        {/* Header */}
        <div className={`mb-4 ${compact ? 'mb-2' : ''} ${showActions && !compact ? 'pr-8' : ''} ${
          tab === "story" ? "md:mb-4" : ""
        }`}>
          {tab === "story" && (
            <div className="flex items-center gap-3 mb-2 md:hidden transition-opacity duration-300">
              <img 
                src={localAlbum.display.cover_image || "/placeholder.png"} 
                alt={localAlbum.display.title}
                className="w-10 h-10 rounded object-cover"
              />
            </div>
          )}
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className={`${headerSize} font-bold text-white leading-tight flex-1 min-w-0`}>
              {localAlbum.display.title}
            </h3>
            {showActions && (
              <button
                type="button"
                onClick={handleToggleFavorite}
                disabled={isTogglingFavorite}
                className="shrink-0 p-1 -m-1 rounded transition-colors hover:bg-white/10 disabled:opacity-50"
                aria-label={localAlbum.is_favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
              >
                <Heart
                  className={`w-5 h-5 transition-colors ${
                    localAlbum.is_favorite ? "fill-red-500 text-red-500" : "fill-none text-zinc-500"
                  }`}
                />
              </button>
            )}
          </div>
          {onArtistClick ? (
            <button
              type="button"
              onClick={() => onArtistClick(localAlbum.display.artist)}
              className={`${artistSize} text-zinc-400 cursor-pointer hover:underline hover:text-amber-500 transition-colors text-left`}
            >
              {localAlbum.display.artist}
            </button>
          ) : (
            <p className={`${artistSize} text-zinc-400`}>
              {localAlbum.display.artist}
            </p>
          )}
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
              if (activeTabControlled === undefined) setInternalTab("tracklist");
              onTabChange?.("tracklist");
            }}
            className={`${tabSize} pb-2 px-1 font-medium transition-colors ${
              tab === "tracklist"
                ? "text-white border-b-2 border-white"
                : "text-zinc-400 hover:text-zinc-300"
            }`}
          >
            TRACKLIST
          </button>
          <button
            onClick={() => {
              if (activeTabControlled === undefined) setInternalTab("sleeve");
              onTabChange?.("sleeve");
            }}
            className={`${tabSize} pb-2 px-1 font-medium transition-colors ${
              tab === "sleeve"
                ? "text-white border-b-2 border-white"
                : "text-zinc-400 hover:text-zinc-300"
            }`}
          >
            SLEEVE NOTES
          </button>
          <button
            onClick={() => {
              if (activeTabControlled === undefined) setInternalTab("story");
              onTabChange?.("story");
            }}
            className={`${tabSize} pb-2 px-1 font-medium transition-colors ${
              tab === "story"
                ? "text-white border-b-2 border-white"
                : "text-zinc-400 hover:text-zinc-300"
            }`}
          >
            STORY
          </button>
          <button
            onClick={() => {
              if (activeTabControlled === undefined) setInternalTab("vibe");
              onTabChange?.("vibe");
            }}
            className={`${tabSize} pb-2 px-1 font-medium transition-colors ${
              tab === "vibe"
                ? "text-white border-b-2 border-white"
                : "text-zinc-400 hover:text-zinc-300"
            }`}
          >
            VIBE
          </button>
        </div>

        {/* Contenu des onglets */}
        <div>
          {tab === "tracklist" ? (
            /* Onglet TRACKLIST */
            localAlbum.details.tracklist && localAlbum.details.tracklist.length > 0 ? (
              <ul className={compact ? "space-y-0" : "space-y-1"} role="list">
                {localAlbum.details.tracklist.map((track, i) => {
                  const isFocus = optimisticFocusIndices.includes(i);
                  // Handle both string and object formats
                  const trackTitle = typeof track === 'string' ? track : (track.title || track.name || '');
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
                        {trackTitle}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className={`${contentSize} space-y-4`}>
                <p className="text-zinc-500">Aucune piste disponible</p>
                {localAlbum.links.spotify_url && (
                  <button
                    onClick={handleRefetchTracklist}
                    disabled={isRefetchingTracklist}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-white text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isRefetchingTracklist ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Récupération en cours...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        <span>Récupérer la tracklist depuis Spotify</span>
                      </>
                    )}
                  </button>
                )}
                {!localAlbum.links.spotify_url && (
                  <p className="text-zinc-600 text-xs">Aucun lien Spotify disponible pour cet album</p>
                )}
              </div>
            )
          ) : tab === "sleeve" ? (
            /* Onglet SLEEVE NOTES - Simplifié */
            <div className="transition-opacity duration-300">
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
              {/* Notes personnelles */}
              <div className={`mt-4 ${compact ? "p-3" : "p-4"} border border-zinc-700/50 rounded-lg bg-transparent`}>
                <h4 className={`text-xs uppercase tracking-wider text-zinc-400 ${compact ? "mb-2" : "mb-3"} amp-label`}>
                  Notes personnelles
                </h4>
                <textarea
                  placeholder="Pensées, date d'écoute, souvenir…"
                  value={localAlbum.personal_notes ?? ""}
                  onBlur={(e) => {
                    const val = e.target.value;
                    const prev = localAlbum.personal_notes ?? "";
                    if (val !== prev) {
                      handleUpdatePurchaseData(localAlbum.id, { personal_notes: val || null });
                    }
                  }}
                  onChange={(e) => setLocalAlbum((prev) => ({ ...prev, personal_notes: e.target.value ?? null }))}
                  className="w-full min-h-[100px] bg-transparent border-none text-white text-sm font-mono focus:outline-none focus:ring-0 placeholder:text-zinc-600 resize-y"
                  rows={4}
                />
              </div>
            </div>
          ) : tab === "vibe" ? (
            /* Onglet VIBE - Gommettes centrées */
            <div className="flex flex-col items-center py-12">
              <div className="grid grid-cols-3 gap-6 max-w-md">
                {moodOptions.map((mood) => {
                  const isSelected = optimisticMoodColors.includes(mood.color);
                  return (
                    <button
                      key={mood.color}
                      onClick={() => {
                        const newColors = isSelected
                          ? optimisticMoodColors.filter(c => c !== mood.color)
                          : [...optimisticMoodColors, mood.color];
                        handleUpdateMoodColors(localAlbum.id, newColors);
                      }}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltipPositionVibe({
                          x: rect.left + rect.width / 2,
                          y: rect.bottom + 8
                        });
                        setHoveredMoodVibe(mood.color);
                      }}
                      onMouseLeave={() => {
                        setHoveredMoodVibe(null);
                        setTooltipPositionVibe(null);
                      }}
                      className="group relative flex items-center justify-center w-12 h-12 outline-none cursor-pointer"
                    >
                      {/* Cercle de couleur - Affiné */}
                      <div 
                        className={`w-8 h-8 rounded-full transition-all duration-200 group-hover:scale-105 ${
                          isSelected 
                            ? 'ring-1 ring-white ring-offset-1 ring-offset-black' 
                            : 'opacity-70 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: mood.color }}
                      />
                    </button>
                  );
                })}
              </div>
              {/* Tooltip avec position fixed pour VIBE */}
              {hoveredMoodVibe && tooltipPositionVibe && (
                <div
                  className="fixed z-[9999] pointer-events-none whitespace-nowrap bg-zinc-800 text-white text-[10px] font-medium px-2 py-1 rounded border border-white/10 shadow-xl"
                  style={{
                    left: `${tooltipPositionVibe.x}px`,
                    top: `${tooltipPositionVibe.y}px`,
                    transform: 'translate(-50%, 0)',
                    opacity: hoveredMoodVibe ? 1 : 0,
                    transition: 'opacity 200ms ease-out'
                  }}
                >
                  {moodOptions.find(m => m.color === hoveredMoodVibe)?.label}
                  {/* Flèche pointant vers le haut */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-zinc-800"></div>
                </div>
              )}
            </div>
          ) : (
            /* Onglet STORY - Editorial uniquement */
            <div className={`${compact ? 'space-y-3' : tab === "story" ? 'flex-1 flex flex-col' : 'space-y-6'}`}>
              {/* Section Editorial */}
              <div className={`${compact ? 'bg-zinc-900/80 border border-zinc-800/50 p-4' : tab === "story" ? 'bg-white/5 border border-zinc-800/30 p-6 md:p-10 flex-1 flex flex-col' : 'bg-white/5 border border-zinc-800/30 p-10'} rounded-lg transition-opacity duration-300`}>
                <h4 className={`text-xs uppercase tracking-wider text-zinc-400 ${compact ? 'mb-3' : 'mb-4'} amp-label ${
                  tab === "story" ? "hidden md:block" : ""
                }`}>
                  Editorial
                </h4>
                {localAlbum.editorial_notes ? (
                  <div className="flex-1 flex flex-col">
                    <div 
                      className={`${
                        compact 
                          ? 'text-sm leading-relaxed' 
                          : tab === "story" 
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
                ) : isGeneratingNotes ? (
                  /* Skeleton loader pendant la génération */
                  <div className={`flex flex-col ${compact ? 'py-4' : 'py-8'}`}>
                    <div className="flex items-center justify-center gap-2 mb-6 text-zinc-400 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Digging in the crates...</span>
                    </div>
                    <div className="space-y-3">
                      <div className="bg-zinc-800 rounded h-4 animate-pulse w-full"></div>
                      <div className="bg-zinc-800 rounded h-4 animate-pulse w-5/6"></div>
                      <div className="bg-zinc-800 rounded h-4 animate-pulse w-full"></div>
                      <div className="bg-zinc-800 rounded h-4 animate-pulse w-4/5"></div>
                      <div className="bg-zinc-800 rounded h-4 animate-pulse w-3/4"></div>
                    </div>
                  </div>
                ) : (
                  <div className={`flex flex-col items-center justify-center ${compact ? 'py-4' : 'py-8'} gap-4`}>
                    {storyError && (
                      <div className="text-red-400 text-sm text-center max-w-md">
                        {storyError}
                      </div>
                    )}
                    <button
                      onClick={() => handleGenerateNotes(localAlbum.id)}
                      disabled={isGeneratingNotes}
                      className={`border border-zinc-600 hover:border-zinc-400 text-zinc-300 hover:text-white ${compact ? 'py-2 px-4 text-xs' : 'py-3 px-6 text-sm'} font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed rounded-sm`}
                    >
                      {isGeneratingNotes ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {compact ? "Loading..." : "Digging in the crates..."}
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          GENERATE STORY
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
                  tab === "story" ? "hidden md:flex" : ""
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
      </div>

      {/* Barre LISTEN (Sticky Bottom) */}
      {onPlay && localAlbum.links.spotify_id && (
        <div className="absolute bottom-0 left-0 right-0 z-50 h-12 bg-zinc-950/80 backdrop-blur border-t border-white/10 flex items-center justify-end px-4">
          <button 
            onClick={onPlay}
            className="text-white hover:text-amber-500 transition-colors flex items-center gap-2 font-mono text-xs"
          >
            <Play className="w-3 h-3" />
            LISTEN
          </button>
        </div>
      )}

      {/* Toast d'erreur */}
      {errorToast && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-in slide-in-from-bottom-4">
          {errorToast}
        </div>
      )}

      {/* Toast de succès */}
      {successToast && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-in slide-in-from-bottom-4">
          {successToast}
        </div>
      )}
    </div>
  );
}