import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_inapp_purchase_example/src/app.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    dotenv.loadFromString(
      envString: 'IAPKIT_API_KEY=\nIAPKIT_BASE_URL=https://kit.openiap.dev\n',
    );
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
    expect(find.text('App Ownership'), findsOneWidget);
    expect(find.text('Check the app came from its store'), findsOneWidget);
    expect(
      tester.getTopLeft(find.text('App Ownership')).dy,
      greaterThan(tester.getTopLeft(find.text('Alternative Billing')).dy),
    );
  });

  testWidgets('App Ownership opens its own screen', (tester) async {
    await tester.pumpWidget(const App());
    await tester.pumpAndSettle();

    await tester.ensureVisible(find.text('App Ownership'));
    await tester.tap(find.text('App Ownership'));
    await tester.pumpAndSettle();

    expect(find.text('Check app ownership'), findsOneWidget);
    expect(find.text('Google Cloud project number'), findsOneWidget);
  });
}
