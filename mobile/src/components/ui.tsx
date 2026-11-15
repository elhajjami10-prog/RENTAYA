import React from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
  type TextInputProps, type TextStyle, type ViewStyle, type StyleProp, RefreshControl, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, gradient, radius, shadow } from '../lib/theme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

// ---------- Texte ----------
export function T({ style, variant = 'body', color, children, numberOfLines, center }: {
  style?: StyleProp<TextStyle>; variant?: 'h1' | 'h2' | 'h3' | 'body' | 'small' | 'caption' | 'label';
  color?: string; children?: React.ReactNode; numberOfLines?: number; center?: boolean;
}) {
  return <Text numberOfLines={numberOfLines} style={[styles.text, styles[variant], color ? { color } : null, center && { textAlign: 'center' }, style]}>{children}</Text>;
}

// ---------- Écran ----------
export function Screen({ children, scroll = true, padded = true, style, refreshing, onRefresh, edges = ['bottom'], footer }: {
  children: React.ReactNode; scroll?: boolean; padded?: boolean; style?: StyleProp<ViewStyle>;
  refreshing?: boolean; onRefresh?: () => void; edges?: ('top' | 'bottom')[]; footer?: React.ReactNode;
}) {
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[padded && styles.padded, styles.maxWidth, style]}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
    >{children}</ScrollView>
  ) : <View style={[{ flex: 1 }, padded && styles.padded, style]}>{children}</View>;
  return (
    <SafeAreaView edges={edges} style={styles.screen}>
      {content}
      {footer ? <View style={styles.footer}><View style={styles.maxWidthInner}>{footer}</View></View> : null}
    </SafeAreaView>
  );
}

// ---------- Boutons ----------
export function Button({ title, onPress, variant = 'primary', icon, loading, disabled, style, small }: {
  title: string; onPress?: () => void; variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  icon?: IconName; loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>; small?: boolean;
}) {
  const fg = variant === 'primary' || variant === 'danger' ? '#fff' : variant === 'secondary' ? colors.primaryDark : colors.primary;
  const inner = (
    <View style={[styles.btnInner, small && styles.btnSmall]}>
      {loading ? <ActivityIndicator color={fg} /> : <>
        {icon ? <Ionicons name={icon} size={small ? 16 : 19} color={fg} /> : null}
        <Text style={[styles.btnText, small && { fontSize: 14 }, { color: fg }]}>{title}</Text>
      </>}
    </View>
  );
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.btn,
        variant === 'secondary' && { backgroundColor: colors.primarySoft },
        variant === 'outline' && { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: '#fff' },
        variant === 'ghost' && { backgroundColor: 'transparent' },
        variant === 'danger' && { backgroundColor: colors.danger },
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
        style,
      ]}
    >
      {variant === 'primary' ? <LinearGradient colors={[gradient[0], gradient[2]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btnGrad}>{inner}</LinearGradient> : inner}
    </Pressable>
  );
}

export function IconButton({ icon, onPress, color = colors.ink, size = 22, style, badge }: { icon: IconName; onPress?: () => void; color?: string; size?: number; style?: StyleProp<ViewStyle>; badge?: number }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }, style]}>
      <Ionicons name={icon} size={size} color={color} />
      {badge ? <View style={styles.badgeDot}><Text style={styles.badgeDotText}>{badge > 9 ? '9+' : badge}</Text></View> : null}
    </Pressable>
  );
}

// ---------- Champs ----------
export function Field({ label, error, hint, style, right, ...props }: TextInputProps & { label?: string; error?: string | null; hint?: string; right?: React.ReactNode }) {
  return (
    <View style={[{ marginBottom: 14 }, style as ViewStyle]}>
      {label ? <T variant="label" style={{ marginBottom: 6 }}>{label}</T> : null}
      <View style={[styles.input, !!error && { borderColor: colors.danger }, props.multiline && { minHeight: 96, alignItems: 'flex-start' }]}>
        <TextInput
          placeholderTextColor={colors.muted}
          {...props}
          style={[styles.inputText, props.multiline && { textAlignVertical: 'top', paddingTop: 12 }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]}
        />
        {right}
      </View>
      {error ? <T variant="caption" color={colors.danger} style={{ marginTop: 4 }}>{error}</T> : hint ? <T variant="caption" style={{ marginTop: 4 }}>{hint}</T> : null}
    </View>
  );
}

export function Toggle({ label, value, onChange, description }: { label: string; value: boolean; onChange: (v: boolean) => void; description?: string }) {
  return (
    <Pressable onPress={() => onChange(!value)} style={styles.toggleRow}>
      <View style={{ flex: 1, paddingEnd: 12 }}>
        <T style={{ fontWeight: '600' }}>{label}</T>
        {description ? <T variant="caption">{description}</T> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primaryLight, false: '#DDD3EA' }} thumbColor="#fff" />
    </Pressable>
  );
}

