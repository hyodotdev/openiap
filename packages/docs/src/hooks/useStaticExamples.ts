import { createContext, useContext } from 'react';

// Nested tabs share one fallback so noscript elements never nest.
export const StaticExamplesContext = createContext(false);

export function useStaticExamples(): boolean {
  return useContext(StaticExamplesContext);
}
