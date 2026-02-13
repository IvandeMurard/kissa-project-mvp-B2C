"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

/** Minimal album shape for the global player (avoids circular imports from page.tsx) */
export interface AlbumForPlayer {
  id: string;
  display: { artist: string; title: string; cover_image: string };
  links: { spotify_url?: string; spotify_id?: string };
}

interface PlayerContextType {
  currentTrack: AlbumForPlayer | null;
  isPlaying: boolean;
  setCurrentTrack: (album: AlbumForPlayer | null) => void;
  setIsPlaying: (playing: boolean) => void;
  play: (album: AlbumForPlayer) => void;
  stop: () => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<AlbumForPlayer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const play = useCallback((album: AlbumForPlayer) => {
    setCurrentTrack(album);
    setIsPlaying(true);
  }, []);

  const stop = useCallback(() => {
    setIsPlaying(false);
    setCurrentTrack(null);
  }, []);

  const value: PlayerContextType = {
    currentTrack,
    isPlaying,
    setCurrentTrack,
    setIsPlaying,
    play,
    stop,
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayerContext() {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error("usePlayerContext must be used within a PlayerProvider");
  }
  return context;
}
