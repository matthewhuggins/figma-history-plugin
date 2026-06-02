# Release Process

Use this process for each internal release.

## Versioning strategy

- Use semantic versioning in `package.json`:
  - Patch (`0.1.x`): bug fixes, no behavior changes.
  - Minor (`0.x.0`): backward-compatible improvements.
  - Major (`x.0.0`): breaking behavior or migration-required changes.
- Keep `CHANGELOG.md` updated for every release.

## Release checklist

1. Sync branch with latest default branch.
2. Run:
   - `npm install`
   - `npm run build`
3. Run manual checks from `README.md` test list.
4. Update version in `package.json`.
5. Add changelog entry in `CHANGELOG.md`.
6. Commit release changes.
7. Distribute through internal publishing flow or pilot flow:
   - see `docs/internal-distribution.md`

## Fast rollback plan

- Keep previous known-good plugin bundle available.
- If a release fails, republish previous version and note rollback in changelog.
