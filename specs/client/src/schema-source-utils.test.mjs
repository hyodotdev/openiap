import { describe, expect, it } from 'vitest';
import { collectGraphQLComments } from '../schema-source-utils.mjs';

describe('GraphQL source comment scanner', () => {
  it('ignores comment-shaped text inside quoted and block-string values', () => {
    const source = String.raw`"# => Union with an escaped quote: \" and # Future"
type Plain {
  value: String
}

"""
Escaped block delimiter: \"""
# @deprecated This remains description text.
"""
type AlsoPlain {
  value: String
}

# Future
extend type Query {
  currentValue: String
}
`;

    expect(collectGraphQLComments(source)).toEqual([
      {
        column: 1,
        line: 14,
        standalone: true,
        text: '# Future',
      },
    ]);
  });

  it('reports trailing comments with exact placement metadata', () => {
    expect(collectGraphQLComments('type Result { value: String } # => Union\n')).toEqual([
      {
        column: 31,
        line: 1,
        standalone: false,
        text: '# => Union',
      },
    ]);
  });
});
