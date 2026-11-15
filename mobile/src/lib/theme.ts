/** Couleurs Rentaya — dégradé violet du logo. */
export const colors = {
  primary: '#7A1FE0',
  primaryDark: '#4B0C99',
  primaryLight: '#A23CF4',
  primarySoft: '#F1E6FE',
  ink: '#2A0B4D',
  inkSoft: '#6B5B86',
  muted: '#9C8FB3',
  bg: '#FFFFFF',
  bgSoft: '#F8F4FD',
  border: '#EADFF8',
  success: '#12A26B',
  successSoft: '#E3F7EE',
  warning: '#E08A00',
  warningSoft: '#FFF3DC',
  danger: '#DC2F4B',
  dangerSoft: '#FDE7EB',
  star: '#F5A524',
  white: '#FFFFFF',
};

export const gradient = ['#A23CF4', '#7A1FE0', '#4B0C99'] as const;

export const radius = { sm: 8, md: 12, lg: 18, xl: 26, pill: 999 };
export const space = (n: number) => n * 4;

export const shadow = {
  shadowColor: '#3B0B7A',
  shadowOpacity: 0.08,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
};
