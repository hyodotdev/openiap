import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform/platform.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('instance getter memoizes singleton', () {
    final first = FlutterInappPurchase.instance;
    final second = FlutterInappPurchase.instance;
    expect(identical(first, second), isTrue);
  });

  test('apps can extend the public constructor', () {
    final iap = _CustomIap();
    expect(iap.isIOS, isTrue);
    expect(identical(iap, FlutterInappPurchase.instance), isFalse);
  });

  test('platform getters reflect provided platform', () {
    final iap = FlutterInappPurchase.private(
      FakePlatform(operatingSystem: 'ios'),
    );

    expect(iap.isIOS, isTrue);
    expect(iap.isAndroid, isFalse);
    expect(iap.operatingSystem, 'ios');
  });
}

class _CustomIap extends FlutterInappPurchase {
  _CustomIap() : super(platform: FakePlatform(operatingSystem: 'ios'));
}
