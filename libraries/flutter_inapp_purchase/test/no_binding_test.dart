import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';
import 'package:flutter_test/flutter_test.dart';

// No TestWidgetsFlutterBinding: apps may read the instance before runApp.
void main() {
  test('reading the shared instance needs no Flutter binding', () {
    expect(() => FlutterInappPurchase.instance, returnsNormally);
  });
}
