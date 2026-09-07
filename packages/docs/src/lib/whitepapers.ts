export interface Whitepaper {
  id: string;
  title: string;
  version: string;
  date: string;
  href: string;
  source: string;
  summary: string;
  scope: string;
}

export const COMMERCE_WHITEPAPER: Whitepaper = {
  id: 'commerce-protocol-rationale',
  title: 'Why the Commerce Protocol Draws Its Boundaries Where It Does',
  version: '1.1',
  date: '7 September 2026',
  href: '/commerce-protocol-rationale.pdf',
  source:
    'https://github.com/hyodotdev/openiap/blob/main/specs/commerce-protocol/DESIGN.md',
  summary:
    'A design paper connecting purchase verification, account ownership, lifecycle state, and current access. It explains the trust boundaries, then develops a provider architecture, persistence model, processing and recovery paths, and an implementation acceptance plan.',
  scope:
    'Design rationale and a non-normative implementation blueprint for server engineers. Protocol 1.0 remains unchanged. No empirical performance result or independent interoperability claim is made; this paper has not been peer reviewed.',
};

export const WHITEPAPERS: Whitepaper[] = [COMMERCE_WHITEPAPER];
