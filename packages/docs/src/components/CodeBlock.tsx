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
    | 'xml'
    | 'gdscript'
    | 'bash'
    | 'json'
    | 'yaml'
    | 'groovy'
    | 'toml'
    | 'text'
    | 'properties';
}

// Identifier → Type doc page slug. Used by `linkifyType` so capitalized
// identifiers (Swift/Kotlin/Dart/GDScript class-name tokens, TypeScript
// type references) render as clickable anchors that jump to the matching
// `/docs/types/...` page. Add new entries here when a new type page ships.
const TYPE_LINKS: Record<string, string> = {
  // Cross-platform
  ActiveSubscription: '/docs/types/active-subscription',
  AlternativeBillingModeAndroid: '/docs/types/alternative-billing-types',
  AlternativeBillingTypes: '/docs/types/alternative-billing-types',
  BillingProgramAndroid: '/docs/types/billing-programs',
  BillingProgramAvailabilityResultAndroid: '/docs/types/billing-programs',
  BillingProgramReportingDetailsAndroid: '/docs/types/billing-programs',
  DeepLinkOptions: '/docs/types#common',
  DiscountOffer: '/docs/types/discount-offer',
  ExternalPurchaseLinkResultIOS: '/docs/types/external-purchase-link',
  ExternalPurchaseNoticeResultIOS: '/docs/types/external-purchase-link',
  ExternalPurchaseCustomLinkNoticeResultIOS:
    '/docs/types/external-purchase-link',
  ExternalPurchaseCustomLinkTokenResultIOS:
    '/docs/types/external-purchase-link',
  ExternalPurchaseCustomLinkNoticeTypeIOS: '/docs/types/external-purchase-link',
  ExternalPurchaseCustomLinkTokenTypeIOS: '/docs/types/external-purchase-link',
  FetchProductsResult: '/docs/types/product-request',
  InitConnectionConfig:
    '/docs/types/alternative-billing-types#init-connection-config',
  LaunchExternalLinkParamsAndroid: '/docs/types/billing-programs',
  Product: '/docs/types/product',
  ProductAndroid: '/docs/types/product',
  ProductIOS: '/docs/types/product',
  ProductOrSubscription: '/docs/types/product',
  ProductQueryType: '/docs/types/product-request',
  ProductRequest: '/docs/types/product-request',
  ProductSubscription: '/docs/types/subscription-product',
  ProductSubscriptionAndroid: '/docs/types/subscription-product',
  ProductSubscriptionIOS: '/docs/types/subscription-product',
  Purchase: '/docs/types/purchase',
  PurchaseAndroid: '/docs/types/purchase',
  PurchaseIOS: '/docs/types/purchase',
  PurchaseInput: '/docs/types/purchase',
  PurchaseOptions: '/docs/types/purchase',
  PurchaseVerificationProvider:
    '/docs/types/verify-purchase-with-provider-props',
  RequestPurchaseAndroidProps: '/docs/types/request-purchase-props',
  RequestPurchaseIosProps: '/docs/types/request-purchase-props',
  RequestPurchaseProps: '/docs/types/request-purchase-props',
  RequestPurchasePropsByPlatforms: '/docs/types/request-purchase-props',
  RequestPurchaseResult: '/docs/types/request-purchase-props',
  RequestSubscriptionPropsByPlatforms: '/docs/types/request-purchase-props',
  Storefront: '/docs/types/storefront',
  SubscriptionOffer: '/docs/types/subscription-offer',
  SubscriptionProduct: '/docs/types/subscription-product',
  VerifyPurchase: '/docs/types/verify-purchase',
  VerifyPurchaseProps: '/docs/types/verify-purchase',
  VerifyPurchaseResult: '/docs/types/verify-purchase',
  VerifyPurchaseResultAndroid: '/docs/types/verify-purchase',
  VerifyPurchaseResultHorizon: '/docs/types/verify-purchase',
  VerifyPurchaseResultIOS: '/docs/types/verify-purchase',
  VerifyPurchaseWithProviderProps:
    '/docs/types/verify-purchase-with-provider-props',
  VerifyPurchaseWithProviderResult:
    '/docs/types/verify-purchase-with-provider-result',
  VoidResult: '/docs/types#common',
  // iOS-only
  AppTransaction: '/docs/types/ios/app-transaction-ios',
  AppTransactionIOS: '/docs/types/ios/app-transaction-ios',
  Discount: '/docs/types/ios/discount-ios',
  DiscountIOS: '/docs/types/ios/discount-ios',
  DiscountOfferIOS: '/docs/types/ios/discount-offer-ios',
  PaymentMode: '/docs/types/ios/payment-mode-ios',
  PaymentModeIOS: '/docs/types/ios/payment-mode-ios',
  RenewalInfo: '/docs/types/ios/renewal-info-ios',
  RenewalInfoIOS: '/docs/types/ios/renewal-info-ios',
  SubscriptionPeriod: '/docs/types/ios/subscription-period-ios',
  SubscriptionPeriodIOS: '/docs/types/ios/subscription-period-ios',
  SubscriptionStatus: '/docs/types/ios/subscription-status-ios',
  SubscriptionStatusIOS: '/docs/types/ios/subscription-status-ios',
  // Android-only
  OneTimePurchaseOfferDetailAndroid:
    '/docs/types/android/one-time-purchase-offer-detail-android',
  PricingPhaseAndroid: '/docs/types/android/pricing-phase-android',
  SubscriptionOfferAndroid: '/docs/types/android/subscription-offer-android',
};

