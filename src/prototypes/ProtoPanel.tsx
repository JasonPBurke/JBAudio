/**
 * THROWAWAY — Series UX redesign prototype harness (ticket 04). See ./README.md.
 *
 * The `__DEV__` switcher. Collapsed it is a small pill in the bottom-left,
 * clear of the create-series FAB (bottom-right) and the FloatingPlayer (bottom
 * strip). Expanded it offers the two knobs and a dataset dump.
 *
 * Deliberately plain: no Reanimated, no gestures, no theming beyond reading the
 * palette. It must never be mistaken for a design proposal.
 */
import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/useTheme';
import { useLibraryStore } from '@/store/library';
import { withOpacity } from '@/helpers/colorUtils';
import { runDetectionProbe } from './detectionProbe';
import { DATA_PRESETS, useProtoStore } from './protoStore';
import { VARIANTS, resolveVariant } from './variants';
import { ProtoSeries } from './syntheticSeries';
import type { VariantProps } from './variantProps';

/** Matches CreateSeriesFab's clearance over the FloatingPlayer. */
const BOTTOM_OFFSET = 64;

type Props = {
  /** Exactly what the variant is rendering — post search and tab filtering, so
   *  the count doubles as a check that those still work over synthetic rows. */
  rendered: VariantProps['series'];
};

