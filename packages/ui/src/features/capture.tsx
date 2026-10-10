import { useTheme } from './../core/theme';
import { useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Camera, Check, CheckCircle2, FastForward, FileText, IdCard, ImageIcon, Lock, ScanFace } from 'lucide-react-native';
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
  useTheme();
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

  const frameH = selfie ? 250 : FRAME_H;
  const frameW = selfie ? frameH * 0.78 : FRAME_H * CARD_RATIO;
  const frame = {
    width: frameW,
    maxWidth: '100%' as const,
    height: frameH,
    borderRadius: selfie ? frameH / 2 : 22,
    alignSelf: 'center' as const,
    overflow: 'hidden' as const,
  };
  const tips = selfie
    ? ['Visage centré, de face', 'Bonne lumière, sans contre-jour', 'Sans lunettes de soleil ni casquette']
    : ['Pièce à plat, quatre coins visibles', 'Sans reflet ni flou', 'Texte lisible en entier'];
  const corner = (pos: object) => <View pointerEvents="none" style={[{ position: 'absolute', width: 26, height: 26, borderColor: '#FFFFFF' }, pos]} />;

  return (
    <View style={{ gap: 16 }} testID={`capture-${item}`}>
      {correctionNote ? <StatusBanner compact tone="warning" title={`${ITEM_LABELS[item]} à reprendre`} message={correctionNote} /> : null}

      {/* ── Stage ── */}
      <View style={{ borderRadius: 28, overflow: 'hidden', paddingVertical: 24, paddingHorizontal: 20, alignItems: 'center' }}>
        <LinearGradient colors={['#3F1B34', '#6B3657']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={{ position: 'absolute', width: 300, height: 300, borderRadius: 150, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', top: -120, right: -110 }} />
        {file ? (
          file.mimeType === 'application/pdf' ? (
            <View style={[frame, { backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 8 }]}>
              <FileText size={34} color={colors.accent} />
              <Text variant="label">Document PDF prêt</Text>
            </View>
          ) : (
            <View style={[frame, { backgroundColor: colors.selected, borderWidth: 3, borderColor: '#FFFFFF' }]}>
              <Image source={{ uri: file.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" accessibilityLabel={`Aperçu : ${ITEM_LABELS[item]}`} />
            </View>
          )
        ) : (
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <View style={[frame, { borderWidth: 2, borderStyle: 'dashed', borderColor: existingUploadId ? '#9AD5B4' : 'rgba(255,255,255,0.55)', backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22, gap: 10 }]}>
              <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}>
                {existingUploadId ? <CheckCircle2 size={28} color="#FFFFFF" /> : selfie ? <ScanFace size={28} color="#FFFFFF" /> : <IdCard size={28} color="#FFFFFF" />}
              </View>
              <Text weight="medium" align="center" style={{ fontSize: 13, lineHeight: 18, color: 'rgba(255,255,255,0.88)' }}>
                {existingUploadId ? 'Pièce ajoutée · vous pouvez la remplacer' : guidance}
              </Text>
            </View>
            {!selfie ? (
              <>
                {corner({ top: -6, left: -6, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 12 })}
                {corner({ top: -6, right: -6, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 12 })}
                {corner({ bottom: -6, left: -6, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 12 })}
                {corner({ bottom: -6, right: -6, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 12 })}
              </>
            ) : null}
          </View>
        )}
      </View>

      {/* ── Tips (before capture) ── */}
      {!file ? (
        <View style={{ gap: 8, paddingHorizontal: 4 }}>
          {tips.map((t) => (
            <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center' }}><Check size={12} color={colors.success} strokeWidth={3} /></View>
              <Text style={{ flex: 1, fontSize: 14, lineHeight: 20 }}>{t}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {file ? (
        <View style={{ gap: 8 }}>
          <Text tone="muted" align="center" style={{ fontSize: 14, lineHeight: 20 }}>
            {selfie ? 'Votre visage est net et bien éclairé ?' : 'Tout est lisible, sans reflet ni coin coupé ?'}
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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 }}>
        <Lock size={14} color={colors.success} strokeWidth={2.2} />
        <Text tone="muted" style={{ flex: 1, fontSize: 12, lineHeight: 17 }}>Chiffrée et vue uniquement par l’équipe de vérification Naya.</Text>
      </View>
      {denied ? <StatusBanner tone="warning" title="Accès refusé" message="Autorisez l’appareil photo ou les photos dans les réglages pour continuer." action={{ label: 'Ouvrir les réglages', onPress: () => Linking.openSettings() }} /> : null}
      {error ? <StatusBanner compact tone="danger" title="Envoi impossible" message={error} /> : null}
    </View>
  );
}