export function Stepper({ label, value, onChange, min = 0, max = 99, step = 1, suffix }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string }) {
  return (
    <View style={styles.toggleRow}>
      <T style={{ flex: 1, fontWeight: '600' }}>{label}</T>
      <IconButton icon="remove-circle-outline" color={value <= min ? colors.muted : colors.primary} onPress={() => onChange(Math.max(min, value - step))} size={28} />
      <T style={{ minWidth: 64, textAlign: 'center', fontWeight: '700' }}>{value}{suffix ? ` ${suffix}` : ''}</T>
      <IconButton icon="add-circle-outline" color={value >= max ? colors.muted : colors.primary} onPress={() => onChange(Math.min(max, value + step))} size={28} />
    </View>
  );
}

export function Chip({ label, selected, onPress, icon, style }: { label: string; selected?: boolean; onPress?: () => void; icon?: IconName; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipOn, style]}>
      {icon ? <Ionicons name={icon} size={15} color={selected ? '#fff' : colors.primaryDark} /> : null}
      <Text style={[styles.chipText, selected && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

export function Segmented<V extends string>({ options, value, onChange }: { options: { value: V; label: string }[]; value: V; onChange: (v: V) => void }) {
  return (
    <View style={styles.segment}>
      {options.map((o) => (
        <Pressable key={o.value} onPress={() => onChange(o.value)} style={[styles.segmentItem, o.value === value && styles.segmentOn]}>
          <Text numberOfLines={1} style={[styles.segmentText, o.value === value && { color: colors.primaryDark }]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// ---------- Mise en page ----------
export function Card({ children, style, onPress }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  if (onPress) return <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }, style]}>{children}</Pressable>;
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Row({ children, style, gap = 8 }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Section({ title, children, action, onAction, style }: { title: string; children: React.ReactNode; action?: string; onAction?: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ marginTop: 24 }, style]}>
      <Row style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <T variant="h3">{title}</T>
        {action ? <Pressable onPress={onAction}><T color={colors.primary} style={{ fontWeight: '600' }}>{action}</T></Pressable> : null}
      </Row>
      {children}
    </View>
  );
}

export const Divider = ({ style }: { style?: StyleProp<ViewStyle> }) => <View style={[{ height: 1, backgroundColor: colors.border, marginVertical: 14 }, style]} />;

export function ListItem({ icon, title, subtitle, onPress, right, danger }: { icon?: IconName; title: string; subtitle?: string; onPress?: () => void; right?: React.ReactNode; danger?: boolean }) {
  const { i18n } = useTranslation();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.listItem, pressed && { backgroundColor: colors.bgSoft }]}>
      {icon ? <View style={styles.listIcon}><Ionicons name={icon} size={20} color={danger ? colors.danger : colors.primary} /></View> : null}
      <View style={{ flex: 1 }}>
        <T style={{ fontWeight: '600', color: danger ? colors.danger : colors.ink }}>{title}</T>
        {subtitle ? <T variant="caption" numberOfLines={2}>{subtitle}</T> : null}
      </View>
      {right ?? (onPress ? <Ionicons name={i18n.language === 'ar' ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.muted} /> : null)}
    </Pressable>
  );
}

export function KV({ k, v, bold, color }: { k: string; v: React.ReactNode; bold?: boolean; color?: string }) {
  return (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 5 }}>
      <T variant={bold ? 'body' : 'small'} style={[{ flex: 1 }, bold && { fontWeight: '700' }]} color={color}>{k}</T>
      <T variant={bold ? 'body' : 'small'} style={[{ fontWeight: bold ? '800' : '600' }]} color={color || colors.ink}>{v}</T>
    </Row>
  );
}

// ---------- Indicateurs ----------
export function Badge({ label, tone = 'primary', icon }: { label: string; tone?: 'primary' | 'success' | 'warning' | 'danger' | 'muted'; icon?: IconName }) {
  const map = {
    primary: [colors.primarySoft, colors.primaryDark], success: [colors.successSoft, colors.success],
    warning: [colors.warningSoft, colors.warning], danger: [colors.dangerSoft, colors.danger], muted: ['#EFEAF5', colors.inkSoft],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      {icon ? <Ionicons name={icon} size={12} color={fg} /> : null}
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function Stars({ value, count, size = 14 }: { value: number; count?: number; size?: number }) {
  const { t } = useTranslation();
  if (!count) return <Badge label={t('car.new')} tone="primary" icon="sparkles" />;
  return (
    <Row gap={3}>
      <Ionicons name="star" size={size} color={colors.star} />
      <T variant="small" style={{ fontWeight: '700' }}>{value.toFixed(1)}</T>
      {count != null ? <T variant="caption">({count})</T> : null}
    </Row>
  );
}

export function StarInput({ value, onChange, size = 34 }: { value: number; onChange: (v: number) => void; size?: number }) {
  return (
    <Row gap={6}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Pressable key={i} onPress={() => onChange(i)} hitSlop={4}>
          <Ionicons name={i <= value ? 'star' : 'star-outline'} size={size} color={colors.star} />
        </Pressable>
      ))}
    </Row>
  );
}

