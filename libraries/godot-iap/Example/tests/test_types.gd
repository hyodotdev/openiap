extends Node
## Unit tests for types.gd
## Run with: godot --headless --script tests/test_types.gd

const Types = preload("res://addons/godot-iap/types.gd")

var _tests_passed := 0
var _tests_failed := 0


func _ready() -> void:
	print("\n========================================")
	print("Running types.gd tests...")
	print("========================================\n")

	_run_all_tests()

	print("\n========================================")
	print("Results: %d passed, %d failed" % [_tests_passed, _tests_failed])
	print("========================================\n")

	# Exit with appropriate code
	get_tree().quit(0 if _tests_failed == 0 else 1)


func _run_all_tests() -> void:
	# ProductRequest tests
	test_product_request_creation()
	test_product_request_to_dict()
	test_product_request_from_dict()

	# PurchaseAndroid tests
	test_purchase_android_creation()
	test_purchase_android_to_dict()
	test_purchase_android_from_dict()

	# PurchaseIOS tests
	test_purchase_ios_creation()
	test_purchase_ios_to_dict()

	# RequestPurchaseProps tests
	test_request_purchase_props_creation()

	# VoidResult tests
	test_void_result()

	# Enum tests
	test_product_query_type_enum()
	test_purchase_state_enum()

	# New types (v1.3.12)
	test_discount_offer_type_enum()
	test_payment_mode_enum()
	test_subscription_period_unit_enum()

	# Simplified field names (v1.3.15)
	test_request_purchase_android_props_offer_token()
	test_request_purchase_android_props_to_dict()
	test_request_subscription_android_props_simplified_names()

	# ExternalPurchaseCustomLink types (v1.3.16)
	test_external_purchase_custom_link_notice_type_ios()
	test_external_purchase_custom_link_token_type_ios()
	test_external_purchase_custom_link_notice_result_ios()
	test_external_purchase_custom_link_token_result_ios()


# ============================================
# ProductRequest Tests
# ============================================

func test_product_request_creation() -> void:
	var request = Types.ProductRequest.new()
	var skus: Array[String] = ["product_1", "product_2"]
	request.skus = skus
	request.type = Types.ProductQueryType.IN_APP

	_assert_equal(request.skus.size(), 2, "ProductRequest should have 2 skus")
	_assert_equal(request.skus[0], "product_1", "First sku should be product_1")
	_assert_equal(request.type, Types.ProductQueryType.IN_APP, "Type should be IN_APP")


func test_product_request_to_dict() -> void:
	var request = Types.ProductRequest.new()
	var skus: Array[String] = ["test_sku"]
	request.skus = skus
	request.type = Types.ProductQueryType.SUBS

	var dict = request.to_dict()

	_assert_equal(dict["skus"][0], "test_sku", "to_dict should preserve sku")
	_assert_equal(dict["type"], "subs", "to_dict should convert type to string")


func test_product_request_from_dict() -> void:
	var dict = {
		"skus": ["sku_from_dict"],
		"type": "in-app"
	}

	var request = Types.ProductRequest.from_dict(dict)

	_assert_equal(request.skus[0], "sku_from_dict", "from_dict should parse skus")


# ============================================
# PurchaseAndroid Tests
# ============================================

func test_purchase_android_creation() -> void:
	var purchase = Types.PurchaseAndroid.new()
	purchase.id = "purchase_123"
	purchase.product_id = "product_abc"
	purchase.purchase_token = "token_xyz"
	purchase.purchase_state = Types.PurchaseState.PURCHASED

	_assert_equal(purchase.id, "purchase_123", "PurchaseAndroid id should match")
	_assert_equal(purchase.product_id, "product_abc", "product_id should match")
	_assert_equal(purchase.purchase_token, "token_xyz", "purchase_token should match")


