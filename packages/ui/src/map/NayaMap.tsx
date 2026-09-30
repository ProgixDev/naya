import { useEffect, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import MapView, { Marker, Polyline, type Region } from 'react-native-maps';
import { colors } from '@naya/tokens';
import { useA11yPrefs } from '../a11y';
import { MarkerView } from './Markers';
import { TileMap } from './TileMap';
import { DEFAULT_ZOOM, type NayaMapProps } from './types';
import { useAnimatedCoordinate } from './useAnimatedCoordinate';

const googleConfigured = !!(Constants.expoConfig?.extra as { googleMapsConfigured?: boolean } | undefined)?.googleMapsConfigured;

/** Which engine renders the map on this build (reported in docs and the dev launcher). */
export const mapEngine: 'apple' | 'google' | 'tiles' = Platform.OS === 'ios' ? 'apple' : Platform.OS === 'android' && googleConfigured ? 'google' : 'tiles';

const deltaForZoom = (zoom: number) => 360 / 2 ** zoom;

/**
 * Map adapter. iOS: Apple Maps (no key, Apple attribution drawn by MapKit). Android: Google
 * Maps when GOOGLE_MAPS_ANDROID_KEY was set at build time, otherwise the tile fallback.
 */
export function NayaMap(props: NayaMapProps) {
  if (mapEngine === 'tiles') return <TileMap {...props} />;
  return <NativeMap {...props} />;
}

function NativeMap({ center, zoom = DEFAULT_ZOOM, markers = [], route, fitTo, onCenterChange, onPress, interactive = true, bottomInset = 0, topInset = 0, testID }: NayaMapProps) {
  const ref = useRef<MapView>(null);
  const { reduceMotion } = useA11yPrefs();
  const fitKey = fitTo?.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|');
  const initial: Region = { latitude: center.lat, longitude: center.lng, latitudeDelta: deltaForZoom(zoom), longitudeDelta: deltaForZoom(zoom) };

  useEffect(() => {
    if (fitTo && fitTo.length > 1) {
      ref.current?.fitToCoordinates(
        fitTo.map((p) => ({ latitude: p.lat, longitude: p.lng })),
        { edgePadding: { top: topInset + 72, right: 48, bottom: bottomInset + 32, left: 48 }, animated: !reduceMotion },
      );
    } else {
      ref.current?.animateToRegion({ ...initial }, reduceMotion ? 0 : 400);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, center.lat, center.lng, bottomInset]);

  const driver = markers.find((m) => m.kind === 'driver');
  const driverPos = useAnimatedCoordinate(driver?.coordinate ?? null, reduceMotion);

  return (
    <View testID={testID} style={StyleSheet.absoluteFill}>
      <MapView
        ref={ref}
        style={StyleSheet.absoluteFill}
        initialRegion={initial}
        mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
        showsPointsOfInterests={false}
        showsCompass={false}
        showsUserLocation={false}
        toolbarEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        mapPadding={{ top: topInset, right: 0, bottom: bottomInset, left: 0 }}
        onRegionChangeComplete={(r) => onCenterChange?.({ lat: r.latitude, lng: r.longitude })}
        onPress={(e) => onPress?.({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })}
        accessibilityLabel="Carte"
      >
        {route && route.length > 1 ? (
          <>
            <Polyline coordinates={route.map((p) => ({ latitude: p.lat, longitude: p.lng }))} strokeColor={colors.surface} strokeWidth={9} lineJoin="round" />
            <Polyline coordinates={route.map((p) => ({ latitude: p.lat, longitude: p.lng }))} strokeColor={colors.accent} strokeWidth={5} lineJoin="round" />
          </>
        ) : null}
        {markers
          .filter((m) => m.kind !== 'driver')
          .map((m) => (
            <Marker key={m.id} coordinate={{ latitude: m.coordinate.lat, longitude: m.coordinate.lng }} anchor={{ x: 0.5, y: m.kind === 'destination' ? 1 : 0.5 }} tracksViewChanges={false} accessibilityLabel={m.label}>
              <MarkerView marker={m} />
            </Marker>
          ))}
        {driver && driverPos ? (
          <Marker coordinate={{ latitude: driverPos.lat, longitude: driverPos.lng }} anchor={{ x: 0.5, y: 0.5 }} flat tracksViewChanges={false}>
            <MarkerView marker={{ ...driver, coordinate: driverPos }} />
          </Marker>
        ) : null}
      </MapView>
    </View>
  );
}
