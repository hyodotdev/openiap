extends SceneTree
## Unit tests for types.gd only (no plugin dependency)
## Run with: godot --headless --script tests/test_types_only.gd

const Types = preload("res://addons/godot-iap/types.gd")

var _total_passed := 0
var _total_failed := 0


func _init() -> void:
	print("\n")
	print("########################################")
	print("#     GodotIap Types Test Suite       #")
	print("########################################")
	print("\n")

	_run_all_tests()

	print("\n")
	print("########################################")
	print("#     Results                         #")
	print("########################################")
	print("Passed: %d" % _total_passed)
	print("Failed: %d" % _total_failed)
	print("########################################\n")

	quit(0 if _total_failed == 0 else 1)


func _run_all_tests() -> void:
	# ProductRequest tests
	_test_product_request()
	_test_product_nested_arrays()

	# PurchaseAndroid tests
	_test_purchase_android()

	# PurchaseIOS tests
	_test_purchase_ios()

	# RequestPurchaseProps tests
	_test_request_purchase_props()

	# IAPKit product client payload tests
	_test_iapkit_product_client_payload()

	# VoidResult tests
	_test_void_result()

	# Enum tests
	_test_enums()

	# New types tests (v1.3.12)
	_test_discount_offer()
	_test_subscription_offer()
	_test_subscription_period()

	# ExternalPurchaseCustomLink types (v1.3.16)
	_test_external_purchase_custom_link_notice_type_ios()
	_test_external_purchase_custom_link_token_type_ios()
	_test_external_purchase_custom_link_notice_result_ios()
	_test_external_purchase_custom_link_token_result_ios()

	# Error code mapping
	_test_purchase_error_code_mapping()
	_test_error_code_maps_complete()
	_test_enum_value_maps_bijective()

	# Wire-format (JSON) round trips
	_test_purchase_android_json_round_trip()
	_test_purchase_ios_json_round_trip()
	_test_active_subscription_round_trip()
	_test_product_android_round_trip()
	_test_product_ios_round_trip()
	_test_purchase_input_round_trip()


# ============================================
# ProductRequest Tests
# ============================================

func _test_product_request() -> void:
	print("Testing ProductRequest...")

	# Test creation
	var request = Types.ProductRequest.new()
	var skus: Array[String] = ["product_1", "product_2"]
	request.skus = skus
	request.type = Types.ProductQueryType.IN_APP

	_assert_equal(request.skus.size(), 2, "ProductRequest should have 2 skus")
	_assert_equal(request.skus[0], "product_1", "First sku should be product_1")
	_assert_equal(request.type, Types.ProductQueryType.IN_APP, "Type should be IN_APP")

	# Test to_dict
	var dict = request.to_dict()
	_assert_equal(dict["skus"][0], "product_1", "to_dict should preserve sku")
	_assert_equal(dict["type"], "in-app", "to_dict should convert type to string")

	# JSON.parse_string returns an untyped Array; from_dict must rebuild Array[String].
	var from_dict_data = {
		"skus": ["sku_from_dict", null, {"invalid": true}],
		"type": "subs"
	}
	var parsed = Types.ProductRequest.from_dict(from_dict_data)
	_assert_equal(parsed.skus[0], "sku_from_dict", "from_dict should parse skus")
	_assert_equal(parsed.skus.size(), 1, "from_dict should skip malformed scalar list items")


func _test_product_nested_arrays() -> void:
	print("Testing nested product arrays...")

	var offer_data = {
		"id": "intro",
		"displayPrice": "Free",
		"price": 0.0,
		"type": "introductory",
		"offerTagsAndroid": ["launch"]
	}
	var ios_product = Types.ProductIOS.from_dict({
		"id": "premium.ios",
		"title": "Premium",
		"description": "Premium subscription",
		"type": "subs",
		"platform": "ios",
		"subscriptionOffers": [offer_data, "invalid", null],
		"pricingTermsIOS": [{
			"billingDisplayPrice": "$9.99",
			"billingPlanType": "monthly",
			"billingPrice": 9.99,
			"subscriptionOffers": [offer_data]
		}]
	})
	_assert_equal(ios_product.subscription_offers.size(), 1, "ProductIOS should parse subscription offers")
	_assert_equal(ios_product.subscription_offers[0].id, "intro", "ProductIOS should preserve offer fields")
	_assert_equal(ios_product.pricing_terms_ios.size(), 1, "ProductIOS should parse pricing terms")
	_assert_equal(
		ios_product.pricing_terms_ios[0].subscription_offers[0].offer_tags_android[0],
		"launch",
		"Nested scalar arrays should remain typed"
	)

	var android_product = Types.ProductSubscriptionAndroid.from_dict({
		"id": "premium.android",
		"title": "Premium",
		"description": "Premium subscription",
		"type": "subs",
		"platform": "android",
		"nameAndroid": "Premium",
		"subscriptionOffers": [{
			"id": "commitment",
			"displayPrice": "$9.99",
			"price": 9.99,
			"type": "promotional",
			"installmentPlanDetailsAndroid": {
				"commitmentPaymentsCount": 12,
				"subsequentCommitmentPaymentsCount": 0
			}
		}],
		"subscriptionOfferDetailsAndroid": [{
			"basePlanId": "annual",
			"offerTags": ["commitment"],
			"offerToken": "token",
			"pricingPhases": {"pricingPhaseList": []},
			"installmentPlanDetails": {
				"commitmentPaymentsCount": 12,
				"subsequentCommitmentPaymentsCount": 0
			}
		}]
	})
	_assert_equal(android_product.subscription_offers.size(), 1, "Android should parse standardized offers")
	_assert_equal(
		android_product.subscription_offers[0].installment_plan_details_android.commitment_payments_count,
		12,
		"Android standardized installment details should survive"
	)
	_assert_equal(
		android_product.subscription_offer_details_android[0].installment_plan_details.commitment_payments_count,
		12,
		"Android legacy installment details should survive"
	)


