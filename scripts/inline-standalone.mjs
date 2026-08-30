import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outputDirectory = join(projectRoot, 'standalone-dist');
const sourceHtml = await readFile(join(outputDirectory, 'index.html'), 'utf8');

const stylesheetMatch = sourceHtml.match(
  /<link rel="stylesheet" crossorigin href="\.\/(assets\/[^"]+\.css)">/,
);
const scriptMatch = sourceHtml.match(
  /<script type="module" crossorigin src="\.\/(assets\/[^"]+\.js)"><\/script>/,
);

if (!stylesheetMatch || !scriptMatch) {
  throw new Error(
    'Die gebauten Picture-MultiCompare-Dateien konnten nicht eingebettet werden.',
  );
}

const [stylesheet, script] = await Promise.all([
  readFile(join(outputDirectory, stylesheetMatch[1]), 'utf8'),
  readFile(join(outputDirectory, scriptMatch[1]), 'utf8'),
]);

export function composeStandaloneHtml(
  html,
  stylesheetTag,
  scriptTag,
  stylesheetContent,
  scriptContent,
) {
  const htmlWithStyles = html.replace(
    stylesheetTag,
    () =>
      `<style>${stylesheetContent.replaceAll('</style', '<\\/style')}</style>`,
  );
  const htmlWithoutScriptTag = htmlWithStyles
    .replace(scriptTag, '')
    .replace(/^[\t ]+$/gm, '');
  const inlineScript = `<script>${scriptContent.replaceAll(
    '</script',
    '<\\/script',
  )}</script>`;

  return htmlWithoutScriptTag.replace(
    '</body>',
    () => `${inlineScript}\n  </body>`,
  );
}

const standaloneHtml = composeStandaloneHtml(
  sourceHtml,
  stylesheetMatch[0],
  scriptMatch[0],
  stylesheet,
  script,
);

if (
  standaloneHtml.includes(stylesheetMatch[0]) ||
  standaloneHtml.includes(scriptMatch[0])
) {
  throw new Error(
    'Picture MultiCompare enthält noch Verweise auf externe Build-Dateien.',
  );
}

await writeFile(
  join(outputDirectory, 'Picture-MultiCompare.html'),
  standaloneHtml,
  'utf8',
);
