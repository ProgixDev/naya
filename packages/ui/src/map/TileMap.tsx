import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import Svg, { Polyline } from 'react-native-svg';
import { colors } from '@naya/tokens';
import type { LatLng } from '@naya/domain';
import { Text } from '../Text';
import { useA11yPrefs } from '../a11y';
import { MarkerView } from './Markers';
import { fitZoom, project, TILE, unproject } from './projection';
import { DEFAULT_ZOOM, type NayaMapProps } from './types';
import { useAnimatedCoordinate, bearing } from './useAnimatedCoordinate';

/**
 * Keyless fallback map for the web build and Android builds without a Google Maps key.
 * Draws raster tiles from EXPO_PUBLIC_MAP_TILE_URL (default: OpenStreetMap standard tiles,
 * acceptable for light development use under the OSMF tile policy) with visible
 * attribution. Production must use a licensed tile provider or a keyed native map.
 */
export const TILE_URL = process.env.EXPO_PUBLIC_MAP_TILE_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION = process.env.EXPO_PUBLIC_MAP_ATTRIBUTION ?? '© OpenStreetMap contributors';

export function TileMap({ center, zoom = DEFAULT_ZOOM, markers = [], route, fitTo, onCenterChange, onPress, interactive = true, bottomInset = 0, topInset = 0, testID }: NayaMapProps) {
  const { reduceMotion } = useA11yPrefs();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState({ center, zoom });
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const fitKey = fitTo?.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|');

  useEffect(() => {
    if (!size.w) return;
    if (fitTo && fitTo.length > 1) {
      const f = fitZoom(fitTo, size.w, size.h - bottomInset - topInset, 56, 16);
      // shift centre upward so content sits above the sheet
      const c = project(f.center, f.zoom);
      setView({ center: unproject(c.x, c.y + (bottomInset - topInset) / 2, f.zoom), zoom: f.zoom });
    } else {
      setView({ center, zoom });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, center.lat, center.lng, zoom, size.w, size.h, bottomInset]);

  const origin = useMemo(() => {
    const c = project(view.center, view.zoom);
    return { x: c.x - size.w / 2, y: c.y - size.h / 2 };
  }, [view, size]);

  const tiles = useMemo(() => {
    if (!size.w) return [];
    const out: { key: string; x: number; y: number; left: number; top: number }[] = [];
    const n = 2 ** view.zoom;
    const x0 = Math.floor((origin.x - TILE) / TILE);
    const x1 = Math.floor((origin.x + size.w + TILE) / TILE);
    const y0 = Math.floor((origin.y - TILE) / TILE);
    const y1 = Math.floor((origin.y + size.h + TILE) / TILE);
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        if (y < 0 || y >= n) continue;
        const wx = ((x % n) + n) % n;
        out.push({ key: `${view.zoom}/${x}/${y}`, x: wx, y, left: x * TILE - origin.x, top: y * TILE - origin.y });
      }
    }
    return out;
  }, [origin, size, view.zoom]);

  const toScreen = (p: LatLng) => {
    const q = project(p, view.zoom);
    return { x: q.x - origin.x, y: q.y - origin.y };
  };

  const commitPan = (dx: number, dy: number) => {
    const c = project(view.center, view.zoom);
    const next = unproject(c.x - dx, c.y - dy, view.zoom);
    setView((v) => ({ ...v, center: next }));
    tx.value = 0;
    ty.value = 0;
    onCenterChange?.(next);
  };
  const tapAt = (x: number, y: number) => onPress?.(unproject(origin.x + x, origin.y + y, view.zoom));

  const pan = Gesture.Pan()
    .enabled(interactive)
    .minDistance(4)
    .onUpdate((e) => {
      tx.value = e.translationX;
      ty.value = e.translationY;
    })
    .onEnd((e) => runOnJS(commitPan)(e.translationX, e.translationY));
  const tap = Gesture.Tap()
    .enabled(interactive && !!onPress)
    .onEnd((e) => runOnJS(tapAt)(e.x, e.y));
  const layer = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { translateY: ty.value }] }));

  const driver = markers.find((m) => m.kind === 'driver');
  const animatedDriver = useAnimatedCoordinate(driver?.coordinate ?? null, reduceMotion);
  const lastDriver = useRef<LatLng | null>(null);
  const heading = useMemo(() => {
    if (!animatedDriver) return 0;
    const prev = lastDriver.current;
    lastDriver.current = animatedDriver;
    return prev && (prev.lat !== animatedDriver.lat || prev.lng !== animatedDriver.lng) ? bearing(prev, animatedDriver) : (driver?.heading ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animatedDriver?.lat, animatedDriver?.lng]);

  const url = (t: { x: number; y: number }) => TILE_URL.replace('{z}', String(view.zoom)).replace('{x}', String(t.x)).replace('{y}', String(t.y)).replace('{s}', 'a');
  const routePts = route?.map(toScreen).map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <View testID={testID} style={[StyleSheet.absoluteFill, { backgroundColor: colors.map, overflow: 'hidden' }]} onLayout={(e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} accessibilityLabel="Carte" accessibilityHint={onCenterChange ? 'Faites glisser la carte pour placer le point de départ sous le repère' : undefined}>
      <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
        <Animated.View style={[StyleSheet.absoluteFill, layer]}>
          {tiles.map((t) => (
            <Image key={t.key} source={{ uri: url(t) }} style={[{ position: 'absolute', left: t.left, top: t.top, width: TILE, height: TILE }, tileFilter]} transition={Platform.OS === 'web' ? 0 : 120} cachePolicy="memory-disk" />
          ))}
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: Platform.OS === 'web' ? 'rgba(250,244,247,0.18)' : 'rgba(250,244,247,0.42)' }]} />
          {route && route.length > 1 ? (
            <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width={size.w} height={size.h}>
              <Polyline points={routePts} stroke={colors.surface} strokeWidth={9} fill="none" strokeLinejoin="round" strokeLinecap="round" />
              <Polyline points={routePts} stroke={colors.accent} strokeWidth={5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            </Svg>
          ) : null}
          {markers
            .filter((m) => m.kind !== 'driver')
            .map((m) => {
              const p = toScreen(m.coordinate);
              return (
                <View key={m.id} pointerEvents="none" style={{ position: 'absolute', left: p.x - 40, top: m.kind === 'destination' ? p.y - 30 : p.y - 9, width: 80, alignItems: 'center' }}>
                  <MarkerView marker={m} />
                </View>
              );
            })}
          {driver && animatedDriver ? (
            <View pointerEvents="none" style={{ position: 'absolute', left: toScreen(animatedDriver).x - 15, top: toScreen(animatedDriver).y - 28 }}>
              <MarkerView marker={{ ...driver, coordinate: animatedDriver, heading }} />
            </View>
          ) : null}
        </Animated.View>
      </GestureDetector>
      <View style={[styles.attribution, { bottom: bottomInset + 6 }]} pointerEvents="box-none">
        <Text variant="micro" tone="muted" onPress={() => Linking.openURL('https://www.openstreetmap.org/copyright')} accessibilityRole="link" style={{ fontSize: 10 }}>
          {TILE_ATTRIBUTION}
        </Text>
      </View>
    </View>
  );
}

/** Calm, pearl-leaning basemap: desaturated on web where CSS filters exist. */
const tileFilter = Platform.OS === 'web' ? ({ filter: 'grayscale(0.92) sepia(0.12) hue-rotate(250deg) brightness(1.06) contrast(0.92)' } as object) : null;

const styles = StyleSheet.create({
  attribution: { position: 'absolute', left: 8, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 4, paddingHorizontal: 4 },
});
