# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-11-04

First release.

### Added
- **Capture modes:** visible area, drag-selected region, full scrolling page, and any window or
  screen through Chrome's screen picker.
- **Full-page capture** that stitches slices into one image, shows sticky and fixed headers only once,
  works on apps that scroll inside a panel, shows progress on the toolbar icon, and stops at 30,000 px
  of page height. Falls back to the visible area on pages Chrome won't let extensions script (New Tab,
  `chrome://`, the Web Store) and says so.
- **Annotation editor** (Konva): tapered brush arrows (straight and curved, growing with length),
  lines, rectangles, ellipses, pen, highlighter, text, callouts, numbered steps, blur / pixelate,
  spotlight, emoji stamps, and crop.
- **Editing:** every annotation stays selectable, movable, resizable and restylable after it is placed
  (colour, size, opacity, fill, shadow); end and bend handles for arrows and lines; duplicate,
  reorder, delete; undo/redo; zoom, fit, pan; keyboard shortcut for every tool.
- **Output:** download as PNG or JPG (with quality), copy to the clipboard.
- **History:** captures and their annotations are saved locally and can be re-opened and edited;
  configurable limit (default 100).
- **Triggers:** toolbar popup, keyboard shortcuts (Alt+Shift+V / S / F / D), right-click menu.
- **Clear failure messages:** the popup explains why a capture failed, with a Copy details button.
- Documentation, MIT license, privacy policy, unit tests and a CI workflow.