# ============================================
# PurchaseAndroid Tests
# ============================================

func _test_purchase_android() -> void:
	print("Testing PurchaseAndroid...")

	# Test creation
	var purchase = Types.PurchaseAndroid.new()
	purchase.id = "purchase_123"
	purchase.product_id = "product_abc"
	purchase.purchase_token = "token_xyz"
	purchase.transaction_id = "txn_456"
	purchase.is_acknowledged_android = true

	_assert_equal(purchase.id, "purchase_123", "id should match")
	_assert_equal(purchase.product_id, "product_abc", "product_id should match")
	_assert_equal(purchase.purchase_token, "token_xyz", "purchase_token should match")
	_assert_equal(purchase.is_acknowledged_android, true, "is_acknowledged_android should be true")

	# Test to_dict
	var dict = purchase.to_dict()
	_assert_equal(dict["id"], "purchase_123", "to_dict id should match")
	_assert_equal(dict["productId"], "product_abc", "to_dict should use camelCase for productId")
	_assert_equal(dict["purchaseToken"], "token_xyz", "to_dict should preserve purchaseToken")
	_assert_equal(dict["transactionId"], "txn_456", "to_dict should preserve transactionId")
	_assert_equal(dict["isAcknowledgedAndroid"], true, "to_dict should preserve isAcknowledgedAndroid")

	# Test from_dict
	var from_dict_data = {
		"id": "parsed_id",
		"productId": "parsed_product",
		"transactionId": "parsed_txn",
		"purchaseToken": "parsed_token",
		"isAcknowledgedAndroid": false
	}
	var parsed = Types.PurchaseAndroid.from_dict(from_dict_data)
	_assert_equal(parsed.id, "parsed_id", "from_dict id should match")
	_assert_equal(parsed.product_id, "parsed_product", "from_dict product_id should match")
	_assert_equal(parsed.is_acknowledged_android, false, "from_dict isAcknowledgedAndroid should be false")


# ============================================
# PurchaseIOS Tests
# ============================================

func _test_purchase_ios() -> void:
	print("Testing PurchaseIOS...")

	# Test creation
	var purchase = Types.PurchaseIOS.new()
	purchase.id = "ios_purchase_123"
	purchase.product_id = "ios_product"
	purchase.transaction_id = "ios_txn"
	purchase.original_transaction_identifier_ios = "original_123"

	_assert_equal(purchase.id, "ios_purchase_123", "id should match")
	_assert_equal(purchase.product_id, "ios_product", "product_id should match")
	_assert_equal(purchase.original_transaction_identifier_ios, "original_123", "original_transaction_identifier_ios should match")

	# Test to_dict
	var dict = purchase.to_dict()
	_assert_equal(dict["id"], "ios_purchase_123", "to_dict id should match")
	_assert_equal(dict["productId"], "ios_product", "to_dict should use camelCase")
	_assert_equal(dict["originalTransactionIdentifierIOS"], "original_123", "to_dict should preserve iOS fields")


# ============================================
# RequestPurchaseProps Tests
# ============================================

func _test_request_purchase_props() -> void:
	print("Testing RequestPurchaseProps...")

	var platforms = Types.RequestSubscriptionPropsByPlatforms.new()
	platforms.google = Types.RequestSubscriptionAndroidProps.new()
	var props = Types.RequestPurchaseProps.subs(platforms)

	var skus: Array[String] = ["subscription_monthly"]
	props.request_subscription.google.skus = skus

	_assert_equal(props.type, Types.ProductQueryType.SUBS, "Type should be SUBS")
	_assert_equal(props.request_subscription.google.skus[0], "subscription_monthly", "Google skus should match")
	_assert_equal(props.to_dict().has("requestSubscription"), true, "Subscription props should use requestSubscription")
	_assert_equal(props.to_dict().has("requestPurchase"), false, "Subscription props should omit requestPurchase")

	var parsed = Types.RequestPurchaseProps.from_dict({
		"requestSubscription": {"google": {"skus": ["subscription_yearly"]}}
	})
	_assert_equal(parsed.type, Types.ProductQueryType.SUBS, "Subscription branch should infer SUBS type")


