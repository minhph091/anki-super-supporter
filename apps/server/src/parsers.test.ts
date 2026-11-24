import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildJapaneseFurigana,
  cleanTextForTts,
  formatPosForAnki,
  formatPosWithGuideword,
  normalizePos,
  sanitizeAnkiBoldText,
  stripHtmlToPlainText,
  stripPosGuideword,
} from '@ass/shared';
import { parseOxfordHtml } from './services/dictionary/oxford.js';
import { parseCambridgeHtml } from './services/dictionary/cambridge.js';
import { parseWeblioHtml } from './services/dictionary/weblio.js';
import {
  adaptEnglishLookup,
  cleanCambridgeDefinitionText,
} from './services/dictionary/registry.js';
import {
  isAudioFilename,
  isCambridgeFilename,
  isElevenLabsFilename,
  resolveDownloadAudioPath,
  scanDownloadsAudio,
} from './services/downloadsScanner.js';
import { LocalSecretVault, maskSecretKey } from './vault.js';
import sharp from 'sharp';
import { compressImageAdaptive } from './services/imageCompressor.js';

test('parseOxfordHtml extracts US IPA, POS, and homograph links', () => {
  const sampleHtml = `
    <html><body>
      <div class="webtop">
        <h1 class="headword">record</h1>
        <span class="pos">noun</span>
        <div class="phonetics">
          <div class="phons_br"><span class="phon">/ˈrekɔːd/</span></div>
          <div class="phons_n_am"><span class="phon">/ˈrekərd/</span></div>
        </div>
      </div>
      <div id="relatedentries">
        <a href="/definition/english/record_2">record verb</a>
      </div>
    </body></html>
  `;

  const parsed = parseOxfordHtml(
    sampleHtml,
    'https://www.oxfordlearnersdictionaries.com/definition/english/record_1',
    'record',
  );

  assert.ok(parsed.item);
  assert.equal(parsed.item.headword, 'record');
  assert.equal(parsed.item.pos, 'noun');
  assert.equal(parsed.item.usIpa, 'ˈrekərd');
  assert.equal(parsed.item.ukIpa, 'ˈrekɔːd');
  assert.deepEqual(parsed.homographUrls, [
    'https://www.oxfordlearnersdictionaries.com/definition/english/record_2',
  ]);
  assert.equal(parsed.item.pastForms, undefined);

  // Verify American English Oxford URLs and homographs
  const amHtml = `
    <html><body>
      <div class="webtop">
        <h1 class="headword">go</h1>
        <span class="pos">verb</span>
        <div class="phonetics">
          <div class="phons_n_am"><span class="phon">/ɡoʊ/</span></div>
        </div>
      </div>
      <div id="relatedentries">
        <a href="/definition/american_english/go_2">go noun</a>
      </div>
    </body></html>
  `;
  const parsedAm = parseOxfordHtml(
    amHtml,
    'https://www.oxfordlearnersdictionaries.com/definition/american_english/go_1',
    'go',
  );
  assert.ok(parsedAm.item);
  assert.equal(parsedAm.item.usIpa, 'ɡoʊ');
  assert.deepEqual(parsedAm.homographUrls, [
    'https://www.oxfordlearnersdictionaries.com/definition/american_english/go_2',
  ]);

  // Verify real OAAD (Oxford Advanced American Dictionary) DOM structure with .top-g / .webtop-g / .pron-gs / .name+.separator+.wrap + .if-gs
  const oaadRealHtml = `
    <html><body>
      <div id="entryContent" class="oaad">
        <div class="entry" dict="oaad" id="long_1">
          <ol class="h-g">
            <div class="top-container">
              <div class="top-g">
                <div class="webtop-g"><h2 class="h">long</h2><span class="pos">adjective</span></div>
                <div class="pron-gs ei-g" source="OAAD">
                  <span class="pron-g" geo="n_am" trans="oaad">
                    <span class="phon"><span class="name">NAmE</span><span class="separator">/</span><span class="wrap">/</span>lɔŋ<span class="wrap">/</span><span class="separator">/</span></span>
                  </span>
                </div>
                <span class="if-gs">
                  <span class="if-g">
                    <span class="if">longer</span>
                    <div class="pron-gs ei-g">
                      <span class="pron-g" geo="n_am">
                        <span class="phon"><span class="name">NAmE</span><span class="separator">/</span><span class="wrap">/</span>ˈlɔŋɡər<span class="wrap">/</span><span class="separator">/</span></span>
                      </span>
                    </div>
                  </span>
                </span>
              </div>
            </div>
          </ol>
        </div>
      </div>
      <div id="relatedentries">
        <a href="https://www.oxfordlearnersdictionaries.com/definition/american_english/long_3">long adverb</a>
        <a href="https://www.oxfordlearnersdictionaries.com/definition/american_english/long_4">long verb</a>
      </div>
    </body></html>
  `;
  const parsedOaad = parseOxfordHtml(
    oaadRealHtml,
    'https://www.oxfordlearnersdictionaries.com/definition/american_english/long_1',
    'long',
  );
  assert.ok(parsedOaad.item);
  assert.equal(parsedOaad.item.headword, 'long');
  assert.equal(parsedOaad.item.pos, 'adjective');
  assert.equal(parsedOaad.item.usIpa, 'lɔŋ');
  assert.equal(parsedOaad.item.ukIpa, undefined);
  assert.equal(parsedOaad.item.pastForms, undefined);
  assert.deepEqual(parsedOaad.homographUrls, [
    'https://www.oxfordlearnersdictionaries.com/definition/american_english/long_3',
    'https://www.oxfordlearnersdictionaries.com/definition/american_english/long_4',
  ]);
});

