import type { ReactNode } from 'react';

type CalloutKind = 'note' | 'tip' | 'important' | 'warning';

const KIND_LABELS: Record<CalloutKind, string> = {
  note: 'Note',
  tip: 'Tip',
  important: 'Important',
  warning: 'Warning',
};

interface CalloutProps {
  kind?: CalloutKind;
  title?: string;
  children: ReactNode;
}

function Callout({ kind = 'note', title, children }: CalloutProps) {
  return (
    <aside className={`callout callout--${kind}`}>
      <p className="callout-label">{title ?? KIND_LABELS[kind]}</p>
      <div className="callout-body">{children}</div>
    </aside>
  );
}

export default Callout;
