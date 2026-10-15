/* Transparent raster artwork supplied with the Figma handoff (resized, alpha preserved). */
export const illustrations = {
  passengerWelcome: require('../illustrations/naya-passagere-bienvenue.png'),
  passengerPlanning: require('../illustrations/naya-passagere-planification.png'),
  passengerIdentity: require('../illustrations/naya-passagere-identite.png'),
  driverWelcome: require('../illustrations/naya-chauffeuse-bienvenue.png'),
  driverWallet: require('../illustrations/naya-chauffeuse-portefeuille.png'),
} as const;

/**
 * Onboarding photos (GPT Image), cropped from 9:16 to 940 × 1100 JPEG with the faces in the upper half, because
 * WelcomeJourney crops them from the top. Slide 1 of each app: 13 October 2026. Slides 2 and passenger slide 3:
 * 15 October 2026, from the docs/design/media-prompts prompts, reviewed before export.
 */
export const photos = {
  /** Driver slide 1. */
  driverOnRoad: require('../photos/naya-chauffeuse-route.jpg'),
  /** Driver slide 2: a chauffeuse at the wheel, door open, checking her phone by the sea. */
  driverEarnings: require('../photos/naya-chauffeuse-gains.jpg'),
  /** Passenger slide 1. */
  passengersBetweenWomen: require('../photos/naya-passageres-trajet.jpg'),
  /** Passenger slide 2: a passenger on a café terrace, looking at her phone. */
  passengerRhythm: require('../photos/naya-passagere-rythme.jpg'),
  /** Passenger slide 3: a chauffeuse at her car door greets a mother and her daughter by a green school gate. */
  schoolGate: require('../photos/naya-portail-ecole.jpg'),
} as const;

/**
 * Original Naya Signature car (GPT Image, 15 October 2026), transparent PNG. Colour variants do not imply a fare
 * tier. `top` is plum only and left-hand drive.
 */
export const cars = {
  pearl: require('../cars/naya-signature-pearl.png'),
  plum: require('../cars/naya-signature-plum.png'),
  pearlSmall: require('../cars/naya-signature-pearl-small.png'),
  plumSmall: require('../cars/naya-signature-plum-small.png'),
  top: require('../cars/naya-signature-top.png'),
} as const;

export const characters = {
  salmaPortrait: require('../characters/salma-portrait.png'),
  salmaStanding: require('../characters/salma-debout.png'),
  salmaSeated: require('../characters/salma-assise.png'),
  salmaWaving: require('../characters/salma-saluer.png'),
  salmaPhone: require('../characters/salma-telephone.png'),
  aminaPortrait: require('../characters/amina-portrait.png'),
  aminaStanding: require('../characters/amina-debout.png'),
  aminaSeated: require('../characters/amina-assise.png'),
  aminaWaving: require('../characters/amina-saluer.png'),
  aminaPhone: require('../characters/amina-telephone.png'),
} as const;

/** Square head-and-shoulders crops of the portraits, for 32–56 pt avatars. */
export const avatars = {
  salma: require('../avatars/salma.jpg'),
  amina: require('../avatars/amina.jpg'),
} as const;

/** Width / height of each artwork, so layouts reserve the right box and never stretch. */
export const aspect = {
  illustration: 1080 / 810,
  car: 1080 / 610,
  carSmall: 420 / 237,
  carTop: 103 / 192,
  portrait: 360 / 620,
  photo: 940 / 1100,
} as const;