func test_purchase_android_to_dict() -> void:
	var purchase = Types.PurchaseAndroid.new()
	purchase.id = "test_id"
	purchase.product_id = "test_product"
	purchase.transaction_id = "txn_123"
	purchase.purchase_token = "token_abc"
	purchase.is_acknowledged_android = true

	var dict = purchase.to_dict()

	_assert_equal(dict["id"], "test_id", "to_dict should preserve id")
	_assert_equal(dict["productId"], "test_product", "to_dict should use camelCase for productId")
	_assert_equal(dict["transactionId"], "txn_123", "to_dict should preserve transactionId")
	_assert_equal(dict["purchaseToken"], "token_abc", "to_dict should preserve purchaseToken")
	_assert_equal(dict["isAcknowledgedAndroid"], true, "to_dict should preserve isAcknowledgedAndroid")


func test_purchase_android_from_dict() -> void:
	var dict = {
		"id": "parsed_id",
		"productId": "parsed_product",
		"transactionId": "parsed_txn",
		"purchaseToken": "parsed_token",
		"purchaseState": "purchased",
		"isAcknowledgedAndroid": false
	}

	var purchase = Types.PurchaseAndroid.from_dict(dict)

	_assert_equal(purchase.id, "parsed_id", "from_dict should parse id")
	_assert_equal(purchase.product_id, "parsed_product", "from_dict should parse productId")
	_assert_equal(purchase.transaction_id, "parsed_txn", "from_dict should parse transactionId")
	_assert_equal(purchase.is_acknowledged_android, false, "from_dict should parse isAcknowledgedAndroid")


# ============================================
# PurchaseIOS Tests
# ============================================

func test_purchase_ios_creation() -> void:
	var purchase = Types.PurchaseIOS.new()
	purchase.id = "ios_purchase_123"
	purchase.product_id = "ios_product"
	purchase.transaction_id = "ios_txn"

	_assert_equal(purchase.id, "ios_purchase_123", "PurchaseIOS id should match")
	_assert_equal(purchase.product_id, "ios_product", "product_id should match")


func test_purchase_ios_to_dict() -> void:
	var purchase = Types.PurchaseIOS.new()
	purchase.id = "ios_id"
	purchase.product_id = "ios_product"
	purchase.original_transaction_id_ios = "original_txn"

	var dict = purchase.to_dict()

	_assert_equal(dict["id"], "ios_id", "to_dict should preserve id")
	_assert_equal(dict["productId"], "ios_product", "to_dict should use camelCase")
	_assert_equal(dict["originalTransactionIdIOS"], "original_txn", "to_dict should preserve iOS fields")


# ============================================
# RequestPurchaseProps Tests
# ============================================

func test_request_purchase_props_creation() -> void:
	var props = Types.RequestPurchaseProps.new()
	props.type = Types.ProductQueryType.SUBS
	props.request = Types.RequestPurchasePropsByPlatforms.new()
	props.request.google = Types.RequestPurchaseAndroidProps.new()

	var skus: Array[String] = ["subscription_monthly"]
	props.request.google.skus = skus

	_assert_equal(props.type, Types.ProductQueryType.SUBS, "RequestPurchaseProps type should be SUBS")
	_assert_equal(props.request.google.skus[0], "subscription_monthly", "Google skus should match")


# ============================================
# VoidResult Tests
# ============================================

func test_void_result() -> void:
	var result = Types.VoidResult.new()
	result.success = true

	_assert_equal(result.success, true, "VoidResult success should be true")

	result.success = false
	_assert_equal(result.success, false, "VoidResult success should be false")


# ============================================
# Enum Tests
# ============================================

func test_product_query_type_enum() -> void:
	_assert_equal(Types.ProductQueryType.IN_APP, 0, "IN_APP should be 0")
	_assert_equal(Types.ProductQueryType.SUBS, 1, "SUBS should be 1")
	_assert_equal(Types.ProductQueryType.ALL, 2, "ALL should be 2")


func test_purchase_state_enum() -> void:
	_assert_equal(Types.PurchaseState.PENDING, 0, "PENDING should be 0")
	_assert_equal(Types.PurchaseState.PURCHASED, 1, "PURCHASED should be 1")
	_assert_equal(Types.PurchaseState.UNKNOWN, 2, "UNKNOWN should be 2")


