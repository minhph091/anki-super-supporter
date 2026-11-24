import {
  formatPosForAnki,
  getLanguageDefinition,
  isSupportedLanguage,
  languageHasField,
  sanitizeAnkiBoldText,
  stripHtmlToPlainText,
  stripIpaSlashes,
  type AppSettings,
  type LanguageCode,
  type SaveCardPayload,
} from '@ass/shared';

export function buildAnkiTextFields(
  payload: SaveCardPayload,
  settings: AppSettings,
): {
  lang: LanguageCode;
  cleanWord: string;
  fieldsToWrite: Record<string, string>;
} {
  const lang: LanguageCode = isSupportedLanguage(payload.lang)
    ? payload.lang
    : settings.activeLanguage;
  const profile = settings.languageProfiles[lang] ?? settings;
  const mapping = profile.fieldMapping;
  const isCreate = payload.mode === 'create';
  const vis = profile.visibleFields;

  const fieldsToWrite: Record<string, string> = {};
  const putField = (fieldName: string, value: string, allowEmpty = false) => {
    const cleanName = fieldName?.trim();
    if (!cleanName) return;
    if (allowEmpty || value !== '') {
      fieldsToWrite[cleanName] = value;
    }
  };

  const langDef = getLanguageDefinition(lang);
  const cleanWord = stripHtmlToPlainText(payload.values.word);
  const cleanPos = langDef.supportsPosFormat
    ? formatPosForAnki(payload.values.partOfSpeech, profile.posFormat)
    : stripHtmlToPlainText(payload.values.partOfSpeech);
  const cleanIpa = langDef.stripReadingSlashes
    ? stripIpaSlashes(stripHtmlToPlainText(payload.values.ipa))
    : stripHtmlToPlainText(payload.values.ipa);
  const cleanTypeAnswer = stripHtmlToPlainText(payload.values.typeAnswer ?? '');
  const cleanPastForms = stripHtmlToPlainText(payload.values.pastForms ?? '');
  const cleanFurigana = stripHtmlToPlainText(payload.values.furigana ?? '');
  const cleanDef = sanitizeAnkiBoldText(payload.values.definition, true);
  const cleanExampleEn = sanitizeAnkiBoldText(payload.values.exampleEn, true);
  const cleanExampleVi = sanitizeAnkiBoldText(payload.values.exampleVi, true);

  putField(mapping.word, cleanWord, isCreate);
  if (!isCreate || vis.partOfSpeech) putField(mapping.partOfSpeech, cleanPos, isCreate);
  if (!isCreate || vis.ipa) putField(mapping.ipa, cleanIpa, isCreate);
  if (!isCreate || vis.typeAnswer) putField(mapping.typeAnswer, cleanTypeAnswer, isCreate);
  if (languageHasField(lang, 'pastForms') && (!isCreate || vis.pastForms)) {
    putField(mapping.pastForms, cleanPastForms, isCreate);
  }
  if (languageHasField(lang, 'furigana') && (!isCreate || vis.furigana)) {
    putField(mapping.furigana, cleanFurigana, isCreate);
  }
  if (!isCreate || vis.definition) putField(mapping.definition, cleanDef, isCreate);
  if (!isCreate || vis.exampleEn) putField(mapping.exampleEn, cleanExampleEn, isCreate);
  if (!isCreate || vis.exampleVi) putField(mapping.exampleVi, cleanExampleVi, isCreate);

  if (payload.customValues && profile.customFields.length > 0) {
    for (const cf of profile.customFields) {
      const rawVal = payload.customValues[cf.id] ?? '';
      const formatted = cf.allowBold
        ? sanitizeAnkiBoldText(rawVal, true)
        : stripHtmlToPlainText(rawVal).replace(/\n/g, '<br>');
      putField(cf.ankiField, formatted, isCreate);
    }
  }

  return { lang, cleanWord, fieldsToWrite };
}