test('parseOxfordHtml extracts Past Simple and Past Participle separated by comma from verb_forms_table', () => {
  const goHtml = `
    <html><body>
      <div class="webtop">
        <h1 class="headword">go</h1>
        <span class="pos">verb</span>
        <div class="phonetics">
          <div class="phons_br"><span class="phon">/ɡəʊ/</span></div>
          <div class="phons_n_am"><span class="phon">/ɡəʊ/</span></div>
        </div>
      </div>
      <span unbox="verbforms">
        <table class="verb_forms_table">
          <tr class="verb_form" form="root"><td class="verb_form"> <span class="vf_prefix">present simple I / you / we / they</span> go</td></tr>
          <tr class="verb_form" form="thirdps"><td class="verb_form"> <span class="vf_prefix">he / she / it</span> goes</td></tr>
          <tr class="verb_form" form="past"><td class="verb_form"> <span class="vf_prefix">past simple</span> went</td></tr>
          <tr class="verb_form" form="pastpart"><td class="verb_form"> <span class="vf_prefix">past participle</span> gone</td></tr>
          <tr class="verb_form" form="prespart"><td class="verb_form"> <span class="vf_prefix">-ing form</span> going</td></tr>
        </table>
      </span>
    </body></html>
  `;

  const parsedGo = parseOxfordHtml(
    goHtml,
    'https://www.oxfordlearnersdictionaries.com/definition/english/go_1',
    'go',
  );
  assert.ok(parsedGo.item);
  assert.deepEqual(parsedGo.item.pastSimple, ['went']);
  assert.deepEqual(parsedGo.item.pastParticiple, ['gone']);
  assert.equal(parsedGo.item.pastForms, 'went, gone');

  const burnHtml = `
    <html><body>
      <div class="webtop">
        <h1 class="headword">burn</h1>
        <span class="pos">verb</span>
        <div class="phons_n_am"><span class="phon">/bɜːrn/</span></div>
      </div>
      <table class="verb_forms_table">
        <tr class="verb_form" form="past"><td class="verb_form"> <span class="vf_prefix">past simple</span> burnt</td></tr>
        <tr class="verb_form" form="pastpart"><td class="verb_form"> <span class="vf_prefix">past participle</span> burnt</td></tr>
        <tr class="verb_form" form="past"><td class="verb_form"> <span class="vf_prefix">past simple</span> burned</td></tr>
        <tr class="verb_form" form="pastpart"><td class="verb_form"> <span class="vf_prefix">past participle</span> burned</td></tr>
      </table>
    </body></html>
  `;
  const parsedBurn = parseOxfordHtml(
    burnHtml,
    'https://www.oxfordlearnersdictionaries.com/definition/english/burn_1',
    'burn',
  );
  assert.ok(parsedBurn.item);
  assert.deepEqual(parsedBurn.item.pastSimple, ['burnt', 'burned']);
  assert.deepEqual(parsedBurn.item.pastParticiple, ['burnt', 'burned']);
  assert.equal(parsedBurn.item.pastForms, 'burnt / burned, burnt / burned');

  const beHtml = `
    <html><body>
      <div class="webtop">
        <h1 class="headword">be</h1>
        <span class="pos">verb</span>
        <div class="phons_n_am"><span class="phon">/biː/</span></div>
      </div>
      <table class="verb_forms_table">
        <tr class="verb_form" form="past"><td class="verb_form"> <span class="vf_prefix">past simple</span> was</td></tr>
        <tr class="verb_form" form="past"><td class="verb_form"> <span class="vf_prefix">past simple</span> were</td></tr>
        <tr class="verb_form" form="pastpart"><td class="verb_form"> <span class="vf_prefix">past participle</span> been</td></tr>
      </table>
    </body></html>
  `;
  const parsedBe = parseOxfordHtml(
    beHtml,
    'https://www.oxfordlearnersdictionaries.com/definition/english/be_1',
    'be',
  );
  assert.ok(parsedBe.item);
  assert.equal(parsedBe.item.pastForms, 'was / were, been');
});

