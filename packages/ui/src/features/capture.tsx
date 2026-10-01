import { useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import { Image } from 'expo-image';
import { Camera, FastForward, FileText, IdCard, ImageIcon, ScanFace } from 'lucide-react-native';
import { errorMessage } from '@naya/api';
import { useApi } from '@naya/api/react';
import { ITEM_LABELS, type VerificationCase, type VerificationItemKey } from '@naya/domain';
import { colors } from '@naya/tokens';
import { Text } from '../Text';
import { Button } from '../Button';
import { StatusBanner } from '../Feedback';
import { haptic } from '../haptics';
import { pickFile, uploadFile, type PickedFile, type Source } from './uploads';
import { DEMO_MODE } from '../core/apiBase';

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

const CARD_RATIO = 1.586; // ID-1 card
const FRAME_H = 210;

/**
 * Framed capture guide → preview → confirm. The frame has the document's own shape (an
 * oval for the selfie, an ID card ratio otherwise) so the whole step fits one screen.
 * Uses the real camera, photo library or document picker and uploads to the protected
 * endpoint only when the person confirms. Permission denial offers a way to the settings.
 */
export function CaptureStep({ caseId, item, guidance, selfie, correctionNote, existingUploadId, onSaved }: CaptureStepProps) {
  const api = useApi();
  const [file, setFile] = useState<PickedFile | null>(null);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState<Source | 'upload' | 'sample' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const web = Platform.OS === 'web';

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
      setError(web && source === 'camera' ? 'L’appareil photo n’est pas disponible dans le navigateur. Importez une photo.' : errorMessage(e));
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

  /** Demo builds only: attach a fictional specimen so the flow continues without a camera. */
  const skip = async () => {
    setBusy('sample');
    setError(null);
    try {
      const up = await api.dev.sampleUpload(item);
      const saved = await api.verification.setItem(caseId, item, [up.id]);
      haptic.success();
      onSaved(saved);
    } catch (e) {
      setError(errorMessage(e));
      haptic.error();
    } finally {
      setBusy(null);
    }
  };

  const frameW = selfie ? FRAME_H * 0.78 : FRAME_H * CARD_RATIO;
  const frame = {
    width: frameW,
    maxWidth: '100%' as const,
    height: FRAME_H,
    borderRadius: selfie ? FRAME_H / 2 : 22,
    alignSelf: 'center' as const,
    overflow: 'hidden' as const,
  };

  return (
    <View style={{ gap: 14 }} testID={`capture-${item}`}>
      {correctionNote ? <StatusBanner compact tone="warning" title={`${ITEM_LABELS[item]} à reprendre`} message={correctionNote} /> : null}

      {file ? (
        file.mimeType === 'application/pdf' ? (
          <View style={[frame, { backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 8 }]}>
            <FileText size={34} color={colors.accent} />
            <Text variant="label">Document PDF prêt</Text>
          </View>
        ) : (
          <View style={[frame, { backgroundColor: colors.selected }]}>
            <Image source={{ uri: file.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" accessibilityLabel={`Aperçu : ${ITEM_LABELS[item]}`} />
          </View>
        )
      ) : (
        <View style={[frame, { borderWidth: 2, borderStyle: 'dashed', borderColor: existingUploadId ? colors.success : colors.mauve, backgroundColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22, gap: 10 }]}>
          {selfie ? <ScanFace size={34} color={colors.accent} /> : <IdCard size={34} color={colors.accent} />}
          <Text variant="caption" tone="muted" align="center">
            {existingUploadId ? 'Pièce ajoutée · vous pouvez la remplacer' : guidance}
          </Text>
        </View>
      )}

      {file ? (
        <View style={{ gap: 8 }}>
          <Text variant="caption" tone="muted" align="center">
            Tout est lisible, sans reflet ni coin coupé ?
          </Text>
          <Button label="Utiliser cette photo" full size="major" loading={busy === 'upload'} loadingLabel="Envoi sécurisé…" onPress={confirm} testID="use-photo" />
          <Button label="Reprendre" variant="secondary" full onPress={() => setFile(null)} disabled={busy === 'upload'} />
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {!web ? (
            <Button label={selfie ? 'Prendre mon selfie' : 'Prendre une photo'} full size="major" icon={<Camera size={18} color={colors.inverse} />} loading={busy === 'camera'} onPress={() => choose('camera')} testID="take-photo" />
          ) : null}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button
              label="Importer une photo"
              variant={web ? 'primary' : 'secondary'}
              size={web ? 'major' : 'standard'}
              full
              style={{ flex: 1 }}
              icon={<ImageIcon size={17} color={web ? colors.inverse : colors.accent} />}
              loading={busy === 'library'}
              onPress={() => choose('library')}
              testID="import-photo"
            />
            {!selfie ? <Button label="PDF" variant="secondary" size={web ? 'major' : 'standard'} icon={<FileText size={17} color={colors.accent} />} onPress={() => choose('document')} testID="import-pdf" /> : null}
          </View>
          {DEMO_MODE ? (
            <Button label="Passer · exemple de démonstration" variant="ghost" full icon={<FastForward size={16} color={colors.accent} />} loading={busy === 'sample'} disabled={!!busy && busy !== 'sample'} onPress={skip} testID="skip-capture" />
          ) : null}
        </View>
      )}
      {denied ? <StatusBanner tone="warning" title="Accès refusé" message="Autorisez l’appareil photo ou les photos dans les réglages pour continuer." action={{ label: 'Ouvrir les réglages', onPress: () => Linking.openSettings() }} /> : null}
      {error ? <StatusBanner compact tone="danger" title="Envoi impossible" message={error} /> : null}
    </View>
  );
}
