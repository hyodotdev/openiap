import { postProcessKotlinSource } from './kotlin-platform-postprocess.mjs';

const MODE_HANDLERS = Object.freeze({
  copy: (source) => source,
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
