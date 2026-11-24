import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCambridgeUrl,
  DEFAULT_SETTINGS,
  extractTypeAnswerFromExample,
  getLanguagePrimaryUrl,
  getLanguageSecondaryUrl,
  interpolateGeminiPrompt,
  languageHasField,
  slugifyFilename,
  type AppSettings,
  type SaveCardPayload,
} from '@ass/shared';
import { buildAnkiTextFields } from './services/cardSaver.js';
import { getDictionaryProvider } from './services/dictionary/registry.js';
import {
  extractTextFromGeminiResponse,
  parseGeminiExamplesJson,
  sortGeminiModels,
} from './services/gemini.js';
import { clearAllTempImages, getTempImage, saveTempImage } from './store.js';

function makeSettings(): AppSettings {
  return structuredClone(DEFAULT_SETTINGS);
}

test('buildAnkiTextFields formats EN fields according to profile visibility, posFormat, and bold rules', () => {
  const settings = makeSettings();
  settings.languageProfiles.en.posFormat = 'short';
  settings.languageProfiles.en.visibleFields.partOfSpeech = true;
  settings.languageProfiles.en.visibleFields.pastForms = true;
  settings.languageProfiles.en.visibleFields.exampleVi = false;
  settings.languageProfiles.en.customFields = [
    { id: 'cf1', label: 'Note', ankiField: 'MyNote', multiline: true, allowBold: true },
    { id: 'cf2', label: 'Plain', ankiField: 'PlainField', multiline: false, allowBold: false },
  ];

  const payload: SaveCardPayload = {
    lang: 'en',
    mode: 'create',
    deckName: 'English',
    modelName: 'Basic',
    values: {
      word: '<b>go</b>',
      partOfSpeech: 'verb (move)',
      ipa: '/ɡoʊ/',
      typeAnswer: 'go',
      pastForms: 'went, gone',
      furigana: 'ignored_for_en',
      definition: 'to **travel** somewhere',
      exampleEn: 'I **went** home.\nSecond line.',
      exampleVi: 'Should be skipped when hidden in create mode',
    },
    customValues: {
      cf1: 'Remember **irregular** verb',
      cf2: '<b>No bold</b> here',
    },
  };

  const { lang, cleanWord, fieldsToWrite } = buildAnkiTextFields(payload, settings);
  assert.equal(lang, 'en');
  assert.equal(cleanWord, 'go');
  assert.equal(fieldsToWrite.Word, 'go');
  assert.equal(fieldsToWrite.PartOfSpeech, 'v. (move)');
  assert.equal(fieldsToWrite.IPA, 'ɡoʊ');
  assert.equal(fieldsToWrite['Past Simple and Past Participle'], 'went, gone');
  assert.equal(fieldsToWrite.Furigana, undefined);
  assert.equal(fieldsToWrite.Definition, 'to <b>travel</b> somewhere');
  assert.equal(fieldsToWrite.Example, 'I <b>went</b> home.<br>Second line.');
  assert.equal(fieldsToWrite.ExampleVI, undefined);
  assert.equal(fieldsToWrite.MyNote, 'Remember <b>irregular</b> verb');
  assert.equal(fieldsToWrite.PlainField, 'No bold here');
});

test('buildAnkiTextFields formats JA fields without EN POS conversion or slash stripping', () => {
  const settings = makeSettings();
  settings.languageProfiles.ja.visibleFields.furigana = true;
  settings.languageProfiles.ja.visibleFields.partOfSpeech = true;

  const payload: SaveCardPayload = {
    lang: 'ja',
    mode: 'create',
    deckName: 'Japanese',
    modelName: 'JP Note',
    values: {
      word: '食べる',
      partOfSpeech: '動詞',
      ipa: 'たべる',
      typeAnswer: 'たべる',
      pastForms: 'ignored_for_ja',
      furigana: '食[た]べる',
      definition: '食物をかんで飲み込む',
      exampleEn: '朝ごはんを**食べる**。',
      exampleVi: '',
    },
  };

  const { lang, fieldsToWrite } = buildAnkiTextFields(payload, settings);
  assert.equal(lang, 'ja');
  assert.equal(fieldsToWrite.Word, '食べる');
  assert.equal(fieldsToWrite.PartOfSpeech, '動詞');
  assert.equal(fieldsToWrite.Reading, 'たべる');
  assert.equal(fieldsToWrite.Furigana, '食[た]べる');
  assert.equal(fieldsToWrite['Past Simple and Past Participle'], undefined);
  assert.equal(fieldsToWrite.Example, '朝ごはんを<b>食べる</b>。');
});

