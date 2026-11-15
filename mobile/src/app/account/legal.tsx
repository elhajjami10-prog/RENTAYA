import React from 'react';
import { useTranslation } from 'react-i18next';
import { Screen, Section, T } from '../../components/ui';
import { colors } from '../../lib/theme';

/** Mentions légales, CGU et confidentialité (texte à faire valider par votre juriste). */
export default function Legal() {
  const { t } = useTranslation();
  return (
    <Screen>
      {(['terms', 'privacy', 'insurance', 'company'] as const).map((k) => (
        <Section key={k} title={t(`legal.${k}Title`)} style={{ marginTop: 12 }}>
          <T color={colors.inkSoft} style={{ lineHeight: 22 }}>{t(`legal.${k}`)}</T>
        </Section>
      ))}
    </Screen>
  );
}
