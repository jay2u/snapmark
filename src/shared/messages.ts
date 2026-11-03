export type CaptureMode = 'visible' | 'region' | 'full' | 'desktop';

export type Message =
  | { type: 'capture'; mode: CaptureMode }
  | { type: 'region-selected'; rect: { x: number; y: number; w: number; h: number } }
  | { type: 'region-cancelled' }
  | { type: 'desktop-captured'; id: string };

export const MODE_LABELS: Record<CaptureMode, string> = {
  visible: 'Visible area',
  region: 'Selected region',
  full: 'Full page',
  desktop: 'Window / desktop',
};
