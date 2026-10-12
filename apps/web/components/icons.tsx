import type { Icon, IconProps } from 'iconsax-reactjs';
import {
  Activity as ActivityGlyph,
  Add as AddGlyph,
  ArrowDown2 as ArrowDownGlyph,
  ArrowRight2 as ArrowRightGlyph,
  ArrowUp2 as ArrowUpGlyph,
  Card as CardGlyph,
  Calendar as CalendarGlyph,
  Car as CarGlyph,
  Check as CheckGlyph,
  Clock as ClockGlyph,
  CloseSquare as CloseGlyph,
  DocumentText as DocumentGlyph,
  Element4 as DashboardGlyph,
  Gps as GpsGlyph,
  Headphones as HeadphonesGlyph,
  Heart as HeartGlyph,
  Import as DownloadGlyph,
  Location as LocationGlyph,
  Logout as LogoutGlyph,
  Menu as MenuGlyph,
  MessageQuestion as HelpGlyph,
  Minus as MinusGlyph,
  Mobile as MobileGlyph,
  Moon as MoonGlyph,
  Money as MoneyGlyph,
  Notification as BellGlyph,
  People as PeopleGlyph,
  SearchNormal as SearchGlyph,
  Setting2 as SettingsGlyph,
  ShieldTick as ShieldGlyph,
  SliderHorizontal as SlidersGlyph,
  Star as StarGlyph,
  Sun as SunGlyph,
  TickCircle as TickGlyph,
  Wallet as WalletGlyph,
} from 'iconsax-reactjs';

type IconComponent = Icon;

function icon(Glyph: IconComponent, rotation = 0): IconComponent {
  return function NayaIcon({
    size = 24,
    color = 'currentColor',
    variant = 'Linear',
    style,
    ...props
  }: IconProps) {
    const iconStyle = rotation
      ? {
          ...style,
          transform: [style?.transform, `rotate(${rotation}deg)`].filter(Boolean).join(' '),
        }
      : style;

    return <Glyph {...props} size={size} color={color} variant={variant} style={iconStyle} />;
  };
}

export const Activity = icon(ActivityGlyph);
export const ArrowRight = icon(ArrowRightGlyph);
export const ArrowUp = icon(ArrowUpGlyph);
export const ArrowUpRight = icon(ArrowRightGlyph, -45);
export const Banknote = icon(MoneyGlyph);
export const CalendarDays = icon(CalendarGlyph);
export const Car = icon(CarGlyph);
export const Check = icon(CheckGlyph);
export const CheckCircle2 = icon(TickGlyph);
export const ChevronDown = icon(ArrowDownGlyph);
export const ChevronRight = icon(ArrowRightGlyph);
export const CircleHelp = icon(HelpGlyph);
export const Clock3 = icon(ClockGlyph);
export const CreditCard = icon(CardGlyph);
export const Download = icon(DownloadGlyph);
export const FileText = icon(DocumentGlyph);
export const Headphones = icon(HeadphonesGlyph);
export const Heart = icon(HeartGlyph);
export const LayoutDashboard = icon(DashboardGlyph);
export const LogOut = icon(LogoutGlyph);
export const MapPin = icon(LocationGlyph);
export const Menu = icon(MenuGlyph);
export const Minus = icon(MinusGlyph);
export const Moon = icon(MoonGlyph);
export const Navigation = icon(GpsGlyph);
export const Bell = icon(BellGlyph);
export const Plus = icon(AddGlyph);
export const Search = icon(SearchGlyph);
export const Settings2 = icon(SettingsGlyph);
export const ShieldCheck = icon(ShieldGlyph);
export const SlidersHorizontal = icon(SlidersGlyph);
export const Smartphone = icon(MobileGlyph);
export const Star = icon(StarGlyph);
export const Sun = icon(SunGlyph);
export const Users = icon(PeopleGlyph);
export const Wallet = icon(WalletGlyph);
export const X = icon(CloseGlyph);