test('dictionary provider registry and shared language helpers work declaratively', () => {
  assert.equal(getDictionaryProvider('en').lang, 'en');
  assert.equal(getDictionaryProvider('ja').lang, 'ja');
  assert.equal(languageHasField('en', 'pastForms'), true);
  assert.equal(languageHasField('en', 'furigana'), false);
  assert.equal(languageHasField('ja', 'furigana'), true);
  assert.equal(languageHasField('ja', 'pastForms'), false);
  assert.equal(slugifyFilename("Don't Stop!!", 'word', 24), 'dont_stop');
  assert.equal(slugifyFilename('   ', 'fallback'), 'fallback');
  assert.ok(getLanguagePrimaryUrl('en', 'ice cream').includes('/dictionary/english/ice-cream'));
  assert.ok(
    getLanguagePrimaryUrl('en', 'ice cream', 'learner-english').includes(
      '/dictionary/learner-english/ice-cream',
    ),
  );
  assert.equal(
    buildCambridgeUrl('resilient', 'learner-english'),
    'https://dictionary.cambridge.org/dictionary/learner-english/resilient',
  );
  assert.ok(getLanguagePrimaryUrl('ja', '食べる').includes('weblio.jp'));
  assert.ok(getLanguageSecondaryUrl('en', 'run').includes('oxfordlearnersdictionaries.com'));
  assert.ok(getLanguageSecondaryUrl('ja', '食べる').includes('jisho.org'));
});

test('interpolateGeminiPrompt replaces {{word}}, {{pos}}, {{definition}} and appends word if placeholder omitted', () => {
  const tpl = 'Đặt câu cho từ "{{word}}" ({{pos}}) với nghĩa: {{definition}}.';
  const res = interpolateGeminiPrompt(tpl, {
    word: 'resilient',
    pos: 'adjective',
    definition: '<b>able</b> to recover quickly',
  });
  assert.equal(res, 'Đặt câu cho từ "resilient" (adjective) với nghĩa: able to recover quickly.');

  const noPlaceholder = 'Hãy tạo 3 câu ví dụ giao tiếp hàng ngày.';
  const fallbackRes = interpolateGeminiPrompt(noPlaceholder, { word: '食べる' });
  assert.ok(fallbackRes.includes('Hãy tạo 3 câu ví dụ giao tiếp hàng ngày.'));
  assert.ok(fallbackRes.includes('"食べる"'));
});

