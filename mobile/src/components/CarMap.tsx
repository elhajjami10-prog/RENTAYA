import React from 'react';
import MapView, { Marker, Circle } from 'react-native-maps';
import { colors } from '../lib/theme';
import { money } from '../lib/format';

export type MapCar = { id: string; latitude: number; longitude: number; pricePerDay: number };

/** Carte native (Apple Plans / Google Maps). */
export default function CarMap({ cars, center, onSelect, height = 400, approx }: {
  cars: MapCar[]; center: { lat: number; lng: number }; onSelect?: (id: string) => void; height?: number; approx?: boolean;
}) {
  return (
    <MapView
      style={{ width: '100%', height }}
      initialRegion={{ latitude: center.lat, longitude: center.lng, latitudeDelta: approx ? 0.03 : 0.2, longitudeDelta: approx ? 0.03 : 0.2 }}
    >
      {approx ? (
        <Circle center={{ latitude: center.lat, longitude: center.lng }} radius={400} fillColor="rgba(122,31,224,0.18)" strokeColor={colors.primary} />
      ) : cars.map((c) => (
        <Marker key={c.id} coordinate={{ latitude: c.latitude, longitude: c.longitude }} title={money(c.pricePerDay)} pinColor={colors.primary} onCalloutPress={() => onSelect?.(c.id)} onPress={() => onSelect?.(c.id)} />
      ))}
    </MapView>
  );
}
