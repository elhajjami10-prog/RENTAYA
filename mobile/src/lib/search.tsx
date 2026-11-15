import React, { createContext, useContext, useMemo, useState } from 'react';

export interface Filters {
  category: string[];
  transmission?: 'MANUAL' | 'AUTOMATIC';
  fuel: string[];
  minSeats?: number;
  minPrice?: number;
  maxPrice?: number;
  instant?: boolean;
  delivery?: boolean;
  unlimitedKm?: boolean;
  features: string[];
  ownerType?: 'pro' | 'private';
  sort?: 'distance' | 'price_asc' | 'price_desc' | 'rating' | 'newest';
}

export interface SearchState {
  city?: string;
  label?: string;
  lat?: number;
  lng?: number;
  start?: Date;
  end?: Date;
  filters: Filters;
}

const roundHour = (d: Date) => { const x = new Date(d); x.setMinutes(0, 0, 0); return x; };
export const defaultDates = () => {
  const s = roundHour(new Date(Date.now() + 26 * 3600_000)); s.setHours(10);
  const e = new Date(s.getTime() + 3 * 86400_000);
  return { start: s, end: e };
};

export const emptyFilters: Filters = { category: [], fuel: [], features: [] };

const Ctx = createContext<{ s: SearchState; set: (p: Partial<SearchState>) => void; setFilters: (f: Partial<Filters>) => void; reset: () => void } | null>(null);

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [s, setS] = useState<SearchState>({ ...defaultDates(), filters: emptyFilters });
  const value = useMemo(() => ({
    s,
    set: (p: Partial<SearchState>) => setS((o) => ({ ...o, ...p })),
    setFilters: (f: Partial<Filters>) => setS((o) => ({ ...o, filters: { ...o.filters, ...f } })),
    reset: () => setS((o) => ({ ...o, filters: emptyFilters })),
  }), [s]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useSearch = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('SearchProvider manquant');
  return c;
};

export const searchQuery = (s: SearchState) => ({
  city: s.lat == null ? s.city : undefined,
  lat: s.lat, lng: s.lng, radius: s.lat != null ? 30 : undefined,
  start: s.start?.toISOString(), end: s.end?.toISOString(),
  category: s.filters.category.join(',') || undefined,
  fuel: s.filters.fuel.join(',') || undefined,
  features: s.filters.features.join(',') || undefined,
  transmission: s.filters.transmission, minSeats: s.filters.minSeats,
  minPrice: s.filters.minPrice, maxPrice: s.filters.maxPrice,
  instant: s.filters.instant ? 'true' : undefined, delivery: s.filters.delivery ? 'true' : undefined,
  unlimitedKm: s.filters.unlimitedKm ? 'true' : undefined, ownerType: s.filters.ownerType, sort: s.filters.sort,
});

export const activeFilterCount = (f: Filters) =>
  f.category.length + f.fuel.length + f.features.length + [f.transmission, f.minSeats, f.minPrice, f.maxPrice, f.instant, f.delivery, f.unlimitedKm, f.ownerType].filter(Boolean).length;

export const CITIES = [
  { name: 'Casablanca', lat: 33.5731, lng: -7.5898 },
  { name: 'Marrakech', lat: 31.6295, lng: -7.9811 },
  { name: 'Rabat', lat: 34.0209, lng: -6.8416 },
  { name: 'Tanger', lat: 35.7595, lng: -5.834 },
  { name: 'Agadir', lat: 30.4278, lng: -9.5981 },
  { name: 'Fès', lat: 34.0181, lng: -5.0078 },
  { name: 'Meknès', lat: 33.8935, lng: -5.5473 },
  { name: 'Oujda', lat: 34.6814, lng: -1.9086 },
  { name: 'Tétouan', lat: 35.5785, lng: -5.3684 },
  { name: 'Essaouira', lat: 31.5085, lng: -9.7595 },
  { name: 'Kénitra', lat: 34.261, lng: -6.5802 },
  { name: 'El Jadida', lat: 33.2316, lng: -8.5007 },
  { name: 'Nador', lat: 35.1681, lng: -2.9335 },
  { name: 'Ouarzazate', lat: 30.9189, lng: -6.8934 },
  { name: 'Dakhla', lat: 23.6848, lng: -15.958 },
  { name: 'Laâyoune', lat: 27.1253, lng: -13.1625 },
];