test('parseGeminiExamplesJson extracts target/vi pairs and preserves safe bold tags', () => {
  const sampleJson = `\`\`\`json
  {
    "examples": [
      {
        "target": "She is remarkably **resilient** in tough times.",
        "vi": "Cô ấy có <b>khả năng phục hồi</b> đáng kinh ngạc trong thời điểm khó khăn.",
        "context": "Đời sống"
      },
      {
        "target": "朝ごはんを<b>食べる</b>時間がない。",
        "vi": "Không có thời gian ăn sáng."
      }
    ]
  }
  \`\`\``;

  const pairs = parseGeminiExamplesJson(sampleJson);
  assert.equal(pairs.length, 2);
  assert.equal(pairs[0].target, 'She is remarkably <b>resilient</b> in tough times.');
  assert.equal(
    pairs[0].vi,
    'Cô ấy có <b>khả năng phục hồi</b> đáng kinh ngạc trong thời điểm khó khăn.',
  );
  assert.equal(pairs[0].context, 'Đời sống');
  assert.equal(pairs[1].target, '朝ごはんを<b>食べる</b>時間がない。');
  assert.equal(pairs[1].vi, 'Không có thời gian ăn sáng.');

  const sorted = sortGeminiModels([
    { id: 'gemini-3.5-flash-lite', name: '3.5 Flash-Lite', description: '' },
    { id: 'gemini-3.8-pro', name: '3.8 Pro', description: '' },
    { id: 'gemini-3.8-flash', name: '3.8 Flash', description: '' },
    { id: 'gemini-3.8-flash-lite', name: '3.8 Flash-Lite', description: '' },
    { id: 'gemini-4-hydrogen', name: '4 Hydrogen', description: '' },
  ]);
  assert.deepEqual(
    sorted.map((m) => m.id),
    [
      'gemini-4-hydrogen',
      'gemini-3.8-flash',
      'gemini-3.8-flash-lite',
      'gemini-3.8-pro',
      'gemini-3.5-flash-lite',
    ],
  );

  // Verify Interactions API (Api-Revision: 2026-05-20) steps schema extraction
  const interactionsStepResponse = {
    id: 'int_123',
    steps: [
      {
        type: 'thought',
        signature: 'sig_abc',
        summary: [{ type: 'text', text: 'internal reasoning' }],
      },
      {
        type: 'model_output',
        content: [
          {
            type: 'text',
            text: '{"examples":[{"target":"My <b>dog</b> runs fast.","vi":"Chú chó của tôi chạy nhanh."}]}',
          },
        ],
      },
    ],
  };
  const extractedText = extractTextFromGeminiResponse(interactionsStepResponse);
  const parsedFromSteps = parseGeminiExamplesJson(extractedText);
  assert.equal(parsedFromSteps.length, 1);
  assert.equal(parsedFromSteps[0].target, 'My <b>dog</b> runs fast.');
  assert.equal(parsedFromSteps[0].vi, 'Chú chó của tôi chạy nhanh.');
});

test('saveTempImage automatically deletes previous unused temp images and clearAllTempImages cleans up', () => {
  clearAllTempImages();
  const img1 = saveTempImage(Buffer.from('fake-img-1'), 'image/webp', { filename: 'one.webp' });
  assert.ok(getTempImage(img1.id));

  // Saving a second temp image automatically deletes img1 because img1 is superseded
  const img2 = saveTempImage(Buffer.from('fake-img-2'), 'image/webp', { filename: 'two.webp' });
  assert.equal(getTempImage(img1.id), null);
  assert.ok(getTempImage(img2.id));

  // Clearing all temp images removes img2 from disk as well
  const deleted = clearAllTempImages();
  assert.equal(deleted, 1);
  assert.equal(getTempImage(img2.id), null);
});

test('extractTypeAnswerFromExample detects exact word, regular/irregular inflections, phrasal verbs, bold tags, and Japanese conjugations', () => {
  // English irregular verb (with or without pastForms / bold tags)
  assert.equal(
    extractTypeAnswerFromExample('go', 'She went to Paris last summer.', {
      lang: 'en',
      pastForms: 'went, gone',
    }),
    'went',
  );
  assert.equal(
    extractTypeAnswerFromExample('take', 'He has <b>taken</b> the train to work.', {
      lang: 'en',
    }),
    'taken',
  );

  // Regular English inflections (-ed, -ing, -ies, doubled consonant)
  assert.equal(
    extractTypeAnswerFromExample('adapt', 'Species quickly adapted to the climate.', {
      lang: 'en',
    }),
    'adapted',
  );
  assert.equal(
    extractTypeAnswerFromExample('carry', 'She carries a laptop everywhere.', {
      lang: 'en',
    }),
    'carries',
  );
  assert.equal(
    extractTypeAnswerFromExample('stop', 'The rain finally stopped.', {
      lang: 'en',
    }),
    'stopped',
  );

  // Sentence-initial capitalization normalized when headword is lowercase
  assert.equal(
    extractTypeAnswerFromExample('resilient', 'Resilient communities recover faster.', {
      lang: 'en',
    }),
    'resilient',
  );

  // Multi-word phrasal verb inflection
  assert.equal(
    extractTypeAnswerFromExample('give up', 'He never gave up on his dream.', {
      lang: 'en',
    }),
    'gave up',
  );

  // Japanese verb conjugations (Ichidan & Godan)
  assert.equal(
    extractTypeAnswerFromExample('食べる', '今朝はパンを食べました。', {
      lang: 'ja',
    }),
    '食べました',
  );
  assert.equal(
    extractTypeAnswerFromExample('行く', '昨日東京に行った。', {
      lang: 'ja',
    }),
    '行った',
  );
});




