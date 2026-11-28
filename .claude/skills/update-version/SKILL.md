---
name: update-version
description: Change Orikata's version number (shown small in the site's footer). Use when asked to bump, set, change or release a new version, or when asked what version the app is at.
---

# Update the version number

Orikata has one version number: `"version"` in `package.json`. `vite.config.ts` reads it into `__APP_VERSION__`
at build time, and `src/app/Footer.tsx` shows it at the bottom of the gallery and the other scrolling pages as
"Version 0.8.0" (translated by `footer.version` in `src/i18n/*.ts`). Nothing else holds the number, so never
type it into the code.

The privacy policy has its own, separate version (see `docs/privacy-policy-history.md`). Don't change it here.

## Choosing the number

Versions are `MAJOR.MINOR.PATCH`. Until launch the app is at `0.x`:

- **Patch** (0.8.0 → 0.8.1): fixes only, nothing new for people to notice.
- **Minor** (0.8.1 → 0.9.0): new models, features or pages.
- **Major** (→ 1.0.0): the public launch. After that, bump major only for big changes.

If the user names a number, use it. If not, suggest one from the commits since the last change
(`git log --oneline -- package.json` shows where it last changed) and check with them before setting it.

## Steps

1. Set it. This updates `package.json` and both version fields at the top of `package-lock.json`, with no git
   commit or tag:

   ```bash
   npm version 0.9.0 --no-git-tag-version
   ```

   Don't edit the files by hand. That can leave the lockfile out of step with `package.json`.

2. Check it shows up. `define` values are read when the server starts, so restart the dev server (with
   `preview_stop` then `preview_start` `{ name: "dev" }`, see the `start-site` skill) and open the gallery. The
   footer should read "Version 0.9.0". Running `npm run typecheck` is enough if no server is needed.

3. Commit `package.json` and `package-lock.json` together, e.g. `Version 0.9.0`, along with any change that
   goes with it. Tag (`git tag v0.9.0`) or push only if the user asks.
