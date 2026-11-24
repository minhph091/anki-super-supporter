import { lookupWeblio } from '../weblio.js';
import { lookupJishoFallback } from '../jisho.js';
import type { DictionaryProvider } from './types.js';

export const jaDictionaryProvider: DictionaryProvider = {
  lang: 'ja',
  lookup: (word) => lookupWeblio(word),
  lookupFallback: (word) => lookupJishoFallback(word),
};
