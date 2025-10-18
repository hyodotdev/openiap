import { useState, ReactNode } from 'react';
import '../styles/accordion.css';

interface AccordionProps {
  title: string | ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  variant?: 'info' | 'tip' | 'warning';
}

function Accordion({
  title,
  children,
  defaultOpen = false,
  variant = 'info',
}: AccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`accordion accordion-${variant} ${isOpen ? 'open' : ''}`}>
      <button
        className="accordion-header"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span className="accordion-title">
          {typeof title === 'string' ? title : <>{title}</>}
        </span>
        <span className={`accordion-icon ${isOpen ? 'open' : ''}`}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M4 6L8 10L12 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>
      <div className={`accordion-content-wrapper ${isOpen ? 'open' : ''}`}>
        <div className="accordion-content">{children}</div>
      </div>
    </div>
  );
}

export default Accordion;
