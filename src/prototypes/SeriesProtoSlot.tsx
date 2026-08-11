/**
 * THROWAWAY — Series UX redesign prototype harness (ticket 04). See ./README.md.
 *
 * The harness's ONLY render mount. Stands where `<SeriesHome />` used to stand
 * in the library screen and renders the selected variant plus the dev panel.
 *
 * In a production build `__DEV__` is false, this renders the real `SeriesHome`
 * with the props it was always given, and no panel or variant module is ever
 * reached. The `useProtoStore` subscription is the entire production cost: one
 * selector over a store whose value never changes.
 */
import React, { useCallback } from 'react';
import { useRouter } from 'expo-router';

import SeriesHome from '@/components/SeriesHome';
import { useProtoStore } from './protoStore';
import { resolveVariant } from './variants';
import ProtoPanel from './ProtoPanel';
import type { VariantProps } from './variantProps';

/**
 * TICKET 12 (§J3): the browse row's pencil is one of the two dead call sites
 * the one-route editor removes, so the library screen no longer supplies an
 * `onEditPress`. The two closed-record variants that still draw a pencil are
 * kept unchanged — rewriting a rejected variant destroys the evidence for why
 * it lost — so the handler moved HERE, into the harness that owns them. It dies
 * with the harness (ticket 18), and nothing in production reaches it.
 */
const SeriesProtoSlot = (props: Omit<VariantProps, 'onEditPress'>) => {
  const variantId = useProtoStore((s) => s.variantId);
  const router = useRouter();

  const onEditPress = useCallback(
    (seriesId: string) =>
      router.navigate({ pathname: '/seriesEditor', params: { id: seriesId } }),
    [router],
  );

  if (!__DEV__) return <SeriesHome {...props} />;

  const { Component } = resolveVariant(variantId);
  return (
    <>
      <Component {...props} onEditPress={onEditPress} />
      <ProtoPanel rendered={props.series} />
    </>
  );
};

export default SeriesProtoSlot;
