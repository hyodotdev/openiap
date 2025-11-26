import { useEffect, useRef, useState } from 'react';

interface CodeBlockProps {
  children: string;
  language?:
    | 'graphql'
    | 'typescript'
    | 'javascript'
    | 'swift'
    | 'kotlin'
    | 'dart'
    | 'xml';
}

function CodeBlock({ children, language = 'graphql' }: CodeBlockProps) {
  const codeRef = useRef<HTMLElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (codeRef.current) {
      highlightCode(codeRef.current, language);
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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function highlightCode(element: HTMLElement, language: string) {
  const text = element.textContent || '';

  if (language === 'typescript' || language === 'javascript') {
    // Process syntax highlighting before escaping HTML
    const lines = text.split('\n');
    const highlightedLines = lines.map((line) => {
      let result = '';
      let inString = false;
      let stringChar = '';

      // Check if line is a comment
      if (line.trim().startsWith('//')) {
        return `<span class="token comment">${escapeHtml(line)}</span>`;
      }

      // Tokenize the line
      const tokens: Array<{ type: string; value: string }> = [];
      let current = '';

      for (let i = 0; i < line.length; i++) {
        const char = line[i];

        // Handle strings
        if ((char === '"' || char === "'" || char === '`') && !inString) {
          if (current) {
            tokens.push({ type: 'code', value: current });
            current = '';
          }
          inString = true;
          stringChar = char;
          current = char;
        } else if (inString && char === stringChar) {
          current += char;
          tokens.push({ type: 'string', value: current });
          current = '';
          inString = false;
          stringChar = '';
        } else {
          current += char;
        }
      }

      if (current) {
        tokens.push({ type: inString ? 'string' : 'code', value: current });
      }

      // Process tokens
      tokens.forEach((token) => {
        if (token.type === 'string') {
          result += `<span class="token string">${escapeHtml(token.value)}</span>`;
        } else {
          let processed = escapeHtml(token.value);

          // Keywords
          processed = processed.replace(
            /\b(import|export|from|as|default|const|let|var|function|async|await|class|extends|implements|interface|type|enum|if|else|for|while|do|switch|case|break|continue|return|try|catch|finally|throw|new|typeof|instanceof|void|null|undefined|true|false|this|super|static|public|private|protected|readonly|abstract|namespace|module|require|declare|constructor|get|set|of|in|yield|delete|debugger|with)\b/g,
            '<span class="token keyword">$1</span>'
          );

          // Numbers
          processed = processed.replace(
            /\b(\d+\.?\d*)\b/g,
            '<span class="token number">$1</span>'
          );

          // Function calls
          processed = processed.replace(
            /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=\()/g,
            '<span class="token function">$1</span>'
          );

          result += processed;
        }
      });

      return result;
    });

    element.innerHTML = highlightedLines.join('\n');
  } else if (language === 'swift' || language === 'kotlin' || language === 'dart') {
    // Swift, Kotlin, and Dart syntax highlighting
    const lines = text.split('\n');
    const highlightedLines = lines.map((line) => {
      let result = '';
      let inString = false;
      let stringChar = '';

      // Check if line is a comment
      if (line.trim().startsWith('//')) {
        return `<span class="token comment">${escapeHtml(line)}</span>`;
      }

      // Tokenize the line
      const tokens: Array<{ type: string; value: string }> = [];
      let current = '';

      for (let i = 0; i < line.length; i++) {
        const char = line[i];

        // Handle strings
        if ((char === '"' || char === "'") && !inString) {
          if (current) {
            tokens.push({ type: 'code', value: current });
            current = '';
          }
          inString = true;
          stringChar = char;
          current = char;
        } else if (inString && char === stringChar && line[i - 1] !== '\\') {
          current += char;
          tokens.push({ type: 'string', value: current });
          current = '';
          inString = false;
          stringChar = '';
        } else {
          current += char;
        }
      }

      if (current) {
        tokens.push({ type: inString ? 'string' : 'code', value: current });
      }

      // Process tokens
      tokens.forEach((token) => {
        if (token.type === 'string') {
          result += `<span class="token string">${escapeHtml(token.value)}</span>`;
        } else {
          let processed = escapeHtml(token.value);

          // Language-specific keywords
          let keywords: string;
          if (language === 'swift') {
            keywords = 'import|func|let|var|if|else|for|while|do|switch|case|return|try|await|async|class|struct|enum|protocol|extension|guard|defer|in|is|as|self|super|static|final|override|public|private|internal|fileprivate|open|weak|unowned|lazy|mutating|nonmutating|convenience|required|subscript|deinit|init|typealias|associatedtype|where|throws|rethrows|catch|throw|nil|true|false|@available';
          } else if (language === 'kotlin') {
            keywords = 'import|package|fun|val|var|if|else|for|while|do|when|return|try|catch|finally|throw|class|object|interface|enum|sealed|data|inner|open|abstract|override|public|private|internal|protected|suspend|inline|crossinline|noinline|reified|lateinit|by|companion|init|constructor|this|super|null|true|false|it|in|is|as|typealias|where';
          } else {
            // Dart keywords
            keywords = 'import|export|library|part|show|hide|as|if|else|for|while|do|switch|case|default|break|continue|return|try|catch|finally|throw|rethrow|assert|class|abstract|extends|implements|with|mixin|enum|typedef|static|final|const|late|required|covariant|get|set|operator|factory|async|await|yield|sync|true|false|null|this|super|new|void|dynamic|var|Function|Future|Stream';
          }

          processed = processed.replace(
            new RegExp(`\\b(${keywords})\\b`, 'g'),
            '<span class="token keyword">$1</span>'
          );

          // Numbers
          processed = processed.replace(
            /\b(\d+\.?\d*)\b/g,
            '<span class="token number">$1</span>'
          );

          // Function calls and declarations
          processed = processed.replace(
            /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=\()/g,
            '<span class="token function">$1</span>'
          );

          // Types (capitalized words not after a dot)
          processed = processed.replace(
            /\b([A-Z][a-zA-Z0-9_]*)\b/g,
            '<span class="token class-name">$1</span>'
          );

          // Annotations/Attributes
          processed = processed.replace(
            /@([a-zA-Z_][a-zA-Z0-9_]*)/g,
            '<span class="token decorator">@$1</span>'
          );

          result += processed;
        }
      });

      return result;
    });

    element.innerHTML = highlightedLines.join('\n');
  } else if (language === 'xml') {
    // XML syntax highlighting
    const lines = text.split('\n');
    const highlightedLines = lines.map((line) => {
      if (!line.trim()) return escapeHtml(line);

      let result = escapeHtml(line);

      // Comments
      if (result.includes('&lt;!--')) {
        return result.replace(
          /(&lt;!--.*?--&gt;)/g,
          '<span class="token comment">$1</span>'
        );
      }

      // Opening/closing tags with attributes
      result = result.replace(
        /(&lt;\/?)([a-zA-Z][a-zA-Z0-9-]*)(.*?)(&gt;)/g,
        (_match, open, tag, attrs, close) => {
          let tagHtml = '<span class="token punctuation">' + open + '</span>';
          tagHtml += '<span class="token tag">' + tag + '</span>';

          // Process attributes if present
          if (attrs.trim()) {
            let processedAttrs = attrs.replace(
              /\s*([a-zA-Z][a-zA-Z0-9-]*)=/g,
              ' <span class="token attr-name">$1</span>='
            );
            processedAttrs = processedAttrs.replace(
              /="([^"]*)"/g,
              '=<span class="token attr-value">"$1"</span>'
            );
            tagHtml += processedAttrs;
          }

          tagHtml += '<span class="token punctuation">' + close + '</span>';
          return tagHtml;
        }
      );

      return result;
    });

    element.innerHTML = highlightedLines.join('\n');
  } else if (language === 'graphql') {
    const lines = text.split('\n');
    let inBlockString = false;

    const highlightedLines = lines.map((line) => {
      const trimmed = line.trim();
      const escaped = escapeHtml(line);

      if (!trimmed) {
        return escaped;
      }

      // Block string delimiters and contents
      if (trimmed.startsWith('"""')) {
        const result = `<span class="token string">${escaped}</span>`;
        const isSingleLineBlock =
          trimmed.length > 3 && trimmed.endsWith('"""') && trimmed !== '"""';
        if (!isSingleLineBlock) {
          inBlockString = !inBlockString;
        }
        return result;
      }

      if (inBlockString) {
        return `<span class="token string">${escaped}</span>`;
      }

      // Line comments
      if (trimmed.startsWith('#')) {
        return `<span class="token comment">${escaped}</span>`;
      }

      // Type/Input/Enum declarations
      const typeMatch = line.match(/^(\s*)(type|input|enum)\s+(\w+)(.*)$/);
      if (typeMatch) {
        const [, leading, keyword, typeName, rest] = typeMatch;
        const escapedRest = rest ? escapeHtml(rest) : '';
        return `${escapeHtml(leading)}<span class="token keyword">${keyword}</span> <span class="token type-name">${typeName}</span>${escapedRest}`;
      }

      // Enum values (all caps with underscores)
      if (/^\s*[A-Z_]+\s*$/.test(line)) {
        return escaped.replace(
          /([A-Z_]+)/g,
          '<span class="token enum-value">$1</span>'
        );
      }

      // Field definitions (fieldName: Type)
      if (line.includes(':')) {
        const fieldProcessed = escaped.replace(
          /^(\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*)(:)/g,
          '$1<span class="token field">$2</span>$3<span class="token punctuation">$4</span>'
        );

        return fieldProcessed.replace(
          /:\s*(\[?)([A-Za-z_][A-Za-z0-9_]*)(\]?)(!?)/g,
          (_match, bracket1, type, bracket2, exclaim) => {
            let result = ':<span class="token punctuation"> </span>';
            if (bracket1) result += '<span class="token punctuation">[</span>';

            const builtInTypes = [
              'String',
              'Int',
              'Float',
              'Boolean',
              'ID',
              'JSON',
              'Void',
            ];
            if (builtInTypes.includes(type)) {
              result += `<span class="token builtin-type">${type}</span>`;
            } else {
              result += `<span class="token custom-type">${type}</span>`;
            }

            if (bracket2) result += '<span class="token punctuation">]</span>';
            if (exclaim) result += '<span class="token required">!</span>';
            return result;
          }
        );
      }

      return escaped;
    });

    element.innerHTML = highlightedLines.join('\n');
  }
}

export default CodeBlock;
