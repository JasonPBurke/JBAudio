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
import React from 'react';

import SeriesHome from '@/components/SeriesHome';
import { useProtoStore } from './protoStore';
import { resolveVariant } from './variants';
import ProtoPanel from './ProtoPanel';
import type { VariantProps } from './variantProps';

const SeriesProtoSlot = (props: VariantProps) => {
  const variantId = useProtoStore((s) => s.variantId);

  if (!__DEV__) return <SeriesHome {...props} />;

  const { Component } = resolveVariant(variantId);
  return (
    <>
      <Component {...props} />
      <ProtoPanel rendered={props.series} />
    </>
  );
};

export default SeriesProtoSlot;
