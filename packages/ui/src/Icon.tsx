import { colors } from '@naya/tokens';
import type { StatusGlyph, StatusTone } from '@naya/domain';
import {
  BadgeCheck,
  Ban,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  CarFront,
  Check,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleOff,
  CirclePause,
  CircleSlash,
  CircleX,
  Droplets,
  FileExclamationPoint,
  FlaskConical,
  Hourglass,
  Inbox,
  Info,
  LoaderCircle,
  Lock,
  LockOpen,
  MapPinCheck,
  MapPinOff,
  MessageCircleQuestionMark,
  Navigation,
  PowerOff,
  Radar,
  ScanSearch,
  Send,
  ShieldCheck,
  ShieldQuestionMark,
  ShieldX,
  Siren,
  Store,
  TimerOff,
  TriangleAlert,
  Undo2,
  UserCheck,
  Van,
  WifiOff,
  type LucideIcon,
} from 'lucide-react-native';
import { Platform, useWindowDimensions } from 'react-native';
import { useTheme } from './core/theme';

/** Kebab-case glyph names from @naya/domain (status.ts) → lucide components. One map for every screen. */
export const GLYPHS: Record<StatusGlyph, LucideIcon> = {
  'badge-check': BadgeCheck,
  ban: Ban,
  'calendar-check': CalendarCheck,
  'calendar-clock': CalendarClock,
  'calendar-x': CalendarX,
  'car-front': CarFront,
  check: Check,
  'circle-alert': CircleAlert,
  'circle-check': CircleCheck,
  'circle-dashed': CircleDashed,
  'circle-off': CircleOff,
  'circle-pause': CirclePause,
  'circle-slash': CircleSlash,
  'circle-x': CircleX,
  droplets: Droplets,
  'file-exclamation-point': FileExclamationPoint,
  'flask-conical': FlaskConical,
  hourglass: Hourglass,
  inbox: Inbox,
  info: Info,
  'loader-circle': LoaderCircle,
  lock: Lock,
  'lock-open': LockOpen,
  'map-pin-check': MapPinCheck,
  'map-pin-off': MapPinOff,
  'message-circle-question-mark': MessageCircleQuestionMark,
  navigation: Navigation,
  'power-off': PowerOff,
  radar: Radar,
  'scan-search': ScanSearch,
  send: Send,
  'shield-check': ShieldCheck,
  'shield-question-mark': ShieldQuestionMark,
  'shield-x': ShieldX,
  siren: Siren,
  store: Store,
  'timer-off': TimerOff,
  'triangle-alert': TriangleAlert,
  'undo-2': Undo2,
  'user-check': UserCheck,
  van: Van,
  'wifi-off': WifiOff,
};

/**
 * The four icon steps (audit §5.3): 16 inline in text, 20 trailing state and disc glyph,
 * 24 bare row leading, header and tab bar, 28 inside a 56 hero disc. 12 is the payment-state badge only.
 */
export type IconSize = 12 | 16 | 20 | 24 | 28;

/** The tone's text colour (≥ 4.5:1 on surface in both schemes), read at render. Neutral is muted. */
export function toneColor(tone: StatusTone): string {
  switch (tone) {
    case 'accent':
      return colors.accent;
    case 'info':
      return colors.info;
    case 'success':
      return colors.success;
    case 'warning':
      return colors.warning;
    case 'danger':
      return colors.danger;
    default:
      return colors.muted;
  }
}

/** The tone's soft disc and chip fill. */
export function toneFill(tone: StatusTone): string {
  switch (tone) {
    case 'accent':
      return colors.selected;
    case 'info':
      return colors.infoSoft;
    case 'success':
      return colors.successSoft;
    case 'warning':
      return colors.warningSoft;
    case 'danger':
      return colors.dangerSoft;
    default:
      return colors.mauveSoft;
  }
}

/** Glyphs keep pace with Dynamic Type next to text, clamped to 1–1.4 (§2.6 rule 3). */
export function useIconScale() {
  const { fontScale } = useWindowDimensions();
  return Math.min(1.4, Math.max(1, fontScale || 1));
}

export interface IconProps {
  /** A status glyph name, or… */
  name?: StatusGlyph;
  /** …any lucide component (place type, payment method, action). */
  icon?: LucideIcon;
  size?: IconSize;
  /** A tone colour; `color` wins over it. Default ink. */
  tone?: StatusTone;
  color?: string;
  /** Default true: the size follows the font scale. Off for glyphs inside fixed-size discs. */
  scale?: boolean;
  /** Set it for an icon that stands alone; otherwise the icon is hidden from screen readers. */
  accessibilityLabel?: string;
  testID?: string;
}

/** One stroke (2), four sizes, tone colours read at render (audit §5.3). */
export function Icon({ name, icon, size = 24, tone, color, scale = true, accessibilityLabel, testID }: IconProps) {
  useTheme();
  const factor = useIconScale();
  const Glyph = icon ?? (name ? GLYPHS[name] : undefined);
  if (!Glyph) return null;
  const px = Math.round(size * (scale ? factor : 1));
  const fill = color ?? (tone ? toneColor(tone) : colors.ink);
  return <Glyph testID={testID} size={px} color={fill} strokeWidth={2} {...(accessibilityLabel ? labelled(accessibilityLabel) : HIDDEN_GLYPH)} />;
}

/*
 * On web the lucide SVG is a DOM element: React Native accessibility props would reach it as unknown
 * attributes (React's « does not recognize the … prop » warning), so web gets the ARIA equivalents.
 */
const WEB = Platform.OS === 'web';
/** Props that hide a bare lucide glyph from screen readers, on native and on the web. Spread them on the glyph. */
export const HIDDEN_GLYPH = (WEB ? { 'aria-hidden': true } : { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' }) as object;
const labelled = (label: string) => (WEB ? { role: 'img', 'aria-label': label } : { accessible: true, accessibilityRole: 'image', accessibilityLabel: label }) as object;
