import { Easing } from 'react-native-reanimated';
import { motion } from '@naya/tokens';
import { useA11yPrefs } from './a11y';

/** Monotonic easing: reaches the target once, with no spring or overshoot. */
const easing = Easing.bezier(...motion.easeOut);
export const motionTiming = {
  pressIn: { duration: motion.press.in, easing },
  pressOut: { duration: motion.press.out, easing },
  selection: { duration: motion.tabFade, easing },
  sheetOpen: { duration: motion.sheet.open, easing },
  sheetClose: { duration: motion.sheet.close, easing },
  sheetSettle: { duration: motion.sheet.settle, easing },
};

/** One navigator transition per route; the system preference removes it entirely. */
export function useStackMotion(animation: 'simple_push' | 'fade' = 'simple_push') {
  const { reduceMotion } = useA11yPrefs();
  return { animation: reduceMotion ? 'none' as const : animation, animationDuration: motion.navigation };
}
