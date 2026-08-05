/**
 * THROWAWAY — Series UX redesign, ticket 15 (wizard flow shape).
 *
 * A route cannot live in `src/prototypes/`, so this file is the second half of
 * the harness's real-code footprint, exactly as `seriesDetail.tsx` is for
 * ticket 13. Renders `null` outside `__DEV__`.
 *
 * Registered in `_layout.tsx` with `animation: 'slide_from_right'`, matching
 * the real `series` group: ticket 05 settled the wizard's presentation as an
 * opaque full-screen push and ticket 15 explicitly forbids reopening it, so
 * diverging here would test something nobody asked about.
 *
 * Delete with `rm -rf src/prototypes src/app/seriesCreateProto.tsx` — see
 * `src/prototypes/README.md`.
 */
import ProtoWizard from '@/prototypes/wizard/ProtoWizard';

export default function SeriesCreateProtoRoute() {
  if (!__DEV__) return null;
  return <ProtoWizard />;
}
