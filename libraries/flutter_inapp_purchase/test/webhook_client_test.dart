import 'dart:convert';

import 'package:flutter_inapp_purchase/types.dart';
import 'package:flutter_inapp_purchase/webhook_client.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('parseWebhookEventData', () {
    test('parses a complete event payload', () {
      final raw = jsonEncode({
        'id': 'uuid-1',
        'type': 'SubscriptionRenewed',
        'source': 'AppleAppStoreServerNotificationsV2',
        'platform': 'IOS',
        'environment': 'Production',
        'projectId': 'p-1',
        'occurredAt': 1711000000000,
        'receivedAt': 1711000001000,
        'purchaseToken': 'token-1',
        'productId': 'com.example.premium',
        'subscriptionState': 'Active',
      });
      final event = parseWebhookEventData(raw)!;
      expect(event.id, 'uuid-1');
      expect(event.type, WebhookEventType.SubscriptionRenewed);
      expect(event.purchaseToken, 'token-1');
      expect(event.productId, 'com.example.premium');
    });

    test('returns null for empty / non-JSON / malformed input', () {
      expect(parseWebhookEventData(''), isNull);
      expect(parseWebhookEventData('not json'), isNull);
      // Required fields missing
      expect(
        parseWebhookEventData(jsonEncode({'type': 'SubscriptionRenewed'})),
        isNull,
      );
    });

    test('rejects payloads with unknown event types', () {
      // PR #123 (https://github.com/hyodotdev/openiap/pull/123) review: lenient mapping to a synthetic `Unknown` enum
      // hides spec drift between kit and the SDK consumers. Generated
      // `WebhookEventType.fromJson` throws for unknown values; the
      // parser catches that and returns null so the SSE listener can
      // surface MALFORMED_EVENT instead of emitting a synthetic row.
      final raw = jsonEncode({
        'id': 'uuid-2',
        'type': 'SomethingNew',
        'source': 'AppleAppStoreServerNotificationsV2',
        'platform': 'IOS',
        'environment': 'Production',
        'projectId': 'p-1',
        'occurredAt': 1,
        'receivedAt': 2,
        'purchaseToken': 't',
      });
      expect(parseWebhookEventData(raw), isNull);
    });
  });
}