test('parseCambridgeHtml extracts structured entries, US IPA, guidewords, CEFR levels, and examples', () => {
  const sampleHtml = `
    <html><body>
      <div class="entry-body__el">
        <div class="pos-header">
          <span class="hw dhw">resilient</span>
          <span class="pos dpos">adjective</span>
          <span class="uk"><span class="ipa">rɪˈzɪl.jənt</span></span>
          <span class="us"><span class="ipa">rɪˈzɪl.jənt</span></span>
        </div>
        <div class="pos-body">
          <div class="pr dsense">
            <h3 class="dsense_h"><span class="guideword"><span>STRONG</span></span></h3>
            <div class="def-block ddef_block">
              <span class="def-info"><span class="epp-xref">C2</span></span>
              <div class="def ddef_d">able to be happy, successful, etc. again after something difficult or bad has happened:</div>
              <div class="examp dexamp"><span class="eg deg">She's a resilient girl - she won't be unhappy for long.</span></div>
            </div>
          </div>
        </div>
      </div>
    </body></html>
  `;

  const result = parseCambridgeHtml(
    sampleHtml,
    'https://dictionary.cambridge.org/dictionary/english/resilient',
    'resilient',
  );

  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].headword, 'resilient');
  assert.equal(result.entries[0].pos, 'adjective');
  assert.equal(result.entries[0].usIpa, 'rɪˈzɪl.jənt');
  assert.equal(result.entries[0].blocks[0].guideword, 'STRONG');
  assert.equal(result.entries[0].blocks[0].senses[0].level, 'C2');
  assert.equal(
    result.entries[0].blocks[0].senses[0].definition,
    'able to be happy, successful, etc. again after something difficult or bad has happened',
  );
  assert.equal(
    result.entries[0].blocks[0].senses[0].examples[0],
    "She's a resilient girl - she won't be unhappy for long.",
  );

  assert.equal(
    cleanCambridgeDefinitionText('a serious disease causing death: + Chọn vào Anki'),
    'a serious disease causing death',
  );
  assert.equal(
    cleanCambridgeDefinitionText('able to recover quickly:'),
    'able to recover quickly',
  );

  // Verify Cambridge with distinct UK & US keeps BOTH separately and never mislabels UK as US
  const dualPronHtml = `
    <html><body>
      <div class="entry-body__el">
        <div class="pos-header">
          <span class="hw dhw">plant</span>
          <span class="pos dpos">noun</span>
          <span class="uk dpron-i"><span class="region dreg">uk</span><span class="pron dpron">/<span class="ipa dipa">plɑːnt</span>/</span></span>
          <span class="us dpron-i"><span class="region dreg">us</span><span class="pron dpron">/<span class="ipa dipa">plænt</span>/</span></span>
        </div>
        <div class="pos-body">
          <div class="def-block ddef_block">
            <div class="def ddef_d">a living thing that grows in earth:</div>
          </div>
        </div>
      </div>
    </body></html>
  `;
  const dualCam = parseCambridgeHtml(
    dualPronHtml,
    'https://dictionary.cambridge.org/dictionary/english/plant',
    'plant',
  );
  assert.equal(dualCam.entries[0].usIpa, 'plænt');
  assert.equal(dualCam.entries[0].ukIpa, 'plɑːnt');

  const adaptedDual = adaptEnglishLookup(
    'plant',
    { word: 'plant', sourceUrl: '', entries: [] },
    dualCam,
  );
  assert.equal(adaptedDual.readings.length, 2);
  assert.equal(adaptedDual.readings[0].label, 'US');
  assert.equal(adaptedDual.readings[0].reading, 'plænt');
  assert.equal(adaptedDual.readings[1].label, 'UK');
  assert.equal(adaptedDual.readings[1].reading, 'plɑːnt');
  assert.equal(adaptedDual.entries[0].reading, 'plænt');
  assert.equal(adaptedDual.entries[0].altReading, 'plɑːnt');

  // UK-only Cambridge entry must NEVER be mislabeled as US
  const ukOnlyHtml = `
    <html><body>
      <div class="entry-body__el">
        <div class="pos-header">
          <span class="hw dhw">plant</span>
          <span class="pos dpos">noun</span>
          <span class="uk dpron-i"><span class="region dreg">uk</span><span class="pron dpron">/<span class="ipa dipa">plɑːnt</span>/</span></span>
        </div>
        <div class="pos-body">
          <div class="def-block ddef_block">
            <div class="def ddef_d">a living thing that grows in earth:</div>
          </div>
        </div>
      </div>
    </body></html>
  `;
  const ukOnlyCam = parseCambridgeHtml(
    ukOnlyHtml,
    'https://dictionary.cambridge.org/dictionary/english/plant',
    'plant',
  );
  assert.equal(ukOnlyCam.entries[0].usIpa, undefined);
  assert.equal(ukOnlyCam.entries[0].ukIpa, 'plɑːnt');
  const adaptedUkOnly = adaptEnglishLookup(
    'plant',
    { word: 'plant', sourceUrl: '', entries: [] },
    ukOnlyCam,
  );
  assert.equal(adaptedUkOnly.readings.length, 1);
  assert.equal(adaptedUkOnly.readings[0].label, 'UK');
  assert.equal(adaptedUkOnly.readings[0].reading, 'plɑːnt');

  // Verify real Cambridge AMP structure (cald4 + cacd + nested <span class="sp dsp"> + .runon + injected .ass-pick-def-btn)
  const cambridgeRealHtml = `
    <html><body>
      <div class="pr dictionary" data-id="cald4">
        <div class="pr entry-body__el">
          <div class="pos-header dpos-h">
            <div class="di-title"><span class="headword hdb tw-bw dhw dpos-h_hw "><span class="hw dhw">beautiful</span></span></div>
            <div class="posgram dpos-g hdib lmr-5"><span class="pos dpos">adjective</span></div>
            <span class="uk dpron-i "><span class="region dreg">uk</span><span class="daud"><audio id="audio1"><source type="audio/mpeg" src="/media/english/uk_pron/u/ukb/ukbea/ukbeau_009.mp3"></audio></span><span class="pron dpron">/<span class="ipa dipa lpr-2 lpl-1">ˈbjuː.tɪ.f<span class="sp dsp">ə</span>l</span>/</span></span>
            <span class="us dpron-i "><span class="region dreg">us</span><span class="daud"><audio id="audio2"><source type="audio/mpeg" src="/media/english/us_pron/e/eus/eus70/eus70469.mp3"></audio></span><span class="pron dpron">/<span class="ipa dipa lpr-2 lpl-1">ˈbjuː.t̬ə.f<span class="sp dsp">ə</span>l</span>/</span></span>
          </div>
          <div class="pos-body">
            <div class="pr dsense dsense-noh">
              <div class="def-block ddef_block">
                <div class="def-info"><span class="epp-xref">A1</span></div>
                <div class="def ddef_d db">very attractive:<button class="ass-pick-def-btn">+ Chọn vào Anki</button></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="pr dictionary" data-id="cacd">
        <div class="pr entry-body__el">
          <div class="pos-header dpos-h">
            <div class="di-title"><span class="headword hdb tw-bw dhw dpos-h_hw "><span class="hw dhw">beautiful</span></span></div>
            <div class="posgram dpos-g hdib lmr-5"><span class="pos dpos">adjective</span></div>
            <span class="us dpron-i "><span class="region dreg">us</span><span class="pron dpron">/<span class="ipa dipa lpr-2 lpl-1">ˈbju·t̬ɪ·fəl</span>/</span></span>
          </div>
          <div class="pos-body">
            <div class="pr dsense dsense-noh">
              <div class="def-block ddef_block">
                <div class="def ddef_d db">having an attractive quality:</div>
              </div>
            </div>
            <div class="pr runon drunon">
              <span class="runon-head drunon-head">
                <h3 class="runon-title drunon-title"><span class="w dw">beautifully</span></h3>
                <div class="pos-header dpos-h">
                  <span class="pos dpos">adverb</span>
                  <span class="us dpron-i "><span class="region dreg">us</span><span class="pron dpron">/<span class="ipa dipa">ˈbju·t̬ɪ·fli</span>, <span class="ipa dipa">-fə·li</span>/</span></span>
                </div>
              </span>
            </div>
          </div>
        </div>
      </div>
    </body></html>
  `;

  const realParsed = parseCambridgeHtml(
    cambridgeRealHtml,
    'https://dictionary.cambridge.org/dictionary/english/beautiful',
    'beautiful',
  );
  assert.equal(realParsed.entries.length, 2);
  assert.equal(realParsed.entries[0].usIpa, 'ˈbjuː.t̬ə.fəl');
  assert.equal(realParsed.entries[0].ukIpa, 'ˈbjuː.tɪ.fəl');
  assert.equal(realParsed.entries[0].blocks[0].senses[0].definition, 'very attractive');
  assert.equal(realParsed.entries[1].usIpa, 'ˈbju·t̬ɪ·fəl');
  assert.equal(realParsed.entries[1].ukIpa, undefined);
  assert.equal(realParsed.audios?.length, 2);
  assert.equal(realParsed.audios?.[0].region, 'uk');
  assert.equal(
    realParsed.audios?.[0].url,
    'https://dictionary.cambridge.org/media/english/uk_pron/u/ukb/ukbea/ukbeau_009.mp3',
  );
  assert.equal(realParsed.audios?.[1].region, 'us');
  assert.equal(
    realParsed.audios?.[1].url,
    'https://dictionary.cambridge.org/media/english/us_pron/e/eus/eus70/eus70469.mp3',
  );

  // Verify Cambridge Learner's Dictionary (cld) DOM structure (.di.superentry > .di-head + .di-body > .entry > .dsense)
  const learnerHtml = `
    <html><body>
      <div class="pr dictionary" data-id="cld">
        <div class="pr di superentry">
          <div class="di-head"><div class="di-title"><h2 class="hw dhw">eager</h2></div></div>
          <div class="di-body">
            <div class="entry">
              <div class="pos-header dpos-h">
                <div class="posgram dpos-g"><span class="pos dpos">adjective</span></div>
                <span class="uk dpron-i"><span class="region dreg">uk</span><span class="pron dpron">/<span class="ipa dipa">ˈiː.ɡər</span>/</span></span>
                <span class="us dpron-i"><span class="region dreg">us</span><span class="pron dpron">/<span class="ipa dipa">ˈiː.ɡɚ</span>/</span></span>
              </div>
              <div class="pos-body">
                <div class="dsense">
                  <h3 class="dsense_h"><span class="guideword"><span>WANTING</span></span></h3>
                  <div class="def-block">
                    <span class="def-info"><span class="epp-xref">B2</span></span>
                    <div class="def">wanting to do or have something very much:</div>
                    <div class="examp"><span class="eg">She was eager to get started.</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </body></html>
  `;
  const learnerParsed = parseCambridgeHtml(
    learnerHtml,
    'https://dictionary.cambridge.org/dictionary/learner-english/eager',
    'eager',
  );
  assert.equal(learnerParsed.entries.length, 1);
  assert.equal(learnerParsed.entries[0].headword, 'eager');
  assert.equal(learnerParsed.entries[0].pos, 'adjective');
  assert.equal(learnerParsed.entries[0].usIpa, 'ˈiː.ɡɚ');
  assert.equal(learnerParsed.entries[0].ukIpa, 'ˈiː.ɡər');
  assert.equal(learnerParsed.entries[0].blocks[0].guideword, 'WANTING');
  assert.equal(
    learnerParsed.entries[0].blocks[0].senses[0].definition,
    'wanting to do or have something very much',
  );
  assert.equal(
    learnerParsed.entries[0].blocks[0].senses[0].examples[0],
    'She was eager to get started.',
  );

  // Even if legacy Oxford cache had UK-only IPA with slashes, Cambridge US & UK are still merged cleanly
  const adaptedWithLegacyOx = adaptEnglishLookup(
    'beautiful',
    {
      word: 'beautiful',
      sourceUrl: '',
      entries: [
        {
          id: 'ox_legacy',
          headword: 'beautiful',
          pos: 'adjective',
          usIpa: '',
          ukIpa: '/ˈbjuːtɪfl/',
          sourceUrl: '',
        },
      ],
    },
    realParsed,
    { preferSource: 'cambridge' },
  );
  assert.equal(adaptedWithLegacyOx.readings[0].label, 'US');
  assert.equal(adaptedWithLegacyOx.readings[0].reading, 'ˈbjuː.t̬ə.fəl');
  assert.ok(
    adaptedWithLegacyOx.readings.some((r) => r.label === 'UK' && r.reading === 'ˈbjuː.tɪ.fəl'),
  );
});

