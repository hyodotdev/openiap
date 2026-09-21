import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'src/app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // `env` is the developer's untracked copy; fall back to the committed
  // template so a fresh checkout still runs.
  try {
    await dotenv.load(fileName: 'env');
  } catch (_) {
    await dotenv.load(fileName: 'env.example');
  }
  runApp(const App());
}
