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
      <div className="code-block-header">
        {(language === 'typescript' || language === 'javascript') && (
          <span className="code-block-language">{language === 'typescript' ? 'ts' : 'js'}</span>
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
  )
}

function highlightCode(element: HTMLElement, language: string) {
  const text = element.textContent || ''
  
  if (language === 'typescript' || language === 'javascript') {
    // Process syntax highlighting before escaping HTML
    const lines = text.split('\n')
    const highlightedLines = lines.map(line => {
      let result = ''
      let inString = false
      let stringChar = ''
      
      // Check if line is a comment
      if (line.trim().startsWith('//')) {
        return `<span class="token comment">${line.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`
      }
      
      // Tokenize the line
      const tokens: Array<{type: string, value: string}> = []
      let current = ''
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        
        // Handle strings
        if ((char === '"' || char === "'" || char === '`') && !inString) {
          if (current) {
            tokens.push({type: 'code', value: current})
            current = ''
          }
          inString = true
          stringChar = char
          current = char
        } else if (inString && char === stringChar) {
          current += char
          tokens.push({type: 'string', value: current})
          current = ''
          inString = false
          stringChar = ''
        } else {
          current += char
        }
      }
      
      if (current) {
        tokens.push({type: inString ? 'string' : 'code', value: current})
      }
      
      // Process tokens
      tokens.forEach(token => {
        if (token.type === 'string') {
          result += `<span class="token string">${token.value.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`
        } else {
          let processed = token.value.replace(/</g, '&lt;').replace(/>/g, '&gt;')
          
          // Keywords
          processed = processed.replace(/\b(import|export|from|as|default|const|let|var|function|async|await|class|extends|implements|interface|type|enum|if|else|for|while|do|switch|case|break|continue|return|try|catch|finally|throw|new|typeof|instanceof|void|null|undefined|true|false|this|super|static|public|private|protected|readonly|abstract|namespace|module|require|declare|constructor|get|set|of|in|yield|delete|debugger|with)\b/g, '<span class="token keyword">$1</span>')
          
          // Numbers
          processed = processed.replace(/\b(\d+\.?\d*)\b/g, '<span class="token number">$1</span>')
          
          // Function calls
          processed = processed.replace(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=\()/g, '<span class="token function">$1</span>')
          
          result += processed
        }
      })
      
      return result
    })
    
    element.innerHTML = highlightedLines.join('\n')
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