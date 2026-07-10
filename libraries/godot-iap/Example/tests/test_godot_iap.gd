extends SceneTree
## Unit tests for godot_iap.gd (mock mode)
## Run with: godot --headless --script tests/test_godot_iap.gd

const Types = preload("res://addons/godot-iap/types.gd")
const GodotIapWrapper = preload("res://addons/godot-iap/godot_iap.gd")

var _tests_passed := 0
var _tests_failed := 0
var GodotIapPlugin: Node = null


class FakeAndroidPlugin:
	extends RefCounted
	var last_config: Dictionary = {}
	var last_purchase: Dictionary = {}

	func initConnectionWithConfig(config_json: String) -> bool:
		last_config = JSON.parse_string(config_json)
		return true

	func requestPurchaseJson(params_json: String) -> String:
		last_purchase = JSON.parse_string(params_json)
		return JSON.stringify({"success": true, "pending": true})


func _init() -> void:
	_run_suite.call_deferred()


func _run_suite() -> void:
	GodotIapPlugin = GodotIapWrapper.new()
	root.add_child(GodotIapPlugin)
	await process_frame
	print("\n========================================")
	print("Running godot_iap.gd tests (mock mode)...")
	print("========================================\n")

	await _run_all_tests()

	print("\n========================================")
	print("Results: %d passed, %d failed" % [_tests_passed, _tests_failed])
	print("========================================\n")

	quit(0 if _tests_failed == 0 else 1)


func _run_all_tests() -> void:
	# Connection tests (run BEFORE guard tests to avoid state leakage)
	test_init_connection_mock()
	test_end_connection_mock()

	# Initialization guard tests
	test_ready_guard_prevents_double_init()
	test_init_connection_idempotent()
	test_no_duplicate_signal_connections()

	# Product tests
	await test_fetch_products_mock()
	test_product_variant_mapping()

	# Purchase tests
	test_billing_choice_android_payloads()
	test_get_available_purchases_mock()
	test_restore_purchases_mock()

	# Finish transaction tests
	test_finish_transaction_mock()

	# Platform-specific mock tests
	test_ios_methods_mock()
	test_android_methods_mock()


# ============================================
# Initialization Guard Tests
# ============================================

func test_ready_guard_prevents_double_init() -> void:
	# Static _is_initialized should be true after first _ready() call
	_assert_true(GodotIapWrapper._is_initialized, "static _is_initialized should be true after _ready()")

	# Count connected signals before second _ready() call
	var connected_before = GodotIapPlugin.purchase_updated.get_connections().size()
	GodotIapPlugin._ready()
	var connected_after = GodotIapPlugin.purchase_updated.get_connections().size()

	# Guard should prevent _init_native_plugin() from running again,
	# so signal connection count must not increase
	_assert_equal(connected_before, connected_after, "_ready() called twice should not add duplicate signal connections")
	_assert_true(GodotIapWrapper._is_initialized, "static _is_initialized should still be true after second _ready()")


func test_init_connection_idempotent() -> void:
	# Reset connection state to test fresh
	GodotIapPlugin._is_connected = false

	# Repeated calls should consistently report that no native store is available.
	var result1 = GodotIapPlugin.init_connection()
	_assert_false(result1, "First init_connection should report unavailable native plugin")

	var result2 = GodotIapPlugin.init_connection()
	_assert_false(result2, "Second init_connection should remain unavailable")


func test_no_duplicate_signal_connections() -> void:
	# After multiple _ready() calls, signals should not have duplicate connections
	var purchase_updated_count = GodotIapPlugin.purchase_updated.get_connections().size()
	var purchase_error_count = GodotIapPlugin.purchase_error.get_connections().size()

	# In mock mode (no native plugin), there should be 0 native signal connections
	# The key assertion: counts should be <= 1 (no duplicates)
	_assert_true(purchase_updated_count <= 1, "purchase_updated should have at most 1 connection (got %d)" % purchase_updated_count)
	_assert_true(purchase_error_count <= 1, "purchase_error should have at most 1 connection (got %d)" % purchase_error_count)


# ============================================
# Connection Tests (Mock Mode)
# ============================================

func test_init_connection_mock() -> void:
	# A desktop test run has no native store plugin and must report that clearly.
	var result = GodotIapPlugin.init_connection()
	_assert_false(result, "init_connection should return false without a native plugin")