# ============================================
# IAPKit Product Client Payload Tests
# ============================================

func _test_iapkit_product_client_payload() -> void:
	print("Testing IapkitProductClientPayload...")

	var payload = Types.IapkitProductClientPayload.new()
	payload.format = Types.IapkitClientPayloadFormat.TOML
	payload.body = 'tier = "gold"'
	payload.version = 2.0
	payload.updated_at = 1720000000000.0

	var payload_dict = payload.to_dict()
	_assert_equal(payload_dict["format"], "toml", "Client payload should serialize format")
	_assert_equal(payload_dict["body"], 'tier = "gold"', "Client payload should serialize body")
	_assert_equal(payload_dict["version"], 2.0, "Client payload should serialize version")
	_assert_equal(payload_dict["updatedAt"], 1720000000000.0, "Client payload should serialize updatedAt")

	var parsed_payload = Types.IapkitProductClientPayload.from_dict(payload_dict)
	_assert_equal(parsed_payload.format, Types.IapkitClientPayloadFormat.TOML, "Client payload should parse format")
	_assert_equal(parsed_payload.body, 'tier = "gold"', "Client payload should parse body")
	_assert_equal(parsed_payload.version, 2.0, "Client payload should parse version")
	_assert_equal(parsed_payload.updated_at, 1720000000000.0, "Client payload should parse updatedAt")

	var result = Types.RequestVerifyPurchaseWithIapkitResult.from_dict({
		"store": "apple",
		"isValid": true,
		"state": "entitled",
		"productId": "premium.monthly",
		"clientPayload": payload_dict
	})
	_assert_equal(result.product_id, "premium.monthly", "IAPKit result should parse productId")
	_assert_equal(
		result.client_payload is Types.IapkitProductClientPayload,
		true,
		"IAPKit result should parse the nested client payload"
	)

	var round_trip = Types.RequestVerifyPurchaseWithIapkitResult.from_dict(result.to_dict())
	_assert_equal(round_trip.product_id, "premium.monthly", "IAPKit result should round-trip productId")
	_assert_equal(round_trip.client_payload.format, Types.IapkitClientPayloadFormat.TOML, "Nested payload should round-trip format")
	_assert_equal(round_trip.client_payload.body, 'tier = "gold"', "Nested payload should round-trip body")
	_assert_equal(round_trip.client_payload.version, 2.0, "Nested payload should round-trip version")
	_assert_equal(round_trip.client_payload.updated_at, 1720000000000.0, "Nested payload should round-trip updatedAt")


# ============================================
# VoidResult Tests
# ============================================

func _test_void_result() -> void:
	print("Testing VoidResult...")

	var result = Types.VoidResult.new()
	result.success = true

	_assert_equal(result.success, true, "VoidResult success should be true")

	result.success = false
	_assert_equal(result.success, false, "VoidResult success should be false")


# ============================================
# Enum Tests
# ============================================

func _test_enums() -> void:
	print("Testing Enums...")

	# ProductQueryType
	_assert_equal(Types.ProductQueryType.IN_APP, 0, "ProductQueryType.IN_APP should be 0")
	_assert_equal(Types.ProductQueryType.SUBS, 1, "ProductQueryType.SUBS should be 1")
	_assert_equal(Types.ProductQueryType.ALL, 2, "ProductQueryType.ALL should be 2")

	# PurchaseState
	_assert_equal(Types.PurchaseState.PENDING, 0, "PurchaseState.PENDING should be 0")
	_assert_equal(Types.PurchaseState.PURCHASED, 1, "PurchaseState.PURCHASED should be 1")
	_assert_equal(Types.PurchaseState.UNKNOWN, 2, "PurchaseState.UNKNOWN should be 2")

	# ErrorCode
	_assert_equal(Types.ErrorCode.UNKNOWN, 0, "ErrorCode.UNKNOWN should be 0")


# ============================================
# DiscountOffer Tests (v1.3.12)
# ============================================

