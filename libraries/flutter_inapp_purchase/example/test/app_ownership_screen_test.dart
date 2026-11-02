import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';
import 'package:flutter_inapp_purchase_example/src/app_purchase_flow.dart';
import 'package:flutter_inapp_purchase_example/src/screens/app_ownership_screen.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform/platform.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const channel = MethodChannel('flutter_inapp');

  late List<MethodCall> log;
  late bool connects;
  PlatformException? ownershipFailure;
  final flows = <AppPurchaseFlow>[];

  Widget screen() {
    final purchases = AppPurchaseFlow(
      FlutterInappPurchase(platform: FakePlatform(operatingSystem: 'android')),
    );
    flows.add(purchases);
    return MaterialApp(home: AppOwnershipScreen(purchases: purchases));
  }

  Finder checkButton() => find.ancestor(
        of: find.text('Check app ownership'),
        matching:
            find.byWidgetPredicate((widget) => widget is ButtonStyleButton),
      );

  setUp(() {
    log = <MethodCall>[];
    connects = true;
    ownershipFailure = null;
    dotenv.loadFromString(isOptional: true);
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (MethodCall call) async {
      log.add(call);
      switch (call.method) {
        case 'initConnection':
          return connects;
        case 'verifyAppOwnership':
          if (ownershipFailure != null) throw ownershipFailure!;
          return <String, dynamic>{
            'status': 'licensed',
            'storeId': 'play',
            'integrityTokenAndroid': 'token',
          };
        case 'getAvailableItems':
          return <Map<String, dynamic>>[];
      }
      return null;
    });
  });

  tearDown(() async {
    for (final purchases in flows) {
      purchases.dispose();
    }
    flows.clear();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
  });

  Iterable<MethodCall> ownershipCalls() =>
      log.where((call) => call.method == 'verifyAppOwnership');

  testWidgets('sends both Google fields and shows the evidence',
      (tester) async {
    await tester.pumpWidget(screen());
    await tester.pumpAndSettle();

    await tester.enterText(
      find.widgetWithText(TextField, 'Google Cloud project number'),
      '123456',
    );
    await tester.enterText(
      find.widgetWithText(TextField, 'Request hash'),
      'hash',
    );
    await tester.tap(checkButton());
    await tester.pumpAndSettle();

    final arguments = ownershipCalls().single.arguments as Map;
    expect(arguments['google'], {
      'cloudProjectNumber': '123456',
      'requestHash': 'hash',
    });
    expect(find.textContaining('Status: licensed'), findsOneWidget);
    expect(find.textContaining('Integrity token length: 5'), findsOneWidget);
  });

  testWidgets('asks for both Google fields before checking', (tester) async {
    await tester.pumpWidget(screen());
    await tester.pumpAndSettle();

    await tester.enterText(
      find.widgetWithText(TextField, 'Google Cloud project number'),
      '123456',
    );
    await tester.tap(checkButton());
    await tester.pumpAndSettle();

    expect(ownershipCalls(), isEmpty);
    expect(
      find.text(
        'developer-error: Enter both Google fields or leave both empty.',
      ),
      findsOneWidget,
    );
  });

  testWidgets('shows the error code when the check fails', (tester) async {
    ownershipFailure = PlatformException(
      code: 'service-error',
      message: 'Play Integrity unavailable',
    );
    await tester.pumpWidget(screen());
    await tester.pumpAndSettle();

    await tester.tap(checkButton());
    await tester.pumpAndSettle();

    expect(ownershipCalls().single.arguments['google'], isNull);
    expect(find.textContaining('service-error: '), findsOneWidget);
    expect(find.textContaining('Play Integrity unavailable'), findsOneWidget);
  });

  testWidgets('waits for the store connection', (tester) async {
    connects = false;
    await tester.pumpWidget(screen());
    await tester.pumpAndSettle();

    expect(tester.widget<ButtonStyleButton>(checkButton()).enabled, isFalse);
  });
}
