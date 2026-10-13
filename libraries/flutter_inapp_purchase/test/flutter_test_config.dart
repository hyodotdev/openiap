import 'dart:async';

import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';
import 'package:flutter_test/flutter_test.dart';

// Instances share native event streams and connection state; start each test fresh.
Future<void> testExecutable(FutureOr<void> Function() testMain) async {
  setUp(FlutterInappPurchase.resetSharedStateForTesting);
  await testMain();
}