func _test_discount_offer() -> void:
	print("Testing DiscountOffer...")

	# Test creation
	var offer = Types.DiscountOffer.new()
	offer.id = "discount_offer_123"
	offer.display_price = "$4.99"
	offer.price = 4.99
	offer.currency = "USD"
	offer.type = Types.DiscountOfferType.INTRODUCTORY
	offer.offer_token_android = "token_abc"

	_assert_equal(offer.id, "discount_offer_123", "DiscountOffer id should match")
	_assert_equal(offer.display_price, "$4.99", "display_price should match")
	_assert_equal(offer.price, 4.99, "price should match")
	_assert_equal(offer.currency, "USD", "currency should match")
	_assert_equal(offer.type, Types.DiscountOfferType.INTRODUCTORY, "type should be INTRODUCTORY")
	_assert_equal(offer.offer_token_android, "token_abc", "offer_token_android should match")

	# Test to_dict
	var dict = offer.to_dict()
	_assert_equal(dict["id"], "discount_offer_123", "to_dict id should match")
	_assert_equal(dict["displayPrice"], "$4.99", "to_dict should use camelCase")
	_assert_equal(dict["price"], 4.99, "to_dict price should match")
	_assert_equal(dict["type"], "introductory", "to_dict type should be string")

	# Test from_dict
	# Note: from_dict expects enum values as integers, not strings
	var from_dict_data = {
		"id": "parsed_offer",
		"displayPrice": "$9.99",
		"price": 9.99,
		"currency": "EUR",
		"type": Types.DiscountOfferType.PROMOTIONAL,
		"offerTokenAndroid": "parsed_token"
	}
	var parsed = Types.DiscountOffer.from_dict(from_dict_data)
	_assert_equal(parsed.id, "parsed_offer", "from_dict id should match")
	_assert_equal(parsed.display_price, "$9.99", "from_dict display_price should match")
	_assert_equal(parsed.type, Types.DiscountOfferType.PROMOTIONAL, "from_dict type should be PROMOTIONAL")

	# Test DiscountOfferType enum
	_assert_equal(Types.DiscountOfferType.INTRODUCTORY, 0, "DiscountOfferType.INTRODUCTORY should be 0")
	_assert_equal(Types.DiscountOfferType.PROMOTIONAL, 1, "DiscountOfferType.PROMOTIONAL should be 1")
	_assert_equal(Types.DiscountOfferType.ONE_TIME, 2, "DiscountOfferType.ONE_TIME should be 2")


# ============================================
# SubscriptionOffer Tests (v1.3.12)
# ============================================

func _test_subscription_offer() -> void:
	print("Testing SubscriptionOffer...")

	# Test creation
	var offer = Types.SubscriptionOffer.new()
	offer.id = "sub_offer_123"
	offer.display_price = "$9.99/month"
	offer.price = 9.99
	offer.currency = "USD"
	offer.type = Types.DiscountOfferType.INTRODUCTORY
	offer.period_count = 3
	offer.payment_mode = Types.PaymentMode.FREE_TRIAL
	offer.key_identifier_ios = "key_123"
	offer.base_plan_id_android = "base_plan_monthly"

	_assert_equal(offer.id, "sub_offer_123", "SubscriptionOffer id should match")
	_assert_equal(offer.display_price, "$9.99/month", "display_price should match")
	_assert_equal(offer.price, 9.99, "price should match")
	_assert_equal(offer.period_count, 3, "period_count should match")
	_assert_equal(offer.payment_mode, Types.PaymentMode.FREE_TRIAL, "payment_mode should be FREE_TRIAL")
	_assert_equal(offer.key_identifier_ios, "key_123", "key_identifier_ios should match")
	_assert_equal(offer.base_plan_id_android, "base_plan_monthly", "base_plan_id_android should match")

	# Test to_dict
	var dict = offer.to_dict()
	_assert_equal(dict["id"], "sub_offer_123", "to_dict id should match")
	_assert_equal(dict["displayPrice"], "$9.99/month", "to_dict should use camelCase")
	_assert_equal(dict["periodCount"], 3, "to_dict periodCount should match")

	# Test from_dict
	# Note: from_dict expects enum values as integers, not strings
	var from_dict_data = {
		"id": "parsed_sub_offer",
		"displayPrice": "$4.99/week",
		"price": 4.99,
		"currency": "USD",
		"type": Types.DiscountOfferType.PROMOTIONAL,
		"periodCount": 1,
		"paymentMode": Types.PaymentMode.PAY_AS_YOU_GO,
		"keyIdentifierIOS": "parsed_key",
		"basePlanIdAndroid": "weekly_base"
	}
	var parsed = Types.SubscriptionOffer.from_dict(from_dict_data)
	_assert_equal(parsed.id, "parsed_sub_offer", "from_dict id should match")
	_assert_equal(parsed.period_count, 1, "from_dict period_count should match")
	_assert_equal(parsed.payment_mode, Types.PaymentMode.PAY_AS_YOU_GO, "from_dict payment_mode should be PAY_AS_YOU_GO")

	# Test PaymentMode enum
	_assert_equal(Types.PaymentMode.FREE_TRIAL, 0, "PaymentMode.FREE_TRIAL should be 0")
	_assert_equal(Types.PaymentMode.PAY_AS_YOU_GO, 1, "PaymentMode.PAY_AS_YOU_GO should be 1")
	_assert_equal(Types.PaymentMode.PAY_UP_FRONT, 2, "PaymentMode.PAY_UP_FRONT should be 2")


# ============================================
# SubscriptionPeriod Tests (v1.3.12)
# ============================================

