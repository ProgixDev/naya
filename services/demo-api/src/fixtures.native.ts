import { Asset } from 'expo-asset';
import { cacheDirectory, copyAsync, getInfoAsync, makeDirectoryAsync } from 'expo-file-system/legacy';

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
/** Real file URIs of the bundled images, ready to be copied by the seed. */
const files: Record<string, string> = {};

export async function prepareFixtures() {
  await Promise.all(Object.entries(assets).map(async ([name, asset]) => {
    await asset.downloadAsync();
    const uri = asset.localUri ?? asset.uri;
    if (uri.includes('://')) { files[name] = uri; return; }
    // Android release builds embed images as resources: localUri is only a resource name,
    // which the file API cannot copy. Extract it once into the cache.
    const target = `${cacheDirectory}demo-fixtures/${name}`;
    if (!(await getInfoAsync(target)).exists) {
      await makeDirectoryAsync(`${cacheDirectory}demo-fixtures`, { intermediates: true }).catch(() => undefined);
      await copyAsync({ from: uri, to: target });
    }
    files[name] = target;
  }));
}
export function fixturePath(name: string) {
  const uri = files[name];
  if (!uri) throw new Error(`Bundled demo image unavailable: ${name}`);
  return uri;
}
