export type Kind =
  | 'arrow' | 'curve' | 'line' | 'rect' | 'ellipse' | 'pen' | 'highlighter'
  | 'text' | 'callout' | 'step' | 'blur' | 'spotlight' | 'emoji';
export type ToolId = 'select' | 'crop' | Kind;

export interface Vec { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }

export interface Style {
  color: string;
  /** Stroke width, or blur strength for the blur tool. */
  width: number;
  opacity: number;
  fontSize: number;
  fill: boolean;
  shadow: boolean;
  rounded: boolean;
  mode: 'pixelate' | 'blur';
}

export const BASE_STYLE: Style = {
  color: '#e5342b', width: 4, opacity: 1, fontSize: 24,
  fill: false, shadow: false, rounded: false, mode: 'pixelate',
};

export const DEFAULT_STYLES: Record<Kind, Style> = {
  arrow: { ...BASE_STYLE },
  curve: { ...BASE_STYLE },
  line: { ...BASE_STYLE },
  rect: { ...BASE_STYLE },
  ellipse: { ...BASE_STYLE },
  pen: { ...BASE_STYLE },
  highlighter: { ...BASE_STYLE, color: '#ffe600', width: 20, opacity: 0.45 },
  text: { ...BASE_STYLE, fontSize: 28 },
  callout: { ...BASE_STYLE, fontSize: 20 },
  step: { ...BASE_STYLE, color: '#2563eb', fontSize: 18 },
  blur: { ...BASE_STYLE, width: 8 },
  spotlight: { ...BASE_STYLE, opacity: 0.6 },
  emoji: { ...BASE_STYLE, fontSize: 48 },
};

export type Control = 'color' | 'width' | 'opacity' | 'fontSize' | 'fill' | 'shadow' | 'rounded' | 'mode';

/** Which option controls apply to each annotation kind. */
export const CONTROLS: Record<Kind, Control[]> = {
  arrow: ['color', 'width', 'opacity', 'shadow'],
  curve: ['color', 'width', 'opacity', 'shadow'],
  line: ['color', 'width', 'opacity', 'shadow'],
  rect: ['color', 'width', 'opacity', 'fill', 'rounded', 'shadow'],
  ellipse: ['color', 'width', 'opacity', 'fill', 'shadow'],
  pen: ['color', 'width', 'opacity'],
  highlighter: ['color', 'width', 'opacity'],
  text: ['color', 'fontSize', 'fill', 'opacity', 'shadow'],
  callout: ['color', 'fontSize', 'fill', 'opacity', 'shadow'],
  step: ['color', 'fontSize', 'shadow'],
  blur: ['mode', 'width'],
  spotlight: ['opacity'],
  emoji: ['fontSize', 'opacity'],
};

export const PALETTE = ['#e5342b', '#f97316', '#ffe600', '#22c55e', '#2563eb', '#a855f7', '#111111', '#ffffff'];
export const EMOJIS = ['✔️', '❌', '⚠️', '❓', '❗', '⭐', '👍', '👎', '❤️', '🔥', '💡', '🚫'];
