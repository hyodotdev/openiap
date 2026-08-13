import 'package:flutter_inapp_purchase/types.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('in-app message input rejects unknown and malformed categories', () {
    final known = InAppMessageParamsAndroid.fromJson({
      'categories': ['unknown-in-app-message-category-id'],
    });
    expect(
      known.categories,
      [InAppMessageCategoryAndroid.UnknownInAppMessageCategoryId],
    );

    for (final input in [
      {
        'categories': ['future-category']
      },
      {
        'categories': [999]
      },
      {'categories': 'transactional'},
    ]) {
      expect(
        () => InAppMessageParamsAndroid.fromJson(input),
        throwsA(anyOf(isA<ArgumentError>(), isA<TypeError>())),
      );
    }
  });
}
