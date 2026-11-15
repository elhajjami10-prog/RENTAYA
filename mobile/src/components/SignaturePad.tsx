import React, { useRef, useState } from 'react';
import { PanResponder, View, StyleSheet, Pressable } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { T, Row } from './ui';
import { colors, radius } from '../lib/theme';

const W = 320; const H = 150;

/** Zone de signature : renvoie la signature en image SVG (data URL). */
export function SignaturePad({ label, onChange }: { label: string; onChange: (dataUrl: string | null) => void }) {
  const { t } = useTranslation();
  const [paths, setPaths] = useState<string[]>([]);
  const current = useRef('');
  const [, force] = useState(0);
  const layout = useRef({ w: W, h: H });

  const emit = (all: string[]) => {
    if (!all.length) return onChange(null);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.round(layout.current.w)} ${H}" width="${Math.round(layout.current.w)}" height="${H}">${all.map((d) => `<path d="${d}" stroke="#2A0B4D" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}</svg>`;
    onChange(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
  };

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => { const { locationX: x, locationY: y } = e.nativeEvent; current.current = `M${x.toFixed(1)} ${y.toFixed(1)}`; force((n) => n + 1); },
    onPanResponderMove: (e) => { const { locationX: x, locationY: y } = e.nativeEvent; current.current += ` L${x.toFixed(1)} ${y.toFixed(1)}`; force((n) => n + 1); },
    onPanResponderRelease: () => {
      setPaths((p) => { const next = [...p, current.current]; current.current = ''; emit(next); return next; });
    },
  })).current;

  return (
    <View style={{ marginBottom: 14 }}>
      <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <T variant="label">{label}</T>
        <Pressable onPress={() => { setPaths([]); emit([]); }}><T variant="small" color={colors.primary}>{t('common.clear')}</T></Pressable>
      </Row>
      <View style={s.pad} onLayout={(e) => (layout.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} {...pan.panHandlers}>
        <Svg width="100%" height={H} pointerEvents="none">
          {[...paths, current.current].filter(Boolean).map((d, i) => <Path key={i} d={d} stroke={colors.ink} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />)}
        </Svg>
        {!paths.length && !current.current ? <T variant="caption" style={s.hint}>{t('inspection.signHere')}</T> : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  pad: { height: H, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.primaryLight, borderRadius: radius.md, backgroundColor: colors.bgSoft, overflow: 'hidden' },
  hint: { position: 'absolute', alignSelf: 'center', top: H / 2 - 8 },
});
