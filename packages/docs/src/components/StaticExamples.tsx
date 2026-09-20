import {
  createContext,
  useContext,
  type ReactElement,
  type ReactNode,
} from 'react';

// Nested tabs share one fallback so noscript elements never nest.
const StaticExamplesContext = createContext(false);

export function useStaticExamples(): boolean {
  return useContext(StaticExamplesContext);
}

export default function StaticExamples({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  return (
    <noscript>
      <StaticExamplesContext.Provider value={true}>
        {children}
      </StaticExamplesContext.Provider>
    </noscript>
  );
}
