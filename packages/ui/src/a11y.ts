import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, useWindowDimensions } from 'react-native';

/** Live system accessibility preferences. Motion and transparency are honoured everywhere. */
export function useA11yPrefs() {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [reduceTransparency, setReduceTransparency] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setReduceMotion(v));
    const subs = [AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion)];
    if (Platform.OS === 'ios') {
      AccessibilityInfo.isReduceTransparencyEnabled().then((v) => alive && setReduceTransparency(v));
      subs.push(AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduceTransparency));
    }
    return () => {
      alive = false;
      subs.forEach((s) => s.remove());
    };
  }, []);
  const { fontScale } = useWindowDimensions();
  return { reduceMotion, reduceTransparency, fontScale, largeText: fontScale >= 1.3 };
}

/** Android wants 48-pt targets at screen edges; iOS 44. */
export const minTouch = Platform.OS === 'android' ? 48 : 44;

export function hitSlopFor(height: number) {
  const pad = Math.max(0, Math.ceil((minTouch - height) / 2));
  return { top: pad, bottom: pad, left: pad, right: pad };
}
