import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import SEO from '../../../components/SEO';
import TLDRBox from '../../../components/TLDRBox';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function AIAssistants() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="AI Assistants"
        description="Use OpenIAP documentation with AI coding assistants like Cursor, GitHub Copilot, Claude, and ChatGPT."
        path="/docs/guides/ai-assistants"
        keywords="AI assistant, Cursor, GitHub Copilot, Claude, ChatGPT, LLM, documentation"
      />
      <h1>AI Assistants</h1>
      <p>
        OpenIAP provides AI-optimized documentation formats to help you work
        more efficiently with AI coding assistants.
      </p>

      <TLDRBox>
        <ul>
          <li>
            <strong>Quick Reference</strong>:{' '}
            <a
              href="https://openiap.dev/llms.txt"
              target="_blank"
              rel="noopener noreferrer"
            >
              llms.txt
            </a>{' '}
            (~300 lines)
          </li>
          <li>
            <strong>Full Reference</strong>:{' '}
            <a
              href="https://openiap.dev/llms-full.txt"
              target="_blank"
              rel="noopener noreferrer"
            >
              llms-full.txt
            </a>{' '}
            (~1000 lines)
          </li>
        </ul>
      </TLDRBox>

      <section>
        <AnchorLink id="ai-optimized-documentation" level="h2">
          AI-Optimized Documentation
        </AnchorLink>
        <p>We provide two formats optimized for AI consumption:</p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1rem',
            marginTop: '1rem',
          }}
        >
          <div
            style={{
              padding: '1.5rem',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
            }}
          >
            <h4 style={{ margin: '0 0 0.5rem 0' }}>
              <a
                href="https://openiap.dev/llms.txt"
                target="_blank"
                rel="noopener noreferrer"
              >
                llms.txt
              </a>
            </h4>
            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>
              <strong>Concise API overview (~300 lines)</strong>
            </p>
            <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem' }}>
              <li>Installation basics</li>
              <li>API signatures</li>
              <li>Core types</li>
              <li>Common patterns</li>
            </ul>
          </div>
          <div
            style={{
              padding: '1.5rem',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
            }}
          >
            <h4 style={{ margin: '0 0 0.5rem 0' }}>
              <a
                href="https://openiap.dev/llms-full.txt"
                target="_blank"
                rel="noopener noreferrer"
              >
                llms-full.txt
              </a>
            </h4>
            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>
              <strong>Complete API documentation (~1000 lines)</strong>
            </p>
            <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem' }}>
              <li>Full configuration options</li>
              <li>Complete API documentation</li>
              <li>All type definitions</li>
              <li>Platform-specific APIs</li>
              <li>Error codes & troubleshooting</li>
            </ul>
          </div>
        </div>
      </section>

      <section>
        <AnchorLink id="integration" level="h2">
          Integration with AI Assistants
        </AnchorLink>

        <AnchorLink id="cursor" level="h3">
          Cursor
        </AnchorLink>
        <p>Add OpenIAP documentation as a custom doc source:</p>
        <ol>
          <li>
            Open <strong>Settings</strong> → <strong>Features</strong> →{' '}
            <strong>Docs</strong>
          </li>
          <li>
            Click <strong>Add new doc</strong>
          </li>
          <li>
            Enter URL:{' '}
            <code>https://openiap.dev/llms.txt</code>
          </li>
          <li>
            Name it <strong>OpenIAP</strong>
          </li>
        </ol>
        <p>
          Then use <code>@OpenIAP</code> in your prompts to reference the
          documentation.
        </p>

        <AnchorLink id="github-copilot" level="h3">
          GitHub Copilot
        </AnchorLink>
        <p>Reference the documentation URL directly in your chat prompts:</p>
        <CodeBlock language="typescript">{`// In Copilot Chat:
// "Using https://openiap.dev/llms.txt as reference,
// help me implement subscription purchase flow"`}</CodeBlock>

        <AnchorLink id="claude-chatgpt" level="h3">
          Claude / ChatGPT
        </AnchorLink>
        <p>Two approaches work well:</p>
        <ol>
          <li>
            <strong>URL Reference</strong>: Provide the documentation URL and
            ask the AI to fetch it
          </li>
          <li>
            <strong>Direct Paste</strong>: Copy the content from{' '}
            <a
              href="https://openiap.dev/llms.txt"
              target="_blank"
              rel="noopener noreferrer"
            >
              llms.txt
            </a>{' '}
            and paste it directly into your conversation
          </li>
        </ol>

        <AnchorLink id="claude-code" level="h3">
          Claude Code (CLI)
        </AnchorLink>
        <p>
          Add OpenIAP documentation to your project's <code>CLAUDE.md</code>{' '}
          file for automatic context:
        </p>
        <CodeBlock language="typescript">{`# In CLAUDE.md:

## IAP Reference
For in-app purchase implementation, reference: https://openiap.dev/llms.txt`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="documentation-contents" level="h2">
          Documentation Contents
        </AnchorLink>

        <AnchorLink id="quick-reference" level="h3">
          Quick Reference (llms.txt)
        </AnchorLink>
        <ul>
          <li>Installation instructions for all platforms</li>
          <li>Core API signatures and usage</li>
          <li>Essential types (Product, Purchase, Subscription)</li>
          <li>Common implementation patterns</li>
          <li>Error handling basics</li>
        </ul>

        <AnchorLink id="full-reference" level="h3">
          Full Reference (llms-full.txt)
        </AnchorLink>
        <ul>
          <li>Complete configuration options</li>
          <li>All API methods with full documentation</li>
          <li>Complete type definitions</li>
          <li>Platform-specific APIs (iOS and Android)</li>
          <li>All error codes and handling</li>
          <li>Implementation patterns and best practices</li>
          <li>Troubleshooting guide</li>
        </ul>
      </section>

      <section>
        <AnchorLink id="example-prompts" level="h2">
          Example Prompts
        </AnchorLink>
        <p>Here are some effective prompts to use with AI assistants:</p>

        <h4>Basic Setup</h4>
        <CodeBlock language="typescript">{`"Using OpenIAP documentation, show me how to initialize
the IAP connection in a React Native app"`}</CodeBlock>

        <h4>Subscriptions</h4>
        <CodeBlock language="typescript">{`"How do I implement subscription purchase with OpenIAP?
Include handling for both iOS and Android."`}</CodeBlock>

        <h4>Error Handling</h4>
        <CodeBlock language="typescript">{`"What errors can occur during purchase and how should
I handle them with OpenIAP?"`}</CodeBlock>

        <h4>Platform-Specific</h4>
        <CodeBlock language="typescript">{`"Show me how to use presentCodeRedemptionSheetIOS
for iOS offer code redemption"`}</CodeBlock>

        <h4>Purchase Restoration</h4>
        <CodeBlock language="typescript">{`"How do I restore previous purchases using
getAvailablePurchases in OpenIAP?"`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="best-practices" level="h2">
          Best Practices
        </AnchorLink>
        <ul>
          <li>
            <strong>Be specific about OpenIAP</strong>: Mention "OpenIAP" or
            "expo-iap" / "react-native-iap" in your prompts to get
            library-specific answers
          </li>
          <li>
            <strong>Reference the documentation URL</strong>: Include the
            llms.txt URL for accurate, up-to-date information
          </li>
          <li>
            <strong>Specify your platform</strong>: Mention iOS, Android, or
            both to get platform-appropriate code
          </li>
          <li>
            <strong>Specify your framework</strong>: Mention React Native,
            Flutter, Swift, Kotlin, or Godot for framework-specific examples
          </li>
          <li>
            <strong>Request code examples</strong>: Ask for working code
            snippets with proper error handling
          </li>
        </ul>
      </section>

      <section
        style={{
          marginTop: '3rem',
          padding: '1.5rem',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '8px',
          borderLeft: '4px solid var(--accent-color)',
        }}
      >
        <p style={{ margin: 0 }}>
          <strong>Tip:</strong> For complex implementations, start with{' '}
          <a
            href="https://openiap.dev/llms.txt"
            target="_blank"
            rel="noopener noreferrer"
          >
            llms.txt
          </a>{' '}
          for quick answers, then reference{' '}
          <a
            href="https://openiap.dev/llms-full.txt"
            target="_blank"
            rel="noopener noreferrer"
          >
            llms-full.txt
          </a>{' '}
          when you need detailed type information or platform-specific APIs.
        </p>
      </section>
    </div>
  );
}

export default AIAssistants;
