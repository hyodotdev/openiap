// Webhook listener for the openiap kit SSE stream
// (`GET /v1/webhooks/stream/{apiKey}`).
//
// Wire format mirrors the canonical TypeScript implementation in
// `packages/gql/src/webhook-client.ts`. The `WebhookEvent` shape comes
// from `packages/gql/src/webhook.graphql` (and is sync-generated into
// `lib/types.dart`).
//
// Why a hand-rolled HTTP/SSE parser instead of an http SSE package:
// the parser is small (~80 lines), matches the openiap project's
// preference for not pulling extra Dart packages into the platform
// SDKs, and gives us total control of the reconnect cadence which is
// what end-of-period billing flows actually depend on.

import 'dart:async';
import 'dart:convert';
import 'dart:io';

/// Possible webhook event kinds. Mirrors the GraphQL
/// `WebhookEventType` enum in `packages/gql/src/webhook.graphql`.
enum WebhookEventTypeName {
  subscriptionStarted,
  subscriptionRenewed,
  subscriptionExpired,
  subscriptionInGracePeriod,
  subscriptionInBillingRetry,
  subscriptionRecovered,
  subscriptionCanceled,
  subscriptionUncanceled,
  subscriptionRevoked,
  subscriptionPriceChange,
  subscriptionProductChanged,
  subscriptionPaused,
  subscriptionResumed,
  purchaseRefunded,
  purchaseConsumptionRequest,
  testNotification,
  unknown,
}

WebhookEventTypeName _parseEventTypeName(String? raw) {
  switch (raw) {
    case 'SubscriptionStarted':
      return WebhookEventTypeName.subscriptionStarted;
    case 'SubscriptionRenewed':
      return WebhookEventTypeName.subscriptionRenewed;
    case 'SubscriptionExpired':
      return WebhookEventTypeName.subscriptionExpired;
    case 'SubscriptionInGracePeriod':
      return WebhookEventTypeName.subscriptionInGracePeriod;
    case 'SubscriptionInBillingRetry':
      return WebhookEventTypeName.subscriptionInBillingRetry;
    case 'SubscriptionRecovered':
      return WebhookEventTypeName.subscriptionRecovered;
    case 'SubscriptionCanceled':
      return WebhookEventTypeName.subscriptionCanceled;
    case 'SubscriptionUncanceled':
      return WebhookEventTypeName.subscriptionUncanceled;
    case 'SubscriptionRevoked':
      return WebhookEventTypeName.subscriptionRevoked;
    case 'SubscriptionPriceChange':
      return WebhookEventTypeName.subscriptionPriceChange;
    case 'SubscriptionProductChanged':
      return WebhookEventTypeName.subscriptionProductChanged;
    case 'SubscriptionPaused':
      return WebhookEventTypeName.subscriptionPaused;
    case 'SubscriptionResumed':
      return WebhookEventTypeName.subscriptionResumed;
    case 'PurchaseRefunded':
      return WebhookEventTypeName.purchaseRefunded;
    case 'PurchaseConsumptionRequest':
      return WebhookEventTypeName.purchaseConsumptionRequest;
    case 'TestNotification':
      return WebhookEventTypeName.testNotification;
    default:
      return WebhookEventTypeName.unknown;
  }
}

/// A normalized webhook event delivered by the kit SSE stream.
class WebhookEvent {
  WebhookEvent({
    required this.id,
    required this.type,
    required this.rawType,
    required this.source,
    required this.platform,
    required this.environment,
    required this.projectId,
    required this.occurredAt,
    required this.receivedAt,
    required this.purchaseToken,
    required this.raw,
    this.productId,
    this.subscriptionState,
    this.expiresAt,
    this.renewsAt,
    this.cancellationReason,
    this.currency,
    this.priceAmountMicros,
    this.rawSignedPayload,
  });

  /// Stable identifier — matches `notificationUUID` (Apple) /
  /// `messageId` (Google).
  final String id;
  final WebhookEventTypeName type;

