import type { DictionaryLookupResponse, LanguageCode } from '@ass/shared';

export type UncachedLookupResponse = Omit<DictionaryLookupResponse, 'cached'>;

export interface DictionaryProvider {
  readonly lang: LanguageCode;
  lookup(word: string): Promise<UncachedLookupResponse>;
  lookupFallback(word: string): Promise<UncachedLookupResponse>;
}
