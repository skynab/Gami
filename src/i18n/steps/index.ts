import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * The built-in models' step titles and instructions in other languages, looked up by their English text, so
 * a step said the same way in several models ("Unfold", "Turn over") is translated once. Each language loads
 * when it's first needed. Text without a translation shows as it is: English, or a Studio model in the
 * language its creator wrote it in.
 */
const loaders: Record<string, () => Promise<Record<string, string>>> = {
  ja: () => import('./ja').then((m) => m.ja),
  es: () => import('./es').then((m) => m.es),
  fr: () => import('./fr').then((m) => m.fr),
};
const loaded = new Map<string, Record<string, string>>();

/** A function giving a step's title or instruction in the interface's language. */
export function useStepText(): (text: string) => string {
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const [words, setWords] = useState(() => loaded.get(language));
  useEffect(() => {
    const load = loaders[language];
    if (!load || loaded.has(language)) {
      setWords(loaded.get(language));
      return;
    }
    let current = true;
    void load().then((w) => {
      loaded.set(language, w);
      if (current) setWords(w);
    });
    return () => {
      current = false;
    };
  }, [language]);
  return useCallback((text: string) => words?.[text] ?? text, [words]);
}
