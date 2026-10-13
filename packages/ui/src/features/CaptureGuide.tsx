import { useTheme } from '../core/theme';
import { View } from 'react-native';
import Svg, { Ellipse, Path, Rect } from 'react-native-svg';
import { CheckCircle2 } from 'lucide-react-native';
import type { VerificationItemKey } from '@naya/domain';
import { colors } from '@naya/tokens';
import { Text } from '../Text';

/** The shape the camera guide draws for a document. */
export type FrameKind = 'card' | 'face' | 'page' | 'vehicle' | 'interior';

export interface CaptureGuide {
  frame: FrameKind;
  /** Short instruction shown in the camera and above the frame. */
  title: string;
  /** Three concrete checks, shown before the photo is taken. */
  tips: [string, string, string];
  /** PDF import makes sense for paper documents only. */
  pdf: boolean;
}

const card = (title: string, tips: [string, string, string]): CaptureGuide => ({ frame: 'card', title, tips, pdf: true });
const page = (title: string, tips: [string, string, string]): CaptureGuide => ({ frame: 'page', title, tips, pdf: true });
const car = (title: string, tip: string): CaptureGuide => ({ frame: 'vehicle', title, tips: [tip, 'En extérieur, de jour, sans contre-jour', 'Le véhicule entier dans le cadre'], pdf: false });

/** One guide per document: the frame shape and what a good photo looks like. */
export const CAPTURE_GUIDES: Record<VerificationItemKey, CaptureGuide> = {
  selfie: { frame: 'face', title: 'Placez votre visage dans l’ovale', tips: ['Visage dégagé, sans lunettes de soleil', 'Lumière de face, pas de contre-jour', 'Le selfie sert uniquement à comparer avec votre pièce'], pdf: false },
  id_front: card('Cadrez le recto de votre pièce', ['Posée à plat, les quatre coins visibles', 'Sans reflet ni flash sur la photo', 'Texte net et lisible']),
  id_back: card('Retournez la pièce : cadrez le verso', ['Les quatre coins visibles', 'Sans reflet sur la puce ou la photo', 'Texte net et lisible']),
  driving_licence: card('Cadrez le recto du permis', ['Posé à plat, les quatre coins visibles', 'Photo et catégories lisibles', 'Sans reflet ni doigt sur le permis']),
  driving_licence_back: card('Retournez le permis : cadrez le verso', ['Les quatre coins visibles', 'La catégorie B et ses dates lisibles', 'Sans reflet ni doigt sur le permis']),
  vehicle_registration: card('Cadrez la carte grise', ['Celle du véhicule déclaré', 'Immatriculation et titulaire lisibles', 'Les quatre coins visibles']),
  insurance: page('Cadrez l’attestation d’assurance', ['En cours de validité', 'Dates et immatriculation lisibles', 'La page entière dans le cadre']),
  technical_inspection: page('Cadrez le procès-verbal de visite technique', ['Le dernier contrôle, résultat favorable', 'Date de prochaine visite lisible', 'La page entière dans le cadre']),
  vehicle_photos: car('Photographiez le véhicule', 'De trois quarts avant, plaque visible'),
  vehicle_photo_front: car('Face avant du véhicule', 'Plaque avant lisible, de face'),
  vehicle_photo_back: car('Face arrière du véhicule', 'Plaque arrière lisible, de face'),
  vehicle_photo_left: car('Côté gauche du véhicule', 'De profil, les deux roues visibles'),
  vehicle_photo_right: car('Côté droit du véhicule', 'De profil, les deux roues visibles'),
  vehicle_photo_interior: { frame: 'interior', title: 'Photographiez l’intérieur', tips: ['Depuis la portière arrière ouverte', 'Sièges et ceintures visibles', 'Habitacle propre et rangé'], pdf: false },
  criminal_record: page('Cadrez l’extrait de casier judiciaire', ['Daté de moins de trois mois', 'Votre nom et le cachet lisibles', 'La page entière dans le cadre']),
};

/** Width / height of each frame. */
export const FRAME_RATIO: Record<FrameKind, number> = { card: 1.586, face: 0.78, page: 0.72, vehicle: 1.5, interior: 1.33 };

/** Car outline (side-agnostic), drawn in a 300 × 200 box. */
const CAR = 'M36 156 C30 156 28 152 28 146 L28 132 C28 118 40 110 62 106 L92 74 C100 66 110 62 122 62 L186 62 C198 62 208 66 216 74 L246 104 C264 108 274 118 274 134 L274 148 C274 153 270 156 265 156 L250 156 M214 156 L86 156 M50 156 L36 156 M50 156 A18 18 0 1 0 86 156 A18 18 0 1 0 50 156 M214 156 A18 18 0 1 0 250 156 A18 18 0 1 0 214 156 M100 102 L118 78 L148 78 L148 102 Z M160 102 L160 78 L188 78 L210 102 Z';
const SEATS = 'M70 150 L70 92 C70 80 80 72 92 72 L110 72 C122 72 130 80 130 92 L130 150 M170 150 L170 92 C170 80 180 72 192 72 L210 72 C222 72 230 80 230 92 L230 150 M56 150 L244 150';

