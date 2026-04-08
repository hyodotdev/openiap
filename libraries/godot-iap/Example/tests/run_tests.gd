extends Node
## Test runner that executes all tests
## Run with: godot --headless --script tests/run_tests.gd

const Types = preload("res://addons/godot-iap/types.gd")
const GodotIapScript = preload("res://addons/godot-iap/godot_iap.gd")

var _total_passed := 0
var _total_failed := 0
var GodotIapPlugin: Node = null


func _ready() -> void:
	# Create GodotIapPlugin instance for testing (mock mode)
	GodotIapPlugin = GodotIapScript.new()
	add_child(GodotIapPlugin)
	print("\n")
	print("########################################")
	print("#     GodotIap Test Suite             #")
	print("########################################")
	print("\n")

	# Run types.gd tests
	_run_types_tests()

	# Run godot_iap.gd tests
	_run_godot_iap_tests()

	# Print final summary
	print("\n")
	print("########################################")
	print("#     Final Summary                   #")
	print("########################################")
	print("Total Passed: %d" % _total_passed)
	print("Total Failed: %d" % _total_failed)
	print("########################################\n")

	get_tree().quit(0 if _total_failed == 0 else 1)


func _run_types_tests() -> void:
	print("========================================")
	print("Running types.gd tests...")
	print("========================================\n")

	var passed := 0
	var failed := 0

	# ProductRequest tests
	if _test_product_request():
		passed += 1
	else:
		failed += 1

	# PurchaseAndroid tests
	if _test_purchase_android():
		passed += 1
	else:
		failed += 1

	# PurchaseIOS tests
	if _test_purchase_ios():
		passed += 1
	else:
		failed += 1

	# Enum tests
	if _test_enums():
		passed += 1
	else:
		failed += 1

	print("\ntypes.gd: %d passed, %d failed\n" % [passed, failed])
	_total_passed += passed
	_total_failed += failed


func _run_godot_iap_tests() -> void:
	print("========================================")
	print("Running godot_iap.gd tests (mock mode)...")
	print("========================================\n")

	var passed := 0
	var failed := 0

	# Connection tests
	if _test_connection():
		passed += 1
	else:
		failed += 1

	# Fetch products test
	if _test_fetch_products():
		passed += 1
	else:
		failed += 1

	# Available purchases test
	if _test_available_purchases():
		passed += 1
	else:
		failed += 1

	# Finish transaction test
	if _test_finish_transaction():
		passed += 1
	else:
		failed += 1

	print("\ngodot_iap.gd: %d passed, %d failed\n" % [passed, failed])
	_total_passed += passed
	_total_failed += failed


# ============================================
# Types Tests
# ============================================

func _test_product_request() -> bool:
	print("  Testing ProductRequest...")

	var request = Types.ProductRequest.new()
	var skus: Array[String] = ["product_1", "product_2"]
	request.skus = skus
	request.type = Types.ProductQueryType.IN_APP

	if request.skus.size() != 2:
		print("    FAIL: skus size mismatch")
		return false

	var dict = request.to_dict()
	if dict["skus"][0] != "product_1":
		print("    FAIL: to_dict skus mismatch")
		return false

	print("    PASS: ProductRequest")
	return true


func _test_purchase_android() -> bool:
	print("  Testing PurchaseAndroid...")

	var purchase = Types.PurchaseAndroid.new()
	purchase.id = "test_id"
	purchase.product_id = "test_product"
	purchase.purchase_token = "test_token"
	purchase.is_acknowledged_android = true

	if purchase.product_id != "test_product":
		print("    FAIL: product_id mismatch")
		return false

	var dict = purchase.to_dict()
	if dict["productId"] != "test_product":
		print("    FAIL: to_dict productId mismatch")
		return false

	if dict["isAcknowledgedAndroid"] != true:
		print("    FAIL: to_dict isAcknowledgedAndroid mismatch")
		return false

	# Test from_dict
	var parsed = Types.PurchaseAndroid.from_dict(dict)
	if parsed.product_id != "test_product":
		print("    FAIL: from_dict product_id mismatch")
		return false

	print("    PASS: PurchaseAndroid")
	return true


func _test_purchase_ios() -> bool:
	print("  Testing PurchaseIOS...")

	var purchase = Types.PurchaseIOS.new()
	purchase.id = "ios_id"
	purchase.product_id = "ios_product"
	purchase.original_transaction_id_ios = "original_123"

	if purchase.product_id != "ios_product":
		print("    FAIL: product_id mismatch")
		return false

	var dict = purchase.to_dict()
	if dict["originalTransactionIdIOS"] != "original_123":
		print("    FAIL: to_dict originalTransactionIdIOS mismatch")
		return false

	print("    PASS: PurchaseIOS")
	return true


func _test_enums() -> bool:
	print("  Testing Enums...")

	if Types.ProductQueryType.IN_APP != 0:
		print("    FAIL: ProductQueryType.IN_APP should be 0")
		return false

	if Types.ProductQueryType.SUBS != 1:
		print("    FAIL: ProductQueryType.SUBS should be 1")
		return false

	if Types.PurchaseState.PURCHASED != 1:
		print("    FAIL: PurchaseState.PURCHASED should be 1")
		return false

	print("    PASS: Enums")
	return true


# ============================================
# GodotIap Tests (Mock Mode)
# ============================================

func _test_connection() -> bool:
	print("  Testing connection...")

	var init_result = GodotIapPlugin.init_connection()
	if init_result != true:
		print("    FAIL: init_connection should return true")
		return false

	var end_result = GodotIapPlugin.end_connection()
	if end_result != true:
		print("    FAIL: end_connection should return true")
		return false

	print("    PASS: connection")
	return true


func _test_fetch_products() -> bool:
	print("  Testing fetch_products...")

	var request = Types.ProductRequest.new()
	var skus: Array[String] = ["test_sku"]
	request.skus = skus
	request.type = Types.ProductQueryType.IN_APP

	var products = GodotIapPlugin.fetch_products(request)
	if not (products is Array):
		print("    FAIL: fetch_products should return Array")
		return false

	print("    PASS: fetch_products")
	return true


func _test_available_purchases() -> bool:
	print("  Testing get_available_purchases...")

	var purchases = GodotIapPlugin.get_available_purchases()
	if not (purchases is Array):
		print("    FAIL: get_available_purchases should return Array")
		return false

	print("    PASS: get_available_purchases")
	return true


func _test_finish_transaction() -> bool:
	print("  Testing finish_transaction...")

	var purchase = Types.PurchaseAndroid.new()
	purchase.product_id = "test_consumable"
	purchase.purchase_token = "mock_token"

	var result = GodotIapPlugin.finish_transaction(purchase, true)
	if not (result is Types.VoidResult):
		print("    FAIL: finish_transaction should return VoidResult")
		return false

	print("    PASS: finish_transaction")
	return true
