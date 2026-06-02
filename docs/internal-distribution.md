# Internal Distribution Guide

Use this guide to make the plugin available to other employees.

## Option A: Org-private plugin publishing (recommended)

Use this when your Figma plan supports internal plugin visibility.

1. Build the plugin:
   - `npm install`
   - `npm run build`
2. Verify the plugin locally with a quick sanity check in Figma.
3. In Figma plugin publishing flow, create/update the plugin with:
   - `manifest.json`
   - `code.js`
   - `ui.html`
4. Set visibility to private/internal (not public community).
5. Grant access to relevant org users/groups.
6. Publish release notes for each version update.

## Option B: Development plugin rollout (pilot teams)

Use this when internal publishing is unavailable or for early pilots.

1. Share this repository internally.
2. Ask users to:
   - clone repo
   - run `npm install && npm run build`
   - import `manifest.json` in Figma Development plugins
3. Communicate upgrade steps for each release:
   - pull latest changes
   - run `npm run build`
   - reload development plugins in Figma

## Security and data notes

- This plugin stores history with `figma.clientStorage`.
- Storage is local to each user and scoped by file key.
- No external API calls are required by current implementation.
