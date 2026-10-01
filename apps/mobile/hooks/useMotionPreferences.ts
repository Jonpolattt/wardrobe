import { AccessibilityInfo } from 'react-native';
import { useEffect, useState } from 'react';
export function useMotionPreferences() {
  const [reduceMotion, setReduceMotion] = useState(true);
  const [reduceTransparency, setReduceTransparency] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (alive) setReduceMotion(value); }).catch(() => undefined);
    void AccessibilityInfo.isReduceTransparencyEnabled().then(value => { if (alive) setReduceTransparency(value); }).catch(() => undefined);
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const transparency = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduceTransparency);
    return () => { alive = false; motion.remove(); transparency.remove(); };
  }, []);
  return { reduceMotion, reduceTransparency };
}