test('parseWeblioHtml extracts 読み方, Japanese POS, definitions, expanded examples, and Furigana while filtering Wikipedia noise', () => {
  const sampleHtml = `
    <html><body>
      <div class="kijiWrp">
        <div class="kiji">
          <h2 class="midashigo" title="食べる">た・べる【食べる】</h2>
          <div class="Sgkdj">
            <p style="padding-bottom: 10px;"><!--AVOID_CROSSLINK-->読み方：たべる<!--/AVOID_CROSSLINK--></p>
            <p><span class="hinshi">［動バ下一］</span>［文］た・ぶ</p>
            <p><b>１</b> 食物をかんで、のみこむ。「生(なま)で―・べる」「ひと口―・べてみる」</p>
            <p><b>２</b> 暮らしを立てる。生活する。「なんとか―・べていくくらいの蓄えはある」</p>
            <p>[補説] 補足テキスト</p>
          </div>
        </div>
      </div>
      <div class="kijiWrp">
        <div class="kiji">
          <h2 class="midashigo" title="食べる">食べる</h2>
          <div class="Wkpja"><p>Wikipedia noise should be skipped</p></div>
        </div>
      </div>
    </body></html>
  `;

  const res = parseWeblioHtml(sampleHtml, 'https://www.weblio.jp/content/%E9%A3%9F%E3%81%B9%E3%82%8B', '食べる');
  assert.equal(res.lang, 'ja');
  assert.equal(res.readings.length, 1);
  assert.equal(res.readings[0].reading, 'たべる');
  assert.equal(res.readings[0].autoFields?.furigana, '食[た]べる');
  assert.equal(res.entries.length, 1);
  assert.equal(res.entries[0].sourceName, 'デジタル大辞泉');
  assert.equal(res.entries[0].pos, '動バ下一');
  assert.equal(res.entries[0].blocks[0].senses.length, 2);
  assert.equal(
    res.entries[0].blocks[0].senses[0].definition,
    '食物をかんで、のみこむ。「生(なま)で―・べる」「ひと口―・べてみる」',
  );
  assert.deepEqual(res.entries[0].blocks[0].senses[0].examples, []);

  assert.equal(buildJapaneseFurigana('台風', 'たいふう'), '台風[たいふう]');
  assert.equal(buildJapaneseFurigana('美しい', 'うつくしい'), '美[うつく]しい');
  assert.equal(buildJapaneseFurigana('お願い', 'おねがい'), 'お願[ねが]い');
  assert.equal(buildJapaneseFurigana('コスパ', 'こすぱ'), '');
});

