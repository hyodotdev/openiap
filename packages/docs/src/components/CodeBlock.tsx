import { useEffect, useRef, useState } from 'react';
import { highlightCode, type HighlightLanguage } from '../lib/codeHighlight';

interface CodeBlockProps {
  children: string;
  language?: HighlightLanguage;
}

function CodeBlock({ children, language = 'text' }: CodeBlockProps) {
  const codeRef = useRef<HTMLElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (codeRef.current) {
      codeRef.current.innerHTML = highlightCode(children, language);
    }
  }, [children, language]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getLanguageLabel = () => {
    switch (language) {
      case 'typescript':
        return 'ts';
      case 'javascript':
        return 'js';
      case 'swift':
        return 'swift';
      case 'kotlin':
        return 'kt';
      case 'dart':
        return 'dart';
      case 'xml':
        return 'xml';
      case 'gdscript':
        return 'gd';
      case 'csharp':
        return 'cs';
      case 'bash':
        return 'sh';
      case 'json':
        return 'json';
      case 'yaml':
        return 'yaml';
      case 'groovy':
        return 'groovy';
      case 'toml':
        return 'toml';
      case 'properties':
        return 'props';
      case 'text':
        return null;
      default:
        return null;
    }
  };

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        {getLanguageLabel() && (
          <span className="code-block-language">{getLanguageLabel()}</span>
        )}
        <button
          className={`copy-button ${copied ? 'copied' : ''}`}
          onClick={() => void handleCopy()}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="code-block">
        <code ref={codeRef} className={`language-${language}`}>
          {children}
        </code>
      </pre>
    </div>
  );
}

export default CodeBlock;