/**
 * The framing guide: corner marks in the document's own shape plus a light silhouette, so
 * the person knows how to hold the phone before the camera opens. Also used over the live
 * camera (`overlay`), where the outside of the frame is dimmed.
 */
export function CaptureFrame({ kind, width, done, overlay, height: forced }: { kind: FrameKind; width: number; done?: boolean; overlay?: { width: number; height: number }; height?: number }) {
  useTheme();
  const height = forced ?? Math.round(width / FRAME_RATIO[kind]);
  const stroke = done ? colors.success : overlay ? '#FFFFFF' : colors.accent;
  const r = kind === 'card' ? 18 : kind === 'page' ? 10 : 22;
  const corner = Math.min(34, width / 5);
  const marks =
    kind === 'face'
      ? null
      : [
          `M0 ${corner} L0 ${r} Q0 0 ${r} 0 L${corner} 0`,
          `M${width - corner} 0 L${width - r} 0 Q${width} 0 ${width} ${r} L${width} ${corner}`,
          `M${width} ${height - corner} L${width} ${height - r} Q${width} ${height} ${width - r} ${height} L${width - corner} ${height}`,
          `M${corner} ${height} L${r} ${height} Q0 ${height} 0 ${height - r} L0 ${height - corner}`,
        ].join(' ');
  const silhouette = kind === 'vehicle' ? CAR : kind === 'interior' ? SEATS : null;
  const frame = (
    <Svg width={width + 6} height={height + 6} viewBox={`-3 -3 ${width + 6} ${height + 6}`}>
      {kind === 'face' ? (
        <Ellipse cx={width / 2} cy={height / 2} rx={width / 2} ry={height / 2} stroke={stroke} strokeWidth={3} strokeDasharray="10 8" fill="none" />
      ) : (
        <>
          <Rect x={0} y={0} width={width} height={height} rx={r} stroke={stroke} strokeOpacity={0.25} strokeWidth={1.5} fill="none" />
          <Path d={marks!} stroke={stroke} strokeWidth={4} strokeLinecap="round" fill="none" />
        </>
      )}
      {kind === 'card' ? (
        <>
          <Rect x={width * 0.08} y={height * 0.28} width={width * 0.24} height={height * 0.44} rx={8} fill={stroke} fillOpacity={overlay ? 0.18 : 0.1} />
          {[0.32, 0.46, 0.6].map((y) => (
            <Rect key={y} x={width * 0.38} y={height * y} width={width * (y === 0.32 ? 0.46 : 0.34)} height={7} rx={3.5} fill={stroke} fillOpacity={overlay ? 0.22 : 0.12} />
          ))}
        </>
      ) : null}
      {kind === 'page'
        ? [0.16, 0.26, 0.36, 0.46, 0.56, 0.66].map((y, i) => <Rect key={y} x={width * 0.12} y={height * y} width={width * (i === 0 ? 0.5 : 0.76)} height={6} rx={3} fill={stroke} fillOpacity={overlay ? 0.2 : 0.1} />)
        : null}
      {silhouette ? (
        <Path d={silhouette} transform={`translate(${width * 0.1} ${height * 0.12}) scale(${(width * 0.8) / 300} ${(height * 0.76) / 200})`} stroke={stroke} strokeOpacity={overlay ? 0.75 : 0.45} strokeWidth={2.5} strokeLinejoin="round" fill="none" />
      ) : null}
    </Svg>
  );
  if (!overlay) return frame;
  // Dim everything outside the frame (even-odd hole), for the live camera.
  const { width: W, height: H } = overlay;
  const x = (W - width) / 2;
  const y = (H - height) / 2 - H * 0.04;
  const hole = kind === 'face' ? ellipsePath(x + width / 2, y + height / 2, width / 2, height / 2) : roundRectPath(x, y, width, height, r);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, width: W, height: H }}>
      <Svg width={W} height={H} style={{ position: 'absolute' }}>
        <Path d={`M0 0 H${W} V${H} H0 Z ${hole}`} fill="rgba(20,12,18,0.55)" fillRule="evenodd" />
      </Svg>
      <View style={{ position: 'absolute', left: x - 3, top: y - 3 }}>{frame}</View>
    </View>
  );
}

const roundRectPath = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${y + h - r} Q${x + w} ${y + h} ${x + w - r} ${y + h} H${x + r} Q${x} ${y + h} ${x} ${y + h - r} V${y + r} Q${x} ${y} ${x + r} ${y} Z`;
const ellipsePath = (cx: number, cy: number, rx: number, ry: number) => `M${cx - rx} ${cy} A${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;

/** The three checks of a guide, each with a tick. */
export function GuideTips({ tips }: { tips: readonly string[] }) {
  useTheme();
  return (
    <View style={{ gap: 8 }} accessibilityRole="list">
      {tips.map((t) => (
        <View key={t} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }} accessibilityRole="text">
          <CheckCircle2 size={18} color={colors.accent} style={{ marginTop: 1 }} />
          <Text variant="caption" style={{ flex: 1 }}>
            {t}
          </Text>
        </View>
      ))}
    </View>
  );
}
