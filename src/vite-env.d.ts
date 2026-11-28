/// <reference types="vite/client" />

/** The app's version from package.json, e.g. "0.8.0". Set by `define` in vite.config.ts. */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_DONATE_LINK_3?: string;
  readonly VITE_DONATE_LINK_5?: string;
  readonly VITE_DONATE_LINK_10?: string;
  readonly VITE_DONATE_LINK_CUSTOM?: string;
  readonly VITE_DONATE_CURRENCY?: string;
  readonly VITE_CONTACT_EMAIL?: string;
  readonly VITE_STUDIO?: string;
}
