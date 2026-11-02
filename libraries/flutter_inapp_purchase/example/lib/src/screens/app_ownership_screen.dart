import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

import '../app_purchase_flow.dart';

class AppOwnershipScreen extends StatefulWidget {
  const AppOwnershipScreen({super.key, this.purchases});

  final AppPurchaseFlow? purchases;

  @override
  State<AppOwnershipScreen> createState() => _AppOwnershipScreenState();
}

class _AppOwnershipScreenState extends State<AppOwnershipScreen> {
  late final AppPurchaseFlow _purchases =
      widget.purchases ?? AppPurchaseFlow.instance;
  final _projectNumber = TextEditingController();
  final _requestHash = TextEditingController();
  bool _connected = false;
  bool _busy = false;
  String _result = '';

  @override
  void initState() {
    super.initState();
    _awaitConnection();
  }

  @override
  void dispose() {
    _projectNumber.dispose();
    _requestHash.dispose();
    super.dispose();
  }

  // The app owns the connection; this screen only waits for it.
  Future<void> _awaitConnection() async {
    final connected = await _purchases.connected;
    if (mounted) setState(() => _connected = connected);
  }

  Future<void> _checkOwnership() async {
    final project = _projectNumber.text.trim();
    final hash = _requestHash.text.trim();
    if (project.isEmpty != hash.isEmpty) {
      setState(() => _result =
          'developer-error: Enter both Google fields or leave both empty.');
      return;
    }
    setState(() {
      _busy = true;
      _result = '';
    });
    try {
      final evidence = await _purchases.iap.verifyAppOwnership(
        google: project.isNotEmpty && hash.isNotEmpty
            ? PlayIntegrityParamsAndroid(
                cloudProjectNumber: project, requestHash: hash)
            : null,
      );
      if (!mounted) return;
      setState(() => _result = [
            'Status: ${evidence.status.value}',
            'Store ID: ${evidence.storeId}',
            'Reason: ${evidence.reason?.value ?? 'none'}',
            'Signed AppTransaction length: ${evidence.signedAppTransactionIOS?.length ?? 0}',
            'Integrity token length: ${evidence.integrityTokenAndroid?.length ?? 0}',
          ].join('\n'));
    } catch (error) {
      if (!mounted) return;
      setState(() => _result = error is PurchaseError
          ? '${error.code?.value ?? ErrorCode.Unknown.value}: ${error.message}'
          : error.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF7F8FA),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(CupertinoIcons.back, color: Colors.black),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'App Ownership',
          style: TextStyle(color: Colors.black),
        ),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Google Play requires a linked Cloud project number and a request hash from your backend. Unknown is inconclusive; send evidence to your backend for verification.',
                      style: TextStyle(fontSize: 14, color: Colors.grey[600]),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _projectNumber,
                      enabled: !_busy,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Google Cloud project number',
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _requestHash,
                      enabled: !_busy,
                      autocorrect: false,
                      decoration:
                          const InputDecoration(labelText: 'Request hash'),
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton.icon(
                      onPressed: _connected && !_busy ? _checkOwnership : null,
                      icon: const Icon(Icons.verified_user),
                      label: Text(
                        _busy
                            ? 'Checking app ownership…'
                            : 'Check app ownership',
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.teal,
                        foregroundColor: Colors.white,
                        minimumSize: const Size(double.infinity, 48),
                      ),
                    ),
                    if (_result.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      SelectableText(_result),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
