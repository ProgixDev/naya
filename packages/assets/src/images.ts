/* Transparent raster artwork supplied with the Figma handoff (resized, alpha preserved). */
export const illustrations = {
  passengerWelcome: require('../illustrations/naya-passagere-bienvenue.png'),
  passengerPlanning: require('../illustrations/naya-passagere-planification.png'),
  passengerIdentity: require('../illustrations/naya-passagere-identite.png'),
  driverWelcome: require('../illustrations/naya-chauffeuse-bienvenue.png'),
  driverWallet: require('../illustrations/naya-chauffeuse-portefeuille.png'),
} as const;

/** Original Naya Signature car. Colour variants do not imply a fare tier. */
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
} as const;