  /// Raw `type` string as delivered on the wire. Useful when the spec
  /// adds new types ahead of the SDK enum.
  final String rawType;
  final String source;
  final String platform;
  final String environment;
  final String projectId;
  final int occurredAt;
  final int receivedAt;
  final String purchaseToken;
  final String? productId;
  final String? subscriptionState;
  final int? expiresAt;
  final int? renewsAt;
  final String? cancellationReason;
  final String? currency;
  final int? priceAmountMicros;
  final String? rawSignedPayload;

  /// Parsed JSON for fields outside the strongly-typed surface.
  final Map<String, dynamic> raw;

  static WebhookEvent? tryParse(Map<String, dynamic> raw) {
    final id = raw['id'];
    final type = raw['type'];
    final purchaseToken = raw['purchaseToken'];
    final occurredAt = raw['occurredAt'];
    final receivedAt = raw['receivedAt'];

    if (id is! String ||
        type is! String ||
        purchaseToken is! String ||
        occurredAt is! num ||
        receivedAt is! num) {
      return null;
    }

    return WebhookEvent(
      id: id,
      type: _parseEventTypeName(type),
      rawType: type,
      source: raw['source']?.toString() ?? '',
      platform: raw['platform']?.toString() ?? '',
      environment: raw['environment']?.toString() ?? '',
      projectId: raw['projectId']?.toString() ?? '',
      occurredAt: occurredAt.toInt(),
      receivedAt: receivedAt.toInt(),
      purchaseToken: purchaseToken,
      productId: raw['productId'] as String?,
      subscriptionState: raw['subscriptionState'] as String?,
      expiresAt: (raw['expiresAt'] as num?)?.toInt(),
      renewsAt: (raw['renewsAt'] as num?)?.toInt(),
      cancellationReason: raw['cancellationReason'] as String?,
      currency: raw['currency'] as String?,
      priceAmountMicros: (raw['priceAmountMicros'] as num?)?.toInt(),
      rawSignedPayload: raw['rawSignedPayload'] as String?,
      raw: raw,
    );
  }
}

/// Errors surfaced by the SSE listener.
class WebhookListenerError {
  WebhookListenerError(this.code, this.message, [this.cause]);

  final String code;
  final String message;
  final Object? cause;

  @override
  String toString() => 'WebhookListenerError($code): $message';
}

/// Active subscription. Cancel via [close].
abstract class WebhookListener {
  Stream<WebhookEvent> get events;
  Stream<WebhookListenerError> get errors;
  Future<void> close();
}

class _SseWebhookListener implements WebhookListener {
  _SseWebhookListener({
    required this.apiKey,
    required this.baseUrl,
    required this.reconnectDelay,
    HttpClient? httpClient,
  }) : _httpClient = httpClient ?? HttpClient();

  final String apiKey;
  final String baseUrl;
  final Duration reconnectDelay;
  final HttpClient _httpClient;

  final StreamController<WebhookEvent> _events =
      StreamController<WebhookEvent>.broadcast();
  final StreamController<WebhookListenerError> _errors =
      StreamController<WebhookListenerError>.broadcast();

  bool _closed = false;
  String? _lastEventId;
  HttpClientRequest? _pendingRequest;
  StreamSubscription<List<int>>? _bodySub;

  @override
  Stream<WebhookEvent> get events => _events.stream;

  @override
  Stream<WebhookListenerError> get errors => _errors.stream;

  @override
  Future<void> close() async {
    _closed = true;
    await _bodySub?.cancel();
    _bodySub = null;
    _pendingRequest?.abort();
    _pendingRequest = null;
    _httpClient.close(force: true);
    await _events.close();
    await _errors.close();
  }

  Future<void> start() async {
    while (!_closed) {
      try {
        await _runOnce();
      } catch (error, stack) {
        _errors.add(
          WebhookListenerError(
            'TRANSPORT_ERROR',
            'SSE stream error: $error',
            stack,
          ),
        );
      }
      if (_closed) break;
      await Future<void>.delayed(reconnectDelay);
    }
  }

