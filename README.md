# Snapmark

Chrome extension (Manifest V3) for capturing and annotating screenshots.

**Capture:** visible area · drag-selected region · full scrolling page · any window / screen
**Annotate:** arrows (straight + curved), lines, rectangles, ellipses, pen, highlighter, text, callouts,
numbered steps, blur / pixelate, spotlight, emoji stamps, crop — all editable after placing, with undo/redo.
**Output:** download PNG/JPG, copy to clipboard, local history (re-editable, stored only in your browser).

## Build & install
```
npm install
npm run build        # outputs dist/
```
Chrome → `chrome://extensions` → enable Developer mode → **Load unpacked** → select `dist/`.

Shortcuts (change at `chrome://extensions/shortcuts`): Alt+Shift+V visible, S selection, F full page, D window/desktop.

## Develop
`npm run dev` rebuilds on change (reload the extension in Chrome after). `npm run typecheck`, `npm test`.

## Known limits
- `chrome://` pages and the Web Store can't be captured (window/desktop capture still works there).
- Full-page capture scrolls the page itself; pages that scroll inside an inner container capture only the visible part.
- Very tall pages are scaled down to stay under the browser's canvas size limit.
