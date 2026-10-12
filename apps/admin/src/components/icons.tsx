import type { Icon, IconProps } from 'iconsax-reactjs';
import {
  Add as AddGlyph,
  ArrowDown2 as ArrowDownGlyph,
  ArrowRight2 as ArrowRightGlyph,
  ArrowSwapVertical as ArrowSwapGlyph,
  ArrowUp2 as ArrowUpGlyph,
  Box as BoxGlyph,
  Buildings2 as BuildingsGlyph,
  Bus as BusGlyph,
  Calendar as CalendarGlyph,
  Call as CallGlyph,
  Car as CarGlyph,
  Card as CardGlyph,
  Chart as ChartGlyph,
  Check as CheckGlyph,
  CloseCircle as CloseCircleGlyph,
  CloseSquare as CloseSquareGlyph,
  Cpu as CpuGlyph,
  Crown as CrownGlyph,
  Danger as DangerGlyph,
  Diamonds as DiamondsGlyph,
  DirectInbox as InboxGlyph,
  DocumentText as DocumentGlyph,
  Driving as DrivingGlyph,
  ExportSquare as ExportGlyph,
  Flash as FlashGlyph,
  InfoCircle as InfoGlyph,
  Key as KeyGlyph,
  Location as LocationGlyph,
  Lock as LockGlyph,
  Logout as LogoutGlyph,
  Map as MapGlyph,
  Menu as MenuGlyph,
  MessageCircle as MessageCircleGlyph,
  MessageQuestion as MessageQuestionGlyph,
  Minus as MinusGlyph,
  Monitor as MonitorGlyph,
  Moon as MoonGlyph,
  Money as MoneyGlyph,
  PauseCircle as PauseGlyph,
  People as PeopleGlyph,
  PlayCircle as PlayGlyph,
  RotateRight as RotateGlyph,
  Routing as RoutingGlyph,
  SearchNormal as SearchGlyph,
  SearchZoomIn as ZoomGlyph,
  Setting2 as SettingGlyph,
  ShieldCross as ShieldAlertGlyph,
  ShieldTick as ShieldCheckGlyph,
  SliderHorizontal as SlidersGlyph,
  Star as StarGlyph,
  Sun as SunGlyph,
  Tag2 as TagsGlyph,
  TickCircle as TickGlyph,
  ToggleOn as ToggleGlyph,
  User as UserGlyph,
  UserSquare as UserSquareGlyph,
  Wallet as WalletGlyph,
  Warning2 as WarningGlyph,
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

export const Accessibility = icon(PeopleGlyph);
export const AlertTriangle = icon(WarningGlyph);
export const ArrowDown = icon(ArrowDownGlyph);
export const ArrowRight = icon(ArrowRightGlyph);
export const ArrowUp = icon(ArrowUpGlyph);
export const ArrowUpDown = icon(ArrowSwapGlyph);
export const Baby = icon(UserSquareGlyph);
export const Banknote = icon(MoneyGlyph);
export const BarChart3 = icon(ChartGlyph);
export const Bike = icon(DrivingGlyph);
export const Bot = icon(CpuGlyph);
export const Building2 = icon(BuildingsGlyph);
export const Bus = icon(BusGlyph);
export const CalendarHeart = icon(CalendarGlyph);
export const Car = icon(CarGlyph);
export const Check = icon(CheckGlyph);
export const CheckCircle2 = icon(TickGlyph);
export const ChevronRight = icon(ArrowRightGlyph);
export const CircleAlert = icon(DangerGlyph);
export const CreditCard = icon(CardGlyph);
export const Crown = icon(CrownGlyph);
export const ExternalLink = icon(ExportGlyph);
export const FileCheck2 = icon(DocumentGlyph);
export const FileText = icon(DocumentGlyph);
export const Gem = icon(DiamondsGlyph);
export const Inbox = icon(InboxGlyph);
export const Info = icon(InfoGlyph);
export const KeyRound = icon(KeyGlyph);
export const Loader2 = icon(RotateGlyph);
export const Lock = icon(LockGlyph);
export const LogOut = icon(LogoutGlyph);
export const Map = icon(MapGlyph);
export const MapPin = icon(LocationGlyph);
export const Menu = icon(MenuGlyph);
export const MessageCircle = icon(MessageCircleGlyph);
export const MessageSquareWarning = icon(MessageQuestionGlyph);
export const Minus = icon(MinusGlyph);
export const Monitor = icon(MonitorGlyph);
export const Moon = icon(MoonGlyph);
export const Package = icon(BoxGlyph);
export const PauseCircle = icon(PauseGlyph);
export const Phone = icon(CallGlyph);
export const PlayCircle = icon(PlayGlyph);
export const Plus = icon(AddGlyph);
export const Power = icon(ToggleGlyph);
export const RotateCw = icon(RotateGlyph);
export const Route = icon(RoutingGlyph);
export const Search = icon(SearchGlyph);
export const ShieldAlert = icon(ShieldAlertGlyph);
export const ShieldCheck = icon(ShieldCheckGlyph);
export const SlidersHorizontal = icon(SlidersGlyph);
export const Star = icon(StarGlyph);
export const Sun = icon(SunGlyph);
export const Tags = icon(TagsGlyph);
export const User = icon(UserGlyph);
export const UserRound = icon(UserGlyph);
export const Users = icon(PeopleGlyph);
export const Wallet = icon(WalletGlyph);
export const Wrench = icon(SettingGlyph);
export const X = icon(CloseSquareGlyph);
export const XCircle = icon(CloseCircleGlyph);
export const Zap = icon(FlashGlyph);
export const ZoomIn = icon(ZoomGlyph);
