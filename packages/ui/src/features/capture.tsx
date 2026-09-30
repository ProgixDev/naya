import { useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import { Image } from 'expo-image';
import { Camera, FileText, ImageIcon } from 'lucide-react-native';
import { errorMessage } from '@naya/api';
import { useApi } from '@naya/api/react';
import { ITEM_LABELS, type VerificationCase, type VerificationItemKey } from '@naya/domain';
import { colors, radius } from '@naya/tokens';
import { Text } from '../Text';
import { Button } from '../Button';
import { StatusBanner } from '../Feedback';
import { haptic } from '../haptics';
import { pickFile, uploadFile, type PickedFile, type Source } from './uploads';

export interface CaptureStepProps {
  caseId: string;
  item: VerificationItemKey;
  /** One line explaining what a good photo looks like. */
  guidance: string;
  selfie?: boolean;
  /** Reviewer's note when this piece was sent back for correction. */
  correctionNote?: string | null;
  existingUploadId?: string | null;
  onSaved: (c: VerificationCase) => void;
}

/**
 * Capture → preview → confirm. Uses the real camera, photo library or document picker,
 * keeps the photo's aspect ratio in the preview, and uploads to the protected endpoint
 * only when the person confirms. Permission denial offers a way to the settings.
 */
export function CaptureStep({ caseId, item, guidance, selfie, correctionNote, existingUploadId, onSaved }: CaptureStepProps) {
  const api = useApi();
  const [file, setFile] = useState<PickedFile | null>(null);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState<Source | 'upload' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const choose = async (source: Source) => {
    setBusy(source);
    setError(null);
    try {
      const r = await pickFile(source, { selfie });
      if (r === 'denied') setDenied(true);
      else if (r) {
        setDenied(false);
        setFile(r);
      }
    } catch (e) {
      setError(Platform.OS === 'web' && source === 'camera' ? 'L’appareil photo n’est pas disponible dans le navigateur. Importez une photo.' : errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const confirm = async () => {
    if (!file) return;
    setBusy('upload');
    setError(null);
    try {
      const up = await uploadFile(api, file, item);
      const saved = await api.verification.setItem(caseId, item, [up.id]);
      haptic.success();
      setFile(null);
      onSaved(saved);
    } catch (e) {
      setError(errorMessage(e));
      haptic.error();
    } finally {
      setBusy(null);
    }
  };

  const ratio = file?.width && file?.height ? file.width / file.height : selfie ? 3 / 4 : 1.586;
  return (
    <View style={{ gap: 16 }} testID={`capture-${item}`}>
      {correctionNote ? <StatusBanner tone="warning" title={`${ITEM_LABELS[item]} à reprendre`} message={correctionNote} /> : null}
      {file ? (
        <View style={{ gap: 12 }}>
          {file.mimeType === 'application/pdf' ? (
            <View style={{ height: 160, borderRadius: radius.card, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <FileText size={36} color={colors.accent} />
              <Text variant="label">Document PDF prêt à envoyer</Text>
            </View>
          ) : (
            <Image source={{ uri: file.uri }} style={{ width: '100%', aspectRatio: ratio, maxHeight: 420, borderRadius: radius.card, backgroundColor: colors.selected }} contentFit="contain" accessibilityLabel={`Aperçu : ${ITEM_LABELS[item]}`} />
          )}
          <Text variant="caption" tone="muted">
            Vérifiez que tout est lisible, sans reflet ni coin coupé.
          </Text>
          <Button label="Utiliser cette photo" full size="major" loading={busy === 'upload'} loadingLabel="Envoi sécurisé…" onPress={confirm} testID="use-photo" />
          <Button label="Reprendre" variant="ghost" full onPress={() => setFile(null)} disabled={busy === 'upload'} />
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <Text variant="label" tone="muted">
            {guidance}
          </Text>
          {existingUploadId ? <StatusBanner tone="success" title="Pièce ajoutée" message="Vous pouvez la remplacer si besoin." /> : null}
          {Platform.OS !== 'web' ? <Button label={selfie ? 'Prendre mon selfie' : 'Prendre une photo'} full size="major" icon={<Camera size={18} color={colors.inverse} />} loading={busy === 'camera'} onPress={() => choose('camera')} testID="take-photo" /> : null}
          <Button label="Importer une photo" variant={Platform.OS === 'web' ? 'primary' : 'secondary'} full icon={<ImageIcon size={18} color={Platform.OS === 'web' ? colors.inverse : colors.accent} />} loading={busy === 'library'} onPress={() => choose('library')} testID="import-photo" />
          {!selfie ? <Button label="Importer un PDF" variant="ghost" full onPress={() => choose('document')} testID="import-pdf" /> : null}
        </View>
      )}
      {denied ? <StatusBanner tone="warning" title="Accès refusé" message="Autorisez l’appareil photo ou les photos dans les réglages pour continuer." action={{ label: 'Ouvrir les réglages', onPress: () => Linking.openSettings() }} /> : null}
      {error ? <StatusBanner tone="danger" title="Envoi impossible" message={error} /> : null}
    </View>
  );
}
