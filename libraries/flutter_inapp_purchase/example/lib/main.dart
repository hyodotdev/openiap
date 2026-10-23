import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'src/app.dart';
import 'src/app_purchase_flow.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Only env.example is a declared asset, so it is the only file the bundle
  // carries. Per-developer values come from --dart-define, which wins over it.
  await dotenv.load(fileName: 'env.example');
  // One connection and purchase flow for the whole app.
  unawaited(AppPurchaseFlow.instance.start());
  runApp(const App());
}
