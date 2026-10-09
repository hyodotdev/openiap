import { mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = `${root}/server/generated`;
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const entry of ['auth', 'showcase']) {
  const result = await Bun.build({
    entrypoints: [`${root}/server/endpoints/${entry}.ts`],
    target: 'node',
    format: 'esm',
    minify: true,
    env: 'disable',
  });
  if (!result.success)
    throw new AggregateError(result.logs, 'Showcase API build failed');
  const source = await result.outputs[0].text();
  await writeFile(`${output}/${entry}.mjs`, source);
}
console.log('Bundled showcase APIs for the Vercel Node runtime.');