  Future<void> _runOnce() async {
    final trimmed =
        baseUrl.endsWith('/') ? baseUrl.substring(0, baseUrl.length - 1) : baseUrl;
    final uri = Uri.parse(
      '$trimmed/v1/webhooks/stream/${Uri.encodeComponent(apiKey)}',
    );

    final request = await _httpClient.getUrl(uri);
    request.headers.set(HttpHeaders.acceptHeader, 'text/event-stream');
    if (_lastEventId != null) {
      request.headers.set('Last-Event-ID', _lastEventId!);
    }
    _pendingRequest = request;

    final response = await request.close();
    if (response.statusCode != 200) {
      throw HttpException('SSE stream returned ${response.statusCode}');
    }

    final completer = Completer<void>();
    final buffer = StringBuffer();

    _bodySub = response.listen(
      (chunk) {
        buffer.write(utf8.decode(chunk, allowMalformed: true));
        _drainSseFrames(buffer);
      },
      onError: (Object error, StackTrace stack) {
        if (!completer.isCompleted) {
          completer.completeError(error, stack);
        }
      },
      onDone: () {
        if (!completer.isCompleted) {
          completer.complete();
        }
      },
      cancelOnError: true,
    );

    try {
      await completer.future;
    } finally {
      await _bodySub?.cancel();
      _bodySub = null;
      _pendingRequest = null;
    }
  }

  void _drainSseFrames(StringBuffer buffer) {
    var content = buffer.toString();
    final frameSeparator = RegExp(r'\r?\n\r?\n');
    while (true) {
      final match = frameSeparator.firstMatch(content);
      if (match == null) break;
      final frame = content.substring(0, match.start);
      content = content.substring(match.end);
      _processFrame(frame);
    }
    buffer
      ..clear()
      ..write(content);
  }

  void _processFrame(String frame) {
    if (frame.isEmpty) return;
    String? eventName;
    String? eventId;
    final dataLines = <String>[];
    for (final rawLine in frame.split(RegExp(r'\r?\n'))) {
      if (rawLine.startsWith(':')) continue; // SSE comment
      final colonIdx = rawLine.indexOf(':');
      if (colonIdx < 0) continue;
      final field = rawLine.substring(0, colonIdx).trim();
      var value = rawLine.substring(colonIdx + 1);
      if (value.startsWith(' ')) value = value.substring(1);
      switch (field) {
        case 'event':
          eventName = value;
          break;
        case 'id':
          eventId = value;
          break;
        case 'data':
          dataLines.add(value);
          break;
      }
    }
    if (eventId != null && eventId.isNotEmpty) {
      _lastEventId = eventId;
    }
    if (dataLines.isEmpty) return;
    final dataStr = dataLines.join('\n');
    if (dataStr.isEmpty) return;
    if (eventName == 'heartbeat' || eventName == 'ready') return;

    Map<String, dynamic>? decoded;
    try {
      final value = jsonDecode(dataStr);
      if (value is Map<String, dynamic>) {
        decoded = value;
      }
    } catch (error) {
      _errors.add(
        WebhookListenerError(
          'PARSE_ERROR',
          'Failed to parse SSE payload: $error',
        ),
      );
      return;
    }
    if (decoded == null) return;

    final event = WebhookEvent.tryParse(decoded);
    if (event == null) {
      _errors.add(
        WebhookListenerError(
          'MALFORMED_EVENT',
          'WebhookEvent missing required fields',
        ),
      );
      return;
    }
    _events.add(event);
  }
}

/// Open a long-lived listener against the kit SSE stream. The
/// listener auto-reconnects with `Last-Event-ID` until [close] is
/// called.
WebhookListener connectWebhookStream({
  required String apiKey,
  String baseUrl = 'https://kit.openiap.dev',
  Duration reconnectDelay = const Duration(seconds: 2),
  HttpClient? httpClient,
}) {
  final listener = _SseWebhookListener(
    apiKey: apiKey,
    baseUrl: baseUrl,
    reconnectDelay: reconnectDelay,
    httpClient: httpClient,
  );
  // Fire-and-forget the loop; consumers gate via [close].
  // ignore: unawaited_futures
  listener.start();
  return listener;
}

// Pure helper exposed for tests so we can validate the parser
// without spinning up a real HTTP listener.
WebhookEvent? parseWebhookEventData(String raw) {
  if (raw.isEmpty) return null;
  try {
    final decoded = jsonDecode(raw);
    if (decoded is! Map<String, dynamic>) return null;
    return WebhookEvent.tryParse(decoded);
  } catch (_) {
    return null;
  }
}
