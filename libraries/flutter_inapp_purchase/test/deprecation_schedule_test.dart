import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

const removalNotice = 'Scheduled for removal in flutter_inapp_purchase 10.0.0.';

String normalizeDartStringFragments(String value) =>
    value.replaceAll(RegExp(r'''[\s'"]+'''), '');

void expectAnnotatedDeclarations({
  required String source,
  required String declaration,
  required int count,
  required String replacement,
}) {
  final declarationMatches = declaration.allMatches(source).toList();
  expect(
    declarationMatches,
    hasLength(count),
    reason: 'Expected $count declaration(s) matching $declaration',
  );

  for (final match in declarationMatches) {
    final start = match.start > 600 ? match.start - 600 : 0;
    final prefix = source.substring(start, match.start);
    final annotationStart = prefix.lastIndexOf('@Deprecated(');
    expect(
      annotationStart,
      isNonNegative,
      reason: '$declaration must carry a @Deprecated annotation',
    );

    final annotation = prefix.substring(annotationStart);
    expect(
      annotation,
      isNot(contains(';')),
      reason: '$declaration must not have another member after its annotation',
    );
    expect(
      annotation,
      isNot(contains('=>')),
      reason: '$declaration must not have another getter after its annotation',
    );
    final normalizedAnnotation = normalizeDartStringFragments(annotation);
    expect(
      normalizedAnnotation,
      contains(normalizeDartStringFragments(replacement)),
    );
    expect(
      normalizedAnnotation,
      contains(normalizeDartStringFragments(removalNotice)),
    );
  }
}

void main() {
  test('legacy concrete getters declare Flutter 10 replacements', () {
    final source = File('lib/flutter_inapp_purchase.dart').readAsStringSync();

    expectAnnotatedDeclarations(
      source: source,
      declaration: 'get checkAlternativeBillingAvailabilityAndroid =>',
      count: 1,
      replacement:
          'isBillingProgramAvailableAndroid(BillingProgramAndroid.ExternalOffer)',
    );
    expectAnnotatedDeclarations(
      source: source,
      declaration: 'get showAlternativeBillingDialogAndroid =>',
      count: 1,
      replacement: 'launchExternalLinkAndroid',
    );
    expectAnnotatedDeclarations(
      source: source,
      declaration: 'get createAlternativeBillingTokenAndroid =>',
      count: 1,
      replacement:
          'createBillingProgramReportingDetailsAndroid(BillingProgramAndroid.ExternalOffer)',
    );
  });

  test('legacy builder fields declare Flutter 10 replacements', () {
    final source = File('lib/builders.dart').readAsStringSync();

    expectAnnotatedDeclarations(
      source: source,
      declaration: 'int? replacementMode;',
      count: 1,
      replacement: 'subscriptionProductReplacementParams',
    );
    expectAnnotatedDeclarations(
      source: source,
      declaration: 'bool? useAlternativeBilling = false;',
      count: 2,
      replacement: 'enableBillingProgramAndroid in InitConnectionConfig',
    );
  });
}
