**Company Name:** Hyo Dev

**Service:** Purchase validation and entitlement infrastructure for the Apple App Store, Google Play, Amazon Appstore, and Meta Horizon

**Last updated:** 2026-11-26

Hyo Dev (“we”, “our”, “us”) provides purchase validation and entitlement infrastructure for app-store purchases. We are committed to protecting your privacy and handling your information responsibly. This Privacy Policy explains what information we collect, how we use it, and your rights.

---

## 1. Information We Collect

### 1.1. Account Information

When you create an account, we collect:

- **Email address**
- **Company name**

This information is required to create and manage your account.

### 1.2. Transaction and Entitlement Data

Our service processes **transaction and entitlement information** from the Apple App Store, Google Play, Amazon Appstore, and Meta Horizon. Depending on the integration, this data may include:

- Store or app-scoped user identifiers
- The user ID your app or backend sends with a purchase, checkout, or entitlement request
- Transaction, receipt, purchase-token, product, subscription, and entitlement metadata
- The signed notifications the stores send about your app's purchases
- Information needed to validate purchases, reconcile store state, and maintain entitlements

We do **not** receive or store payment card details.

### 1.3. Automatically Collected Information

We may collect technical information such as:

- Server logs
- IP addresses
- Usage metadata

This is used for security, debugging, and performance.

### 1.4. Sponsorship Links

If your organization sponsors OpenIAP on GitHub and we link that sponsorship to it, we store the sponsoring GitHub account, the sponsorship amount, and when we linked it. We use them only to stop sponsorship notices to your organization and to show the sponsorship on its Usage page. We store nothing about sponsorships that are not linked to an organization.

### 1.5. Project Configuration

To verify purchases and sync products for a project, we store:

- Store credentials: the Apple App Store Server API key file, the App Store Connect API key file, the Google service account file, the Amazon Appstore shared secret, and the Meta Horizon app ID and secret
- One App Review screenshot per project, which we send to App Store Connect when you sync iOS products
- The webhook destination URLs you register, and the signing secret IAPKit generates for each

### 1.6. External Checkouts

If your backend registers a Stripe checkout paid outside the stores, we store the order ID, user ID, product ID, and region you send, and the payment facts we read from your Stripe account: the payment, invoice, charge, and refund identifiers, amounts, currency, payment time, and subscription period. To read them, IAPKit holds your Stripe account ID, API key, and webhook signing secret in its deployment configuration, not in these records.

### 1.7. Connected Apps

When you connect an AI assistant such as Claude or ChatGPT to a project, we store which assistant, the project, whether it may make changes, who approved it, and when it was connected and last used. Its tokens are stored only as one-way hashes.

---

## 2. How We Use Your Information

We use the information we collect to:

