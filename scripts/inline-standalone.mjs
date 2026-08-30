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
    'Die gebauten Vierblick-Dateien konnten nicht eingebettet werden.',
  );
}

const [stylesheet, script] = await Promise.all([
  readFile(join(outputDirectory, stylesheetMatch[1]), 'utf8'),
  readFile(join(outputDirectory, scriptMatch[1]), 'utf8'),
]);

const standaloneHtml = sourceHtml
  .replace(
    stylesheetMatch[0],
    () => `<style>${stylesheet.replaceAll('</style', '<\\/style')}</style>`,
  )
  .replace(
    scriptMatch[0],
    () => `<script>${script.replaceAll('</script', '<\\/script')}</script>`,
  );

if (
  standaloneHtml.includes(stylesheetMatch[0]) ||
  standaloneHtml.includes(scriptMatch[0])
) {
  throw new Error('Vierblick enthält noch Verweise auf externe Build-Dateien.');
}

await writeFile(
  join(outputDirectory, 'Vierblick.html'),
  standaloneHtml,
  'utf8',
);
