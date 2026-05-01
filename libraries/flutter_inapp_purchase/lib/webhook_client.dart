// Webhook listener for the openiap kit SSE stream
// (`GET /v1/webhooks/stream/{apiKey}`).
//
// Wire format mirrors the canonical TypeScript implementation in
// `packages/gql/src/webhook-client.ts`. The `WebhookEvent` value type
// + enums (`WebhookEventType`, `WebhookEventSource`, `IapPlatform`,
// `SubscriptionState`, `WebhookEventEnvironment`,
// `WebhookCancellationReason`) come from the generated
// `lib/types.dart` (synced from `packages/gql/src/webhook.graphql`),
// so this file only adds:
//
//   - `parseWebhookEventData` — pure JSON-string → WebhookEvent
//   - `connectWebhookStream` — long-lived HTTP+SSE listener with
//     auto-reconnect via `Last-Event-ID`
//
// Why a hand-rolled SSE parser instead of an http SSE package: the
// parser is small (~80 lines), matches the openiap project's
// preference for not pulling extra Dart packages into the platform
// SDKs, and gives us total control of the reconnect cadence which is
// what end-of-period billing flows actually depend on.

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'types.dart';

/// Pure parser exported for tests so the SSE-frame → `WebhookEvent`
/// path can be validated without spinning up a real HTTP listener.
WebhookEvent? parseWebhookEventData(String raw) {
  if (raw.isEmpty) return null;
  Map<String, dynamic>? decoded;
  try {
    final value = jsonDecode(raw);
    if (value is Map<String, dynamic>) decoded = value;
  } catch (_) {
    return null;
  }
  if (decoded == null) return null;
  if (!decoded.containsKey('id') ||
      !decoded.containsKey('type') ||
      !decoded.containsKey('purchaseToken') ||
      !decoded.containsKey('occurredAt') ||
      !decoded.containsKey('receivedAt')) {
    return null;
  }
  // The wire format kit currently emits uses GraphQL enum identifiers
  // (PascalCase, e.g. `AppleAppStoreServerNotificationsV2`). The
  // generated Dart `fromJson` factories only accept the kebab-case
  // wire form (`apple-app-store-server-notifications-v2`). Normalize
  // each enum field here so consumers don't have to know about the
  // representational difference. PR #123 review caught this drift.
  return _decodeWithFallback(decoded);
}

WebhookEvent? _decodeWithFallback(Map<String, dynamic> json) {
  try {
    return WebhookEvent.fromJson(json);
  } catch (_) {
    // The kebab-case `fromJson` rejected one or more enum values; try
    // again after rewriting the source/type/platform/environment/state
    // /cancellationReason fields to their kebab-case equivalents.
    final mapped = Map<String, dynamic>.of(json);
    _rewriteEnumByName<WebhookEventType>(
      mapped,
      'type',
      WebhookEventType.values,
      (e) => e.value,
    );
    _rewriteEnumByName<WebhookEventSource>(
      mapped,
      'source',
      WebhookEventSource.values,
      (e) => e.value,
    );
    _rewriteEnumByName<IapPlatform>(
      mapped,
      'platform',
      IapPlatform.values,
      (e) => e.value,
    );
    _rewriteEnumByName<WebhookEventEnvironment>(
      mapped,
      'environment',
      WebhookEventEnvironment.values,
      (e) => e.value,
    );
    _rewriteEnumByName<SubscriptionState>(
      mapped,
      'subscriptionState',
      SubscriptionState.values,
      (e) => e.value,
    );
    _rewriteEnumByName<WebhookCancellationReason>(
      mapped,
      'cancellationReason',
      WebhookCancellationReason.values,
      (e) => e.value,
    );
    try {
      return WebhookEvent.fromJson(mapped);
    } catch (_) {
      return null;
    }
  }
}

void _rewriteEnumByName<T extends Enum>(
  Map<String, dynamic> json,
  String field,
  List<T> values,
  String Function(T) toWire,
) {
  final raw = json[field];
  if (raw is! String) return;
  for (final value in values) {
    if (value.name == raw) {
      json[field] = toWire(value);
      return;
    }
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
  }) : _httpClient = httpClient ?? HttpClient(),
       _ownsHttpClient = httpClient == null;

  final String apiKey;
  final String baseUrl;
  final Duration reconnectDelay;
  final HttpClient _httpClient;
  // Only close the underlying HttpClient if we created it ourselves.
  // Callers may share a single HttpClient across multiple listeners or
  // unrelated request flows; force-closing a caller-owned client would
  // tear down their other in-flight requests.
  final bool _ownsHttpClient;

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
    if (_ownsHttpClient) {
      _httpClient.close(force: true);
    }
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
    final trimmed = baseUrl.endsWith('/')
        ? baseUrl.substring(0, baseUrl.length - 1)
        : baseUrl;
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

    // The kit server emits `event: stream-error` with a JSON `{message}`
    // payload when the backend Convex subscription itself fails (e.g. the
    // project's API key was rotated mid-stream). Surface those as a
    // distinct error code so callers can react — falling through to
    // `parseWebhookEventData` would mis-report it as MALFORMED_EVENT.
    if (eventName == 'stream-error') {
      String message = dataStr;
      try {
        final decoded = jsonDecode(dataStr);
        if (decoded is Map<String, dynamic> && decoded['message'] is String) {
          message = decoded['message'] as String;
        }
      } catch (_) {
        // Fall back to raw frame body.
      }
      _errors.add(WebhookListenerError('STREAM_ERROR', message));
      return;
    }

    final event = parseWebhookEventData(dataStr);
    if (event == null) {
      _errors.add(
        WebhookListenerError(
          'MALFORMED_EVENT',
          'WebhookEvent missing required fields or unknown type',
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
