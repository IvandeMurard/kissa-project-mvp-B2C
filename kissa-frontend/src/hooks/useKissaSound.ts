"use client";

import { useSound } from "use-sound";
import { useSoundContext } from "@/contexts/SoundContext";

export function useKissaSound() {
  const { isMuted } = useSoundContext();

  const [playCardboard] = useSound("/sounds/cardboard.mp3", {
    volume: 0.5,
    interrupt: true,
  });

  const [playSwitch] = useSound("/sounds/switch.mp3", {
    volume: 0.3,
    interrupt: true,
  });

  const [playAmpOn] = useSound("/sounds/amp-on.mp3", {
    volume: 0.6,
    interrupt: true,
  });

  const [playCrackleLoop, { stop: stopCrackleLoop }] = useSound(
    "/sounds/crackle_loop.mp3",
    {
      volume: 0.1,
      loop: true,
      interrupt: false,
    }
  );

  const playOpenAlbum = () => {
    if (!isMuted) {
      playCardboard();
    }
  };

  const playSwitchSound = () => {
    if (!isMuted) {
      // Random playbackRate between 0.9 and 1.1 to avoid robotic sound
      const randomRate = Math.random() * 0.2 + 0.9;
      playSwitch({ playbackRate: randomRate });
    }
  };

  const playVinylStart = () => {
    if (!isMuted) {
      playAmpOn();
    }
  };

  const toggleAmbiance = (shouldPlay: boolean) => {
    if (shouldPlay) {
      playCrackleLoop();
    } else {
      stopCrackleLoop();
    }
  };

  return {
    playOpenAlbum,
    playSwitch: playSwitchSound,
    playVinylStart,
    toggleAmbiance,
  };
}
