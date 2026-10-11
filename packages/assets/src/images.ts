import type { Spot } from './spots';

/** Contextual vector illustrations (see spots.ts). Names kept so screens read the same. */
export const illustrations = {
  passengerWelcome: 'journey',
  passengerPlanning: 'schedule',
  passengerIdentity: 'verified',
  passengerSupport: 'support',
  driverWelcome: 'drive',
  driverWallet: 'wallet',
  driverEarnings: 'earnings',
  driverSupport: 'support',
} as const satisfies Record<string, Spot>;

/** The Naya car, drawn in vector. */
export const cars = { side: 'car' } as const satisfies Record<string, Spot>;

/** Width / height of each artwork, so layouts reserve the right box and never stretch. */
export const aspect = {
  illustration: 320 / 240,
  carSmall: 320 / 180,
} as const;

/** Full-bleed onboarding photos (Pexels licence, see photos/CREDITS.md). */
export const photos = {
  onboardingRide: require('../photos/onboarding-ride.jpg'),
  onboardingFriends: require('../photos/onboarding-friends.jpg'),
  onboardingFamily: require('../photos/onboarding-family.jpg'),
  onboardingDriver: require('../photos/onboarding-driver.jpg'),
  onboardingDriver2: require('../photos/onboarding-driver-2.jpg'),
};
