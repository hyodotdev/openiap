import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:platform/platform.dart';

import '../types.dart' as gentype;

/// Must match `consoleNotice` in packages/docs/community-touchpoints.json;
/// `bun audit:parity` compares them.
const List<String> firstPurchaseNoticeLines = <String>[
  '[OpenIAP] First purchase finished in this app 🎉',
  'If OpenIAP saved you time, a star helps: https://github.com/hyodotdev/openiap',
  'When your app ships, list it for free: https://openiap.dev/showcase',
  '(Shown once, debug builds only.)',
];

/// Prints [firstPurchaseNoticeLines] once per install, after the first
/// purchased purchase finishes in a debug build of the host app.
/// Internal: not exported (knowledge/internal/09-community-touchpoints.md).
class FirstPurchaseNotice {
  FirstPurchaseNotice(
    this._platform,
    this._channel, {
    bool isDebug = kDebugMode,
  }) : _isDebug = isDebug;

  final Platform _platform;
  final MethodChannel _channel;
  final bool _isDebug;
  bool _tried = false;

  /// Call only after finishTransaction succeeded. Never throws.
  Future<void> onFinished(gentype.Purchase purchase) async {
    try {
      if (!_isDebug ||
          purchase.purchaseState != gentype.PurchaseState.Purchased ||
          _tried ||
          _platform.environment['FLUTTER_TEST'] == 'true') {
        return;
      }
      _tried = true;
      // Internal channel method: true only the first time on this install.
      final claimed =
          await _channel.invokeMethod<bool>('claimFirstPurchaseNotice');
      if (claimed == true) {
        debugPrint(firstPurchaseNoticeLines.join('\n'));
      }
    } catch (_) {
      // The notice must never affect finishTransaction.
    }
  }
}
