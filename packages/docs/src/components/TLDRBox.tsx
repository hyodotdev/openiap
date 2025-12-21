import type { ReactNode } from 'react';

interface TLDRBoxProps {
  title?: string;
  children: ReactNode;
}

function TLDRBox({ title = 'TL;DR', children }: TLDRBoxProps) {
  return (
    <div className="tldr-box">
      <h4 className="tldr-title">{title}</h4>
      <div className="tldr-content">{children}</div>
    </div>
  );
}

export default TLDRBox;
