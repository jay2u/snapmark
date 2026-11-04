# Contributing

Thanks for helping improve Snapmark! Bug reports, ideas and pull requests are welcome.

## Reporting a bug
Please include:
- Chrome version and OS.
- What you did and what you expected.
- For a failed capture: open the Snapmark popup and use **Copy details** in the red box.

## Development setup
```bash
npm install
npm run build          # outputs dist/ — load it via chrome://extensions → Load unpacked
npm run dev            # rebuild on change (reload the extension after each build)
npm run typecheck
npm test
```

## Pull requests
1. Keep changes focused; one topic per PR.
2. Add or update tests for logic that doesn't need a browser (see `tests/`).
3. Run `npm run typecheck && npm test && npm run build` before pushing — CI runs the same.
4. Add a line under **Unreleased** in [CHANGELOG.md](CHANGELOG.md).

## Code layout
See [Project structure](README.md#project-structure) in the README.
