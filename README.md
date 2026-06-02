# Figma History Plugin (Quick Prototype)

Tracks recent page and selection activity, then lets you jump back from a floating History panel.

## Project files

- `manifest.json` — plugin metadata and commands
- `code.ts` — TypeScript source of truth for plugin logic
- `code.js` — compiled runtime plugin logic loaded by Figma
- `ui.html` — History panel UI
- `tsconfig.json` — TypeScript compiler configuration
- `package.json` — build/watch scripts and dev dependencies

## Load as a development plugin

1. Open Figma Desktop.
2. Go to `Plugins` > `Development` > `Import plugin from manifest...`.
3. Select this file: `manifest.json`.
4. Run the plugin from `Plugins` > `Development` > `History Navigator` > `Open History`.

## Commands

- `Open History` — opens the floating History panel.
- `Clear History` — clears persisted history for the current file.

## Development scripts

- `npm install`
- `npm run build` — compile `code.ts` -> `code.js`
- `npm run watch` — rebuild on TypeScript changes

## Team rollout docs

- Internal distribution: `docs/internal-distribution.md`
- Release/versioning process: `docs/release-process.md`
- Release notes: `CHANGELOG.md`

## Manual test checklist

Use this checklist in a multi-page Figma file with a few frames/layers.

- [ ] Open `Open History`; verify panel appears and list initializes.
- [ ] Select different layers/frames; verify new entries appear (not spammed by rapid duplicates).
- [ ] Switch pages; verify page entries appear.
- [ ] Search by page or layer name; verify filtering works.
- [ ] Click a layer history item; verify page switches (if needed) and node is focused.
- [ ] Delete a previously logged node, then click its history item; verify graceful fallback notification.
- [ ] Click `Clear`; verify list clears.
- [ ] Run `Clear History` command from plugin menu; verify no history remains.
- [ ] Close and reopen Figma/plugin; verify history persistence for the same file.
- [ ] Open a different file; verify history is isolated per file key.

## Notes / limitations

- Figma does not allow plugins to inject a custom button directly under the native `Assets` section.
- This prototype uses plugin commands and a floating panel as the closest supported UX.
- History capture occurs while the plugin is running; entries are persisted locally via `clientStorage`.