test('stripHtmlToPlainText removes HTML formatting and optional bullets/quotes', () => {
  const dirty =
    '<p style="color:red">• &ldquo;<b>She</b> is <i>very</i>&nbsp;resilient.&rdquo;</p>';
  assert.equal(stripHtmlToPlainText(dirty, true), 'She is very resilient.');

  const grokSelection = '- "The team proved remarkably resilient under pressure."  ';
  assert.equal(
    stripHtmlToPlainText(grokSelection, true),
    'The team proved remarkably resilient under pressure.',
  );
});

test('formatPosForAnki supports full, short, abbr formats and guideword annotations', () => {
  assert.equal(formatPosForAnki('adjective', 'full'), 'adjective');
  assert.equal(formatPosForAnki('adjective', 'short'), 'adj.');
  assert.equal(formatPosForAnki('adjective', 'abbr'), 'adj');

  assert.equal(formatPosWithGuideword('verb', ['MOVE/TRAVEL']), 'verb (move/travel)');
  assert.equal(
    formatPosWithGuideword('verb (old)', ['MOVE/TRAVEL', 'Free Dictionary API (Fallback)']),
    'verb (move/travel)',
  );
  assert.equal(stripPosGuideword('verb (move/travel)'), 'verb');
  assert.equal(normalizePos('verb (move/travel)'), 'verb');
  assert.equal(formatPosForAnki('verb (move/travel)', 'full'), 'verb (move/travel)');
  assert.equal(formatPosForAnki('verb (move/travel)', 'short'), 'v. (move/travel)');
  assert.equal(formatPosForAnki('verb (move/travel)', 'abbr'), 'v (move/travel)');
});

