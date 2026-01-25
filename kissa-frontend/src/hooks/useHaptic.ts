/**
 * Custom hook for haptic feedback (mobile vibrations)
 * Provides three intensity levels for different user interactions
 */
export function useHaptic() {
  const isSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator;

  const light = () => {
    if (!isSupported) return;
    try {
      navigator.vibrate(10); // 10ms - For UI clicks (buttons)
    } catch (error) {
      // Silently fail if vibration is not supported or blocked
      console.debug('Vibration not available:', error);
    }
  };

  const medium = () => {
    if (!isSupported) return;
    try {
      navigator.vibrate(40); // 40ms - For successful scan
    } catch (error) {
      console.debug('Vibration not available:', error);
    }
  };

  const heavy = () => {
    if (!isSupported) return;
    try {
      navigator.vibrate([50, 30, 50]); // 50ms vibration, 30ms pause, 50ms vibration - For delete or error
    } catch (error) {
      console.debug('Vibration not available:', error);
    }
  };

  return { light, medium, heavy };
}
