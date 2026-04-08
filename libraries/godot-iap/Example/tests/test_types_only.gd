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

	# PurchaseAndroid tests
	_test_purchase_android()

	# PurchaseIOS tests
	_test_purchase_ios()

	# RequestPurchaseProps tests
	_test_request_purchase_props()

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

	# Test from_dict (skus need to be typed Array[String])
	var sku_arr: Array[String] = ["sku_from_dict"]
	var from_dict_data = {"skus": sku_arr, "type": "subs"}
	var parsed = Types.ProductRequest.from_dict(from_dict_data)
	_assert_equal(parsed.skus[0], "sku_from_dict", "from_dict should parse skus")


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

	var props = Types.RequestPurchaseProps.new()
	props.type = Types.ProductQueryType.SUBS
	props.request = Types.RequestPurchasePropsByPlatforms.new()
	props.request.google = Types.RequestPurchaseAndroidProps.new()

	var skus: Array[String] = ["subscription_monthly"]
	props.request.google.skus = skus

	_assert_equal(props.type, Types.ProductQueryType.SUBS, "Type should be SUBS")
	_assert_equal(props.request.google.skus[0], "subscription_monthly", "Google skus should match")


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
# Test Utilities
# ============================================

func _assert_equal(actual, expected, message: String) -> void:
	if actual == expected:
		_total_passed += 1
		print("  PASS: %s" % message)
	else:
		_total_failed += 1
		print("  FAIL: %s (expected: %s, got: %s)" % [message, expected, actual])