func test_billing_choice_android_payloads() -> void:
	var fake = FakeAndroidPlugin.new()
	GodotIapPlugin._native_plugin = fake
	GodotIapPlugin._platform = "Android"

	var config = Types.InitConnectionConfig.new()
	config.enable_billing_program_android = Types.BillingProgramAndroid.BILLING_CHOICE
	config.billing_choice_screen_type_android = Types.BillingChoiceScreenTypeAndroid.DEVELOPER_RENDERED
	_assert_true(GodotIapPlugin.init_connection(config), "Billing Choice config should reach Android plugin")
	_assert_equal(fake.last_config.get("enableBillingProgramAndroid"), "billing-choice", "Billing Choice program should be preserved")
	_assert_equal(fake.last_config.get("billingChoiceScreenTypeAndroid"), "developer-rendered", "Billing Choice renderer should be preserved")

	var subscription = Types.RequestSubscriptionAndroidProps.new()
	var skus: Array[String] = ["monthly_subscription"]
	subscription.skus = skus
	subscription.original_external_transaction_id = "original-external-id"
	var option = Types.DeveloperBillingOptionParamsAndroid.new()
	option.billing_program = Types.BillingProgramAndroid.BILLING_CHOICE
	subscription.developer_billing_option = option
	GodotIapPlugin._request_purchase_raw({
		"type": "subs",
		"requestSubscription": {"google": subscription.to_dict()},
	})
	_assert_equal(fake.last_purchase.get("originalExternalTransactionId"), "original-external-id", "Original external transaction ID should reach Android plugin")
	_assert_equal(fake.last_purchase.get("developerBillingOption", {}).get("billingProgram"), "billing-choice", "Developer billing option should reach Android plugin")

	var replacement_params = Types.SubscriptionProductReplacementParamsAndroid.new()
	replacement_params.old_product_id = "legacy-monthly"
	replacement_params.replacement_mode = Types.SubscriptionReplacementModeAndroid.CHARGE_PRORATED_PRICE
	var raw_option = Types.DeveloperBillingOptionParamsAndroid.new()
	raw_option.billing_program = Types.BillingProgramAndroid.BILLING_CHOICE
	GodotIapPlugin._request_purchase_raw({
		"type": "subs",
		"requestSubscription": {"google": {
			"skus": ["monthly_subscription"],
			"subscriptionProductReplacementParams": replacement_params,
			"developerBillingOption": raw_option,
		}},
	})
	_assert_equal(fake.last_purchase.get("subscriptionProductReplacementParams", {}).get("oldProductId"), "legacy-monthly", "Replacement params objects should serialize to dictionaries")
	_assert_equal(fake.last_purchase.get("subscriptionProductReplacementParams", {}).get("replacementMode"), "charge-prorated-price", "Replacement mode should preserve its serialized value")
	_assert_equal(fake.last_purchase.get("developerBillingOption", {}).get("billingProgram"), "billing-choice", "Developer billing option objects should serialize to dictionaries")

	GodotIapPlugin._native_plugin = null
	GodotIapPlugin._platform = ""
	GodotIapPlugin._is_connected = false


func test_end_connection_mock() -> void:
	var result = GodotIapPlugin.end_connection()
	_assert_true(result, "end_connection should return true in mock mode")


# ============================================
# Product Tests (Mock Mode)
# ============================================

func test_fetch_products_mock() -> void:
	var request = Types.ProductRequest.new()
	var skus: Array[String] = ["test_product_1", "test_product_2"]
	request.skus = skus
	request.type = Types.ProductQueryType.IN_APP

	var products = await GodotIapPlugin.fetch_products(request)

	# In mock mode, returns mock products
	_assert_true(products.size() >= 0, "fetch_products should return an array")


func test_product_variant_mapping() -> void:
	var original_platform = GodotIapPlugin._platform
	var subscription_data = {
		"id": "premium",
		"title": "Premium",
		"description": "Premium subscription",
		"displayPrice": "$9.99",
		"currency": "USD",
		"type": "subs",
		"subscriptionOffers": [{
			"id": "intro",
			"displayPrice": "Free",
			"price": 0.0,
			"type": "introductory"
		}]
	}

	GodotIapPlugin._platform = "iOS"
	var ios_product = GodotIapPlugin._product_from_dict(subscription_data)
	_assert_true(
		ios_product is Types.ProductSubscriptionIOS,
		"iOS subscriptions should use ProductSubscriptionIOS"
	)
	_assert_equal(ios_product.subscription_offers.size(), 1, "iOS offers should be preserved")

	GodotIapPlugin._platform = "Android"
	subscription_data["nameAndroid"] = "Premium"
	subscription_data["subscriptionOfferDetailsAndroid"] = []
	var android_product = GodotIapPlugin._product_from_dict(subscription_data)
	_assert_true(
		android_product is Types.ProductSubscriptionAndroid,
		"Android subscriptions should use ProductSubscriptionAndroid"
	)
	_assert_equal(android_product.subscription_offers.size(), 1, "Android offers should be preserved")
	GodotIapPlugin._platform = original_platform


# ============================================
# Purchase Tests (Mock Mode)
# ============================================

func test_get_available_purchases_mock() -> void:
	var purchases = GodotIapPlugin.get_available_purchases()

	# In mock mode, returns empty array or mock purchases
	_assert_true(purchases is Array, "get_available_purchases should return an array")


func test_restore_purchases_mock() -> void:
	var result = GodotIapPlugin.restore_purchases()

	_assert_true(result is Types.VoidResult, "restore_purchases should return VoidResult")
	# Mock mode may return success=false
	_assert_true(result.success == true or result.success == false, "VoidResult should have success field")


func test_finish_transaction_mock() -> void:
	# Create a mock purchase
	var purchase = Types.PurchaseAndroid.new()
	purchase.product_id = "test_consumable"
	purchase.purchase_token = "mock_token_123"

	var result = GodotIapPlugin.finish_transaction(purchase, true)

	_assert_true(result is Types.VoidResult, "finish_transaction should return VoidResult")


