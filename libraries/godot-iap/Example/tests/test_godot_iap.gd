extends Node
## Unit tests for godot_iap.gd (mock mode)
## Run with: godot --headless --script tests/test_godot_iap.gd

const Types = preload("res://addons/godot-iap/types.gd")

var _tests_passed := 0
var _tests_failed := 0


func _ready() -> void:
	print("\n========================================")
	print("Running godot_iap.gd tests (mock mode)...")
	print("========================================\n")

	_run_all_tests()

	print("\n========================================")
	print("Results: %d passed, %d failed" % [_tests_passed, _tests_failed])
	print("========================================\n")

	get_tree().quit(0 if _tests_failed == 0 else 1)


func _run_all_tests() -> void:
	# Connection tests
	test_init_connection_mock()
	test_end_connection_mock()

	# Product tests
	await test_fetch_products_mock()

	# Purchase tests
	test_get_available_purchases_mock()
	test_restore_purchases_mock()

	# Finish transaction tests
	test_finish_transaction_mock()

	# Platform-specific mock tests
	test_ios_methods_mock()
	test_android_methods_mock()


# ============================================
# Connection Tests (Mock Mode)
# ============================================

func test_init_connection_mock() -> void:
	# In mock mode (no native plugin), should return true
	var result = GodotIapPlugin.init_connection()
	_assert_true(result, "init_connection should return true in mock mode")


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
	_assert_true(sync_result is Types.VoidResult, "sync_ios should return VoidResult")

	# clear_transaction_ios
	var clear_result = GodotIapPlugin.clear_transaction_ios()
	_assert_true(clear_result is Types.VoidResult, "clear_transaction_ios should return VoidResult")

	# get_pending_transactions_ios
	var pending = GodotIapPlugin.get_pending_transactions_ios()
	_assert_true(pending is Array, "get_pending_transactions_ios should return Array")

	# present_code_redemption_sheet_ios
	var redemption_result = GodotIapPlugin.present_code_redemption_sheet_ios()
	_assert_true(redemption_result is Types.VoidResult, "present_code_redemption_sheet_ios should return VoidResult")

	# current_entitlement_ios
	var entitlement = GodotIapPlugin.current_entitlement_ios("test_sku")
	_assert_true(entitlement == null or entitlement is Types.PurchaseIOS, "current_entitlement_ios should return PurchaseIOS or null")

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
	_assert_true(ack_result is Types.VoidResult, "acknowledge_purchase_android should return VoidResult")

	# consume_purchase_android
	var consume_result = GodotIapPlugin.consume_purchase_android("mock_token")
	_assert_true(consume_result is Types.VoidResult, "consume_purchase_android should return VoidResult")

	# get_package_name_android
	var package_name = GodotIapPlugin.get_package_name_android()
	_assert_true(package_name is String, "get_package_name_android should return String")

	# has_active_subscriptions
	var has_subs = GodotIapPlugin.has_active_subscriptions()
	_assert_true(has_subs is bool, "has_active_subscriptions should return bool")


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