func test_discount_offer_type_enum() -> void:
	_assert_equal(Types.DiscountOfferType.INTRODUCTORY, 0, "INTRODUCTORY should be 0")
	_assert_equal(Types.DiscountOfferType.PROMOTIONAL, 1, "PROMOTIONAL should be 1")
	_assert_equal(Types.DiscountOfferType.ONE_TIME, 2, "ONE_TIME should be 2")


func test_payment_mode_enum() -> void:
	_assert_equal(Types.PaymentMode.FREE_TRIAL, 0, "FREE_TRIAL should be 0")
	_assert_equal(Types.PaymentMode.PAY_AS_YOU_GO, 1, "PAY_AS_YOU_GO should be 1")
	_assert_equal(Types.PaymentMode.PAY_UP_FRONT, 2, "PAY_UP_FRONT should be 2")
	_assert_equal(Types.PaymentMode.UNKNOWN, 3, "UNKNOWN should be 3")


func test_subscription_period_unit_enum() -> void:
	_assert_equal(Types.SubscriptionPeriodUnit.DAY, 0, "DAY should be 0")
	_assert_equal(Types.SubscriptionPeriodUnit.WEEK, 1, "WEEK should be 1")
	_assert_equal(Types.SubscriptionPeriodUnit.MONTH, 2, "MONTH should be 2")
	_assert_equal(Types.SubscriptionPeriodUnit.YEAR, 3, "YEAR should be 3")
	_assert_equal(Types.SubscriptionPeriodUnit.UNKNOWN, 4, "UNKNOWN should be 4")


# ============================================
# RequestPurchaseAndroidProps Tests (v1.3.15+)
# ============================================

func test_request_purchase_android_props_offer_token() -> void:
	# Test that RequestPurchaseAndroidProps has offer_token field (no Android suffix)
	var request = Types.RequestPurchaseAndroidProps.new()
	var skus: Array[String] = ["product_id"]
	request.skus = skus
	request.offer_token = "test_offer_token"
	request.is_offer_personalized = true
	request.obfuscated_account_id = "user_123"
	request.obfuscated_profile_id = "profile_456"

	_assert_equal(request.skus[0], "product_id", "RequestPurchaseAndroidProps should have sku")
	_assert_equal(request.offer_token, "test_offer_token", "RequestPurchaseAndroidProps should have offer_token (no Android suffix)")
	_assert_equal(request.is_offer_personalized, true, "RequestPurchaseAndroidProps should have is_offer_personalized (no Android suffix)")
	_assert_equal(request.obfuscated_account_id, "user_123", "RequestPurchaseAndroidProps should have obfuscated_account_id (no Android suffix)")
	_assert_equal(request.obfuscated_profile_id, "profile_456", "RequestPurchaseAndroidProps should have obfuscated_profile_id (no Android suffix)")


func test_request_purchase_android_props_to_dict() -> void:
	var request = Types.RequestPurchaseAndroidProps.new()
	var skus: Array[String] = ["product_id"]
	request.skus = skus
	request.offer_token = "discount_token"

	var dict = request.to_dict()

	_assert_equal(dict["skus"][0], "product_id", "to_dict should preserve skus")
	_assert_equal(dict["offerToken"], "discount_token", "to_dict should serialize offer_token as offerToken")


func test_request_subscription_android_props_simplified_names() -> void:
	# Test that RequestSubscriptionAndroidProps uses simplified field names (no Android suffix)
	var request = Types.RequestSubscriptionAndroidProps.new()
	var skus: Array[String] = ["premium_monthly"]
	request.skus = skus
	request.purchase_token = "old_purchase_token"
	request.replacement_mode = 2  # CHARGE_PRORATED_PRICE
	request.obfuscated_account_id = "user_123"

	_assert_equal(request.purchase_token, "old_purchase_token", "RequestSubscriptionAndroidProps should have purchase_token (no Android suffix)")
	_assert_equal(request.replacement_mode, 2, "RequestSubscriptionAndroidProps should have replacement_mode (no Android suffix)")
	_assert_equal(request.obfuscated_account_id, "user_123", "RequestSubscriptionAndroidProps should have obfuscated_account_id (no Android suffix)")