// Wraps a class-name token in an anchor when it matches a known type.
// Caller is responsible for HTML-escaping the input.
function linkifyType(name: string): string {
  const href = TYPE_LINKS[name];
  if (href) {
    return `<a class="token class-name type-ref" href="${href}">${name}</a>`;
  }
  return `<span class="token class-name">${name}</span>`;
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
      case 'gdscript':
        return 'gd';
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

          // Capitalized identifiers → linkify known OpenIAP types (so e.g.
          // `ProductRequest`, `Purchase[]`, `Promise<FetchProductsResult>` in
          // a TS signature jump to /docs/types/...).
          // The negative lookbehind `(?<![">])` skips capitals that sit
          // immediately after an HTML attribute quote or a closing `>` —
          // i.e. text already wrapped by the keyword / function passes
          // above. Without it we'd nest tags (e.g. wrap `Future` inside
          // `<span class="token keyword">Future</span>`) and clobber the
          // upstream token color.
          processed = processed.replace(
            /(?<![">])\b([A-Z][a-zA-Z0-9_]*)\b/g,
            (_, name: string) => linkifyType(name)
          );

          result += processed;
        }
      });

      return result;
    });

    element.innerHTML = highlightedLines.join('\n');
  } else if (
    language === 'swift' ||
    language === 'kotlin' ||
    language === 'dart' ||
    language === 'gdscript'
  ) {
    // Swift, Kotlin, and Dart syntax highlighting
    const lines = text.split('\n');
    const highlightedLines = lines.map((line) => {
      let result = '';
      let inString = false;
      let stringChar = '';

      // Check if line is a comment
      if (line.trim().startsWith('//') || line.trim().startsWith('#')) {
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
            keywords =
              'import|func|let|var|if|else|for|while|do|switch|case|return|try|await|async|class|struct|enum|protocol|extension|guard|defer|in|is|as|self|super|static|final|override|public|private|internal|fileprivate|open|weak|unowned|lazy|mutating|nonmutating|convenience|required|subscript|deinit|init|typealias|associatedtype|where|throws|rethrows|catch|throw|nil|true|false|@available';
          } else if (language === 'kotlin') {
            keywords =
              'import|package|fun|val|var|if|else|for|while|do|when|return|try|catch|finally|throw|class|object|interface|enum|sealed|data|inner|open|abstract|override|public|private|internal|protected|suspend|inline|crossinline|noinline|reified|lateinit|by|companion|init|constructor|this|super|null|true|false|it|in|is|as|typealias|where';
          } else if (language === 'gdscript') {
            // GDScript keywords
            keywords =
              'func|var|const|class|class_name|extends|signal|enum|static|onready|export|preload|load|if|elif|else|for|while|match|break|continue|pass|return|await|yield|true|false|null|self|void|int|float|bool|String|Array|Dictionary|Vector2|Vector3|Object|Node|and|or|not|in|is|as';
          } else {
            // Dart keywords
            keywords =
              'import|export|library|part|show|hide|as|if|else|for|while|do|switch|case|default|break|continue|return|try|catch|finally|throw|rethrow|assert|class|abstract|extends|implements|with|mixin|enum|typedef|static|final|const|late|required|covariant|get|set|operator|factory|async|await|yield|sync|true|false|null|this|super|new|void|dynamic|var|Function|Future|Stream';
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

          // Types (capitalized words). Known OpenIAP type names render as
          // anchors to /docs/types/...; unknown ones stay as plain class-name
          // spans so styling is identical.
          // Negative lookbehind `(?<![">])` skips capitals already inside
          // tags emitted by the keyword/function/decorator passes above —
          // languages like Dart treat `Future`/`Function` and GDScript treats
          // `String`/`Array` as keywords, so the bare `\b[A-Z]...\b` pattern
          // would re-wrap them and override the upstream token color.
          processed = processed.replace(
            /(?<![">])\b([A-Z][a-zA-Z0-9_]*)\b/g,
            (_, name: string) => linkifyType(name)
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
  } else if (language === 'json') {
    const lines = text.split('\n');
    const highlightedLines = lines.map((line) => {
      if (!line.trim()) return escapeHtml(line);

      let result = '';
      let inString = false;
      let currentToken = '';
      const tokens: Array<{ type: string; value: string }> = [];

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' && !inString) {
          if (currentToken) {
            tokens.push({ type: 'code', value: currentToken });
            currentToken = '';
          }
          inString = true;
          currentToken = char;
        } else if (char === '"' && inString && line[i - 1] !== '\\') {
          currentToken += char;
          tokens.push({ type: 'string', value: currentToken });
          currentToken = '';
          inString = false;
        } else {
          currentToken += char;
        }
      }
      if (currentToken) {
        tokens.push({
          type: inString ? 'string' : 'code',
          value: currentToken,
        });
      }

      // Determine if a string token is a key (followed by ':')
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (token.type === 'string') {
          // Check if next non-whitespace token contains ':'
          const nextToken = tokens[i + 1];
          const isKey = nextToken && nextToken.value.trim().startsWith(':');
          if (isKey) {
            result += `<span class="token attr-name">${escapeHtml(token.value)}</span>`;
          } else {
            result += `<span class="token string">${escapeHtml(token.value)}</span>`;
          }
        } else {
          let processed = escapeHtml(token.value);

          // Booleans and null
          processed = processed.replace(
            /\b(true|false|null)\b/g,
            '<span class="token keyword">$1</span>'
          );

          // Numbers
          processed = processed.replace(
            /\b(\d+\.?\d*)\b/g,
            '<span class="token number">$1</span>'
          );

          result += processed;
        }
      }

      return result;
    });

    element.innerHTML = highlightedLines.join('\n');
  } else if (language === 'bash') {
    const lines = text.split('\n');
    const highlightedLines = lines.map((line) => {
      if (!line.trim()) return escapeHtml(line);

      // Comments
      if (line.trim().startsWith('#')) {
        return `<span class="token comment">${escapeHtml(line)}</span>`;
      }

      // Tokenize strings first
      let result = '';
      let inString = false;
      let stringChar = '';
      const tokens: Array<{ type: string; value: string }> = [];
      let current = '';

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
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

      let isFirstCode = true;
      tokens.forEach((token) => {
        if (token.type === 'string') {
          result += `<span class="token string">${escapeHtml(token.value)}</span>`;
        } else {
          let processed = escapeHtml(token.value);

          // Variables
          processed = processed.replace(
            /(\$\{[^}]+\}|\$[A-Za-z_][A-Za-z0-9_]*)/g,
            '<span class="token variable">$1</span>'
          );

          // Commands at the start of the line
          if (isFirstCode) {
            processed = processed.replace(
              /^(\s*)(npm|npx|yarn|bun|git|cd|mkdir|cp|rm|flutter|make|pod|eas|adb|curl|export|open|xcodebuild|EXPO_TV=\S+)\b/,
              '$1<span class="token function">$2</span>'
            );
          }

          // Flags
          processed = processed.replace(
            /\s(--?[a-zA-Z][\w-]*)/g,
            ' <span class="token attr-name">$1</span>'
          );

          // Pipe and redirects
          processed = processed.replace(
            /(\||&amp;&amp;|&gt;|&lt;)/g,
            '<span class="token keyword">$1</span>'
          );

          result += processed;
          isFirstCode = false;
        }
      });

      return result;
    });

    element.innerHTML = highlightedLines.join('\n');
  } else if (language === 'yaml' || language === 'toml') {
    const lines = text.split('\n');
    const highlightedLines = lines.map((line) => {
      if (!line.trim()) return escapeHtml(line);

      // Comments
      if (line.trim().startsWith('#')) {
        return `<span class="token comment">${escapeHtml(line)}</span>`;
      }

      // Section headers [section]
      if (/^\s*\[/.test(line)) {
        return escapeHtml(line).replace(
          /(\[[^\]]+\])/g,
          '<span class="token keyword">$1</span>'
        );
      }

      // Tokenize strings
      let result = '';
      const tokens: Array<{ type: string; value: string }> = [];
      let current = '';
      let inString = false;
      let stringChar = '';

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if ((char === '"' || char === "'") && !inString) {
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

      let isFirst = true;
      tokens.forEach((token) => {
        if (token.type === 'string') {
          result += `<span class="token string">${escapeHtml(token.value)}</span>`;
        } else {
          let processed = escapeHtml(token.value);

          // Keys (first code token before : or =)
          if (isFirst) {
            processed = processed.replace(
              /^(\s*)([A-Za-z_][\w.-]*)\s*([:=])/,
              '$1<span class="token attr-name">$2</span> $3'
            );
          }

          // Booleans
          processed = processed.replace(
            /\b(true|false)\b/g,
            '<span class="token keyword">$1</span>'
          );

          // Numbers
          processed = processed.replace(
            /\b(\d+\.?\d*)\b/g,
            '<span class="token number">$1</span>'
          );

          result += processed;
          isFirst = false;
        }
      });

      return result;
    });

    element.innerHTML = highlightedLines.join('\n');
  } else if (language === 'groovy') {
    const lines = text.split('\n');
    const highlightedLines = lines.map((line) => {
      if (!line.trim()) return escapeHtml(line);

      // Comments
      if (line.trim().startsWith('//')) {
        return `<span class="token comment">${escapeHtml(line)}</span>`;
      }

      let result = '';
      let inString = false;
      let stringChar = '';

      const tokens: Array<{ type: string; value: string }> = [];
      let current = '';

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
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

      tokens.forEach((token) => {
        if (token.type === 'string') {
          result += `<span class="token string">${escapeHtml(token.value)}</span>`;
        } else {
          let processed = escapeHtml(token.value);

          processed = processed.replace(
            /\b(android|compileSdkVersion|compileSdk|minSdkVersion|minSdk|targetSdkVersion|targetSdk|defaultConfig|dependencies|implementation|def|if|else|for|while|return|true|false|null|new|class|extends|implements|import|package|static|final|void|int|boolean|String|project)\b/g,
            '<span class="token keyword">$1</span>'
          );

          processed = processed.replace(
            /\b(\d+\.?\d*)\b/g,
            '<span class="token number">$1</span>'
          );

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
  } else if (language === 'properties') {
    const lines = text.split('\n');
    const highlightedLines = lines.map((line) => {
      if (!line.trim()) return escapeHtml(line);

      if (line.trim().startsWith('#')) {
        return `<span class="token comment">${escapeHtml(line)}</span>`;
      }

      const result = escapeHtml(line);
      return result.replace(
        /^(\s*)([^=]+?)\s*(=)\s*(.*)/gm,
        '$1<span class="token attr-name">$2</span> $3 <span class="token string">$4</span>'
      );
    });

    element.innerHTML = highlightedLines.join('\n');
  } else if (language === 'text') {
    element.innerHTML = escapeHtml(text);
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
