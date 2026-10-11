import { Accessibility, Baby, Bike, Bus, Car, Crown, Gem, Package, Zap } from 'lucide-react';
import type { ServiceIcon } from '@naya/domain';

export const SERVICE_ICON: Record<ServiceIcon, typeof Car> = { car: Car, scooter: Bike, premium: Gem, van: Bus, electric: Zap, accessible: Accessibility, family: Baby, luxury: Crown, package: Package };