func _test_subscription_period() -> void:
	print("Testing SubscriptionPeriod...")

	# Test creation
	var period = Types.SubscriptionPeriod.new()
	period.unit = Types.SubscriptionPeriodUnit.MONTH
	period.value = 1

	_assert_equal(period.unit, Types.SubscriptionPeriodUnit.MONTH, "unit should be MONTH")
	_assert_equal(period.value, 1, "value should be 1")

	# Test to_dict
	var dict = period.to_dict()
	_assert_equal(dict["unit"], "month", "to_dict unit should be string")
	_assert_equal(dict["value"], 1, "to_dict value should match")

	# Test from_dict
	# Note: from_dict expects enum values as integers, not strings
	var from_dict_data = {
		"unit": Types.SubscriptionPeriodUnit.YEAR,
		"value": 1
	}
	var parsed = Types.SubscriptionPeriod.from_dict(from_dict_data)
	_assert_equal(parsed.unit, Types.SubscriptionPeriodUnit.YEAR, "from_dict unit should be YEAR")
	_assert_equal(parsed.value, 1, "from_dict value should match")

	# Test SubscriptionPeriodUnit enum
	_assert_equal(Types.SubscriptionPeriodUnit.DAY, 0, "SubscriptionPeriodUnit.DAY should be 0")
	_assert_equal(Types.SubscriptionPeriodUnit.WEEK, 1, "SubscriptionPeriodUnit.WEEK should be 1")
	_assert_equal(Types.SubscriptionPeriodUnit.MONTH, 2, "SubscriptionPeriodUnit.MONTH should be 2")
	_assert_equal(Types.SubscriptionPeriodUnit.YEAR, 3, "SubscriptionPeriodUnit.YEAR should be 3")


# ============================================
# ExternalPurchaseCustomLink Tests (v1.3.16)
# ============================================

func _test_external_purchase_custom_link_notice_type_ios() -> void:
	print("Testing ExternalPurchaseCustomLinkNoticeTypeIOS...")

	# Test enum value
	_assert_equal(Types.ExternalPurchaseCustomLinkNoticeTypeIOS.BROWSER, 0, "ExternalPurchaseCustomLinkNoticeTypeIOS.BROWSER should be 0")


func _test_external_purchase_custom_link_token_type_ios() -> void:
	print("Testing ExternalPurchaseCustomLinkTokenTypeIOS...")

	# Test enum values
	_assert_equal(Types.ExternalPurchaseCustomLinkTokenTypeIOS.ACQUISITION, 0, "ExternalPurchaseCustomLinkTokenTypeIOS.ACQUISITION should be 0")
	_assert_equal(Types.ExternalPurchaseCustomLinkTokenTypeIOS.SERVICES, 1, "ExternalPurchaseCustomLinkTokenTypeIOS.SERVICES should be 1")


func _test_external_purchase_custom_link_notice_result_ios() -> void:
	print("Testing ExternalPurchaseCustomLinkNoticeResultIOS...")

	# Test creation
	var result = Types.ExternalPurchaseCustomLinkNoticeResultIOS.new()
	result.continued = true
	result.error = ""

	_assert_equal(result.continued, true, "ExternalPurchaseCustomLinkNoticeResultIOS continued should be true")
	_assert_equal(result.error, "", "ExternalPurchaseCustomLinkNoticeResultIOS error should be empty")

	# Test to_dict
	var dict = result.to_dict()
	_assert_equal(dict["continued"], true, "to_dict continued should match")
	_assert_equal(dict["error"], "", "to_dict error should match")

	# Test from_dict
	var from_dict_data = {
		"continued": false,
		"error": "User cancelled"
	}
	var parsed = Types.ExternalPurchaseCustomLinkNoticeResultIOS.from_dict(from_dict_data)
	_assert_equal(parsed.continued, false, "from_dict continued should be false")
	_assert_equal(parsed.error, "User cancelled", "from_dict error should match")


func _test_external_purchase_custom_link_token_result_ios() -> void:
	print("Testing ExternalPurchaseCustomLinkTokenResultIOS...")

	# Test creation
	var result = Types.ExternalPurchaseCustomLinkTokenResultIOS.new()
	result.token = "abc123token"
	result.error = ""

	_assert_equal(result.token, "abc123token", "ExternalPurchaseCustomLinkTokenResultIOS token should match")
	_assert_equal(result.error, "", "ExternalPurchaseCustomLinkTokenResultIOS error should be empty")

	# Test to_dict
	var dict = result.to_dict()
	_assert_equal(dict["token"], "abc123token", "to_dict token should match")
	_assert_equal(dict["error"], "", "to_dict error should match")

	# Test from_dict
	var from_dict_data = {
		"token": "parsed_token_xyz",
		"error": null
	}
	var parsed = Types.ExternalPurchaseCustomLinkTokenResultIOS.from_dict(from_dict_data)
	_assert_equal(parsed.token, "parsed_token_xyz", "from_dict token should match")

	# Test from_dict with error
	var error_data = {
		"token": null,
		"error": "Not eligible"
	}
	var error_result = Types.ExternalPurchaseCustomLinkTokenResultIOS.from_dict(error_data)
	_assert_equal(error_result.error, "Not eligible", "from_dict error should match")


# ============================================
# Error Code Mapping Tests
# ============================================