test('scanDownloadsAudio detects ElevenLabs files newest-first and ignores partial downloads', () => {
  assert.equal(isAudioFilename('ElevenLabs_Mark.mp3'), true);
  assert.equal(isAudioFilename('ElevenLabs_Mark.mp3.crdownload'), false);
  assert.equal(isElevenLabsFilename('ElevenLabs_2026-11-21_Mark.mp3'), true);
  assert.equal(isElevenLabsFilename('random_song.mp3'), false);
  assert.equal(isCambridgeFilename('Cambridge_beautiful_US_2.mp3'), true);
  assert.equal(isCambridgeFilename('ElevenLabs_Mark.mp3'), false);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ass-dl-test-'));
  try {
    const oldFile = path.join(tmpDir, 'ElevenLabs_2026-11-21_old.mp3');
    const longName =
      'ElevenLabs_2026-11-21T13_45_10_Mark - Natural Conversations_pvc_s50_sb75_se0_b_m2_extra_long_filename.mp3';
    const newFile = path.join(tmpDir, longName);
    const otherFile = path.join(tmpDir, 'voice_note.mp3');
    const camFile = path.join(tmpDir, 'Cambridge_beautiful_US_2.mp3');
    const partialFile = path.join(tmpDir, 'ElevenLabs_downloading.mp3.crdownload');

    fs.writeFileSync(oldFile, Buffer.from('old-audio'));
    fs.writeFileSync(newFile, Buffer.from('new-audio'));
    fs.writeFileSync(otherFile, Buffer.from('other-audio'));
    fs.writeFileSync(camFile, Buffer.from('cambridge-audio'));
    fs.writeFileSync(partialFile, Buffer.from('partial'));

    const now = Date.now() / 1000;
    fs.utimesSync(oldFile, now - 60, now - 60);
    fs.utimesSync(newFile, now - 5, now - 5);
    fs.utimesSync(camFile, now - 2, now - 2);
    fs.utimesSync(otherFile, now - 1, now - 1);

    const elOnly = scanDownloadsAudio(tmpDir, { filterMode: 'elevenlabs_only', maxFiles: 10 });
    assert.equal(elOnly.files.length, 2);
    assert.equal(elOnly.files[0].filename, longName);
    assert.equal(elOnly.files[0].id.length, 16);
    assert.equal(elOnly.files[1].filename, 'ElevenLabs_2026-11-21_old.mp3');

    const camOnly = scanDownloadsAudio(tmpDir, { filterMode: 'cambridge_audio', maxFiles: 10 });
    assert.equal(camOnly.files.length, 1);
    assert.equal(camOnly.files[0].filename, 'Cambridge_beautiful_US_2.mp3');
    assert.equal(camOnly.files[0].isCambridge, true);

    const resolved = resolveDownloadAudioPath(tmpDir, elOnly.files[0].id);
    assert.ok(resolved);
    assert.equal(resolved.filename, longName);

    const allAudio = scanDownloadsAudio(tmpDir, { filterMode: 'all_audio', maxFiles: 10 });
    assert.equal(allAudio.files.length, 4);
    assert.equal(allAudio.files[0].filename, 'voice_note.mp3');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('sanitizeAnkiBoldText preserves bold tags while stripping unsafe HTML and cleanTextForTts strips all bold', () => {
  const raw = '<span style="color:red">She is <b>resilient</b> and **strong**.</span>\nLine 2';
  assert.equal(
    sanitizeAnkiBoldText(raw, true),
    'She is <b>resilient</b> and <b>strong</b>.<br>Line 2',
  );
  assert.equal(cleanTextForTts('She is <b>resilient</b> and **strong**.'), 'She is resilient and strong.');
});

test('LocalSecretVault encrypts, persists, reads, masks, and deletes API keys cleanly', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ass-vault-test-'));
  try {
    const vault = new LocalSecretVault(tmpDir);
    const sampleKey = 'sk-proj-1234567890abcdefXYZ9';
    vault.set('openai_api_key', `"${sampleKey}"\n`);

    // Encrypted file should not store plaintext key
    const rawEnc = fs.readFileSync(path.join(tmpDir, 'vault.enc'), 'utf-8');
    assert.equal(rawEnc.includes(sampleKey), false);

    // Re-instantiating vault reads persisted secret cleanly
    const vault2 = new LocalSecretVault(tmpDir);
    assert.equal(vault2.get('openai_api_key'), sampleKey);
    assert.equal(maskSecretKey(sampleKey), 'sk-proj-12••••XYZ9');

    vault2.delete('openai_api_key');
    assert.equal(vault2.get('openai_api_key'), '');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('compressImageAdaptive v2 strips opaque alpha, classifies graphic vs photo (quantized + coverage), caps 2D LANCZOS, supports BMP & size guard', async () => {
  // 1. Opaque RGBA graphic (2 solid colors, alpha=255 everywhere) -> strip alpha, graphic=true, WebP lossless
  const gWidth = 400;
  const gHeight = 300;
  const opaqueGraphicRaw = Buffer.alloc(gWidth * gHeight * 4);
  for (let y = 0; y < gHeight; y++) {
    for (let x = 0; x < gWidth; x++) {
      const i = (y * gWidth + x) * 4;
      const isBand = y % 20 < 10;
      opaqueGraphicRaw[i] = isBand ? 255 : 20;
      opaqueGraphicRaw[i + 1] = isBand ? 255 : 40;
      opaqueGraphicRaw[i + 2] = isBand ? 255 : 80;
      opaqueGraphicRaw[i + 3] = 255;
    }
  }
  const opaqueGraphicPng = await sharp(opaqueGraphicRaw, {
    raw: { width: gWidth, height: gHeight, channels: 4 },
  })
    .png({ compressionLevel: 0 })
    .toBuffer();

  const resGraphic = await compressImageAdaptive(opaqueGraphicPng);
  assert.equal(resGraphic.strippedAlpha, true);
  assert.equal(resGraphic.isGraphic, true);
  assert.equal(resGraphic.encodingMode, 'lossless');
  assert.ok(resGraphic.topColorCoverage >= 0.99);
  assert.equal(resGraphic.resized, false);
  assert.equal(resGraphic.keptOriginal, false);
  assert.equal(resGraphic.extension, 'webp');
  assert.ok(resGraphic.finalSizeBytes < resGraphic.originalSizeBytes);
  const resGraphicMeta = await sharp(resGraphic.compressedBytes).metadata();
  assert.equal(resGraphicMeta.hasAlpha, false);
  assert.equal(resGraphicMeta.width, gWidth);

  // 2. Truly transparent RGBA graphic (alpha=0 pixel) -> keep alpha
  opaqueGraphicRaw[3] = 0;
  const transparentPng = await sharp(opaqueGraphicRaw, {
    raw: { width: gWidth, height: gHeight, channels: 4 },
  })
    .png({ compressionLevel: 0 })
    .toBuffer();
  const resTransparent = await compressImageAdaptive(transparentPng);
  assert.equal(resTransparent.strippedAlpha, false);
  assert.equal(resTransparent.isGraphic, true);
  const resTransparentMeta = await sharp(resTransparent.compressedBytes).metadata();
  assert.equal(resTransparentMeta.hasAlpha, true);

  // 3. Large photographic image (1600x800, noisy multi-color) -> isGraphic=false, resize to 1200x600 (default photo cap), WebP lossy
  const pWidth = 1600;
  const pHeight = 800;
  const photoRaw = Buffer.alloc(pWidth * pHeight * 3);
  let seed = 0x12345678;
  for (let y = 0; y < pHeight; y++) {
    for (let x = 0; x < pWidth; x++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const i = (y * pWidth + x) * 3;
      photoRaw[i] = (seed >>> 16) & 255;
      photoRaw[i + 1] = (seed >>> 8) & 255;
      photoRaw[i + 2] = seed & 255;
    }
  }
  const photoPng = await sharp(photoRaw, {
    raw: { width: pWidth, height: pHeight, channels: 3 },
  })
    .png({ compressionLevel: 1 })
    .toBuffer();

  const resPhoto = await compressImageAdaptive(photoPng);
  assert.equal(resPhoto.isGraphic, false);
  assert.equal(resPhoto.encodingMode, 'lossy');
  assert.ok(resPhoto.uniqueColors > 1200);
  assert.equal(resPhoto.resized, true);
  assert.equal(resPhoto.keptOriginal, false);
  assert.equal(resPhoto.extension, 'webp');
  assert.ok(resPhoto.finalSizeBytes < resPhoto.originalSizeBytes);
  const resPhotoMeta = await sharp(resPhoto.compressedBytes).metadata();
  assert.equal(resPhotoMeta.width, 1200);
  assert.equal(resPhotoMeta.height, 600);

  // 4. Portrait / tall screenshot (900x2800 graphic) -> 2D fit:inside caps height to 1400 (450x1400)
  const tallPng = await sharp({
    create: { width: 900, height: 2800, channels: 3, background: { r: 245, g: 247, b: 250 } },
  })
    .png({ compressionLevel: 0 })
    .toBuffer();
  const resTall = await compressImageAdaptive(tallPng);
  assert.equal(resTall.isGraphic, true);
  assert.equal(resTall.resized, true);
  const resTallMeta = await sharp(resTall.compressedBytes).metadata();
  assert.equal(resTallMeta.height, 1400);
  assert.equal(resTallMeta.width, 450);

  // 5. 24-bit uncompressed BMP input -> decoded & compressed to WebP
  const bmpW = 64;
  const bmpH = 64;
  const rowStride = bmpW * 3;
  const pixelBytes = rowStride * bmpH;
  const bmpBuf = Buffer.alloc(54 + pixelBytes);
  bmpBuf.write('BM', 0, 'ascii');
  bmpBuf.writeUInt32LE(bmpBuf.length, 2);
  bmpBuf.writeUInt32LE(54, 10);
  bmpBuf.writeUInt32LE(40, 14);
  bmpBuf.writeInt32LE(bmpW, 18);
  bmpBuf.writeInt32LE(bmpH, 22);
  bmpBuf.writeUInt16LE(1, 26);
  bmpBuf.writeUInt16LE(24, 28);
  bmpBuf.writeUInt32LE(0, 30);
  bmpBuf.writeUInt32LE(pixelBytes, 34);
  bmpBuf.fill(0xaa, 54);

  const resBmp = await compressImageAdaptive(bmpBuf);
  assert.equal(resBmp.extension, 'webp');
  assert.equal(resBmp.isGraphic, true);
  assert.equal(resBmp.keptOriginal, false);
  assert.ok(resBmp.finalSizeBytes < bmpBuf.length);

  // 6. Safety size guard: deeply compressed small JPG returns exact original bytes & 'jpg' extension
  const smallPhotoRaw = Buffer.alloc(120 * 120 * 3);
  let smallSeed = 0xabcdef01;
  for (let i = 0; i < smallPhotoRaw.length; i += 3) {
    smallSeed = (Math.imul(smallSeed, 1664525) + 1013904223) >>> 0;
    smallPhotoRaw[i] = (smallSeed >>> 16) & 255;
    smallPhotoRaw[i + 1] = (smallSeed >>> 8) & 255;
    smallPhotoRaw[i + 2] = smallSeed & 255;
  }
  const smallLowQJp = await sharp(smallPhotoRaw, {
    raw: { width: 120, height: 120, channels: 3 },
  })
    .jpeg({ quality: 20 })
    .toBuffer();

  const resGuard = await compressImageAdaptive(smallLowQJp);
  assert.equal(resGuard.keptOriginal, true);
  assert.equal(resGuard.encodingMode, 'original');
  assert.equal(resGuard.extension, 'jpg');
  assert.equal(Buffer.compare(resGuard.compressedBytes, smallLowQJp), 0);
});