export function Avatar({ uri, name, size = 44 }: { uri?: string | null; name?: string; size?: number }) {
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primarySoft }} />;
  return (
    <LinearGradient colors={[gradient[0], gradient[2]]} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.4 }}>{(name || '?').slice(0, 1).toUpperCase()}</Text>
    </LinearGradient>
  );
}

export function Loading({ full = true }: { full?: boolean }) {
  return <View style={[full ? { flex: 1, minHeight: 240 } : { padding: 24 }, { alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator size="large" color={colors.primary} /></View>;
}

export function Empty({ icon = 'car-outline', title, text, action, onAction }: { icon?: IconName; title: string; text?: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ alignItems: 'center', padding: 32, gap: 10 }}>
      <View style={styles.emptyIcon}><Ionicons name={icon} size={36} color={colors.primary} /></View>
      <T variant="h3" center>{title}</T>
      {text ? <T center color={colors.inkSoft}>{text}</T> : null}
      {action ? <Button title={action} onPress={onAction} style={{ marginTop: 8, alignSelf: 'stretch' }} /> : null}
    </View>
  );
}

export function Notice({ tone = 'primary', icon = 'information-circle', title, text, action, onAction }: { tone?: 'primary' | 'warning' | 'danger' | 'success'; icon?: IconName; title?: string; text: string; action?: string; onAction?: () => void }) {
  const bg = { primary: colors.primarySoft, warning: colors.warningSoft, danger: colors.dangerSoft, success: colors.successSoft }[tone];
  const fg = { primary: colors.primaryDark, warning: '#9A5B00', danger: colors.danger, success: colors.success }[tone];
  return (
    <View style={[styles.notice, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={22} color={fg} />
      <View style={{ flex: 1, gap: 2 }}>
        {title ? <T style={{ fontWeight: '700' }} color={fg}>{title}</T> : null}
        <T variant="small" color={colors.ink}>{text}</T>
        {action ? <Pressable onPress={onAction}><T variant="small" style={{ fontWeight: '700', marginTop: 4 }} color={fg}>{action} →</T></Pressable> : null}
      </View>
    </View>
  );
}

/** Invite à se connecter quand un écran nécessite un compte. */
export function LoginPrompt({ title, text }: { title: string; text: string }) {
  const { t } = useTranslation();
  return (
    <Screen edges={['top']}>
      <View style={{ alignItems: 'center', marginTop: 40 }}>
        <Image source={require('../../assets/logo-mark.png')} style={{ width: 120, height: 120 }} contentFit="contain" />
      </View>
      <Empty icon="person-circle-outline" title={title} text={text} action={t('auth.login')} onAction={() => router.push('/auth/login')} />
      <Button title={t('auth.createAccount')} variant="ghost" onPress={() => router.push('/auth/register')} />
    </Screen>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  padded: { padding: 16, paddingBottom: 40 },
  maxWidth: { width: '100%', maxWidth: 820, alignSelf: 'center' },
  maxWidthInner: { width: '100%', maxWidth: 820, alignSelf: 'center' },
  footer: { borderTopWidth: 1, borderTopColor: colors.border, padding: 12, paddingHorizontal: 16, backgroundColor: '#fff' },
  text: { color: colors.ink, fontSize: 15, writingDirection: 'auto' },
  h1: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  h3: { fontSize: 18, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 22 },
  small: { fontSize: 14, lineHeight: 20 },
  caption: { fontSize: 12.5, color: colors.inkSoft, lineHeight: 17 },
  label: { fontSize: 13.5, fontWeight: '700', color: colors.inkSoft },
  btn: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.primary },
  btnGrad: { borderRadius: radius.md },
  btnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 18, minHeight: 50 },
  btnSmall: { paddingVertical: 8, paddingHorizontal: 12, minHeight: 38 },
  btnText: { fontSize: 16, fontWeight: '700' },
  iconBtn: { padding: 6 },
  badgeDot: { position: 'absolute', top: 0, right: 0, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeDotText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  input: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, backgroundColor: '#fff', paddingHorizontal: 14, minHeight: 50 },
  inputText: { flex: 1, fontSize: 16, color: colors.ink, paddingVertical: 10 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primarySoft },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.primaryDark, fontWeight: '600', fontSize: 14 },
  segment: { flexDirection: 'row', backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: 4 },
  segmentItem: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: radius.sm },
  segmentOn: { backgroundColor: '#fff', ...shadow },
  segmentText: { fontWeight: '700', color: colors.inkSoft, fontSize: 14 },
  card: { backgroundColor: '#fff', borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: colors.border, ...shadow },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 4 },
  listIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '700' },
  emptyIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  notice: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: radius.md, alignItems: 'flex-start' },
});
