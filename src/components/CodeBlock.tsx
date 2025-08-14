import { useEffect, useRef, useState } from 'react'

interface CodeBlockProps {
  children: string
  language?: 'graphql' | 'typescript' | 'javascript'
}

function CodeBlock({ children, language = 'graphql' }: CodeBlockProps) {
  const codeRef = useRef<HTMLElement>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (codeRef.current) {
      highlightCode(codeRef.current, language)
    }
  }, [children, language])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(children)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className="code-block-wrapper">
      <button 
        className={`copy-button ${copied ? 'copied' : ''}`}
        onClick={() => void handleCopy()}
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <pre className="code-block">
        <code ref={codeRef} className={`language-${language}`}>
          {children}
        </code>
      </pre>
    </div>
  )
}

function highlightCode(element: HTMLElement, language: string) {
  const text = element.textContent || ''
  
  if (language === 'typescript' || language === 'javascript') {
    // TypeScript/JavaScript syntax highlighting
    const highlighted = text
      // Comments (must be before strings to avoid conflicts)
      .replace(/(\/\/[^\n]*)/g, '<span class="token comment">$1</span>')
      .replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="token comment">$1</span>')
      // Template literals and strings
      .replace(/(`[\s\S]*?`)/g, '<span class="token string">$1</span>')
      .replace(/("[^"]*")/g, '<span class="token string">$1</span>')
      .replace(/('[^']*')/g, '<span class="token string">$1</span>')
      // Keywords
      .replace(/\b(import|export|from|as|default|const|let|var|function|async|await|class|extends|implements|interface|type|enum|if|else|for|while|do|switch|case|break|continue|return|try|catch|finally|throw|new|typeof|instanceof|void|null|undefined|true|false|this|super|static|public|private|protected|readonly|abstract|namespace|module|require|declare|constructor|get|set|of|in|yield|delete|debugger|with)\b/g, '<span class="token keyword">$1</span>')
      // Built-in types and objects
      .replace(/\b(string|number|boolean|any|unknown|never|void|null|undefined|object|symbol|bigint|Array|Object|Function|Promise|Date|RegExp|Map|Set|WeakMap|WeakSet|Error|JSON|Math|Number|String|Boolean|Symbol|BigInt|Proxy|Reflect|console)\b/g, '<span class="token builtin-type">$1</span>')
      // Numbers
      .replace(/\b(\d+\.?\d*)\b/g, '<span class="token number">$1</span>')
      // Function names
      .replace(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=\()/g, '<span class="token function">$1</span>')
      // Property access
      .replace(/\.([a-zA-Z_$][a-zA-Z0-9_$]*)/g, '.<span class="token property">$1</span>')
    
    element.innerHTML = highlighted
  } else if (language === 'graphql') {
    // Split by lines to process each line
    const lines = text.split('\n')
    const highlightedLines = lines.map(line => {
      // Skip empty lines
      if (!line.trim()) return line
      
      // Comments first (highest priority)
      if (line.trim().startsWith('#') || line.includes('"') && line.trim().startsWith('"')) {
        return line
          .replace(/(#[^\n]*)/g, '<span class="token comment">$1</span>')
          .replace(/"([^"]*)"/g, '<span class="token string">"$1"</span>')
      }
      
      // Type/Input/Enum declarations
      if (line.match(/^\s*(type|input|enum)\s+(\w+)/)) {
        return line
          .replace(/\b(type|input|enum)\b/g, '<span class="token keyword">$1</span>')
          .replace(/\b(type|input|enum)\s+(\w+)/g, '$1 <span class="token type-name">$2</span>')
          .replace(/\b(implements)\b/g, '<span class="token keyword">$1</span>')
          .replace(/\b(implements)\s+(\w+)/g, '$1 <span class="token type-name">$2</span>')
      }
      
      // Enum values (all caps with underscores)
      if (line.match(/^\s*[A-Z_]+\s*$/)) {
        return line.replace(/([A-Z_]+)/g, '<span class="token enum-value">$1</span>')
      }
      
      // Field definitions (fieldName: Type)
      if (line.includes(':')) {
        return line
          // Field name before colon
          .replace(/^(\s*)(\w+)(\s*)(:)/g, '$1<span class="token field">$2</span>$3<span class="token punctuation">$4</span>')
          // Types after colon
          .replace(/:\s*(\[?)(\w+)(\]?)(!?)/g, function(_match, bracket1, type, bracket2, exclaim) {
            let result = ':<span class="token punctuation"> </span>'
            if (bracket1) result += '<span class="token punctuation">[</span>'
            
            // Check if it's a built-in type or custom type
            const builtInTypes = ['String', 'Int', 'Float', 'Boolean', 'ID', 'JSON', 'Void']
            if (builtInTypes.includes(type)) {
              result += `<span class="token builtin-type">${type}</span>`
            } else {
              result += `<span class="token custom-type">${type}</span>`
            }
            
            if (bracket2) result += '<span class="token punctuation">]</span>'
            if (exclaim) result += '<span class="token required">!</span>'
            return result
          })
      }
      
      return line
    })
    
    element.innerHTML = highlightedLines.join('\n')
  }
}

export default CodeBlock