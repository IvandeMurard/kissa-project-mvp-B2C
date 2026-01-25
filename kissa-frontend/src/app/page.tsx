"use client";

import { useState, useEffect, useMemo, useCallback } from "react";

import { Loader2, Search, Trash2, Camera, Play, X, Keyboard, Plus, Disc, ExternalLink, Edit, Library, Scan, Settings, Lock, Unlock, Sparkles } from "lucide-react";

import { createClient } from "@supabase/supabase-js";

import { useHaptic } from "@/hooks/useHaptic";
import { useKissaSound } from "@/hooks/useKissaSound";
import { SoundToggle } from "@/components/SoundToggle";
import { AlbumDetailView } from "@/components/AlbumDetailView";

// --- TYPES ---

interface Album {

  id: string;

  display: { artist: string; title: string; cover_image: string };

  links: { spotify_url: string; discogs_url: string; spotify_id?: string };

  details: { year: string; label: string; genre: string[]; tracklist?: string[] };

  purchase_data?: { date?: string; location?: string; price?: number; condition?: string } | null;

  editorial_notes?: string | null;

}



interface SearchCandidate {

  discogs_id: number;

  title: string;

  artist: string;

  year: string;

  label: string;

  thumb: string;

}



export default function Home() {

  // Configuration de l'URL de l'API (utilise NEXT_PUBLIC_API_URL en production, localhost en dev)
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

  // Initialisation du client Supabase
  const supabase = useMemo(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error("⚠️ NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_KEY manquant");
      return null;
    }
    
    return createClient(supabaseUrl, supabaseKey);
  }, []);

  const [allAlbums, setAllAlbums] = useState<Album[]>([]);
  const [filteredAlbums, setFilteredAlbums] = useState<Album[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);
  const [isLoadingInProgress, setIsLoadingInProgress] = useState(false);

  

  // --- ÉTATS RECHERCHE MANUELLE ---

  const [showManualSearch, setShowManualSearch] = useState(false);

  const [manualSearchQuery, setManualSearchQuery] = useState("");

  const [searchResults, setSearchResults] = useState<SearchCandidate[]>([]);

  const [isSearching, setIsSearching] = useState(false); // Loading pendant la recherche

  const [hasSearched, setHasSearched] = useState(false); // NOUVEAU : Pour savoir si on a déjà appuyé sur Entrée

  

  // États UI Globaux

  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<"recent" | "artist" | "year">("recent");

  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);

  const [availableGenres, setAvailableGenres] = useState<string[]>([]);

  const [currentTrack, setCurrentTrack] = useState<Album | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);

  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [modalActiveTab, setModalActiveTab] = useState<"tracklist" | "sleeve" | "story">("tracklist");

  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Bloquer le scroll du body quand la modale est ouverte
  useEffect(() => {
    if (selectedAlbum) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedAlbum]);

  // --- ÉTATS VUES ET MODE GESTION ---
  const [currentView, setCurrentView] = useState<"SHELF" | "DIG" | "SETUP">("DIG");
  const [isManageMode, setIsManageMode] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Haptic feedback hook
  const haptic = useHaptic();

  // Sound design hook
  const sounds = useKissaSound();

  // Déclaration de fetchLibrary avec useCallback AVANT le useEffect
  const fetchLibrary = useCallback(async () => {

    console.log("📚 fetchLibrary appelée, supabase:", supabase ? "disponible" : "null");

    if (!supabase) {
      console.error("⚠️ Supabase client non initialisé dans fetchLibrary");
      return;
    }

    // Protection contre les appels simultanés
    if (isLoadingInProgress) {
      console.log("⏸️ Chargement déjà en cours, abandon de l'appel");
      return;
    }

    setIsLoadingInProgress(true);
    console.log("🔄 Début du chargement de la bibliothèque...");
    setIsLoadingLibrary(true);

    try {

      const { data, error } = await supabase
        .from("albums")
        .select("*")
        .order("created_at", { ascending: false });

      console.log("📦 Données Supabase reçues:", { 
        dataCount: data?.length || 0, 
        hasError: !!error,
        error: error?.message 
      });

      if (error) {
        console.error("❌ Erreur Supabase lors du chargement:", error);
        alert(`❌ Erreur lors du chargement de la bibliothèque : ${error.message || "Erreur inconnue"}`);
        setIsLoadingLibrary(false);
        return;
      }

      const formattedLibrary: Album[] = (data || []).map((item: any) => ({

        id: item.id,

        display: { artist: item.artist, title: item.title, cover_image: item.cover_image },

        links: { 

          spotify_url: item.spotify_url, 

          discogs_url: item.discogs_url,

          spotify_id: item.spotify_url ? item.spotify_url.split('/album/')[1]?.split('?')[0] : null

        },

        details: { year: item.year, label: item.label, genre: item.genre || [], tracklist: item.tracklist || [] },

        purchase_data: item.purchase_data || null,

        editorial_notes: item.editorial_notes || null,

      }));

      console.log(`✅ ${formattedLibrary.length} album(s) chargé(s) et formatés`);
      console.log("📋 Détails des albums:", formattedLibrary.map(a => `${a.display.artist} - ${a.display.title}`));
      
      setAllAlbums(formattedLibrary);
      console.log("✅ allAlbums mis à jour avec", formattedLibrary.length, "album(s)");

      const allGenres = formattedLibrary.flatMap(a => a.details.genre || []);

      setAvailableGenres(Array.from(new Set(allGenres)).sort());
      console.log("✅ Genres mis à jour:", Array.from(new Set(allGenres)).sort());

    } catch (error) { 
      console.error("❌ Erreur lors du chargement:", error);
      const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
      alert(`❌ Erreur lors du chargement de la bibliothèque : ${errorMessage}`);
    } finally {
      setIsLoadingLibrary(false);
      setIsLoadingInProgress(false);
      console.log("✅ Chargement terminé, isLoadingLibrary = false");
    }

  }, [supabase, isLoadingInProgress]);



  useEffect(() => { 
    console.log("🔄 useEffect de chargement déclenché, supabase:", supabase ? "disponible" : "null", "hasAttemptedLoad:", hasAttemptedLoad);
    
    if (!supabase) {
      console.log("⏳ Supabase non disponible, attente...");
      // Mettre isLoadingLibrary à false après un délai si supabase reste null
      const timeout = setTimeout(() => {
        console.log("⏱️ Timeout: supabase toujours null après 1 seconde, arrêt du chargement");
        setIsLoadingLibrary(false);
      }, 1000);
      
      return () => {
        clearTimeout(timeout);
      };
    }
    
    // Ne charger qu'une fois par changement de supabase
    if (!hasAttemptedLoad) {
      console.log("📚 Première tentative de chargement, appel de fetchLibrary...");
      setHasAttemptedLoad(true);
      fetchLibrary();
    } else {
      console.log("⏭️ Chargement déjà tenté, ignore cet appel");
    }
  }, [supabase, fetchLibrary, hasAttemptedLoad]);



  const handlePlay = (album: Album) => { 
    if (album.links.spotify_id) { 
      sounds.playVinylStart();
      setCurrentTrack(album); 
      setIsPlaying(true); 
    }
  };

  const handleStop = () => { setIsPlaying(false); setCurrentTrack(null); };



  const handleDelete = async (id: string, e: React.MouseEvent) => {

    e.stopPropagation();

    if (!confirm("Supprimer cet album ?")) return;

    haptic.heavy();

    try {

      const response = await fetch(`${API_URL}/album/${id}`, { method: "DELETE" });

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`);
      }

      setAllAlbums((prev) => prev.filter((album) => album.id !== id));

      if (currentTrack?.id === id) handleStop();

    } catch (error) { 
      const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
      console.error("❌ Erreur lors de la suppression:", error);
      alert(`❌ Erreur lors de la suppression : ${errorMessage}`);
    }

  };



  const handleDeleteFromModal = async () => {

    if (!selectedAlbum) return;

    haptic.heavy();

    try {

      const response = await fetch(`${API_URL}/album/${selectedAlbum.id}`, { method: "DELETE" });

      if (!response.ok) {
        let errorMessage = `Erreur ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.message || errorMessage;
        } catch (e) {
          // Si la réponse n'est pas du JSON, utiliser le message par défaut
        }
        throw new Error(errorMessage);
      }

      console.log(`✅ Album supprimé : ${selectedAlbum.display.title}`);
      setAllAlbums((prev) => prev.filter((album) => album.id !== selectedAlbum.id));

      if (currentTrack?.id === selectedAlbum.id) handleStop();

      setSelectedAlbum(null);

    } catch (error) { 
      const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
      console.error("❌ Erreur lors de la suppression:", error);
      alert(`❌ Erreur lors de la suppression : ${errorMessage}`);
    }

  };




  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {

    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    setIsLoading(true);

    console.log(`📷 Début de l'analyse de la photo : ${file.name}`);

    const formData = new FormData();
    formData.append("file", file);

    // Créer un AbortController pour gérer les timeouts
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // Timeout de 2 minutes

    try {

      const response = await fetch(`${API_URL}/scan`, { 
        method: "POST", 
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) { 
        const result = await response.json();
        const title = result.display?.title || "Album";
        const artist = result.display?.artist || "Artiste";

        await new Promise(resolve => setTimeout(resolve, 500));
        await fetchLibrary(); 

        setSuccessToast(`Album identifié : ${title} - ${artist}`);
        haptic.medium();

        e.target.value = ""; 
      } else { 
        // Gestion d'erreur détaillée
        let errorMessage = "Erreur lors de l'analyse de la photo.";
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.message || errorMessage;
        } catch (parseError) {
          errorMessage = `Erreur ${response.status}: ${response.statusText}`;
        }
        console.error("❌ Erreur lors du scan:", errorMessage);
        alert(`❌ ${errorMessage}`);
      }

    } catch (error) { 
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        console.error("⏱️ Timeout : Le traitement prend trop de temps");
        alert("⏱️ Le traitement prend plus de temps que prévu. Veuillez réessayer.");
      } else {
        console.error("❌ Erreur serveur lors du scan:", error);
        alert(`❌ Erreur serveur : ${error instanceof Error ? error.message : "Impossible de contacter le serveur"}`); 
      }
    } finally { 
      setIsLoading(false); 
    }

  };



  // --- LOGIQUE RECHERCHE CORRIGÉE ---



  // Quand on tape dans le champ

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {

    setManualSearchQuery(e.target.value);

    setHasSearched(false); // On cache le message d'erreur dès qu'on modifie le texte

  };



  // Quand on valide le formulaire

  const handleSearchSubmit = async (e: React.FormEvent) => {

    e.preventDefault(); // Bloque le rechargement de page

    if (!manualSearchQuery.trim()) return;

    

    setIsSearching(true);

    setHasSearched(true); // On indique qu'une recherche a été tentée

    setSearchResults([]); 

    

    try {

      console.log("🔍 Envoi de la requête de recherche :", manualSearchQuery);
      console.log("🔍 URL :", `${API_URL}/search-candidates`);

      const response = await fetch(`${API_URL}/search-candidates`, {

        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({ query: manualSearchQuery }),

      });

      console.log("✅ Réponse reçue, status:", response.status);

      if (!response.ok) {
        let errorMessage = `Erreur ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.message || errorMessage;
        } catch (parseError) {
          try {
            const errorText = await response.text();
            errorMessage = errorText || errorMessage;
          } catch (e) {
            // Utiliser le message par défaut si on ne peut pas parser
          }
        }
        console.error("❌ Erreur HTTP:", response.status, errorMessage);
        alert(`❌ Erreur lors de la recherche : ${errorMessage}`);
        return;
      }

      const data = await response.json();
      console.log("📦 Données reçues:", data);
      console.log(`✅ ${data.length || 0} résultat(s) trouvé(s)`);

      setSearchResults(data);

    } catch (error) { 

      console.error("❌ Erreur lors de la recherche:", error);
      const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
      alert(`❌ Erreur technique lors de la recherche : ${errorMessage}`); 

    } finally { 

      setIsSearching(false);

    }

  };



  const handleSelectCandidate = async (candidate: SearchCandidate) => {

    setIsLoading(true);

    try {

      const response = await fetch(`${API_URL}/add-by-id`, {

        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({ discogs_id: candidate.discogs_id }),

      });

      

      if (response.ok) {
        // Attendre un court délai pour s'assurer que la base de données est à jour
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Rafraîchir la bibliothèque
        await fetchLibrary();

        setSuccessToast("Album ajouté");
        closeManualSearch();

      } else {
        // Gestion d'erreur détaillée
        let errorMessage = "Erreur lors de l'ajout.";
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.message || errorMessage;
        } catch (e) {
          // Si la réponse n'est pas du JSON, utiliser le message par défaut
          errorMessage = `Erreur ${response.status}: ${response.statusText}`;
        }
        alert(`❌ ${errorMessage}`);
      }

    } catch (error) { 
      console.error("Erreur lors de l'ajout de l'album:", error);
      alert(`❌ Erreur serveur : ${error instanceof Error ? error.message : "Impossible de contacter le serveur"}`); 
    } finally { 
      setIsLoading(false); 
    }

  };



  const closeManualSearch = () => {

    setShowManualSearch(false);

    setSearchResults([]);

    setManualSearchQuery("");

    setHasSearched(false);

  };



  // Logique de filtrage et tri
  useEffect(() => {
    console.log("🔄 useEffect de filtrage déclenché, allAlbums:", allAlbums.length, "searchQuery:", searchQuery, "selectedGenre:", selectedGenre);
    
    let filtered = [...allAlbums];

    // Filtrage par recherche
    if (searchQuery.trim()) {
      const queryLower = searchQuery.toLowerCase();
      filtered = filtered.filter((album) =>
        album.display.title.toLowerCase().includes(queryLower) ||
        album.display.artist.toLowerCase().includes(queryLower)
      );
      console.log(`🔍 Filtrage par recherche "${searchQuery}": ${filtered.length} résultat(s)`);
    }

    // Filtrage par genre
    if (selectedGenre) {
      filtered = filtered.filter((album) => album.details.genre.includes(selectedGenre));
      console.log(`🎵 Filtrage par genre "${selectedGenre}": ${filtered.length} résultat(s)`);
    }

    // Tri
    filtered.sort((a, b) => {
      switch (sortOption) {
        case "artist":
          return a.display.artist.localeCompare(b.display.artist);
        case "year":
          const yearA = parseInt(a.details.year) || 0;
          const yearB = parseInt(b.details.year) || 0;
          if (yearB !== yearA) return yearB - yearA;
          return a.display.artist.localeCompare(b.display.artist);
        case "recent":
        default:
          // Tri par created_at (déjà trié depuis Supabase, mais on garde pour cohérence)
          return 0;
      }
    });

    console.log(`✅ Albums filtrés: ${filtered.length} sur ${allAlbums.length} total`);
    setFilteredAlbums(filtered);
  }, [allAlbums, searchQuery, selectedGenre, sortOption]);

  useEffect(() => {
    if (!successToast) return;
    const t = setTimeout(() => setSuccessToast(null), 3000);
    return () => clearTimeout(t);
  }, [successToast]);

  // Détection de la taille d'écran pour définir la vue initiale
  useEffect(() => {
    setIsMounted(true);
    // Définir la vue initiale selon la taille d'écran
    if (typeof window !== "undefined") {
      if (window.innerWidth > 768) {
        setCurrentView("SHELF");
      } else {
        setCurrentView("DIG");
      }
    }
  }, []);

  // Composant BottomNav
  const BottomNav = () => (
    <nav className="fixed bottom-0 left-0 right-0 w-full bg-black/80 backdrop-blur-md border-t border-zinc-800 z-50">
      <div className="flex items-center justify-around h-16 px-4">
        <button
          onClick={() => {
            setCurrentView("SHELF");
            haptic.light();
          }}
          className={`flex flex-col items-center justify-center gap-1 flex-1 transition-colors ${
            currentView === "SHELF" ? "text-white" : "text-neutral-500"
          }`}
        >
          <Library className={`w-5 h-5 ${currentView === "SHELF" ? "text-white" : "text-neutral-500"}`} />
          <span className="text-[10px] uppercase tracking-wider amp-label">SHELF</span>
        </button>
        <button
          onClick={() => {
            setCurrentView("DIG");
            haptic.light();
          }}
          className={`flex flex-col items-center justify-center gap-1 flex-1 transition-colors ${
            currentView === "DIG" ? "text-white" : "text-neutral-500"
          }`}
        >
          <Scan className={`w-5 h-5 ${currentView === "DIG" ? "text-white" : "text-neutral-500"}`} />
          <span className="text-[10px] uppercase tracking-wider amp-label">DIG</span>
        </button>
        <button
          onClick={() => {
            setCurrentView("SETUP");
            haptic.light();
          }}
          className={`flex flex-col items-center justify-center gap-1 flex-1 transition-colors ${
            currentView === "SETUP" ? "text-white" : "text-neutral-500"
          }`}
        >
          <Settings className={`w-5 h-5 ${currentView === "SETUP" ? "text-white" : "text-neutral-500"}`} />
          <span className="text-[10px] uppercase tracking-wider amp-label">SETUP</span>
        </button>
      </div>
    </nav>
  );

  return (

    <main className="min-h-screen bg-[#080808] text-neutral-200 font-sans pb-24">

      {/* HEADER - Affiché uniquement pour SHELF */}
      {currentView === "SHELF" && (
        <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-md border-b border-white/5 px-6 py-4 flex flex-col md:flex-row justify-between gap-4">
          <div className="flex items-center gap-6">
            <h1 className="lightbox-sign inline-block rounded-xl px-4 py-2 text-sm">喫茶 Kissa</h1>
            {/* Toggle Mode Gestion */}
            <button
              onClick={() => {
                setIsManageMode(!isManageMode);
                haptic.light();
                sounds.playSwitch();
              }}
              className="flex items-center justify-center w-8 h-8 rounded-full border border-white/10 hover:bg-white hover:text-black transition-all"
              title={isManageMode ? "Verrouiller" : "Déverrouiller"}
            >
              {isManageMode ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative group w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-500 group-focus-within:text-white" />
              <input 
                type="text" 
                placeholder="Artist, Title, Cat. No..." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-full py-1.5 pl-9 pr-4 text-xs text-zinc-100 focus:outline-none focus:border-kissa-amber/50 transition-all placeholder:text-zinc-500"
              />
            </div>
            <span className="bg-zinc-800 text-zinc-300 border border-zinc-700 font-mono text-xs px-2 py-1 rounded-sm">{filteredAlbums.length} LP</span>
          </div>
        </header>
      )}



      {/* VUE SHELF */}
      {currentView === "SHELF" && (
        <>
          {/* FILTRES GENRES */}
          {availableGenres.length > 0 && (
            <div className="px-6 py-4 flex gap-2 overflow-x-auto scrollbar-hide">
              <button onClick={() => setSelectedGenre(null)} className={`amp-label text-sm font-semibold px-3 py-1 rounded-sm transition-all duration-300 ease-in-out ${!selectedGenre ? 'amp-button-active font-bold' : 'text-zinc-500 border border-zinc-800 bg-transparent hover:border-zinc-500 hover:text-zinc-200'}`}>ALL</button>
              {availableGenres.map(g => (
                <button key={g} onClick={() => { sounds.playSwitch(); setSelectedGenre(selectedGenre === g ? null : g); }} className={`amp-label text-sm font-semibold uppercase tracking-wider px-3 py-1 rounded-sm transition-all duration-300 ease-in-out ${selectedGenre === g ? 'amp-button-active font-bold' : 'text-zinc-500 border border-zinc-800 bg-transparent hover:border-zinc-500 hover:text-zinc-200'}`}>{g}</button>
              ))}
            </div>
          )}

          {/* BARRE D'OUTILS */}
          <div className="px-6 py-4 border-b border-white/5">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-end">
              {/* Tri uniquement - Recherche supprimée */}
              <div className="flex items-center gap-2">
                <label className="amp-label text-neutral-500">SORT:</label>
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as "recent" | "artist" | "year")}
                  className="bg-[#111] border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-white/20 transition-all cursor-pointer"
                >
                  <option value="recent">Ajouté récemment</option>
                  <option value="artist">Artiste (A-Z)</option>
                  <option value="year">Année</option>
                </select>
              </div>
            </div>
          </div>

          {/* GRILLE D'ALBUMS */}
          <div className="px-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 mt-4">
            {isLoadingLibrary ? (
              // Skeletons pendant le chargement
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-square bg-[#111] border border-white/5 animate-pulse">
                  <div className="w-full h-full bg-neutral-800/50"></div>
                </div>
              ))
            ) : !supabase ? (
              // Message d'erreur si Supabase n'est pas configuré
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
                <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6 max-w-md">
                  <h3 className="text-white font-bold text-lg mb-2">Configuration manquante</h3>
                  <p className="text-red-300 text-sm mb-4">
                    Les variables d'environnement Supabase ne sont pas configurées.
                  </p>
                  <div className="text-neutral-400 text-xs space-y-3 text-left">
                    <div>
                      <p className="font-semibold mb-2">Pour le développement local :</p>
                      <ol className="list-decimal list-inside space-y-1 ml-2">
                        <li>Créez un fichier <code className="bg-black/50 px-1 rounded">.env.local</code> dans le dossier <code className="bg-black/50 px-1 rounded">kissa-frontend</code></li>
                        <li>Ajoutez les variables :</li>
                      </ol>
                      <pre className="bg-black/50 p-2 rounded mt-2 text-[10px] overflow-x-auto">
{`NEXT_PUBLIC_SUPABASE_URL=votre_url
NEXT_PUBLIC_SUPABASE_KEY=votre_cle`}
                      </pre>
                    </div>
                    <div>
                      <p className="font-semibold mb-2">Pour Vercel (production) :</p>
                      <ol className="list-decimal list-inside space-y-1 ml-2">
                        <li>Allez dans votre projet Vercel → Settings → Environment Variables</li>
                        <li>Ajoutez <code className="bg-black/50 px-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code> et <code className="bg-black/50 px-1 rounded">NEXT_PUBLIC_SUPABASE_KEY</code></li>
                        <li>Redéployez l'application</li>
                      </ol>
                    </div>
                    <div className="mt-3 pt-3 border-t border-red-500/30">
                      <p className="text-red-300 text-[10px]">
                        Obtenez vos clés Supabase :{" "}
                        <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="underline hover:text-red-200">
                          Dashboard Supabase → Settings → API
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : filteredAlbums.length === 0 && allAlbums.length === 0 ? (
              // Message si aucune donnée n'est chargée
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
                <div className="bg-neutral-900/50 border border-white/10 rounded-lg p-6 max-w-md">
                  <h3 className="amp-label text-white text-lg mb-2 font-semibold">YOUR SHELF IS EMPTY</h3>
                  <p className="text-neutral-400 text-sm mb-4">
                    Start digging.
                  </p>
                  <p className="text-neutral-500 text-xs">
                    Use the camera to scan or dig manually.
                  </p>
                </div>
              </div>
            ) : filteredAlbums.length === 0 ? (
              // Message si les filtres ne donnent aucun résultat
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
                <div className="bg-neutral-900/50 border border-white/10 rounded-lg p-6 max-w-md">
                  <h3 className="amp-label text-white text-lg mb-2 font-semibold">NO MATCH</h3>
                  <p className="text-neutral-400 text-sm">
                    Try another query.
                  </p>
                </div>
              </div>
            ) : (
              filteredAlbums.map((album) => (
                <div key={album.id} className="group relative aspect-square bg-[#111] overflow-hidden cursor-default border border-white/5">
                  <img 
                    src={album.display.cover_image || "/placeholder.png"} 
                    alt={album.display.title}
                    onClick={(e) => {
                      haptic.light();
                      // Sur mobile uniquement : ouvrir la modale
                      if (window.innerWidth < 768) {
                        setSelectedAlbum(album);
                      }
                    }}
                    className={`w-full h-full object-cover transition-transform duration-500 ease-out md:relative md:z-10 md:group-hover:-translate-x-full group-hover:scale-110 md:group-hover:scale-100 cursor-pointer md:cursor-default ${currentTrack?.id === album.id ? 'opacity-50 grayscale' : ''}`}
                  />

                  <div className="absolute inset-0 bg-black/90 backdrop-blur-sm translate-y-full group-hover:translate-y-0 md:translate-y-0 md:z-0 transition-opacity duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] md:opacity-0 md:group-hover:opacity-100 overflow-hidden">
                    {/* Boutons d'action - affichés uniquement si isManageMode est true */}
                    {isManageMode && (
                      <div className="absolute top-3 right-3 z-10 flex gap-2">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAlbum(album);
                          }} 
                          className="text-neutral-700 hover:text-blue-400 transition-colors bg-black/50 p-1 rounded"
                          title="Éditer"
                        >
                          <Edit className="w-3 h-3" />
                        </button>
                        <button 
                          onClick={(e) => handleDelete(album.id, e)} 
                          className="text-neutral-700 hover:text-red-500 transition-colors bg-black/50 p-1 rounded" 
                          title="DISCARD"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    <AlbumDetailView
                      album={album}
                      onUpdateAlbum={(updated) => {
                        setAllAlbums(prev => prev.map(a => a.id === updated.id ? updated : a));
                        fetchLibrary();
                      }}
                      onPlay={() => handlePlay(album)}
                      showActions={false}
                      compact={true}
                      API_URL={API_URL}
                    />
                  </div>

                  {currentTrack?.id === album.id && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-12 h-12 rounded-full border-2 border-white/20 animate-[spin_3s_linear_infinite] flex items-center justify-center"><div className="w-3 h-3 bg-red-500 rounded-full" /></div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}



      {/* MODAL RECHERCHE MANUELLE */}

      {showManualSearch && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">

          <div className="bg-[#111] border border-white/10 rounded-lg w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">

            

            {/* Header Modal */}

            <div className="p-4 border-b border-white/10 flex justify-between items-center">

              <h3 className="amp-label text-sm font-semibold text-white">DIGGING</h3>

              <button onClick={closeManualSearch} className="text-neutral-500 hover:text-white"><X className="w-4 h-4" /></button>

            </div>



            {/* Formulaire Recherche */}

            <div className="p-4 bg-black/50">

              <form onSubmit={handleSearchSubmit} className="flex gap-2">

                <input 

                  autoFocus

                  type="text" 

                  placeholder="Artist, Title, Cat. No..." 

                  value={manualSearchQuery}

                  onChange={handleInputChange} // Utilise la nouvelle fonction qui reset l'erreur

                  className="flex-grow bg-[#222] border border-neutral-700 rounded px-4 py-2 text-sm focus:border-white focus:outline-none placeholder:text-neutral-600 text-white"

                />

                <button type="submit" disabled={isSearching} className="bg-white text-black px-4 py-2 rounded text-sm font-bold uppercase hover:bg-neutral-200 disabled:opacity-50">

                  {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}

                </button>

              </form>

            </div>



            {/* Liste de Résultats */}

            <div className="flex-grow overflow-y-auto p-2 space-y-2 min-h-[100px]">

              

              {/* MESSAGE D'ERREUR CORRIGÉ : S'affiche uniquement si on a cherché ET qu'il n'y a pas de résultats */}

              {hasSearched && !isSearching && searchResults.length === 0 && (

                 <div className="text-center py-8 text-neutral-500 text-xs">

                   Aucun résultat trouvé. Essaie avec un autre terme.

                 </div>

              )}



              {/* MESSAGE D'ATTENTE */}

              {!hasSearched && searchResults.length === 0 && !isSearching && (

                 <div className="text-center py-8 text-neutral-700 text-xs italic">

                   Artist, Title, Cat. No...

                 </div>

              )}

              

              {searchResults.map((candidate) => (

                <button 

                  key={candidate.discogs_id} 

                  onClick={() => handleSelectCandidate(candidate)}

                  disabled={isLoading}

                  className="w-full flex items-center gap-4 p-2 rounded hover:bg-white/5 transition-colors text-left group border border-transparent hover:border-white/10"

                >

                  <div className="w-12 h-12 bg-neutral-800 rounded overflow-hidden shrink-0">

                    {candidate.thumb ? (

                      <img src={candidate.thumb} className="w-full h-full object-cover opacity-70 group-hover:opacity-100" />

                    ) : (

                      <div className="w-full h-full flex items-center justify-center"><Disc className="w-4 h-4 text-neutral-600" /></div>

                    )}

                  </div>

                  <div className="flex-grow min-w-0">

                    <h4 className="text-sm font-bold text-white truncate group-hover:text-blue-400 transition-colors">{candidate.title}</h4>

                    <div className="flex items-center gap-2 text-xs text-neutral-500">

                      <span>{candidate.year}</span>

                      {candidate.label && <span>• {candidate.label}</span>}

                    </div>

                  </div>

                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">

                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Plus className="w-4 h-4 text-white" />}

                  </div>

                </button>

              ))}

            </div>

          </div>

        </div>

      )}



      {/* MODAL DÉTAILS ALBUM */}
      {selectedAlbum && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/60 p-4 animate-in fade-in duration-300"
          onClick={() => setSelectedAlbum(null)}
        >
          <div 
            key={selectedAlbum.id}
            className="bg-[#111] border border-white/10 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col md:flex-row shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: 'scaleIn 0.3s ease-out' }}
          >
            {/* Section Image */}
            <div className={`h-[250px] md:h-full bg-[#000] overflow-hidden shrink-0 transition-all duration-300 ${
              modalActiveTab === "story" ? "hidden md:block" : ""
            } ${
              modalActiveTab === "sleeve" ? "md:w-2/5" : "md:w-1/2"
            }`}>
              <img 
                src={selectedAlbum.display.cover_image || "/placeholder.png"} 
                alt={selectedAlbum.display.title}
                className="w-full h-full object-cover transition-opacity duration-300"
              />
            </div>

            {/* Section Texte avec AlbumDetailView */}
            <div className={`flex flex-col flex-1 relative transition-all duration-300 max-h-full overflow-hidden ${
              modalActiveTab === "sleeve" ? "md:w-3/5" : "md:w-1/2"
            }`}>
              {/* Bouton Fermer */}
              <button 
                onClick={() => {
                  setSelectedAlbum(null);
                  setModalActiveTab("tracklist");
                }}
                className="absolute top-4 right-4 z-10 text-neutral-400 hover:text-white transition-colors"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>

              <AlbumDetailView
                album={selectedAlbum}
                onUpdateAlbum={(updated) => {
                  setSelectedAlbum(updated);
                  fetchLibrary();
                }}
                onDelete={handleDeleteFromModal}
                showActions={true}
                isManageMode={isManageMode}
                API_URL={API_URL}
                sounds={sounds}
                compact={false}
                onTabChange={(tab) => setModalActiveTab(tab)}
              />
            </div>
          </div>
        </div>
      )}



      {/* VUE DIG - Interface Shazam-like */}
      {currentView === "DIG" && (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-6 py-12 relative">
          {/* Éléments Viewfinder (z-0 - arrière-plan) */}
          
          {/* Spotlight (Ambiance lumineuse) */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-900/20 blur-[100px] rounded-full z-0"></div>
          
          {/* Crosshairs - Ligne verticale */}
          <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0 h-full border-[0.5px] border-zinc-800 z-0"></div>
          
          {/* Crosshairs - Ligne horizontale */}
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 w-full h-0 border-[0.5px] border-zinc-800 z-0"></div>
          
          {/* Marquages techniques - Haut-Gauche */}
          <div className="absolute top-20 left-6 amp-label text-xs text-zinc-600 z-0">REC • [ 00:00:00 ]</div>
          
          {/* Marquages techniques - Haut-Droite */}
          <div className="absolute top-20 right-6 amp-label text-xs text-zinc-600 z-0">ISO 400</div>
          
          {/* Marquages techniques - Bas-Gauche */}
          <div className="absolute bottom-20 left-6 amp-label text-xs text-zinc-600 z-0">F/2.8</div>
          
          {/* Marquages techniques - Bas-Droite */}
          <div className="absolute bottom-20 right-6 amp-label text-xs text-zinc-600 z-0">AUTO-FOCUS</div>
          
          {/* Corners brackets - Zone de scan idéale */}
          {/* Corner haut-gauche */}
          <div className="absolute top-1/2 left-1/2 -translate-x-[200px] -translate-y-[200px] w-8 h-8 z-0">
            <div className="absolute top-0 left-0 w-4 h-[1px] bg-zinc-700"></div>
            <div className="absolute top-0 left-0 w-[1px] h-4 bg-zinc-700"></div>
          </div>
          
          {/* Corner haut-droite */}
          <div className="absolute top-1/2 left-1/2 translate-x-[200px] -translate-y-[200px] w-8 h-8 z-0">
            <div className="absolute top-0 right-0 w-4 h-[1px] bg-zinc-700"></div>
            <div className="absolute top-0 right-0 w-[1px] h-4 bg-zinc-700"></div>
          </div>
          
          {/* Corner bas-gauche */}
          <div className="absolute top-1/2 left-1/2 -translate-x-[200px] translate-y-[200px] w-8 h-8 z-0">
            <div className="absolute bottom-0 left-0 w-4 h-[1px] bg-zinc-700"></div>
            <div className="absolute bottom-0 left-0 w-[1px] h-4 bg-zinc-700"></div>
          </div>
          
          {/* Corner bas-droite */}
          <div className="absolute top-1/2 left-1/2 translate-x-[200px] translate-y-[200px] w-8 h-8 z-0">
            <div className="absolute bottom-0 right-0 w-4 h-[1px] bg-zinc-700"></div>
            <div className="absolute bottom-0 right-0 w-[1px] h-4 bg-zinc-700"></div>
          </div>

          {/* Logo Kissa en haut à gauche */}
          <h1 className="absolute top-6 left-6 lightbox-sign inline-block rounded-xl px-4 py-2 text-sm z-10">喫茶 Kissa</h1>

          {/* Bouton de recherche manuelle - Flottant en haut à droite */}
          <button
            onClick={() => {
              setShowManualSearch(true);
              haptic.light();
            }}
            className="absolute top-6 right-6 flex items-center gap-2 text-neutral-400 hover:text-white transition-colors amp-label z-10"
            title="Recherche manuelle"
          >
            <Search className="w-4 h-4" />
            <span className="text-xs">Search Manually</span>
          </button>

          {/* Container principal centré */}
          <div className="flex flex-col items-center justify-center gap-6 relative z-20">
            {/* Bouton principal vinyle rotatif */}
            <label
              className={`relative w-48 h-48 md:w-64 md:h-64 rounded-full bg-neutral-950 border-2 border-amber-100/20 cursor-pointer flex items-center justify-center transition-all hover:scale-105 z-20 ${
                isLoading 
                  ? "shadow-amber-500/30 animate-pulse" 
                  : "shadow-lg shadow-amber-500/10"
              }`}
            >
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileUpload}
                disabled={isLoading}
              />
              
              {/* Vinyle en rotation avec rainures */}
              <div className={`relative w-40 h-40 md:w-52 md:h-52 rounded-full bg-neutral-950 flex items-center justify-center ${
                isLoading ? "animate-spin" : "animate-spin-slow"
              }`}
              style={{
                background: `radial-gradient(circle, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.8) 50%, #0a0a0a 100%)`
              }}>
                {/* Rainures concentriques du vinyle */}
                <div className="absolute inset-0 rounded-full border border-neutral-800/40" style={{ width: "90%", height: "90%", top: "5%", left: "5%" }}></div>
                <div className="absolute inset-0 rounded-full border border-neutral-800/30" style={{ width: "75%", height: "75%", top: "12.5%", left: "12.5%" }}></div>
                <div className="absolute inset-0 rounded-full border border-neutral-800/40" style={{ width: "60%", height: "60%", top: "20%", left: "20%" }}></div>
                <div className="absolute inset-0 rounded-full border border-neutral-800/30" style={{ width: "45%", height: "45%", top: "27.5%", left: "27.5%" }}></div>
                <div className="absolute inset-0 rounded-full border border-neutral-800/40" style={{ width: "30%", height: "30%", top: "35%", left: "35%" }}></div>
                
                {/* Macaron central coloré avec icône */}
                <div className="absolute w-12 h-12 md:w-16 md:h-16 rounded-full bg-red-800 flex items-center justify-center shadow-inner border-2 border-red-900/50 z-10">
                  <Scan className="w-6 h-6 md:w-8 md:h-8 text-white" />
                </div>
              </div>
            </label>

            {/* Texte de feedback */}
            <div className="text-center">
              {isLoading ? (
                <p className="amp-label text-white text-sm md:text-base">ANALYZING SLEEVE...</p>
              ) : (
                <>
                  <p className="amp-label text-neutral-400 text-sm md:text-base tracking-widest" style={{ fontFamily: "var(--font-technical)" }}>
                    TAP TO DIG
                  </p>
                  <p className="text-neutral-500 text-xs mt-2">Place cover in frame</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VUE SETUP */}
      {currentView === "SETUP" && (
        <div className="px-6 py-12 max-w-2xl mx-auto">
          <h2 className="lightbox-sign inline-block rounded-xl px-4 py-2 text-sm mb-8">SETTINGS</h2>
          
          <div className="space-y-6">
            {/* Section Sound */}
            <div className="bg-[#111] border border-white/10 rounded-lg p-6">
              <h3 className="amp-label text-white mb-4">SOUND</h3>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400 text-sm">Audio Feedback</span>
                <SoundToggle />
              </div>
            </div>

            {/* Placeholder pour futures préférences */}
            <div className="bg-[#111] border border-white/10 rounded-lg p-6 opacity-50">
              <h3 className="amp-label text-white mb-4">PREFERENCES</h3>
              <p className="text-neutral-500 text-xs">More settings coming soon...</p>
            </div>
          </div>
        </div>
      )}



      {/* LECTEUR FOOTER - Visible sur toutes les vues */}

      {currentTrack && (

        <div className="fixed bottom-16 left-0 right-0 h-24 bg-black/95 border-t border-white/10 backdrop-blur-xl z-40 flex items-center px-4 md:px-8 shadow-2xl animate-in slide-in-from-bottom-24 duration-500">

          <div className="flex items-center gap-4 w-1/3">

            <div className={`relative w-16 h-16 rounded-full overflow-hidden border border-neutral-800 shadow-lg ${isPlaying ? 'animate-[spin_6s_linear_infinite]' : ''}`}>

              <img src={currentTrack.display.cover_image} className="w-full h-full object-cover" />

              <div className="absolute inset-0 flex items-center justify-center"><div className="w-2 h-2 bg-black rounded-full border border-neutral-700"></div></div>

            </div>

            <div className="hidden md:block overflow-hidden"><h4 className="text-white text-sm font-bold truncate">{currentTrack.display.title}</h4><p className="text-neutral-500 text-xs truncate">{currentTrack.display.artist}</p></div>

          </div>

          <div className="flex-grow flex justify-center w-1/3">

             <iframe src={`https://open.spotify.com/embed/album/${currentTrack.links.spotify_id}?utm_source=generator&theme=0`} width="100%" height="80" frameBorder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" className="max-w-md opacity-80 hover:opacity-100 transition-opacity rounded-lg"></iframe>

          </div>

          <div className="w-1/3 flex justify-end"><button onClick={handleStop} className="p-2 hover:bg-neutral-800 rounded-full text-neutral-500 hover:text-white transition-colors"><X className="w-5 h-5" /></button></div>

        </div>

      )}

      {successToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-[scaleIn_0.2s_ease-out]"
        >
          <div className="lightbox-sign rounded-lg px-4 py-2 text-sm">
            {successToast}
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <BottomNav />
    </main>

  );

}
