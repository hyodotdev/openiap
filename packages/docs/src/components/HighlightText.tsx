import type { ReactNode } from 'react';

interface HighlightTextProps {
  children: ReactNode;
}

function HighlightText({ children }: HighlightTextProps) {
  return (
    <p
      style={{
        backgroundColor: 'rgba(234, 179, 8, 0.15)',
        color: 'var(--text-primary)',
        padding: '0.5rem 0.75rem',
        borderRadius: '6px',
        fontSize: '0.9rem',
        display: 'inline-block',
        border: '1px solid rgba(234, 179, 8, 0.3)',
      }}
    >
      {children}
    </p>
  );
}

export default HighlightText;
