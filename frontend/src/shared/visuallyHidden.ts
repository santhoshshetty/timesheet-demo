import type { CSSProperties } from 'react';

/** Hides content visually while keeping it available to screen readers. */
export const visuallyHidden: CSSProperties = {
  border: 0,
  clip: 'rect(0 0 0 0)',
  height: 1,
  margin: -1,
  overflow: 'hidden',
  padding: 0,
  position: 'absolute',
  whiteSpace: 'nowrap',
  width: 1,
};