func _test_purchase_error_code_mapping() -> void:
	print("Testing PurchaseError code mapping...")

	var parsed = Types.PurchaseError.from_dict({
		"code": "user-cancelled",
		"message": "User cancelled",
		"productId": "sku.a",
	})
	_assert_equal(parsed.code, Types.ErrorCode.USER_CANCELLED, "String codes should map to the ErrorCode enum")
	_assert_equal(parsed.message, "User cancelled", "The error message should be preserved")
	_assert_equal(parsed.product_id, "sku.a", "The product id should be preserved")

	var dict = parsed.to_dict()
	_assert_equal(dict["code"], "user-cancelled", "Enum codes should serialize back to their wire strings")

	var unknown = Types.PurchaseError.from_dict({"code": "definitely-not-a-code", "message": "x"})
	_assert_equal(unknown.code, Types.ErrorCode.UNKNOWN, "Unrecognized string codes should fall back to UNKNOWN")

	var int_code = Types.PurchaseError.from_dict({"code": Types.ErrorCode.SERVICE_ERROR, "message": "x"})
	_assert_equal(int_code.code, Types.ErrorCode.SERVICE_ERROR, "Integer codes should pass through unchanged")

	var full = Types.PurchaseError.from_dict({
		"code": "already-owned",
		"message": "Owned",
		"subResponseCodeAndroid": "user-ineligible",
		"productIds": ["a", null, "b"],
	})
	_assert_equal(full.code, Types.ErrorCode.ALREADY_OWNED, "already-owned should map to ALREADY_OWNED")
	_assert_equal(full.sub_response_code_android, Types.SubResponseCodeAndroid.USER_INELIGIBLE, "Sub-response strings should map to the enum")
	_assert_equal(full.product_ids.size(), 2, "Malformed productIds entries should be skipped")

	var round_trip = Types.PurchaseError.from_dict(full.to_dict())
	_assert_equal(round_trip.code, Types.ErrorCode.ALREADY_OWNED, "Error codes should survive a round trip")
	_assert_equal(round_trip.sub_response_code_android, Types.SubResponseCodeAndroid.USER_INELIGIBLE, "Sub-response codes should survive a round trip")


func _test_error_code_maps_complete() -> void:
	print("Testing ErrorCode map completeness...")

	var enum_values = Types.ErrorCode.values()
	_assert_equal(Types.ERROR_CODE_VALUES.size(), enum_values.size(), "Every ErrorCode should have a serialized value")

	var missing := 0
	for value in enum_values:
		if not Types.ERROR_CODE_VALUES.has(value):
			missing += 1
	_assert_equal(missing, 0, "No ErrorCode should be missing from ERROR_CODE_VALUES")

	# Canonical OpenIAP wire strings used across all SDKs (kebab-case).
	_assert_equal(Types.ERROR_CODE_VALUES[Types.ErrorCode.USER_CANCELLED], "user-cancelled", "USER_CANCELLED wire value")
	_assert_equal(Types.ERROR_CODE_VALUES[Types.ErrorCode.SERVICE_ERROR], "service-error", "SERVICE_ERROR wire value")
	_assert_equal(Types.ERROR_CODE_VALUES[Types.ErrorCode.NOT_PREPARED], "not-prepared", "NOT_PREPARED wire value")
	_assert_equal(Types.ERROR_CODE_VALUES[Types.ErrorCode.DEVELOPER_ERROR], "developer-error", "DEVELOPER_ERROR wire value")
	_assert_equal(Types.ERROR_CODE_VALUES[Types.ErrorCode.FEATURE_NOT_SUPPORTED], "feature-not-supported", "FEATURE_NOT_SUPPORTED wire value")
	_assert_equal(Types.ERROR_CODE_VALUES[Types.ErrorCode.PURCHASE_VERIFICATION_FAILED], "purchase-verification-failed", "PURCHASE_VERIFICATION_FAILED wire value")


func _test_enum_value_maps_bijective() -> void:
	print("Testing enum VALUES/FROM_STRING bijections...")

	var types_script: Script = Types
	var constant_map: Dictionary = types_script.get_script_constant_map()
	var pair_count := 0
	for constant_name in constant_map:
		var key = str(constant_name)
		if not key.ends_with("_VALUES"):
			continue
		var values = constant_map[constant_name]
		if not (values is Dictionary):
			continue
		var from_name = key.trim_suffix("_VALUES") + "_FROM_STRING"
		if not constant_map.has(from_name):
			_assert_true(false, "%s should have a matching %s map" % [key, from_name])
			continue
		var from_map: Dictionary = constant_map[from_name]
		pair_count += 1
		var consistent = from_map.size() == values.size()
		for enum_value in values:
			if from_map.get(values[enum_value], null) != enum_value:
				consistent = false
		_assert_true(consistent, "%s and %s should be a bijection" % [key, from_name])
	_assert_true(pair_count >= 30, "Expected at least 30 enum value maps (got %d)" % pair_count)


