import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import type * as Leaflet from 'leaflet';
import { colors } from '../lib/theme';
import { money } from '../lib/format';
import type { MapCar } from './CarMap';

import 'leaflet/dist/leaflet.css';

/** Carte web (OpenStreetMap via Leaflet). */
export default function CarMap({ cars, center, onSelect, height = 400, approx }: {
  cars: MapCar[]; center: { lat: number; lng: number }; onSelect?: (id: string) => void; height?: number; approx?: boolean;
}) {
  const ref = useRef<View>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const layerRef = useRef<Leaflet.LayerGroup | null>(null);
  const LRef = useRef<typeof Leaflet | null>(null);

  useEffect(() => {
    let cancelled = false;
    import('leaflet').catch(() => null).then((mod) => {
      if (!mod) return;
      const L = ((mod as any).default || mod) as typeof Leaflet;
      if (cancelled || !ref.current) return;
      LRef.current = L;
      const el = ref.current as unknown as HTMLElement;
      const map = L.map(el, { zoomControl: true, attributionControl: true }).setView([center.lat, center.lng], approx ? 14 : 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
      draw();
    });
    return () => { cancelled = true; mapRef.current?.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const draw = () => {
    const L = LRef.current; const layer = layerRef.current; const map = mapRef.current;
    if (!L || !layer || !map) return;
    layer.clearLayers();
    if (approx) {
      L.circle([center.lat, center.lng], { radius: 400, color: colors.primary, fillColor: colors.primaryLight, fillOpacity: 0.2 }).addTo(layer);
      return;
    }
    for (const c of cars) {
      const icon = L.divIcon({
        className: '',
        html: `<div style="background:${colors.primary};color:#fff;font:700 12px sans-serif;padding:5px 8px;border-radius:14px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.25);transform:translate(-50%,-50%)">${money(c.pricePerDay)}</div>`,
      });
      L.marker([c.latitude, c.longitude], { icon }).on('click', () => onSelect?.(c.id)).addTo(layer);
    }
  };

  useEffect(() => { draw(); }, [cars, approx]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { mapRef.current?.setView([center.lat, center.lng]); }, [center.lat, center.lng]);

  return <View ref={ref} style={{ width: '100%', height, borderRadius: 16, overflow: 'hidden', zIndex: 0 }} />;
}
