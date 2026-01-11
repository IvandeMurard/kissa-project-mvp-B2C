"use client";

import { useState, useEffect } from "react";

import { Loader2, Search, Trash2, Camera, Play, X, Keyboard, Plus, Disc } from "lucide-react";

// --- TYPES ---

interface Album {

  id: string;

  display: { artist: string; title: string; cover_image: string };

  links: { spotify_url: string; discogs_url: string; spotify_id?: string };

  details: { year: string; label: string; genre: string[]; tracklist?: string[] };

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

  const [library, setLibrary] = useState<Album[]>([]);

  const [isLoading, setIsLoading] = useState(false);

  

  // --- ÉTATS RECHERCHE MANUELLE ---

  const [showManualSearch, setShowManualSearch] = useState(false);

  const [manualSearchQuery, setManualSearchQuery] = useState("");

  const [searchResults, setSearchResults] = useState<SearchCandidate[]>([]);

  const [isSearching, setIsSearching] = useState(false); // Loading pendant la recherche

  const [hasSearched, setHasSearched] = useState(false); // NOUVEAU : Pour savoir si on a déjà appuyé sur Entrée

  

  // États UI Globaux

  const [filterQuery, setFilterQuery] = useState("");

  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);

  const [availableGenres, setAvailableGenres] = useState<string[]>([]);

  const [currentTrack, setCurrentTrack] = useState<Album | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);

  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);



  useEffect(() => { fetchLibrary(); }, []);



  const fetchLibrary = async () => {

    try {

      const res = await fetch(`${API_URL}/library`);

      const dbData = await res.json();

      const formattedLibrary: Album[] = dbData.map((item: any) => ({

        id: item.id,

        display: { artist: item.artist, title: item.title, cover_image: item.cover_image },

        links: { 

          spotify_url: item.spotify_url, 

          discogs_url: item.discogs_url,

          spotify_id: item.spotify_url ? item.spotify_url.split('/album/')[1]?.split('?')[0] : null

        },

        details: { year: item.year, label: item.label, genre: item.genre || [], tracklist: item.tracklist || [] },

      }));

      setLibrary(formattedLibrary);

      const allGenres = formattedLibrary.flatMap(a => a.details.genre || []);

      setAvailableGenres(Array.from(new Set(allGenres)).sort());

    } catch (error) { console.error(error); }

  };



  const handlePlay = (album: Album) => { if (album.links.spotify_id) { setCurrentTrack(album); setIsPlaying(true); }};

  const handleStop = () => { setIsPlaying(false); setCurrentTrack(null); };



  const handleDelete = async (id: string, e: React.MouseEvent) => {

    e.stopPropagation();

    if (!confirm("Supprimer cet album ?")) return;

    try {

      await fetch(`${API_URL}/album/${id}`, { method: "DELETE" });

      setLibrary((prev) => prev.filter((album) => album.id !== id));

      if (currentTrack?.id === id) handleStop();

    } catch (error) { alert("Erreur suppression"); }

  };



  const handleDeleteFromModal = async () => {

    if (!selectedAlbum) return;

    try {

      await fetch(`${API_URL}/album/${selectedAlbum.id}`, { method: "DELETE" });

      setLibrary((prev) => prev.filter((album) => album.id !== selectedAlbum.id));

      if (currentTrack?.id === selectedAlbum.id) handleStop();

      setSelectedAlbum(null);

    } catch (error) { alert("Erreur suppression"); }

  };



  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {

    if (!e.target.files || e.target.files.length === 0) return;

    setIsLoading(true);

    const formData = new FormData();

    formData.append("file", e.target.files[0]);

    try {

      const response = await fetch(`${API_URL}/scan`, { method: "POST", body: formData });

      if (response.ok) { await fetchLibrary(); e.target.value = ""; } 

      else { const data = await response.json(); alert("Erreur : " + data.detail); }

    } catch (error) { alert("Erreur serveur."); } finally { setIsLoading(false); }

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
        const errorText = await response.text();
        console.error("❌ Erreur HTTP:", response.status, errorText);
        alert(`Erreur ${response.status}: ${errorText}`);
        return;
      }

      const data = await response.json();
      console.log("📦 Données reçues:", data);
      console.log("📦 Nombre de résultats:", data.length);

      setSearchResults(data);

    } catch (error) { 

      console.error("❌ Erreur lors de la recherche:", error);
      alert(`Erreur technique lors de la recherche: ${error}`); 

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

        await fetchLibrary();

        closeManualSearch();

      } else {

        alert("Erreur lors de l'ajout.");

      }

    } catch (error) { alert("Erreur serveur."); } finally { setIsLoading(false); }

  };



  const closeManualSearch = () => {

    setShowManualSearch(false);

    setSearchResults([]);

    setManualSearchQuery("");

    setHasSearched(false);

  };



  const filteredLibrary = library.filter((album) => {

    const matchesSearch = 

      album.display.title.toLowerCase().includes(filterQuery.toLowerCase()) ||

      album.display.artist.toLowerCase().includes(filterQuery.toLowerCase());

    const matchesGenre = selectedGenre ? album.details.genre.includes(selectedGenre) : true;

    return matchesSearch && matchesGenre;

  });



  return (

    <main className="min-h-screen bg-[#080808] text-neutral-200 font-sans pb-32">

      {/* HEADER */}

      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-md border-b border-white/5 px-6 py-4 flex flex-col md:flex-row justify-between gap-4">

        <div className="flex items-center gap-4">

          <h1 className="text-xl tracking-[0.3em] font-light text-white uppercase">喫茶 Kissa</h1>

          <span className="text-[10px] text-neutral-600 border border-neutral-800 px-2 py-0.5 rounded-full">{filteredLibrary.length} LP</span>

        </div>

        <div className="flex items-center gap-3">

          <div className="relative group w-full md:w-64">

            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-500 group-focus-within:text-white" />

            <input type="text" placeholder="Filtrer..." value={filterQuery} onChange={(e) => setFilterQuery(e.target.value)}

              className="w-full bg-[#111] border border-[#222] rounded-full py-1.5 pl-9 pr-4 text-xs focus:outline-none focus:border-white/20 transition-all placeholder:text-neutral-700"/>

          </div>

          <div className="flex items-center gap-2">

            <button onClick={() => setShowManualSearch(true)} className="flex items-center justify-center w-8 h-8 rounded-full border border-white/10 hover:bg-white hover:text-black transition-all" title="Ajout manuel">

              <Keyboard className="w-3.5 h-3.5" />

            </button>

            <label className={`cursor-pointer flex items-center justify-center w-8 h-8 rounded-full border border-white/10 hover:bg-white hover:text-black transition-all ${isLoading ? 'animate-pulse' : ''}`} title="Scanner une photo">

              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileUpload} disabled={isLoading} />

              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}

            </label>

          </div>

        </div>

      </header>



      {/* FILTRES GENRES */}

      {availableGenres.length > 0 && (

        <div className="px-6 py-4 flex gap-2 overflow-x-auto scrollbar-hide">

          <button onClick={() => setSelectedGenre(null)} className={`text-[10px] uppercase tracking-wider px-3 py-1 rounded-sm transition-colors ${!selectedGenre ? 'bg-white text-black' : 'text-neutral-500 hover:text-white'}`}>Tout</button>

          {availableGenres.map(g => (

            <button key={g} onClick={() => setSelectedGenre(selectedGenre === g ? null : g)} className={`text-[10px] uppercase tracking-wider px-3 py-1 rounded-sm transition-colors ${selectedGenre === g ? 'bg-white text-black' : 'text-neutral-500 hover:text-white'}`}>{g}</button>

          ))}

        </div>

      )}



      {/* MODAL RECHERCHE MANUELLE */}

      {showManualSearch && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">

          <div className="bg-[#111] border border-white/10 rounded-lg w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">

            

            {/* Header Modal */}

            <div className="p-4 border-b border-white/10 flex justify-between items-center">

              <h3 className="text-sm font-bold uppercase tracking-widest text-white">Ajout Manuel</h3>

              <button onClick={closeManualSearch} className="text-neutral-500 hover:text-white"><X className="w-4 h-4" /></button>

            </div>



            {/* Formulaire Recherche */}

            <div className="p-4 bg-black/50">

              <form onSubmit={handleSearchSubmit} className="flex gap-2">

                <input 

                  autoFocus

                  type="text" 

                  placeholder="Ex: Apparat The Devil's Walk" 

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

                   Tape le nom d'un artiste ou d'un album...

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#111] border border-white/10 rounded-lg max-w-md w-full shadow-2xl overflow-hidden">
            {/* Image */}
            <div className="w-full aspect-square bg-[#000] overflow-hidden">
              <img 
                src={selectedAlbum.display.cover_image || "/placeholder.png"} 
                alt={selectedAlbum.display.title}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Contenu */}
            <div className="p-6">
              <div className="mb-4">
                <h3 className="text-white font-bold text-lg leading-tight mb-1">{selectedAlbum.display.title}</h3>
                <p className="text-neutral-400 text-sm">{selectedAlbum.display.artist}</p>
              </div>

              {/* Boutons */}
              <div className="flex gap-3">
                <button 
                  onClick={handleDeleteFromModal}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-sm text-sm font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> Supprimer l'album
                </button>
                <button 
                  onClick={() => setSelectedAlbum(null)}
                  className="px-6 py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-sm text-sm font-bold uppercase tracking-widest transition-colors"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}



      {/* GRILLE D'ALBUMS */}

      <div className="px-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 mt-4">

        {filteredLibrary.map((album) => (

          <div key={album.id} className="group relative aspect-square bg-[#111] overflow-hidden cursor-default border border-white/5">

            <img 

              src={album.display.cover_image || "/placeholder.png"} 

              alt={album.display.title}

              onClick={() => setSelectedAlbum(album)}

              className={`w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110 cursor-pointer ${currentTrack?.id === album.id ? 'opacity-50 grayscale' : ''}`}

            />

            <div className="absolute inset-0 bg-black/90 backdrop-blur-sm translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] p-5 flex flex-col">

              <div className="flex justify-between items-start mb-2">

                <span className="text-[9px] text-neutral-500 uppercase">{album.details.year} • {album.details.label}</span>

                <button onClick={(e) => handleDelete(album.id, e)} className="text-neutral-700 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>

              </div>

              <div className="mb-4">

                <h3 className="text-white font-bold text-sm leading-tight mb-1">{album.display.title}</h3>

                <p className="text-neutral-400 text-xs">{album.display.artist}</p>

              </div>

              <div className="flex-grow overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-700 pr-2 space-y-1">

                {album.details.genre.map((g, i) => ( <span key={i} className="inline-block text-[9px] border border-neutral-700 rounded px-1 mr-1 mb-1 text-neutral-400">{g}</span> ))}

              </div>

              {album.links.spotify_id && (

                <button onClick={() => handlePlay(album)} className="mt-3 w-full bg-white text-black py-2 rounded-sm text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-200 transition-colors flex items-center justify-center gap-2">

                  <Play className="w-3 h-3 fill-current" /> Ecouter

                </button>

              )}

            </div>

            {currentTrack?.id === album.id && (

               <div className="absolute inset-0 flex items-center justify-center pointer-events-none">

                 <div className="w-12 h-12 rounded-full border-2 border-white/20 animate-[spin_3s_linear_infinite] flex items-center justify-center"><div className="w-3 h-3 bg-red-500 rounded-full" /></div>

               </div>

            )}

          </div>

        ))}

      </div>



      {/* LECTEUR FOOTER */}

      {currentTrack && (

        <div className="fixed bottom-0 left-0 right-0 h-24 bg-black/95 border-t border-white/10 backdrop-blur-xl z-50 flex items-center px-4 md:px-8 shadow-2xl animate-in slide-in-from-bottom-24 duration-500">

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

    </main>

  );

}