# ============================================
# Wire-Format Round-Trip Tests
# ============================================
# Serialize through JSON.stringify/JSON.parse_string to mirror what actually
# crosses the native plugin boundary (all JSON numbers come back as floats).

func _test_purchase_android_json_round_trip() -> void:
	print("Testing PurchaseAndroid JSON round trip...")

	var purchase = Types.PurchaseAndroid.new()
	purchase.id = "txn-1"
	purchase.product_id = "sku.a"
	var ids: Array[String] = ["sku.a"]
	purchase.ids = ids
	purchase.transaction_id = "txn-1"
	purchase.transaction_date = 1720000000000.0
	purchase.purchase_token = "token-1"
	purchase.store = Types.IapStore.GOOGLE
	purchase.platform = Types.IapPlatform.ANDROID
	purchase.quantity = 2
	purchase.purchase_state = Types.PurchaseState.PURCHASED
	purchase.is_auto_renewing = true
	purchase.is_acknowledged_android = true

	var dict = purchase.to_dict()
	_assert_equal(dict["store"], "google", "IapStore should serialize to its wire value")
	_assert_equal(dict["platform"], "android", "IapPlatform should serialize to its wire value")
	_assert_equal(dict["purchaseState"], "purchased", "PurchaseState should serialize to its wire value")

	var wire = JSON.parse_string(JSON.stringify(dict))
	var parsed = Types.PurchaseAndroid.from_dict(wire)
	_assert_equal(parsed.product_id, "sku.a", "productId should survive the wire round trip")
	_assert_equal(parsed.store, Types.IapStore.GOOGLE, "store should parse back to the enum")
	_assert_equal(parsed.platform, Types.IapPlatform.ANDROID, "platform should parse back to the enum")
	_assert_equal(parsed.purchase_state, Types.PurchaseState.PURCHASED, "purchaseState should parse back to the enum")
	_assert_equal(parsed.quantity, 2, "quantity should survive JSON float conversion")
	_assert_equal(parsed.is_acknowledged_android, true, "isAcknowledgedAndroid should survive the wire round trip")
	_assert_equal(parsed.ids.size(), 1, "ids should survive the wire round trip")

	var unknown_state = Types.PurchaseAndroid.from_dict({"productId": "p", "purchaseState": "mystery"})
	_assert_equal(unknown_state.purchase_state, Types.PurchaseState.UNKNOWN, "Unknown purchaseState strings should fall back to UNKNOWN")
	var unknown_store = Types.PurchaseAndroid.from_dict({"productId": "p", "store": "mystery"})
	_assert_equal(unknown_store.store, Types.IapStore.UNKNOWN, "Unknown store strings should fall back to UNKNOWN")


func _test_purchase_ios_json_round_trip() -> void:
	print("Testing PurchaseIOS JSON round trip...")

	var purchase = Types.PurchaseIOS.new()
	purchase.id = "txn-ios-1"
	purchase.product_id = "ios.sku"
	purchase.transaction_id = "txn-ios-1"
	purchase.transaction_date = 1720000000000.0
	purchase.purchase_token = "jws-token"
	purchase.store = Types.IapStore.APPLE
	purchase.platform = Types.IapPlatform.IOS
	purchase.quantity = 1
	purchase.purchase_state = Types.PurchaseState.PURCHASED
	purchase.original_transaction_identifier_ios = "orig-1"

	var wire = JSON.parse_string(JSON.stringify(purchase.to_dict()))
	_assert_equal(wire["store"], "apple", "IapStore should serialize to apple")
	_assert_equal(wire["platform"], "ios", "IapPlatform should serialize to ios")

	var parsed = Types.PurchaseIOS.from_dict(wire)
	_assert_equal(parsed.product_id, "ios.sku", "productId should survive the wire round trip")
	_assert_equal(parsed.store, Types.IapStore.APPLE, "store should parse back to the enum")
	_assert_equal(parsed.original_transaction_identifier_ios, "orig-1", "iOS-only fields should survive the wire round trip")


func _test_active_subscription_round_trip() -> void:
	print("Testing ActiveSubscription round trip...")

	var subscription = Types.ActiveSubscription.from_dict({
		"productId": "sub.gold",
		"isActive": true,
		"expirationDateIOS": 1720000000000.0,
		"autoRenewingAndroid": true,
		"environmentIOS": "Production",
		"daysUntilExpirationIOS": 12,
		"transactionId": "txn-2",
		"purchaseToken": "token-2",
		"transactionDate": 1710000000000.0,
		"basePlanIdAndroid": "annual",
		"currentPlanId": "annual",
	})
	_assert_equal(subscription.product_id, "sub.gold", "productId should parse")
	_assert_equal(subscription.is_active, true, "isActive should parse")
	_assert_equal(subscription.auto_renewing_android, true, "autoRenewingAndroid should parse")
	_assert_equal(subscription.base_plan_id_android, "annual", "basePlanIdAndroid should parse")

	var wire = JSON.parse_string(JSON.stringify(subscription.to_dict()))
	var round_trip = Types.ActiveSubscription.from_dict(wire)
	_assert_equal(round_trip.product_id, "sub.gold", "productId should survive the wire round trip")
	_assert_equal(round_trip.expiration_date_ios, 1720000000000.0, "expirationDateIOS should survive the wire round trip")
	_assert_equal(round_trip.current_plan_id, "annual", "currentPlanId should survive the wire round trip")


