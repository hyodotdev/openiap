import type { ReactElement, ReactNode } from 'react';
import { StaticExamplesContext } from '../hooks/useStaticExamples';

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