# ============================================
# ExternalPurchaseCustomLink Tests (v1.3.16)
# ============================================

func test_external_purchase_custom_link_notice_type_ios() -> void:
	_assert_equal(Types.ExternalPurchaseCustomLinkNoticeTypeIOS.BROWSER, 0, "ExternalPurchaseCustomLinkNoticeTypeIOS.BROWSER should be 0")


func test_external_purchase_custom_link_token_type_ios() -> void:
	_assert_equal(Types.ExternalPurchaseCustomLinkTokenTypeIOS.ACQUISITION, 0, "ExternalPurchaseCustomLinkTokenTypeIOS.ACQUISITION should be 0")
	_assert_equal(Types.ExternalPurchaseCustomLinkTokenTypeIOS.SERVICES, 1, "ExternalPurchaseCustomLinkTokenTypeIOS.SERVICES should be 1")


func test_external_purchase_custom_link_notice_result_ios() -> void:
	# Test creation and to_dict
	var result = Types.ExternalPurchaseCustomLinkNoticeResultIOS.new()
	result.continued = true
	result.error = ""

	_assert_equal(result.continued, true, "ExternalPurchaseCustomLinkNoticeResultIOS continued should be true")
	_assert_equal(result.error, "", "ExternalPurchaseCustomLinkNoticeResultIOS error should be empty")

	var dict = result.to_dict()
	_assert_equal(dict["continued"], true, "to_dict continued should match")
	_assert_equal(dict["error"], "", "to_dict error should match")

	# Test from_dict
	var from_dict_data = {"continued": false, "error": "User cancelled"}
	var parsed = Types.ExternalPurchaseCustomLinkNoticeResultIOS.from_dict(from_dict_data)
	_assert_equal(parsed.continued, false, "from_dict continued should be false")
	_assert_equal(parsed.error, "User cancelled", "from_dict error should match")


func test_external_purchase_custom_link_token_result_ios() -> void:
	# Test creation and to_dict
	var result = Types.ExternalPurchaseCustomLinkTokenResultIOS.new()
	result.token = "abc123token"
	result.error = ""

	_assert_equal(result.token, "abc123token", "ExternalPurchaseCustomLinkTokenResultIOS token should match")
	_assert_equal(result.error, "", "ExternalPurchaseCustomLinkTokenResultIOS error should be empty")

	var dict = result.to_dict()
	_assert_equal(dict["token"], "abc123token", "to_dict token should match")
	_assert_equal(dict["error"], "", "to_dict error should match")

	# Test from_dict
	var from_dict_data = {"token": "parsed_token", "error": null}
	var parsed = Types.ExternalPurchaseCustomLinkTokenResultIOS.from_dict(from_dict_data)
	_assert_equal(parsed.token, "parsed_token", "from_dict token should match")
	_assert_equal(parsed.error, null, "from_dict error should be null")

	# Test from_dict with error
	var error_data = {"token": null, "error": "Not eligible"}
	var error_result = Types.ExternalPurchaseCustomLinkTokenResultIOS.from_dict(error_data)
	_assert_equal(error_result.token, null, "from_dict token should be null")
	_assert_equal(error_result.error, "Not eligible", "from_dict error should match")


# ============================================
# Test Utilities
# ============================================

func _assert_equal(actual, expected, message: String) -> void:
	if actual == expected:
		_tests_passed += 1
		print("  PASS: %s" % message)
	else:
		_tests_failed += 1
		print("  FAIL: %s (expected: %s, got: %s)" % [message, expected, actual])


func _assert_true(condition: bool, message: String) -> void:
	_assert_equal(condition, true, message)


func _assert_false(condition: bool, message: String) -> void:
	_assert_equal(condition, false, message)
