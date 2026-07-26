import 'package:flutter/material.dart';

class WebhookStreamScreen extends StatelessWidget {
  const WebhookStreamScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Webhook Stream')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: const [
          Text(
            'Trusted backend or MCP only',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          SizedBox(height: 16),
          _InfoCard(
            title: 'Do not connect from a shipped app',
            body: 'The project-wide IAPKit stream contains lifecycle records '
                'and purchase identifiers. It requires an openiap-kit_sk_ '
                'secret admin key, which must never be embedded in a Flutter '
                'app.',
            warning: true,
          ),
          SizedBox(height: 12),
          _InfoCard(
            title: 'Mobile app',
            body: 'Use an openiap-kit_pk_ publishable key for purchase '
                'verification, user-scoped entitlement helpers, and public '
                'product payloads.',
          ),
          SizedBox(height: 12),
          _InfoCard(
            title: 'Trusted consumer',
            body: 'MCP, CI, or your backend connects to GET '
                '/v1/webhooks/stream and sends Authorization: Bearer '
                '<IAPKIT_SECRET_KEY>. If your backend protects paid content, '
                'it should make the final entitlement decision.',
          ),
          SizedBox(height: 16),
          Text(
            'Configure the separate lifecycle webhook URL from the IAPKit '
            'dashboard in App Store Connect and Google Cloud Pub/Sub.',
          ),
        ],
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({
    required this.title,
    required this.body,
    this.warning = false,
  });

  final String title;
  final String body;
  final bool warning;

  @override
  Widget build(BuildContext context) {
    return Card(
      color: warning ? const Color(0xFFFFF7ED) : null,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Text(body),
          ],
        ),
      ),
    );
  }
}
