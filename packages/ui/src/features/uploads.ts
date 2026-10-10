import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import type { ApiClient } from '@naya/api';
import type { Upload, VerificationItemKey } from '@naya/domain';

export type Source = 'camera' | 'library' | 'document';

export interface PickedFile {
  uri: string;
  width: number | null;
  height: number | null;
  mimeType: 'image/jpeg' | 'application/pdf';
}

/**
 * Real native pickers. Images are resized to ≤1600 px on the long edge (aspect ratio kept)
 * and re-encoded as JPEG, which also strips location metadata. `square` opens the native
 * 1:1 crop step and `maxEdge` lowers the size cap (profile photos).
 */
export async function pickFile(source: Source, opts: { selfie?: boolean; square?: boolean; maxEdge?: number } = {}): Promise<PickedFile | 'denied' | null> {
  if (source === 'document') {
    const r = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true, multiple: false });
    if (r.canceled || !r.assets[0]) return null;
    const a = r.assets[0];
    if (a.mimeType === 'application/pdf') return { uri: a.uri, width: null, height: null, mimeType: 'application/pdf' };
    return normalizeImage(a.uri);
  }
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return 'denied';
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9, cameraType: opts.selfie ? ImagePicker.CameraType.front : ImagePicker.CameraType.back, exif: false, allowsEditing: !!opts.square, aspect: opts.square ? [1, 1] : undefined });
    if (r.canceled || !r.assets[0]) return null;
    return normalizeImage(r.assets[0].uri, opts.maxEdge);
  }
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted && Platform.OS !== 'web') return 'denied';
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, exif: false, allowsEditing: !!opts.square, aspect: opts.square ? [1, 1] : undefined });
  if (r.canceled || !r.assets[0]) return null;
  return normalizeImage(r.assets[0].uri, opts.maxEdge);
}

async function normalizeImage(uri: string, maxEdge = 1600): Promise<PickedFile> {
  const ctx = ImageManipulator.ImageManipulator.manipulate(uri);
  const probe = await ctx.renderAsync();
  const long = Math.max(probe.width, probe.height);
  const scaled = long > maxEdge ? ImageManipulator.ImageManipulator.manipulate(uri).resize(probe.width >= probe.height ? { width: maxEdge } : { height: maxEdge }) : ImageManipulator.ImageManipulator.manipulate(uri);
  const img = await scaled.renderAsync();
  const out = await img.saveAsync({ format: ImageManipulator.SaveFormat.JPEG, compress: 0.82 });
  return { uri: out.uri, width: out.width, height: out.height, mimeType: 'image/jpeg' };
}

async function toBase64(uri: string): Promise<string> {
  if (Platform.OS === 'web' || uri.startsWith('blob:') || uri.startsWith('data:')) {
    const blob = await (await fetch(uri)).blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  const { File } = await import('expo-file-system');
  return new File(uri).base64();
}

/** Uploads to the protected upload endpoint; the returned id is only readable by the owner and reviewers. */
export async function uploadFile(api: ApiClient, file: PickedFile, purpose: VerificationItemKey | 'support_attachment' | 'avatar'): Promise<Upload> {
  const dataBase64 = await toBase64(file.uri);
  return api.uploads.create({ purpose, mimeType: file.mimeType, dataBase64, width: file.width, height: file.height });
}
