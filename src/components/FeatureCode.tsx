import { useState } from 'react';

interface FeatureCodeProps {
  code: string;
}

function FeatureCode({ code }: FeatureCodeProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Simple syntax highlighting for JavaScript/TypeScript
  const highlightCode = (text: string) => {
    return (
      text
        // Comments
        .replace(/(\/\/[^\n]*)/g, '<span class="token comment">$1</span>')
        // Strings
        .replace(/('[^']*')/g, '<span class="token string">$1</span>')
        // Keywords
        .replace(
          /\b(import|from|await|async|const|let|var|function)\b/g,
          '<span class="token keyword">$1</span>'
        )
        // Function names
        .replace(
          /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=\()/g,
          '<span class="token function">$1</span>'
        )
        // Properties
        .replace(
          /\.([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
          '.<span class="token property">$1</span>'
        )
    );
  };

  return (
    <div className="feature-code">
      <button
        className={`copy-button ${copied ? 'copied' : ''}`}
        onClick={() => void handleCopy()}
        style={{
          position: 'absolute',
          top: '0.5rem',
          right: '0.5rem',
          fontSize: '0.7rem',
          padding: '0.25rem 0.5rem',
        }}
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <pre>
        <code dangerouslySetInnerHTML={{ __html: highlightCode(code) }} />
      </pre>
    </div>
  );
}

export default FeatureCode;
