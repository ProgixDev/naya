/**
 * Mock photos (packages/assets/mock/): what the apps show where the mock backend stands in for
 * someone else's camera. Swap a photo by replacing its file under the same name (see
 * mock/README.md for the expected files and sizes); no code change is needed.
 */
export const mockPhotos = {
  /** Car wash · « Avant » shots taken by the washing team. */
  carWashBefore: require('../mock/car-wash-before.jpg'),
  /** Car wash · « Après » shots taken by the washing team. */
  carWashAfter: require('../mock/car-wash-after.jpg'),
  /** Naya Famille · photo of the child at the pick-up. */
  famillePickup: require('../mock/famille-pickup.jpg'),
  /** Naya Famille · photo of the child at the school. */
  familleDropoff: require('../mock/famille-dropoff.jpg'),
} as const;

/** Every mock photo is 4:3 (1200 × 900). */
export const mockPhotoAspect = 4 / 3;
