import expect from 'expect';
import sinon from 'sinon';
const fs = require('fs');
const path = require('path');

const exampleFetch = fs.readFileSync(path.resolve(__dirname, './assets/netflix/fetch-en-cc.txt'));

let detectedLanguage = 'en';
window.DC.translate = sinon.stub().returns(
  Promise.resolve({
    text: 'Used Google Translate',
    from: {
      language: {
        iso: detectedLanguage
      }
    }
  })
);

sinon.stub(window, 'fetch')
  .returns(
    Promise.resolve({
      ok: true,
      text: () => {
        return Promise.resolve(exampleFetch)
      }
    })
  );

import './chrome-mock';
import '../../public/content-scripts/init/init';
import '../../public/content-scripts/init/translation-queue';
import '../../public/content-scripts/init/adapter';
import '../../public/content-scripts/netflix/adapter';
import '../../public/content-scripts/init/parser';
import '../../public/content-scripts/netflix/parser';
import '../../public/content-scripts/init/provider';
import '../../public/content-scripts/init/processor';

const adapter = window.DC.adapter;
const parser = window.DC.parser;
const provider = window.DC.provider;
const processor = window.DC.processor;
const queue = window.DC.translationQueue;

sinon.stub(adapter, 'getVideoId').returns('test-video-id');

it('should fetch, parse, guess language, and load captions on caption request', done => {
  // Spies
  sinon.spy(processor, 'fetchUrl');
  sinon.spy(parser, 'parse');
  sinon.spy(processor, '_guessLanguageOfCaptions');
  sinon.spy(provider, '__loadCaptions');

  // Stub TranslationQueue.addToQueue()
  sinon.stub(queue, 'addToQueue').returns(Promise.resolve('jp'));

  const testCaptionUrl = 'some-netflix-caption-url';
  processor._onMessage({
    type: 'process-caption-request',
    payload: testCaptionUrl
  }, null, response => {
    expect(response).toEqual({ ok: true });
    expect(processor.fetchUrl.called).toEqual(true);
    expect(parser.parse.called).toEqual(true);
    expect(processor._guessLanguageOfCaptions.called).toEqual(true);
    expect(provider.__loadCaptions.called).toEqual(true);

    // Clean up
    processor.fetchUrl.restore();
    parser.parse.restore();
    processor._guessLanguageOfCaptions.restore();
    provider.__loadCaptions.restore();
    queue.addToQueue.restore();

    done();
  });
});

it('should correctly _guessLanguageOfCaptions', done => {
  // FIXME: Use actual captions from tests/assets/netflix
  const captionsToGuess = [
    {
      startTime: 10,
      endTime: 7000,
      text: 'Météo'
    }, {
      startTime: 9000,
      endTime: 12000,
      text: 'Il fait beau aujourd\'hui.'
    }, {
      startTime: 15000,
      endTime: 19000,
      text: 'Il va pleuvoir ce week-end.'
    }, {
      startTime: 20000,
      endTime: 23000,
      text: 'La semaine prochaine...'
    }
  ];

  // Stubs
  sinon.stub(processor, '_guessLanguage').returns(Promise.resolve('fr'));

  processor._guessLanguageOfCaptions(captionsToGuess)
    .then(result => {
      const { captions, language } = result;
      expect(language).toEqual('fr');
      // Should guess with the longest caption
      expect(processor._guessLanguage.calledWith('Il va pleuvoir ce week-end.')).toEqual(true);

      // Clean up
      processor._guessLanguage.restore();
      done();
    });
});

it('should correctly _guessLanguage', done => {
  sinon.stub(queue, 'addToQueue').returns(Promise.resolve('jp'));
  processor._guessLanguage('Some text')
    .then(language => {
      expect(language).toEqual('jp');
      queue.addToQueue.restore();
      done();
    });
});
