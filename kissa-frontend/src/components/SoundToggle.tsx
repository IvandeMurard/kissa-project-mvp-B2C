"use client";

import { Speaker, SpeakerX } from "lucide-react";
import { useSoundContext } from "@/contexts/SoundContext";
import { useKissaSound } from "@/hooks/useKissaSound";

export function SoundToggle() {
  const { isMuted, toggleMute } = useSoundContext();
  const { playSwitch, toggleAmbiance } = useKissaSound();

  const handleClick = () => {
    const newMutedState = !isMuted;
    toggleMute();

    // Control crackle loop based on mute state
    toggleAmbiance(!newMutedState); // If unmuting, play; if muting, stop

    // Play feedback sound only if unmuting (when sound will be enabled)
    // The sound will play after state update due to React's state batching
    if (!newMutedState) {
      // Use setTimeout to ensure state is updated in useKissaSound
      setTimeout(() => {
        playSwitch();
      }, 10);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="flex items-center justify-center w-8 h-8 rounded-full border border-white/10 hover:bg-white hover:text-black transition-all"
      title={isMuted ? "Activer le son" : "Désactiver le son"}
      aria-label={isMuted ? "Activer le son" : "Désactiver le son"}
    >
      {isMuted ? (
        <SpeakerX className="w-3.5 h-3.5" />
      ) : (
        <Speaker className="w-3.5 h-3.5" />
      )}
    </button>
  );
}