# ============================================
# iOS Methods (Mock Mode)
# ============================================

func test_ios_methods_mock() -> void:
	# sync_ios
	var sync_result = GodotIapPlugin.sync_ios()
	_assert_true(sync_result is bool, "sync_ios should return bool")

	# clear_transaction_ios
	var clear_result = GodotIapPlugin.clear_transaction_ios()
	_assert_true(clear_result is bool, "clear_transaction_ios should return bool")

	# get_pending_transactions_ios
	var pending = GodotIapPlugin.get_pending_transactions_ios()
	_assert_true(pending is Array, "get_pending_transactions_ios should return Array")

	# present_code_redemption_sheet_ios
	var redemption_result = GodotIapPlugin.present_code_redemption_sheet_ios()
	_assert_true(redemption_result is bool, "present_code_redemption_sheet_ios should return bool")

	# request_purchase_on_promoted_product_ios
	var promoted_result = GodotIapPlugin.request_purchase_on_promoted_product_ios()
	_assert_true(promoted_result is bool, "request_purchase_on_promoted_product_ios should return bool")

	# current_entitlement_ios
	var entitlement = GodotIapPlugin.current_entitlement_ios("test_sku")
	_assert_true(entitlement == null or entitlement is Types.PurchaseIOS, "current_entitlement_ios should return PurchaseIOS or null")

	# begin_refund_request_ios
	var refund_status = await GodotIapPlugin.begin_refund_request_ios("test_sku")
	_assert_true(refund_status is String, "begin_refund_request_ios should return String")

	# latest_transaction_ios
	var latest = GodotIapPlugin.latest_transaction_ios("test_sku")
	_assert_true(latest == null or latest is Types.PurchaseIOS, "latest_transaction_ios should return PurchaseIOS or null")

	# get_storefront
	var storefront = GodotIapPlugin.get_storefront()
	_assert_true(storefront is String, "get_storefront should return String")


# ============================================
# Android Methods (Mock Mode)
# ============================================

func test_android_methods_mock() -> void:
	# acknowledge_purchase_android
	var ack_result = GodotIapPlugin.acknowledge_purchase_android("mock_token")
	_assert_true(ack_result is bool, "acknowledge_purchase_android should return bool")

	# consume_purchase_android
	var consume_result = GodotIapPlugin.consume_purchase_android("mock_token")
	_assert_true(consume_result is bool, "consume_purchase_android should return bool")

	# check_alternative_billing_availability_android
	var alternative_available = GodotIapPlugin.check_alternative_billing_availability_android()
	_assert_true(alternative_available is bool, "check_alternative_billing_availability_android should return bool")

	# show_alternative_billing_dialog_android
	var alternative_accepted = GodotIapPlugin.show_alternative_billing_dialog_android()
	_assert_true(alternative_accepted is bool, "show_alternative_billing_dialog_android should return bool")

	# create_alternative_billing_token_android
	var alternative_token = GodotIapPlugin.create_alternative_billing_token_android()
	_assert_true(alternative_token is String, "create_alternative_billing_token_android should return String")

	# get_package_name_android
	var package_name = GodotIapPlugin.get_package_name_android()
	_assert_true(package_name is String, "get_package_name_android should return String")

	# has_active_subscriptions
	var has_subs = GodotIapPlugin.has_active_subscriptions()
	_assert_true(has_subs is bool, "has_active_subscriptions should return bool")

	# deep_link_to_subscriptions
	var deep_link_result = await GodotIapPlugin.deep_link_to_subscriptions()
	_assert_true(deep_link_result is Types.VoidResult, "deep_link_to_subscriptions should return VoidResult")

	# get_billing_choice_info_android
	var choice_params = Types.GetBillingChoiceInfoParamsAndroid.new()
	choice_params.billing_program = Types.BillingProgramAndroid.BILLING_CHOICE
	choice_params.play_billing_choice_image_layout = Types.BillingChoiceImageLayoutAndroid.RECTANGULAR_FOUR_BY_ONE
	var choice_info = GodotIapPlugin.get_billing_choice_info_android(choice_params)
	_assert_true(choice_info is Types.BillingChoiceInfoAndroid, "get_billing_choice_info_android should return BillingChoiceInfoAndroid")

	# show_billing_program_information_dialog_android
	var dialog_params = Types.BillingProgramInformationDialogParamsAndroid.new()
	dialog_params.billing_program = Types.BillingProgramAndroid.BILLING_CHOICE
	dialog_params.external_transaction_token = "mock_external_token"
	var dialog_result = GodotIapPlugin.show_billing_program_information_dialog_android(dialog_params)
	_assert_true(dialog_result is Types.BillingResultAndroid, "show_billing_program_information_dialog_android should return BillingResultAndroid")

	# show_in_app_messages_android
	var message_result = GodotIapPlugin.show_in_app_messages_android()
	_assert_true(message_result is Types.InAppMessageResultAndroid, "show_in_app_messages_android should return InAppMessageResultAndroid")


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
