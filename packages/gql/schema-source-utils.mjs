export const normalizeSchemaSources = (sources) =>
  [...sources].map((source, index) => (typeof source === 'string' ? { sourceId: `<schema:${index + 1}>`, sdl: source } : source));

/**
 * Collect real GraphQL comments while excluding `#` text inside quoted and
 * block-string values. Position metadata lets marker consumers distinguish a
 * standalone directive comment from an invalid trailing comment.
 */
export const collectGraphQLComments = (sdl) => {
  const comments = [];
  let index = 0;
  let line = 1;
  let lineStart = 0;

  const advance = () => {
    const character = sdl[index];
    index += 1;
    if (character === '\n') {
      line += 1;
      lineStart = index;
    }
    return character;
  };

  while (index < sdl.length) {
    if (sdl.startsWith('"""', index)) {
      advance();
      advance();
      advance();
      while (index < sdl.length) {
        if (sdl.startsWith('"""', index) && (index === 0 || sdl[index - 1] !== '\\')) {
          advance();
          advance();
          advance();
          break;
        }
        advance();
      }
      continue;
    }

    if (sdl[index] === '"') {
      advance();
      while (index < sdl.length) {
        const character = advance();
        if (character === '\\' && index < sdl.length) {
          advance();
        } else if (character === '"') {
          break;
        }
      }
      continue;
    }

    if (sdl[index] === '#') {
      const start = index;
      const commentLine = line;
      const column = start - lineStart + 1;
      while (index < sdl.length && sdl[index] !== '\n' && sdl[index] !== '\r') {
        advance();
      }
      comments.push({
        column,
        line: commentLine,
        standalone: /^\s*$/.test(sdl.slice(lineStart, start)),
        text: sdl.slice(start, index),
      });
      continue;
    }

    advance();
  }

  return comments;
};
