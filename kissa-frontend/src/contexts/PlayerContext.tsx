"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void;
    Spotify: {
      Player: new (options: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume: number;
      }) => {
        addListener: (event: string, fn: (payload: any) => void) => void;
        connect: () => Promise<boolean>;
        disconnect: () => void;
        togglePlay: () => Promise<void>;
        nextTrack: () => Promise<void>;
        previousTrack: () => Promise<void>;
      };
    };
  }
}

export interface Track {
  title: string;
  artist: string;
  cover: string;
  uri: string;
}

interface PlayerContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  isReady: boolean;
  deviceId: string | null;
  currentAlbumUri: string | null;
  playAlbum: (spotifyUri: string) => Promise<void>;
  togglePlay: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export function PlayerProvider({ children, token }: { children: ReactNode; token: string }) {
  const playerRef = useRef<InstanceType<typeof window.Spotify.Player> | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [currentAlbumUri, setCurrentAlbumUri] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    document.body.appendChild(script);

    window.onSpotifyWebPlaybackSDKReady = () => {
      const p = new window.Spotify.Player({
        name: "Kissa Listening Room",
        getOAuthToken: (cb: (t: string) => void) => {
          cb(token);
        },
        volume: 0.5,
      });

      playerRef.current = p;

      p.addListener("ready", ({ device_id }: { device_id: string }) => {
        setDeviceId(device_id);
        setIsReady(true);
      });

      p.addListener("not_ready", () => {
        setIsReady(false);
      });

      p.addListener("player_state_changed", (state: any) => {
        if (!state) return;
        setIsPlaying(!state.paused);
        const track = state.track_window?.current_track;
        if (track) {
          setCurrentTrack({
            title: track.name,
            artist: track.artists?.[0]?.name ?? "",
            cover: track.album?.images?.[0]?.url ?? "",
            uri: track.uri,
          });
          setCurrentAlbumUri(track.album?.uri ?? null);
        }
      });

      p.addListener("authentication_error", ({ message }: { message: string }) => {
        console.error("Spotify auth error:", message);
      });
      p.addListener("account_error", ({ message }: { message: string }) => {
        console.error("Spotify account error:", message);
      });

      p.connect();
    };

    return () => {
      const player = playerRef.current;
      if (player) {
        player.disconnect();
        playerRef.current = null;
      }
      setDeviceId(null);
      setIsReady(false);
      setCurrentTrack(null);
      setCurrentAlbumUri(null);
    };
  }, [token]);

  const playAlbum = useCallback(
    async (spotifyUri: string) => {
      if (!deviceId || !token) return;
      await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: "PUT",
        body: JSON.stringify({ context_uri: spotifyUri }),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
    },
    [deviceId, token]
  );

  const togglePlay = useCallback(() => {
    playerRef.current?.togglePlay();
  }, []);

  const nextTrack = useCallback(() => {
    playerRef.current?.nextTrack();
  }, []);

  const prevTrack = useCallback(() => {
    playerRef.current?.previousTrack();
  }, []);

  const value: PlayerContextType = {
    currentTrack,
    isPlaying,
    isReady,
    deviceId,
    currentAlbumUri,
    playAlbum,
    togglePlay,
    nextTrack,
    prevTrack,
  };

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayerContext() {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error("usePlayerContext must be used within a PlayerProvider");
  }
  return context;
}

export const usePlayer = usePlayerContext;
