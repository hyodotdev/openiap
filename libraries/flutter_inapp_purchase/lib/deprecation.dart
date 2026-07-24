import 'package:flutter/foundation.dart';

final Set<String> _emittedLegacyWarnings = <String>{};

/// Emits a compatibility warning once per legacy wire shape.
///
/// This intentionally remains separate from debug logging because callers
/// need to see migration guidance before the compatibility path is removed.
void warnLegacyOnce(String key, String message) {
  if (!_emittedLegacyWarnings.add(key)) {
    return;
  }

  debugPrint('[flutter_inapp_purchase] DEPRECATED: $message');
}

@visibleForTesting
void resetLegacyWarningsForTesting() {
  _emittedLegacyWarnings.clear();
}
