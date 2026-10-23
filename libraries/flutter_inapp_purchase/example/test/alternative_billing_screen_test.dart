import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_inapp_purchase_example/src/screens/alternative_billing_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const channel = MethodChannel('flutter_inapp');

  testWidgets('switches the billing mode only after native applies it',
      (tester) async {
    dotenv.loadFromString(isOptional: true);
    // The screen's own connect fails, so each reconnect reaches native.
    final connects = <Object>[
      false,
      PlatformException(
        code: 'developer-error',
        message: 'A purchase is in progress',
      ),
      true,
    ];
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (call) async {
      if (call.method != 'initConnection') return null;
      final answer = connects.isEmpty ? true : connects.removeAt(0);
      if (answer is PlatformException) throw answer;
      return answer;
    });
    addTearDown(() {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, null);
    });

    await tester.pumpWidget(
      const MaterialApp(home: AlternativeBillingScreen()),
    );
    await tester.pumpAndSettle();
    Future<void> chooseExternalPayments() async {
      await tester.tap(find.text('Billing Programs API (8.2.0+)'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('External Payments (8.3.0+ Japan)').last);
      await tester.pumpAndSettle();
    }

    await chooseExternalPayments();

    expect(find.textContaining('Reconnection failed'), findsOneWidget);
    expect(
      find.text('Current mode: BILLING_PROGRAMS (ExternalOffer)'),
      findsOneWidget,
    );

    await chooseExternalPayments();

    expect(
      find.text('Current mode: EXTERNAL_PAYMENTS (8.3.0+ Japan)'),
      findsOneWidget,
    );
  }, variant: TargetPlatformVariant.only(TargetPlatform.android));
}
