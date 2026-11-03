import type { ToolId } from './types';

export const ICONS: Record<ToolId, string> = {
  select: '<path d="M5 3l14 8-6 2-3 6z"/>',
  arrow: '<path d="M5 19L19 5M9 5h10v10"/>',
  curve: '<path d="M4 19C5 9 11 6 19 6M15 2.5L19.5 6 16 10.5"/>',
  line: '<path d="M5 19L19 5"/>',
  rect: '<rect x="4" y="6" width="16" height="12" rx="1"/>',
  ellipse: '<ellipse cx="12" cy="12" rx="8.5" ry="6"/>',
  pen: '<path d="M4 20l1-4L16 5l3 3L8 19zM14 7l3 3"/>',
  highlighter: '<path d="M9 14l6-6 4 4-6 6H9zM9 18l-4 2 2-4M13 21h8"/>',
  text: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
  callout: '<path d="M4 5h16v11h-9l-4 4v-4H4z"/>',
  step: '<circle cx="12" cy="12" r="8.5"/><path d="M10.5 9.5l2-1.5v8"/>',
  blur: '<path d="M12 3s6.5 6.5 6.5 11a6.5 6.5 0 01-13 0C5.5 9 12 3 12 3z"/>',
  spotlight: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="4"/>',
  emoji: '<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9.5h.01M15 9.5h.01"/>',
  crop: '<path d="M6 2v16h16M2 6h16v16"/>',
};

export const TOOL_INFO: { id: ToolId; label: string; key: string; tip: string }[] = [
  { id: 'select', label: 'Select / move', key: 'V', tip: 'Click an item to edit it. Shift-click to select several. Double-click text to edit.' },
  { id: 'arrow', label: 'Arrow', key: 'A', tip: 'Drag to draw. Hold Shift for 45° angles.' },
  { id: 'curve', label: 'Curved arrow', key: 'Q', tip: 'Drag to draw. Select it afterwards to bend it with the middle handle.' },
  { id: 'line', label: 'Line', key: 'L', tip: 'Drag to draw. Hold Shift for 45° angles.' },
  { id: 'rect', label: 'Rectangle', key: 'R', tip: 'Drag to draw. Hold Shift for a square.' },
  { id: 'ellipse', label: 'Ellipse', key: 'O', tip: 'Drag to draw. Hold Shift for a circle.' },
  { id: 'pen', label: 'Pen', key: 'P', tip: 'Drag to draw freehand.' },
  { id: 'highlighter', label: 'Highlighter', key: 'H', tip: 'Drag over text. Hold Shift for a straight line.' },
  { id: 'text', label: 'Text', key: 'T', tip: 'Click to add text. Enter to finish, Shift+Enter for a new line.' },
  { id: 'callout', label: 'Callout', key: 'B', tip: 'Click where the pointer should aim, then type.' },
  { id: 'step', label: 'Numbered step', key: 'N', tip: 'Click to place numbered markers 1, 2, 3…' },
  { id: 'blur', label: 'Blur / pixelate', key: 'X', tip: 'Drag over sensitive info to hide it.' },
  { id: 'spotlight', label: 'Spotlight', key: 'F', tip: 'Drag to dim everything outside the area.' },
  { id: 'emoji', label: 'Stamp', key: 'E', tip: 'Pick a stamp, then click to place it.' },
  { id: 'crop', label: 'Crop', key: 'C', tip: 'Drag the area to keep. Undo restores it.' },
];
