"use client";

import { useState } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, Maximize2, X } from "lucide-react";
import { usePlayerContext } from "@/contexts/PlayerContext";

export default function GlassPlayer() {
  const { currentTrack, isPlaying, setIsPlaying, stop } = usePlayerContext();
  const [progress] = useState(33);

  if (!currentTrack) return null;

  const cover = currentTrack.display.cover_image || "/placeholder.png";

  return (
    <div className="fixed bottom-24 left-0 right-0 flex justify-center z-[90] px-4 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-4 md:gap-8 bg-zinc-900/60 backdrop-blur-xl border border-white/10 p-3 pr-6 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom-10 duration-500">
        {/* 1. Pochette tournante (vibe analogique) */}
        <div
          className={`relative w-12 h-12 rounded-full overflow-hidden border border-white/10 flex-shrink-0 ${
            isPlaying ? "animate-spin-slow" : ""
          }`}
        >
          <img src={cover} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 m-auto w-3 h-3 bg-zinc-900 rounded-full border border-white/10" />
        </div>

        {/* 2. Infos titre */}
        <div className="flex flex-col min-w-[120px]">
          <span className="text-white text-sm font-bold leading-tight truncate max-w-[150px]">
            {currentTrack.display.title}
          </span>
          <span className="text-white/50 text-xs font-medium truncate max-w-[150px]">
            {currentTrack.display.artist}
          </span>
        </div>

        {/* 3. Contrôles centraux */}
        <div className="flex items-center gap-2 md:gap-4">
          <button
            type="button"
            className="text-white/40 hover:text-white transition-colors p-2 hidden sm:block"
            aria-label="Previous"
          >
            <SkipBack size={20} fill="currentColor" />
          </button>

          <button
            type="button"
            className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition flex-shrink-0"
            onClick={() => setIsPlaying(!isPlaying)}
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
            className="text-white/40 hover:text-white transition-colors p-2 hidden sm:block"
            aria-label="Next"
          >
            <SkipForward size={20} fill="currentColor" />
          </button>

          <button
            type="button"
            onClick={stop}
            className="md:hidden p-2 -m-1 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close player"
          >
            <X size={18} />
          </button>
        </div>

        {/* 4. Barre de progression (style minimaliste) */}
        <div className="hidden md:flex flex-col gap-1 w-32 group cursor-pointer">
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 group-hover:bg-amber-400 transition-colors"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* 5. Volume / Expand + fermer */}
        <div className="hidden md:flex items-center gap-3 border-l border-white/10 pl-4 ml-2">
          <Volume2 size={16} className="text-white/40" aria-hidden />
          <Maximize2 size={16} className="text-white/40 hover:text-white cursor-pointer" aria-hidden />
          <button
            type="button"
            onClick={stop}
            className="p-1.5 -m-1.5 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close player"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
