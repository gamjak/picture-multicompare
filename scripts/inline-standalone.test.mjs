import { describe, expect, it } from 'vitest';

import * as standalone from './inline-standalone.mjs';

describe('standalone HTML composition', () => {
  it('exposes the HTML composition as a testable transformation', () => {
    expect(standalone.composeStandaloneHtml).toBeTypeOf('function');
  });

  it('places the executable bundle after the root element', () => {
    const scriptTag =
      '<script type="module" crossorigin src="./assets/app.js"></script>';
    const stylesheetTag =
      '<link rel="stylesheet" crossorigin href="./assets/app.css">';
    const sourceHtml = `<!doctype html><html><head>${scriptTag}${stylesheetTag}</head><body><div id="root"></div></body></html>`;

    const html = standalone.composeStandaloneHtml(
      sourceHtml,
      stylesheetTag,
      scriptTag,
      'body { color: white; }',
      'window.__started = true;',
    );

    expect(html.indexOf('<div id="root"></div>')).toBeLessThan(
      html.indexOf('<script>'),
    );
  });

  it('does not leave indentation behind when moving the script', () => {
    const scriptTag =
      '<script type="module" crossorigin src="./assets/app.js"></script>';
    const stylesheetTag =
      '<link rel="stylesheet" crossorigin href="./assets/app.css">';
    const sourceHtml = `<head>\n    ${scriptTag}\n    ${stylesheetTag}\n  </head><body><div id="root"></div></body>`;

    const html = standalone.composeStandaloneHtml(
      sourceHtml,
      stylesheetTag,
      scriptTag,
      '',
      '',
    );

    expect(html).not.toMatch(/^[\t ]+$/m);
  });
});
