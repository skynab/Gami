# Launch: legal and business notes

Internal notes on what Orikata needs, legally and as a business, before it goes on sale as a cheap paid app on
Google Play and the App Store, with a website. The owner is **Zaro Software LLC**. These notes record decisions
and what's still open. They aren't legal advice. Last reviewed 27 November 2026.

Related records: `PROVENANCE.md` (every model's designer and licence), `DESIGNS-LICENSE.md` (Orikata's own
designs, CC BY 4.0), `docs/name-choice.md` (the name), `docs/privacy-policy-history.md` (the policy's versions).

## Decided

- **No sign-in and no Studio at launch.** That leaves no accounts, community submissions or uploads, so no
  terms of use, takedown agent or account deletion are needed yet. They come back if sign-in or the Studio is
  switched on. Sign-in is already off unless the Supabase settings are given (`docs/accounts.md`). **The Studio
  has no off switch yet**: the gallery's Studio button always shows. It needs one before launch, and the privacy
  policy's line about Studio designs should go with it.
- **Donate on the website only.** Apple and Google don't allow outside payment links like Stripe in apps. The
  button shows only when `VITE_DONATE_LINK_*` are set, so set them for the website's build and never for an app
  build. When Donate is on, the privacy policy adds its Donations and Your choices sections by itself.
- **Credits stay internal for now.** Each model's designer and licence is in `PROVENANCE.md`, not shown in the
  app. Showing "Traditional" or "Design: Orikata, CC BY 4.0" on model pages can come later.
- **The fox stays.** The owner compared it with Mitsuo Okuda's design and judges it a different, much simpler
  model, at most loosely based on his. See the Fox note in `PROVENANCE.md`.
- **Fold'N Fly planes are treated as free to use.** They're unattributed, with only the order of folds used.
  See the note in `PROVENANCE.md`, which also says what that does and doesn't mean.
- **The privacy policy has a version and a date** (1.0, 27 Nov 2026). Your choices shows only where something is
  held, so it's left out of the store apps.

## Open before launch

1. **Contact email.** Set `VITE_CONTACT_EMAIL` for the website and every app build. Both stores expect the policy
   to say how to reach you.
2. **The Studio's off switch** (see above).
3. **Store privacy forms.** In Google Play's Data safety and Apple's App Privacy, with no sign-in and no Donate in
   the apps, the answer is "no data collected" and "no tracking".
4. **Age ratings.** For Apple's age rating and Google's IARC questionnaire: no violence, no user content, no chat,
   no ads, no purchases inside the app, no data collected. Expect 4+ on Apple and Everyone on Google. The FAQ
   page says it's made for all ages.
5. **Step wording.** Each recipe's step text should be Orikata's own words, not the tutorial's it followed. Only
   the heart and fox have been compared, out of about 57 recipes that follow a published tutorial.
6. **The repository.** Recommended: make it private and add a notice "Copyright © 2026 Zaro Software LLC. All
   rights reserved." An open-source licence would let anyone publish free copies of a paid app. Orikata's own
   designs stay under CC BY 4.0 (`DESIGNS-LICENSE.md`) whatever the code's licence. Not decided yet.
7. **A lawyer's read** of the privacy policy, the fox decision and the ORIGATA question before charging money.

## The name (Orikata)

The full reasoning is in `docs/name-choice.md`.

- Write **Orikata™** in store listings, on the website and in marketing. ™ needs no registration, and ® can
  only be used after registering.
- **Keep dated proof of first use.** This is what common-law rights depend on, so keep it from the start:
  - the date the app first went on sale in each store, and the date the website went live
  - screenshots of the store listings and the website with the name and the date
  - the first sale's record in each store's console
  - copies of the first marketing or announcement posts
- **After 19 March 2027, check the ORIGATA application** (serial 97802246) on
  [TSDR](https://tsdr.uspto.gov/#caseNumber=97802246&caseSearchType=US_APPLICATION&caseType=DEFAULT&searchType=statusSearch).
  If it has lapsed, file ORIKATA in class 9 (about $350) based on use. If it has registered, talk to a trademark
  attorney.
- **Domain.** orikata.com and orikata.app are taken. orikata.io, orikata.co, orikata.studio, orikataapp.com,
  orikata3d.com, playorikata.com and tryorikata.com looked free on 27 Nov 2026. Register it in the LLC's name.

## Zaro Software LLC as owner

- **Privacy policy:** name Zaro Software LLC as the operator ("Orikata is made by Zaro Software LLC"), with the
  contact email. Move the policy to version 1.1 when it changes.
- **Copyright line:** "© 2026 Zaro Software LLC" in the app's footer and on the website.
- **Store developer accounts** in the LLC's name, as an organisation. Both Apple and Google need a **D-U-N-S
  number** for an organisation account. It's free from Dun & Bradstreet but can take a couple of weeks, so ask
  early. The LLC's name then shows as the seller on the store pages, rather than a person's.
- **Money:** store payouts, Stripe (for Donate on the website) and the domain should all be in the LLC's name and
  paid into its bank account. The stores collect sales tax and VAT on app sales themselves.
- **Ownership of the work (later):** a short written assignment of the code, designs and name to Zaro Software
  LLC, from the owner and anyone else who wrote code or designs. Without it, the LLC may not own what it sells.
  The owner will do this later.

## Not needed unless plans change

- **Selling downloads from the website** (rather than linking to the stores) would add a payment provider, sales
  tax or VAT, and refund terms. Skip it while the website only links to the stores.
- **Terms of use, a DMCA takedown agent (about $6 at the US Copyright Office) and account deletion** are needed
  once sign-in, the Studio or community submissions are switched on.
