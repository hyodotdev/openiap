import { useScrollToHash } from '../../hooks/useScrollToHash'
import CodeBlock from '../../components/CodeBlock'

function Updates() {
  useScrollToHash()
  
  return (
    <div className="doc-page">
      <h1>Notes</h1>
      <p>Important changes and deprecations in IAP libraries and platforms.</p>
      
      <section>
        <h2>✨ New Features</h2>
        
        <div style={{
          background: 'rgba(0, 200, 100, 0.1)',
          border: '1px solid rgba(0, 200, 100, 0.3)',
          borderRadius: '0.5rem',
          padding: '1rem',
          marginBottom: '1.5rem'
        }}>
          <h4 style={{ marginTop: 0, color: 'var(--text-primary)' }}>
            📅 January 2025 - Subscription Status APIs
          </h4>
          <p>New standardized APIs for checking subscription status across platforms.</p>
          <ul>
            <li><code>getActiveSubscriptions()</code> - Get detailed information about active subscriptions</li>
            <li><code>hasActiveSubscriptions()</code> - Simple boolean check for subscription status</li>
            <li>Automatic detection of all active subscriptions without requiring product IDs</li>
            <li>Platform-specific details (iOS expiration dates, Android auto-renewal status)</li>
          </ul>
          <p>See: <a href="#subscription-management">Subscription Management APIs</a></p>
        </div>
      </section>
      
      <section>
        <h2>⚠️ Breaking Changes</h2>
        
        <h3>Google Play Billing Library</h3>
        
        <div style={{ 
          background: 'rgba(255, 200, 0, 0.1)', 
          border: '1px solid rgba(255, 200, 0, 0.3)',
          borderRadius: '0.5rem',
          padding: '1rem',
          marginBottom: '1.5rem'
        }}>
          <h4 style={{ marginTop: 0, color: 'var(--text-primary)' }}>
            📅 August 31, 2024 - Billing Library v5 Deprecated
          </h4>
          <p>All apps must use Google Play Billing Library v6.0.1 or later.</p>
          <ul>
            <li>Migration deadline: August 31, 2024 (extended to November 1, 2024)</li>
            <li>New apps must use v6+ immediately</li>
            <li>Existing apps must update before deadline</li>
          </ul>
        </div>

        <h3>Static Test Product IDs Deprecated</h3>
        <p>The following static test product IDs are <strong>no longer supported</strong> in Play Billing Library v3+:</p>
        
        <table className="error-table">
          <thead>
            <tr>
              <th>Deprecated Product ID</th>
              <th>Previous Behavior</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code style={{ textDecoration: 'line-through' }}>android.test.purchased</code></td>
              <td>Simulated successful purchase</td>
              <td>❌ No longer works</td>
            </tr>
            <tr>
              <td><code style={{ textDecoration: 'line-through' }}>android.test.canceled</code></td>
              <td>Simulated canceled purchase</td>
              <td>❌ No longer works</td>
            </tr>
            <tr>
              <td><code style={{ textDecoration: 'line-through' }}>android.test.refunded</code></td>
              <td>Simulated refunded purchase</td>
              <td>❌ No longer works</td>
            </tr>
            <tr>
              <td><code style={{ textDecoration: 'line-through' }}>android.test.item_unavailable</code></td>
              <td>Simulated unavailable item</td>
              <td>❌ No longer works</td>
            </tr>
          </tbody>
        </table>
        
        <h4>Alternative Testing Methods</h4>
        <p>Use these methods instead of static test IDs:</p>
        <ol>
          <li><strong>License Testing</strong> - Configure test accounts in Google Play Console</li>
          <li><strong>Test Tracks</strong> - Use internal/closed testing tracks</li>
          <li><strong>Real Products</strong> - Create actual products and use test accounts</li>
        </ol>
      </section>

      <section>
        <h2>🔄 Migration Guides</h2>
        
        <h3>Migrating from Static Test IDs</h3>
        
        <h4>Before (Deprecated):</h4>
        <CodeBlock language="typescript">
{`// ❌ This no longer works
const testProduct = await requestProducts(['android.test.purchased'])
// Returns SERVICE_DISCONNECTED error`}
        </CodeBlock>
        
        <h4>After (Current approach):</h4>
        <CodeBlock language="typescript">
{`// ✅ Use real product with test account
// 1. Add test account in Play Console
// 2. Use real product ID
const testProduct = await requestProducts(['your_real_product_id'])
// Test account won't be charged`}
        </CodeBlock>

        <h3>Setting Up License Testing</h3>
        <ol>
          <li>Go to Google Play Console → Settings → License Testing</li>
          <li>Add tester email addresses (must be Google accounts)</li>
          <li>Testers must join your testing program</li>
          <li>Use real product IDs in your code</li>
          <li>Test purchases won't charge testers</li>
        </ol>
      </section>

      <section>
        <h2>📊 Version Compatibility</h2>
        
        <h3>Google Play Billing Library Timeline</h3>
        <table className="error-table">
          <thead>
            <tr>
              <th>Version</th>
              <th>Status</th>
              <th>Deprecation Date</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>v7.x</td>
              <td>✅ Current</td>
              <td>August 31, 2025</td>
              <td>Latest recommended version</td>
            </tr>
            <tr>
              <td>v6.x</td>
              <td>✅ Supported</td>
              <td>August 31, 2025</td>
              <td>Minimum required version</td>
            </tr>
            <tr>
              <td>v5.x</td>
              <td>❌ Deprecated</td>
              <td>August 31, 2024</td>
              <td>No longer accepted</td>
            </tr>
            <tr>
              <td>v4.x</td>
              <td>❌ Deprecated</td>
              <td>August 2, 2023</td>
              <td>No longer accepted</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>🆕 Recent Updates</h2>
        
        <h3>Google Play Billing Library v7 (May 2024)</h3>
        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
          Released at Google I/O 2024
        </p>
        <ul>
          <li><strong>Installment Subscriptions</strong> - New monetization model for subscription payments</li>
          <li><strong>Enhanced Pending Purchases</strong> - Better handling of pending transactions</li>
          <li><strong>Improved Error Codes</strong> - More specific error responses including NETWORK_ERROR</li>
          <li><strong>Subscription Management APIs</strong> - Simplified subscription state management</li>
          <li><strong>Performance Improvements</strong> - Optimized billing flow and reduced latency</li>
        </ul>
        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginTop: "0.5rem" }}>
          ⚠️ Deadline: All apps must migrate from v5 by November 1, 2024
        </p>

        <h3>iOS StoreKit 2 Evolution</h3>
        
        <h4>WWDC 2024 - StoreKit 1 Deprecation (iOS 18+)</h4>
        <ul>
          <li><strong>⚠️ StoreKit 1 officially deprecated</strong> - Now called "original API"</li>
          <li><strong>Promoted purchases API</strong> - New Swift API (iOS 16.4+)</li>
          <li><strong>App account token</strong> - Track user accounts across transactions</li>
          <li>All new features exclusive to StoreKit 2</li>
        </ul>

        <h4>WWDC 2023 Updates (iOS 17+)</h4>
        <ul>
          <li><strong>Storefront fields</strong> - Access to storefront and country code</li>
          <li><strong>Purchase reason</strong> - Distinguish user-initiated vs auto-renewal</li>
          <li><strong>nextRenewalDate</strong> - Direct access in RenewalInfo model</li>
          <li>Most features work retroactively with iOS 15+ when using Xcode 15</li>
        </ul>

        <h4>WWDC 2022 Updates (iOS 16+)</h4>
        <ul>
          <li><strong>Message API</strong> - App Store notifications to customers</li>
          <li><strong>Environment property</strong> - Distinguish sandbox/production purchases</li>
          <li><strong>recentSubscriptionStartDate</strong> - Track subscription continuity</li>
          <li><strong>originalPurchaseDate</strong> - Support for paid-to-subscription migrations</li>
        </ul>

        <h4>WWDC 2021 - Initial Release (iOS 15+)</h4>
        <ul>
          <li><strong>Swift async/await API</strong> - Modern concurrency patterns</li>
          <li><strong>One-line purchase flow</strong> - Simplified purchase implementation</li>
          <li><strong>Built-in receipt validation</strong> - No server-side validation required</li>
          <li><strong>Transaction history API</strong> - Easy access to purchase history</li>
        </ul>
      </section>
    </div>
  )
}

export default Updates