import { Asset } from 'expo-asset';

const assets: Record<string, Asset> = {
  'amina-id-back.jpg': Asset.fromModule(require('../fixtures/amina-id-back.jpg')),
  'amina-id-front.jpg': Asset.fromModule(require('../fixtures/amina-id-front.jpg')),
  'amina-licence.jpg': Asset.fromModule(require('../fixtures/amina-licence.jpg')),
  'amina-selfie.jpg': Asset.fromModule(require('../fixtures/amina-selfie.jpg')),
  'generic-id-back.jpg': Asset.fromModule(require('../fixtures/generic-id-back.jpg')),
  'generic-id-front.jpg': Asset.fromModule(require('../fixtures/generic-id-front.jpg')),
  'generic-licence-blurry.jpg': Asset.fromModule(require('../fixtures/generic-licence-blurry.jpg')),
  'insurance.jpg': Asset.fromModule(require('../fixtures/insurance.jpg')),
  'salma-id-back.jpg': Asset.fromModule(require('../fixtures/salma-id-back.jpg')),
  'salma-id-front.jpg': Asset.fromModule(require('../fixtures/salma-id-front.jpg')),
  'salma-selfie.jpg': Asset.fromModule(require('../fixtures/salma-selfie.jpg')),
  'vehicle-pearl.jpg': Asset.fromModule(require('../fixtures/vehicle-pearl.jpg')),
  'vehicle-plum.jpg': Asset.fromModule(require('../fixtures/vehicle-plum.jpg')),
  'vehicle-registration-2.jpg': Asset.fromModule(require('../fixtures/vehicle-registration-2.jpg')),
  'vehicle-registration.jpg': Asset.fromModule(require('../fixtures/vehicle-registration.jpg')),
};
export async function prepareFixtures() { await Promise.all(Object.values(assets).map((a) => a.downloadAsync())); }
export function fixturePath(name: string) {
  const uri = assets[name]?.localUri;
  if (!uri) throw new Error(`Bundled demo image unavailable: ${name}`);
  return uri;
}