- Provide, maintain, and improve our service
- Authenticate and manage user accounts
- Email organization owners and admins about service matters, including the sponsorship notices on the [Pricing](https://kit.openiap.dev/pricing) page, which use the organization's production subscription revenue tracked by the service
- Email account holders occasional product updates about new IAPKit features. Each one goes to a single address and has an unsubscribe link; unsubscribing does not stop service emails
- Offer customer support
- Ensure platform security
- Comply with legal obligations

We **do not** sell or share personal information for marketing purposes.

---

## 3. Legal Basis for Processing (GDPR)

For users in the European Economic Area (EEA), we process data based on:

- **Contract necessity**
- **Legitimate interests**
- **Legal compliance**

---

## 4. Data Sharing and Third-Party Providers

We use trusted third-party services to operate our platform.

### Convex (Application Data Platform)

We use Convex to host and process application data. Convex may store:

- Account email
- Company name
- Transaction and entitlement data, including store or app-scoped identifiers when supplied

Data is processed only as needed to provide our service.

### Fly.io (Application Hosting)

Fly.io hosts the IAPKit web application and API. Requests may pass through its infrastructure and produce limited operational or security logs.

### GitHub and Resend (Authentication and Email)

If you choose GitHub sign-in, GitHub provides the account details needed to authenticate you. Resend delivers email one-time passwords, service emails such as sponsorship notices, and product update emails. It processes the destination email address for that purpose and keeps the list of addresses that unsubscribed from product updates.

### Sentry (Error and Performance Monitoring)

We use Sentry in the hosted web application and API to diagnose errors, security issues, and performance problems. Reports may include stack traces, request and browser metadata, IP addresses, logs, and account context available when an error occurs. The hosted browser application enables Sentry's default personally identifiable information handling; server-side handling depends on the deployment configuration.

### Mixpanel (Product Analytics)

We use Mixpanel in the hosted web application to understand adoption and improve product flows. Mixpanel receives product events, page views, clicks, form interactions, browser identifiers stored in local storage. Session replay is disabled. Identifying app-user path segments and query values are redacted from event URLs. After sign-in, analytics profiles may include the user ID, email address, display name, current organization ID, sign-in method, and event-specific project or organization identifiers. Mixpanel data is sent to its EU API endpoint.

### Store Platforms (Purchase Verification)

When you ask IAPKit to verify or reconcile a purchase, the relevant transaction identifiers and app configuration are sent only to the applicable platform: Apple, Google, Amazon, or Meta. Those platforms process the request under their own privacy policies.

### Stripe (External Checkouts)

When your backend registers a Stripe checkout, IAPKit reads that payment from your Stripe account and receives Stripe's signed webhooks for it. IAPKit then reports the purchase to Apple or Google, as the checkout asks. Stripe processes the payment under its own privacy policy.

### AI Assistants You Connect

If you connect an AI assistant to a project, it receives the project data its requests return, such as products, subscribers, purchases, and revenue. Its provider, for example Anthropic or OpenAI, processes that data under its own privacy policy.

We disclose personal data only as needed to operate, analyze, improve, secure, support, and validate the service, or to comply with law. We do not sell personal data or share it for third-party marketing.

---

## 5. International Data Transfers

Because our customers are located globally, your information may be processed in countries outside your own.
We use safeguards such as:

- Standard Contractual Clauses (SCCs)
- Industry-standard security practices

---

## 6. Data Retention

We retain:

- **Account data** for as long as your account is active
- **Transaction data** as required to operate the service
- **Store notifications** for 30 days after we receive them. A subscription keeps a summary of its latest notification (its type, time, and transaction identifiers) as transaction data
- **Purchase records no store recognized** for 30 days after the last time a store failed to recognize them. A record that held any other verdict, or is linked to a user, an order, or a subscription, is kept as transaction data, as is a record last checked before November 17, 2026
- **Project configuration** (store credentials, the review screenshot, webhook destinations) until you remove it or the project is deleted
- **Sponsorship links** until the link is removed or the organization is deleted
- **Connected apps** until disconnected, until the approving member leaves the organization, 30 days after the assistant last renewed its access, or when the approving account or project is deleted
- **Logs and diagnostics** for a limited time for security and debugging

You can delete your account yourself on the Profile page, or ask us to.

---

## 7. Security

We use technical and organizational measures to protect data, including:

- Encrypted connections (HTTPS/TLS)
- Secure hosting infrastructure
- Access controls and audit logs

---

## 8. Children's Privacy

The service is **not intended for children under 16**, and we do not knowingly collect personal information from them.

---

## 9. Your Rights

Depending on your location (e.g., GDPR, CCPA), you may have the right to:

- Access your personal data
- Correct inaccurate information
- Request deletion
- Restrict or object to processing
- Request data portability

To exercise these rights, contact us at **[hyo@hyo.dev](mailto:hyo@hyo.dev)**.

---

## 10. Changes to This Policy

We may update this Privacy Policy occasionally.
We will notify users of material changes by email or through our website.

---

## 11. Contact Us

If you have questions about this policy or your data, you can contact: Hyo Dev (OpenIAP Founding Company)
