const { TestEnvironment } = require('jest-environment-jsdom');

/**
 * jsdom lacks the Fetch API and text encoding globals that React Router's data router uses;
 * expose Node's implementations to the test realm.
 */
class JsdomWithFetchEnvironment extends TestEnvironment {
  constructor(config, context) {
    super(config, context);
    for (const name of [
      'Request',
      'Response',
      'Headers',
      'AbortController',
      'AbortSignal',
      'ReadableStream',
      'TextEncoder',
      'TextDecoder',
    ]) {
      this.global[name] = globalThis[name];
    }
  }
}

module.exports = JsdomWithFetchEnvironment;
