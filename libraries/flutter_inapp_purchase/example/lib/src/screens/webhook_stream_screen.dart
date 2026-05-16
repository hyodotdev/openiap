import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_inapp_purchase/types.dart';
import 'package:flutter_inapp_purchase/webhook_client.dart';

import '../constants.dart';

class WebhookStreamScreen extends StatefulWidget {
  const WebhookStreamScreen({Key? key}) : super(key: key);

  @override
  State<WebhookStreamScreen> createState() => _WebhookStreamScreenState();
}

class _WebhookStreamScreenState extends State<WebhookStreamScreen> {
  final List<WebhookEvent> _events = <WebhookEvent>[];
  WebhookListener? _listener;
  StreamSubscription<WebhookEvent>? _eventSubscription;
  StreamSubscription<WebhookListenerError>? _errorSubscription;
  String _status = 'idle';
  String? _statusMessage;
  bool _testing = false;

  @override
  void dispose() {
    _eventSubscription?.cancel();
    _errorSubscription?.cancel();
    _listener?.close();
    super.dispose();
  }

  void _connect() {
    final apiKey = IapConstants.iapkitApiKey;
    if (apiKey.isEmpty) {
      setState(() {
        _status = 'error';
        _statusMessage = 'IAPKIT_API_KEY is not configured.';
      });
      return;
    }

    _eventSubscription?.cancel();
    _errorSubscription?.cancel();
    _listener?.close();

    final listener = connectWebhookStream(
      apiKey: apiKey,
      baseUrl: IapConstants.iapkitBaseUrl,
    );

    _eventSubscription = listener.events.listen((event) {
      setState(() {
        _events.insert(0, event);
        if (_events.length > 50) {
          _events.removeRange(50, _events.length);
        }
        _status = 'connected';
        _statusMessage = null;
      });
    });
    _errorSubscription = listener.errors.listen((error) {
      setState(() {
        _status = 'error';
        _statusMessage = '${error.code}: ${error.message}';
      });
    });

    setState(() {
      _listener = listener;
      _status = 'connected';
      _statusMessage = null;
    });
  }

  void _disconnect() {
    _eventSubscription?.cancel();
    _errorSubscription?.cancel();
    _listener?.close();
    setState(() {
      _listener = null;
      _status = 'idle';
      _statusMessage = null;
    });
  }

  Future<void> _triggerTestNotification() async {
    final apiKey = IapConstants.iapkitApiKey;
    if (apiKey.isEmpty) {
      setState(() {
        _statusMessage = 'Cannot trigger test: IAPKIT_API_KEY is missing.';
      });
      return;
    }

    setState(() {
      _testing = true;
    });

    try {
      final client = HttpClient();
      final baseUrl = IapConstants.iapkitBaseUrl.replaceFirst(
        RegExp(r'/$'),
        '',
      );
      final request = await client.postUrl(
        Uri.parse('$baseUrl/v1/webhooks/${Uri.encodeComponent(apiKey)}'),
      );
      request.headers.contentType = ContentType.json;
      final dataJson = jsonEncode(<String, Object>{
        'version': '1.0',
        'packageName': 'com.example.app',
        'eventTimeMillis': DateTime.now().millisecondsSinceEpoch.toString(),
        'testNotification': <String, String>{'version': '1.0'},
      });
      final payload = <String, Object>{
        'message': <String, String>{
          'data': base64Encode(utf8.encode(dataJson)),
          'messageId': 'flutter-test-${DateTime.now().millisecondsSinceEpoch}',
          'publishTime': DateTime.now().toUtc().toIso8601String(),
        },
        'subscription': 'projects/example/subscriptions/iapkit-rtdn',
      };
      request.write(jsonEncode(payload));
      final response = await request.close();
      final body = await response.transform(utf8.decoder).join();
      client.close(force: true);
      setState(() {
        _statusMessage = response.statusCode >= 200 && response.statusCode < 300
            ? 'Test notification accepted.'
            : 'Test POST returned ${response.statusCode}: $body';
      });
    } catch (error) {
      setState(() {
        _statusMessage = 'Test POST failed: $error';
      });
    } finally {
      setState(() {
        _testing = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final apiKey = IapConstants.iapkitApiKey;
    return Scaffold(
      appBar: AppBar(title: const Text('Webhook Stream')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'SSE /v1/webhooks/stream/{apiKey}',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 8),
                Text(
                  'api key: ${apiKey.isEmpty ? 'MISSING' : 'CONFIGURED'}',
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton(
                        onPressed: _status == 'idle' || _status == 'error'
                            ? _connect
                            : _disconnect,
                        child: Text(
                          _status == 'idle' || _status == 'error'
                              ? 'Connect'
                              : 'Disconnect',
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: _testing ? null : _triggerTestNotification,
                        child: _testing
                            ? const CupertinoActivityIndicator()
                            : const Text('Trigger test'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                _StatusBanner(status: _status, message: _statusMessage),
              ],
            ),
          ),
          Expanded(
            child: _events.isEmpty
                ? const Center(child: Text('No webhook events yet.'))
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: _events.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final event = _events[index];
                      return Card(
                        child: ListTile(
                          title: Text(event.type.name),
                          subtitle: Text(
                            'source: ${event.source.name}\n'
                            'platform: ${event.platform.name}\n'
                            'productId: ${event.productId ?? '-'}',
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}

class _StatusBanner extends StatelessWidget {
  const _StatusBanner({required this.status, required this.message});

  final String status;
  final String? message;

  @override
  Widget build(BuildContext context) {
    final color = switch (status) {
      'connected' => const Color(0xFFE5F7EA),
      'error' => const Color(0xFFFDECEC),
      'connecting' => const Color(0xFFFFF6E0),
      _ => const Color(0xFFF0F0F0),
    };
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        message == null ? 'Status: $status' : 'Status: $status\n$message',
      ),
    );
  }
}
