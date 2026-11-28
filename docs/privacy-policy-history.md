# Privacy policy history

The policy is at `/privacy`. Its text is the `privacy` block in `src/i18n/en.ts`, with Japanese, Spanish and
French translations, and it's put together in `src/routes/Privacy.tsx`. The English version is the one that
applies.

**Every change to what the policy says gets a new version here.** Move `PRIVACY_VERSION` and `PRIVACY_UPDATED`
in `Privacy.tsx` on, and say what changed and why. Fixing a typo or a translation without changing the meaning
needs neither.

The policy describes the build it's in, so one version has a few forms:

| Build | Sections shown |
|---|---|
| Store apps (no sign-in, no Donate) | Device, Loading Orikata, Children (no data collected), Contact, Changes |
| Website with Donate | Adds Donations and Your choices |
| Website with sign-in (not planned for launch) | Adds If you sign in, Reporting a model and Your choices, plus the 13+ age rule under Children |

Without `VITE_CONTACT_EMAIL`, Contact points to the store page or website instead of an email address.

## Versions

### 1.0 (27 November 2026)

The first version, written before launch.

- No ads, analytics or trackers, and nothing sold.
- Settings, progress and favourites stay on the device, and so do Studio designs in builds with the Studio
  (`VITE_STUDIO`). Without it, the intro and the device section don't mention designing.
- The host's request logs are mentioned, and so are the stores' own handling of downloads and payments.
- Sign-in, reports and Stripe donations are described only in the builds that have them.
- **Your choices** (to see, correct or delete what we hold, answered within 30 days) appears only where
  something is held, which means sign-in or donation records. In the store apps there's nothing to ask
  about, so it's left out.
