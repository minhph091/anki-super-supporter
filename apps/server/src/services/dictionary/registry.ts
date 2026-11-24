import type { LanguageCode } from '@ass/shared';
import { enDictionaryProvider } from './providers/en.js';
import { jaDictionaryProvider } from './providers/ja.js';
import type { DictionaryProvider, UncachedLookupResponse } from './providers/types.js';

export { adaptEnglishLookup, cleanCambridgeDefinitionText } from './providers/en.js';
export type { DictionaryProvider, UncachedLookupResponse } from './providers/types.js';

const DICTIONARY_PROVIDERS: Record<LanguageCode, DictionaryProvider> = {
  en: enDictionaryProvider,
  ja: jaDictionaryProvider,
};

export function getDictionaryProvider(lang: LanguageCode): DictionaryProvider {
  return DICTIONARY_PROVIDERS[lang] ?? DICTIONARY_PROVIDERS.en;
}

export async function lookupDictionaryByLang(
  lang: LanguageCode,
  word: string,
): Promise<UncachedLookupResponse> {
  return getDictionaryProvider(lang).lookup(word);
}

export async function lookupFallbackByLang(
  lang: LanguageCode,
  word: string,
): Promise<UncachedLookupResponse> {
  return getDictionaryProvider(lang).lookupFallback(word);
}
