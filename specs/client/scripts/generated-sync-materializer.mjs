import { postProcessKotlinSource } from './kotlin-platform-postprocess.mjs';

const MODE_HANDLERS = Object.freeze({
  copy: (source) => source,
  // Node ESM needs .js paths; Metro and Jest resolve the mirrored TypeScript.
  'typescript-bundler': (source) => source.replace(/(from\s+["']\.{1,2}\/[^"']+)\.js(["'])/gu, '$1$2'),
  'google-kotlin': (source) => postProcessKotlinSource(source, 'google'),
  'kmp-kotlin': (source) => postProcessKotlinSource(source, 'kmp'),
});

export function materializeGeneratedSyncEdge(edge, source) {
  const handler = MODE_HANDLERS[edge.mode];
  if (!handler) {
    throw new Error(`Unknown sync mode "${edge.mode}" for ${edge.groupName}.${edge.targetName}`);
  }
  return handler(source);
}
