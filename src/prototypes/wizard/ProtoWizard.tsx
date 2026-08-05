/**
 * THROWAWAY — ticket 15's switcher and variant dispatch.
 *
 * "Four create-flow shapes, switchable from a floating pill, on a throwaway
 * route pushed from the library exactly as the real wizard is."
 *
 * The pill is loud and obviously not part of the design being judged, per the
 * prototype skill. It carries the SCREEN COUNT as well as the label, because
 * the ticket's second question is literally "would this delete three screens?"
 * — so the cost of each shape should be readable without leaving the screen.
 *
 * Switching variants resets the draft. Carrying a half-built series across a
 * structural change would compare two shapes in two different states, which is
 * the one thing an A/B must not do.
 */
import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useTheme } from '@/hooks/useTheme';
import { useProtoStore, WIZARD_VARIANTS } from '@/prototypes/protoStore';
import VariantA from './VariantA';
import VariantB from './VariantB';
import VariantC from './VariantC';
import VariantD from './VariantD';
import VariantE from './VariantE';
import VariantF from './VariantF';
import { useWizardDraft } from './wizardShared';

export default function ProtoWizard() {
  const { colors: themeColors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const variant = useProtoStore((s) => s.wizardVariant);
  const setVariant = useProtoStore((s) => s.setWizardVariant);
  const reset = useWizardDraft((s) => s.reset);

  const onExit = useCallback(() => {
    reset();
    router.back();
  }, [reset, router]);

  const idx = WIZARD_VARIANTS.findIndex((v) => v.id === variant);
  const step = useCallback(
    (d: number) => {
      const n = WIZARD_VARIANTS.length;
      reset();
      setVariant(WIZARD_VARIANTS[(idx + d + n) % n].id);
    },
    [idx, reset, setVariant],
  );

  if (!__DEV__) return null;

  const current = WIZARD_VARIANTS[idx] ?? WIZARD_VARIANTS[0];

  return (
    <View
      style={[
        localStyles.root,
        {
          backgroundColor: themeColors.background,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      {/* `key` forces a fresh mount per variant: each holds its own step state,
          and a stale `step`/`named` surviving a switch would show variant B on
          variant D's screen. */}
      <View key={variant} style={localStyles.stage}>
        {variant === 'steps3' && <VariantA onExit={onExit} />}
        {variant === 'steps2' && <VariantB onExit={onExit} />}
        {variant === 'single' && <VariantC onExit={onExit} />}
        {variant === 'thenEdit' && <VariantD onExit={onExit} />}
        {variant === 'authorFirst' && <VariantE onExit={onExit} />}
        {variant === 'accordion' && <VariantF onExit={onExit} />}
      </View>

      <View
        style={[localStyles.pill, { bottom: insets.bottom + 78 }]}
        pointerEvents='box-none'
      >
        <Pressable onPress={() => step(-1)} style={localStyles.pillArrow} hitSlop={10}>
          <Text style={localStyles.pillArrowText}>‹</Text>
        </Pressable>
        <Text style={localStyles.pillLabel}>
          15 · {current.label} · {current.screens}
        </Text>
        <Pressable onPress={() => step(1)} style={localStyles.pillArrow} hitSlop={10}>
          <Text style={localStyles.pillArrowText}>›</Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * The launcher, mounted on the library screen. Deliberately a SECOND entry
 * point rather than a redirect of `handleCreateSeries`: the real wizard has to
 * stay reachable from the `+`, because variant A is the fixed control and the
 * shipping screens are the UNFIXED one — 05's three defects are only visible
 * by comparison.
 */
export function ProtoWizardPill() {
  const router = useRouter();
  const variant = useProtoStore((s) => s.wizardVariant);

  if (!__DEV__) return null;

  const current =
    WIZARD_VARIANTS.find((v) => v.id === variant) ?? WIZARD_VARIANTS[0];

  return (
    <Pressable
      style={localStyles.launcher}
      onPress={() => router.navigate('/seriesCreateProto' as never)}
    >
      <Text style={localStyles.launcherText}>15 · new series · {current.label}</Text>
    </Pressable>
  );
}

const localStyles = StyleSheet.create({
  root: { flex: 1 },
  stage: { flex: 1 },
  pill: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#B5179E',
    elevation: 8,
  },
  pillArrow: { paddingHorizontal: 6 },
  pillArrowText: { color: '#fff', fontSize: 18, lineHeight: 20 },
  pillLabel: { color: '#fff', fontFamily: 'Rubik', fontSize: 11 },
  launcher: {
    position: 'absolute',
    left: 10,
    bottom: 96,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#B5179E',
    elevation: 8,
  },
  launcherText: { color: '#fff', fontFamily: 'Rubik', fontSize: 11 },
});
