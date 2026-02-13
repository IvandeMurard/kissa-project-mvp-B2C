"use client";

import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { usePlayerContext } from "@/contexts/PlayerContext";

export default function GlassPlayer() {
  const { currentTrack, isPlaying, togglePlay, nextTrack, prevTrack } = usePlayerContext();

  if (!currentTrack) return null;

  const cover = currentTrack.cover || "/placeholder.png";

  return (
    <div className="fixed bottom-6 left-0 right-0 flex justify-center z-[90] px-4 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-4 md:gap-8 bg-zinc-900/80 backdrop-blur-2xl border border-white/10 p-3 pr-6 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom-10 duration-500">
        {/* Pochette */}
        <div
          className={`relative w-12 h-12 rounded-full overflow-hidden border border-white/10 flex-shrink-0 ${
            isPlaying ? "animate-spin-slow" : ""
          }`}
        >
          <img src={cover} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 m-auto w-3 h-3 bg-zinc-900 rounded-full border border-white/10" />
        </div>

        {/* Infos */}
        <div className="flex flex-col min-w-[120px]">
          <span className="text-white text-sm font-bold leading-tight truncate max-w-[150px]">
            {currentTrack.title}
          </span>
          <span className="text-white/50 text-xs font-medium truncate max-w-[150px]">
            {currentTrack.artist}
          </span>
        </div>

        {/* Contrôles */}
        <div className="flex items-center gap-2 md:gap-4">
          <button
            type="button"
            onClick={prevTrack}
            className="text-white/40 hover:text-white transition-colors p-2 hidden sm:block"
            aria-label="Previous"
          >
            <SkipBack size={20} fill="currentColor" />
          </button>

          <button
            type="button"
            className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition flex-shrink-0"
            onClick={togglePlay}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause size={18} fill="currentColor" />
            ) : (
              <Play size={18} fill="currentColor" className="ml-1" />
            )}
          </button>

          <button
            type="button"
            onClick={nextTrack}
            className="text-white/40 hover:text-white transition-colors p-2 hidden sm:block"
            aria-label="Next"
          >
            <SkipForward size={20} fill="currentColor" />
          </button>
        </div>
      </div>
    </div>
  );
}
