import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_inapp_purchase_example/src/screens/alternative_billing_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const channel = MethodChannel('flutter_inapp');

  testWidgets('switches the billing mode only after native applies it',
      (tester) async {
    dotenv.loadFromString(isOptional: true);
    // The screen's own connect fails, so each reconnect reaches native.
    final refused = PlatformException(
      code: 'developer-error',
      message: 'A purchase is in progress',
    );
    final connects = <Object>[false, refused, false, true, refused, true];
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
    Future<void> choose(String selector, String mode) async {
      await tester.tap(find.text(selector));
      await tester.pumpAndSettle();
      await tester.tap(find.text(mode).last);
      await tester.pumpAndSettle();
    }

    const programs = 'Current mode: BILLING_PROGRAMS (ExternalOffer)';
    const payments = 'Current mode: EXTERNAL_PAYMENTS (8.3.0+ Japan)';
    Future<void> chooseExternalPayments() => choose(
          'Billing Programs API (8.2.0+)',
          'External Payments (8.3.0+ Japan)',
        );
    Future<void> chooseBillingPrograms() => choose(
          'External Payments (8.3.0+ Japan)',
          'Billing Programs API (7.0+/8.2.0+)',
        );

    // Refused, then not connected: the mode stays.
    await chooseExternalPayments();
    expect(find.textContaining('Reconnection failed'), findsOneWidget);
    expect(find.text(programs), findsOneWidget);
    await chooseExternalPayments();
    expect(find.text(programs), findsOneWidget);

    await chooseExternalPayments();
    expect(find.text(payments), findsOneWidget);

    // Switching back follows the same rule; on this non-Android host a live
    // connection would answer initConnection itself, so end it first.
    await FlutterInappPurchase.instance.endConnection();
    await chooseBillingPrograms();
    expect(find.text(payments), findsOneWidget);
    await chooseBillingPrograms();
    expect(find.text(programs), findsOneWidget);
  }, variant: TargetPlatformVariant.only(TargetPlatform.android));
}