func _test_product_android_round_trip() -> void:
	print("Testing ProductAndroid round trip...")

	var product = Types.ProductAndroid.from_dict({
		"id": "coins.100",
		"title": "Coins",
		"description": "100 coins",
		"type": "in-app",
		"displayPrice": "$0.99",
		"currency": "USD",
		"price": 0.99,
		"platform": "android",
		"nameAndroid": "Coins",
		"discountOffers": [{
			"id": "d1",
			"displayPrice": "$0.49",
			"price": 0.49,
			"type": "one-time",
		}],
	})
	_assert_equal(product.type, Types.ProductType.IN_APP, "type strings should map to the ProductType enum")
	_assert_equal(product.platform, Types.IapPlatform.ANDROID, "platform strings should map to the IapPlatform enum")
	_assert_equal(product.discount_offers.size(), 1, "discountOffers should parse into typed offers")
	_assert_equal(product.discount_offers[0].type, Types.DiscountOfferType.ONE_TIME, "Offer type strings should map to the enum")

	var dict = product.to_dict()
	_assert_equal(dict["type"], "in-app", "type should serialize back to its wire value")
	_assert_equal(dict["platform"], "android", "platform should serialize back to its wire value")

	var wire = JSON.parse_string(JSON.stringify(dict))
	var round_trip = Types.ProductAndroid.from_dict(wire)
	_assert_equal(round_trip.id, "coins.100", "id should survive the wire round trip")
	_assert_equal(round_trip.price, 0.99, "price should survive the wire round trip")
	_assert_equal(round_trip.discount_offers.size(), 1, "Nested offers should survive the wire round trip")
	_assert_equal(round_trip.discount_offers[0].id, "d1", "Nested offer fields should survive the wire round trip")


func _test_product_ios_round_trip() -> void:
	print("Testing ProductIOS round trip...")

	var product = Types.ProductIOS.from_dict({
		"id": "ios.premium",
		"title": "Premium",
		"description": "Premium product",
		"type": "in-app",
		"displayPrice": "$9.99",
		"currency": "USD",
		"platform": "ios",
		"displayNameIOS": "Premium",
		"isFamilyShareableIOS": true,
		"jsonRepresentationIOS": "{}",
		"typeIOS": "non-consumable",
	})
	_assert_equal(product.platform, Types.IapPlatform.IOS, "platform strings should map to the IapPlatform enum")
	_assert_equal(product.type_ios, Types.ProductTypeIOS.NON_CONSUMABLE, "typeIOS strings should map to the enum")
	_assert_equal(product.is_family_shareable_ios, true, "isFamilyShareableIOS should parse")

	var wire = JSON.parse_string(JSON.stringify(product.to_dict()))
	_assert_equal(wire["typeIOS"], "non-consumable", "typeIOS should serialize back to its wire value")

	var round_trip = Types.ProductIOS.from_dict(wire)
	_assert_equal(round_trip.display_name_ios, "Premium", "displayNameIOS should survive the wire round trip")
	_assert_equal(round_trip.type_ios, Types.ProductTypeIOS.NON_CONSUMABLE, "typeIOS should survive the wire round trip")


func _test_purchase_input_round_trip() -> void:
	print("Testing PurchaseInput round trip...")

	var input = Types.PurchaseInput.new()
	input.id = "txn-3"
	input.product_id = "sku.c"
	input.purchase_token = "token-3"
	input.store = Types.IapStore.GOOGLE
	input.purchase_state = Types.PurchaseState.PENDING
	input.quantity = 1
	input.transaction_date = 1720000000000.0

	var dict = input.to_dict()
	_assert_equal(dict["store"], "google", "PurchaseInput store should serialize to its wire value")
	_assert_equal(dict["purchaseState"], "pending", "PurchaseInput purchaseState should serialize to its wire value")

	var wire = JSON.parse_string(JSON.stringify(dict))
	var parsed = Types.PurchaseInput.from_dict(wire)
	_assert_equal(parsed.product_id, "sku.c", "productId should survive the wire round trip")
	_assert_equal(parsed.store, Types.IapStore.GOOGLE, "store should parse back to the enum")
	_assert_equal(parsed.purchase_state, Types.PurchaseState.PENDING, "purchaseState should parse back to the enum")
	_assert_equal(parsed.purchase_token, "token-3", "purchaseToken should survive the wire round trip")


# ============================================
# Test Utilities
# ============================================

func _assert_equal(actual, expected, message: String) -> void:
	if actual == expected:
		_total_passed += 1
		print("  PASS: %s" % message)
	else:
		_total_failed += 1
		print("  FAIL: %s (expected: %s, got: %s)" % [message, expected, actual])
