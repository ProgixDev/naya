import { useTheme } from '../core/theme';
import { useRef, useState } from 'react';
import { Linking, Modal, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SwitchCamera, X } from 'lucide-react-native';
import { colors } from '@naya/tokens';
import { Text } from '../Text';
import { Button, IconButton } from '../Button';
import { PressableScale } from '../PressableScale';
import { haptic } from '../haptics';
import { CaptureFrame, FRAME_RATIO, type FrameKind } from './CaptureGuide';

/** The viewfinder is black in both schemes: text on it is fixed white, never `inverse` (DM-02). */
const ON_MEDIA = '#FFFFFF';
const ON_MEDIA_MUTED = 'rgba(255,255,255,0.82)';

export interface LiveCameraProps {
  visible: boolean;
  kind: FrameKind;
  title: string;
  tip: string;
  front?: boolean;
  onClose: () => void;
  onCaptured: (uri: string) => void;
  /** The camera could not start (no module, no device): fall back to the system camera. */
  onUnavailable: () => void;
}

/**
 * Full-screen viewfinder with the document's frame drawn over the live camera and the rest
 * dimmed. One 72-pt shutter, a close and (for the selfie) a camera switch. No automatic
 * capture and no face analysis: the person decides when the photo is right.
 */
export function LiveCamera({ visible, kind, title, tip, front, onClose, onCaptured, onUnavailable }: LiveCameraProps) {
  useTheme();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'front' | 'back'>(front ? 'front' : 'back');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<CameraView>(null);
  const frameW = Math.min(W - 48, kind === 'face' ? 260 : kind === 'page' ? 300 : 360);
  const frameH = Math.min(Math.round(frameW / FRAME_RATIO[kind]), H * 0.55);

  const shoot = async () => {
    if (!ref.current || busy) return;
    setBusy(true);
    try {
      const pic = await ref.current.takePictureAsync({ quality: 0.9, exif: false });
      haptic.success();
      onCaptured(pic.uri);
    } catch {
      onUnavailable();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000' }} testID="live-camera">
        {permission?.granted ? (
          <CameraView ref={ref} style={{ flex: 1 }} facing={facing} onCameraReady={() => setReady(true)} onMountError={onUnavailable} />
        ) : (
          <View style={{ flex: 1, justifyContent: 'center', padding: 32, gap: 16 }}>
            <Text variant="title" align="center" style={{ color: ON_MEDIA }}>
              Autoriser l’appareil photo
            </Text>
            <Text variant="body" align="center" style={{ color: ON_MEDIA_MUTED }}>
              Naya utilise l’appareil photo uniquement pour vos pièces justificatives, pendant l’inscription.
            </Text>
            {permission && !permission.canAskAgain ? (
              <Button label="Ouvrir les réglages" full onPress={() => Linking.openSettings()} />
            ) : (
              <Button label="Autoriser" full onPress={() => requestPermission()} testID="camera-allow" />
            )}
          </View>
        )}
        {permission?.granted ? <CaptureFrame kind={kind} width={frameW} height={frameH} overlay={{ width: W, height: H }} /> : null}
        <View style={{ position: 'absolute', top: insets.top + 8, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconButton icon={<X size={22} color={colors.ink} />} accessibilityLabel="Fermer l’appareil photo" onPress={onClose} testID="camera-close" />
          <View style={{ flex: 1 }} />
          {front !== undefined && permission?.granted ? (
            <IconButton icon={<SwitchCamera size={21} color={colors.ink} />} accessibilityLabel="Changer de caméra" onPress={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))} />
          ) : null}
        </View>
        {permission?.granted ? (
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 24, alignItems: 'center', gap: 18, paddingHorizontal: 28 }}>
            <View style={{ gap: 4, alignItems: 'center' }} accessibilityLiveRegion="polite">
              <Text variant="heading" align="center" style={{ color: ON_MEDIA }}>
                {title}
              </Text>
              <Text variant="caption" align="center" style={{ color: ON_MEDIA_MUTED }}>
                {tip}
              </Text>
            </View>
            <PressableScale
              onPress={shoot}
              disabled={!ready || busy}
              accessibilityRole="button"
              accessibilityLabel="Prendre la photo"
              accessibilityState={{ disabled: !ready || busy, busy }}
              testID="camera-shutter"
              style={{ width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: ON_MEDIA, alignItems: 'center', justifyContent: 'center', opacity: ready ? 1 : 0.5 }}
            >
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: busy ? 'rgba(255,255,255,0.6)' : ON_MEDIA }} />
            </PressableScale>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
