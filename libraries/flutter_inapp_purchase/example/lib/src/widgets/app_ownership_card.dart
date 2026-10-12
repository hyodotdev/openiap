import 'package:flutter/material.dart';
import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

class AppOwnershipCard extends StatefulWidget {
  const AppOwnershipCard(
      {super.key, required this.iap, required this.connected});

  final FlutterInappPurchase iap;
  final bool connected;

  @override
  State<AppOwnershipCard> createState() => _AppOwnershipCardState();
}

class _AppOwnershipCardState extends State<AppOwnershipCard> {
  final _projectNumber = TextEditingController();
  final _requestHash = TextEditingController();
  bool _busy = false;
  String _result = '';

  @override
  void dispose() {
    _projectNumber.dispose();
    _requestHash.dispose();
    super.dispose();
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
      final evidence = await widget.iap.verifyAppOwnership(
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
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('App ownership',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            const Text(
                'Google Play requires a linked Cloud project number and a request hash from your backend. Unknown is inconclusive; send evidence to your backend for verification.'),
            const SizedBox(height: 12),
            TextField(
                controller: _projectNumber,
                enabled: !_busy,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                    labelText: 'Google Cloud project number')),
            TextField(
                controller: _requestHash,
                enabled: !_busy,
                autocorrect: false,
                decoration: const InputDecoration(labelText: 'Request hash')),
            const SizedBox(height: 12),
            FilledButton(
                onPressed: widget.connected && !_busy ? _checkOwnership : null,
                child: Text(
                    _busy ? 'Checking app ownership…' : 'Check app ownership')),
            if (_result.isNotEmpty) ...[
              const SizedBox(height: 12),
              SelectableText(_result),
            ],
          ],
        ),
      ),
    );
  }
}