const ProtoPanel = ({ rendered }: Props) => {
  const { colors: themeColors } = useTheme();
  const insets = useSafeAreaInsets();

  const open = useProtoStore((s) => s.panelOpen);
  const setPanelOpen = useProtoStore((s) => s.setPanelOpen);
  const dataPreset = useProtoStore((s) => s.dataPreset);
  const setDataPreset = useProtoStore((s) => s.setDataPreset);
  const variantId = useProtoStore((s) => s.variantId);
  const setVariantId = useProtoStore((s) => s.setVariantId);
  const clearSynthetic = useProtoStore((s) => s.clearSynthetic);
  const seriesBackgrounds = useProtoStore((s) => s.seriesBackgrounds);
  const setSeriesBackgrounds = useProtoStore((s) => s.setSeriesBackgrounds);
  const rowMode = useProtoStore((s) => s.rowMode);
  const setRowMode = useProtoStore((s) => s.setRowMode);
  const editorTarget = useProtoStore((s) => s.editorTarget);
  const setEditorTarget = useProtoStore((s) => s.setEditorTarget);

  const poolSize = useLibraryStore((s) => Object.keys(s.books).length);
  const variant = resolveVariant(variantId);
  const synthetic = dataPreset !== 'off';
  const slots = rendered.reduce((n, s) => n + s.books.length, 0);

  // Plain text, not console.table — RN's console.table does not forward to the
  // Metro log, so the per-series legend (the useful half) silently vanished.
  const logDataset = useCallback(() => {
    const lines = (rendered as ProtoSeries[]).map((s) => {
      const name = s.name.length > 34 ? `${s.name.slice(0, 31)}...` : s.name;
      const numbers = s.canonicalNumbers
        ? s.canonicalNumbers.map((n) => n ?? '-').join(',')
        : '(real series — no proto numbers)';
      return (
        `  ${name.padEnd(34)} ${String(s.books.length).padStart(3)} books  ` +
        `${s.progressState.padEnd(8)} #${numbers}` +
        (s.stresses ? `\n${' '.repeat(6)}${s.stresses}` : '')
      );
    });
    console.log(
      `[proto] ${rendered.length} series rendered, ${slots} book slots\n` +
        lines.join('\n'),
    );
  }, [rendered, slots]);

  // Ticket 04 — the real library through the real cascade, into the Metro log.
  const logDetection = useCallback(() => {
    void runDetectionProbe();
  }, []);

  const toggleOpen = useCallback(
    () => setPanelOpen(!open),
    [open, setPanelOpen],
  );

  const panelBase = {
    bottom: insets.bottom + BOTTOM_OFFSET,
    backgroundColor: themeColors.background,
    borderColor: withOpacity(themeColors.divider, 0.5),
  };

  if (!open) {
    return (
      <Pressable
        style={[styles.pill, panelBase]}
        onPress={toggleOpen}
        accessibilityLabel='Open prototype panel'
      >
        <Text style={[styles.pillText, { color: themeColors.textMuted }]}>
          {`proto · ${variant.label}`}
        </Text>
        {synthetic && (
          <View style={[styles.dot, { backgroundColor: themeColors.primary }]} />
        )}
      </Pressable>
    );
  }

  return (
    <View style={[styles.panel, panelBase]}>
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: themeColors.text }]}>
          Series prototype harness
        </Text>
        <Pressable onPress={toggleOpen} hitSlop={10}>
          <Text style={[styles.close, { color: themeColors.textMuted }]}>
            close
          </Text>
        </Pressable>
      </View>

      <Text style={[styles.label, { color: themeColors.textMuted }]}>
        Variant
      </Text>
      <View style={styles.chipRow}>
        {VARIANTS.map((v) => (
          <Chip
            key={v.id}
            label={v.label}
            active={v.id === variantId}
            onPress={() => setVariantId(v.id)}
          />
        ))}
      </View>

      <Text style={[styles.label, { color: themeColors.textMuted }]}>Data</Text>
      <View style={styles.chipRow}>
        {DATA_PRESETS.map((p) => (
          <Chip
            key={p.id}
            label={p.label}
            active={p.id === dataPreset}
            onPress={() => setDataPreset(p.id)}
          />
        ))}
      </View>

      {/*
        TICKET 13's knobs. All three belong to the DETAIL SHEET, not to browse,
        and they are chips rather than switches only because every other control
        in this panel is a chip.

        `Backgrounds` stands in for ticket 12's `Series Backgrounds` column,
        which 11 widened to govern the detail hero too — default ON, matching
        12's ruling. `Rows` is 13's secondary question after the driver merged
        the glyph into it: `whole` is 11's one-target row with no glyph, `split`
        gives the cover a glyph and playback and the text `titleDetails`.
        `Editor` picks which screen the sheet's single wrench row opens: `real`
        is the routing test (an opaque push over a live sheet), `proto` reaches
        `ProtoSeriesEdit` and its pinned-artwork caption.
      */}
      <Text style={[styles.label, { color: themeColors.textMuted }]}>
        Detail sheet (13)
      </Text>
      <View style={styles.chipRow}>
        <Chip
          label={`Backgrounds ${seriesBackgrounds ? 'ON' : 'OFF'}`}
          active={seriesBackgrounds}
          onPress={() => setSeriesBackgrounds(!seriesBackgrounds)}
        />
        <Chip
          label={rowMode === 'split' ? 'Rows: split' : 'Rows: whole'}
          active={rowMode === 'split'}
          onPress={() => setRowMode(rowMode === 'whole' ? 'split' : 'whole')}
        />
        <Chip
          label={`Editor: ${editorTarget}`}
          active={editorTarget === 'proto'}
          onPress={() =>
            setEditorTarget(editorTarget === 'real' ? 'proto' : 'real')
          }
        />
      </View>

      <Text style={[styles.stat, { color: themeColors.textMuted }]}>
        {`${rendered.length} series · ${slots} slots · pool ${poolSize} books`}
      </Text>
      <Text style={[styles.stat, { color: themeColors.textMuted }]}>
        {variant.hint}
      </Text>
      {synthetic && (
        <Text style={[styles.warn, { color: themeColors.primary }]}>
          SYNTHETIC DATA — nothing is written to the database
        </Text>
      )}

      <View style={styles.chipRow}>
        <Chip label='Log dataset' active={false} onPress={logDataset} />
        <Chip
          label='Clear synthetic'
          active={false}
          onPress={clearSynthetic}
          disabled={!synthetic}
        />
        {/*
          TICKET 04's dev entry point. Unlike everything else in this panel it
          ignores the dataset knob entirely — it reads the REAL database and
          runs the REAL cascade, so its output can be diffed against
          SERIES_LISTING.txt. Writes nothing; that is ticket 06.
        */}
        <Chip label='Detect series (log)' active={false} onPress={logDetection} />
      </View>
    </View>
  );
};

const Chip = ({
  label,
  active,
  onPress,
  disabled,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  disabled?: boolean;
}) => {
  const { colors: themeColors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.chip,
        {
          borderColor: active ? themeColors.primary : themeColors.divider,
          backgroundColor: active
            ? withOpacity(themeColors.primary, 0.18)
            : 'transparent',
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.chipText,
          { color: active ? themeColors.primary : themeColors.text },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
};

export default ProtoPanel;

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    opacity: 0.85,
  },
  pillText: {
    fontFamily: 'Rubik',
    fontSize: 11,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 6,
  },
  panel: {
    position: 'absolute',
    left: 10,
    right: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontFamily: 'Rubik',
    fontWeight: '600',
    fontSize: 13,
  },
  close: {
    fontFamily: 'Rubik',
    fontSize: 12,
  },
  label: {
    fontFamily: 'Rubik',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 5,
    marginBottom: 4,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  chipText: {
    fontFamily: 'Rubik',
    fontSize: 11,
  },
  stat: {
    fontFamily: 'Rubik',
    fontSize: 10,
    marginTop: 3,
  },
  warn: {
    fontFamily: 'Rubik',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 5,
  },
});
