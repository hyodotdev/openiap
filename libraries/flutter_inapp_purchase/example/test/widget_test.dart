import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_inapp_purchase_example/src/app.dart';
import 'package:flutter_inapp_purchase_example/src/screens/webhook_stream_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    dotenv.testLoad(
        fileInput:
            'IAPKIT_API_KEY=\nIAPKIT_BASE_URL=https://kit.openiap.dev\n');
  });

  testWidgets('renders the full example menu', (WidgetTester tester) async {
    await tester.pumpWidget(const App());
    await tester.pumpAndSettle();

    expect(find.text('All Products'), findsOneWidget);
    expect(find.text('Purchase Flow'), findsOneWidget);
    expect(find.text('Subscription Flow'), findsOneWidget);
    expect(find.text('Available Purchases'), findsOneWidget);
    expect(find.text('Redeem Offer Code'), findsOneWidget);
    expect(find.text('Alternative Billing'), findsOneWidget);
    expect(find.text('Webhook Stream'), findsOneWidget);
  });

  testWidgets('renders webhook stream controls', (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(home: WebhookStreamScreen()),
    );

    expect(find.text('Webhook Stream'), findsOneWidget);
    expect(find.text('Connect'), findsOneWidget);
    expect(find.text('Trigger test'), findsOneWidget);
    expect(find.text('No webhook events yet.'), findsOneWidget);
  });
}
