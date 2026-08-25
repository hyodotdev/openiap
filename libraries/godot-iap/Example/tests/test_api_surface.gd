extends SceneTree
## API-surface parity tests between generated types.gd and godot_iap.gd.
##
## The Godot SDK is deliberately excluded from the repo-wide
## scripts/audit-non-godot-parity.mjs audit, so this suite is the parity gate
## for GDScript: every Query/Mutation field generated from the OpenIAP schema
## must be reachable through the wrapper's snake_case API, every field must
## keep its generated *_args helper, and every generated IapEvent must map to
## a wrapper signal.
## Run with: godot --headless --path Example --script res://tests/test_api_surface.gd

const Types = preload("res://addons/godot-iap/types.gd")
const GodotIapWrapper = preload("res://addons/godot-iap/godot_iap.gd")

var _tests_passed := 0
var _tests_failed := 0
var GodotIapPlugin: Node = null
var _types_instance = null
var _types_method_names := {}


func _init() -> void:
	_run_suite.call_deferred()


func _run_suite() -> void:
	GodotIapPlugin = GodotIapWrapper.new()
	root.add_child(GodotIapPlugin)
	await process_frame
	_types_instance = Types.new()
	var types_script: Script = Types
	for method_info in types_script.get_script_method_list():
		_types_method_names[str(method_info.get("name", ""))] = true

	print("\n========================================")
	print("Running API surface parity tests...")
	print("========================================\n")

	_run_all_tests()

	print("\n========================================")
	print("Results: %d passed, %d failed" % [_tests_passed, _tests_failed])
	print("========================================\n")

	quit(0 if _tests_failed == 0 else 1)


func _run_all_tests() -> void:
	test_introspection_canary()
	test_query_fields_have_wrapper_methods()
	test_mutation_fields_have_wrapper_methods()
	test_fields_have_args_helpers()
	test_field_names_match_snake_names()
	test_iap_events_have_wrapper_signals()
	test_wrapper_signal_surface()
	test_args_helper_shapes()


# ============================================
# Introspection Helpers
# ============================================

## Collect every generated *Field class nested in Types.Query / Types.Mutation
## as {"name": String, "snake_name": String}, skipping the generator's
## _placeholder field.
func _collect_fields(container) -> Array:
	var fields: Array = []
	var container_script: Script = container
	var constant_map: Dictionary = container_script.get_script_constant_map()
	for constant_name in constant_map:
		var value = constant_map[constant_name]
		if not (value is GDScript):
			continue
		var field_script: Script = value
		var field_constants: Dictionary = field_script.get_script_constant_map()
		if not field_constants.has("snake_name"):
			continue
		var snake_name = str(field_constants.get("snake_name", ""))
		if snake_name.begins_with("_"):
			continue
		fields.append({
			"name": str(field_constants.get("name", "")),
			"snake_name": snake_name,
		})
	return fields


## Static functions can surface either in the script method list or on an
## instance depending on the engine version, so accept both.
func _has_types_method(method_name: String) -> bool:
	return _types_method_names.has(method_name) or _types_instance.has_method(method_name)


func _camel_to_snake(camel: String) -> String:
	var adjusted = camel.replace("IOS", "Ios")
	var snake = ""
	for i in adjusted.length():
		var character = adjusted[i]
		if character >= "A" and character <= "Z" and i > 0:
			snake += "_"
		snake += character.to_lower()
	return snake


# ============================================
# Parity Tests
# ============================================

func test_introspection_canary() -> void:
	# If either of these fails, the introspection mechanism itself is broken
	# and every later failure in this file should be read in that light.
	_assert_true(_collect_fields(Types.Query).size() > 0, "Query field introspection should find generated fields")
	_assert_true(_collect_fields(Types.Mutation).size() > 0, "Mutation field introspection should find generated fields")
	_assert_true(_has_types_method("init_connection_args"), "Static *_args helpers should be visible to introspection")


func test_query_fields_have_wrapper_methods() -> void:
	var fields = _collect_fields(Types.Query)
	_assert_true(fields.size() >= 20, "Query should expose at least 20 generated fields (got %d)" % fields.size())
	for field in fields:
		_assert_true(
			GodotIapPlugin.has_method(field["snake_name"]),
			"godot_iap.gd should implement query %s as %s()" % [field["name"], field["snake_name"]]
		)


func test_mutation_fields_have_wrapper_methods() -> void:
	var fields = _collect_fields(Types.Mutation)
	_assert_true(fields.size() >= 24, "Mutation should expose at least 24 generated fields (got %d)" % fields.size())
	for field in fields:
		_assert_true(
			GodotIapPlugin.has_method(field["snake_name"]),
			"godot_iap.gd should implement mutation %s as %s()" % [field["name"], field["snake_name"]]
		)


func test_fields_have_args_helpers() -> void:
	var fields = _collect_fields(Types.Query) + _collect_fields(Types.Mutation)
	for field in fields:
		var args_helper = "%s_args" % field["snake_name"]
		_assert_true(
			_has_types_method(args_helper),
			"types.gd should keep the generated %s() helper for %s" % [args_helper, field["name"]]
		)


func test_field_names_match_snake_names() -> void:
	var fields = _collect_fields(Types.Query) + _collect_fields(Types.Mutation)
	var mismatches: Array = []
	for field in fields:
		if _camel_to_snake(field["name"]) != field["snake_name"]:
			mismatches.append("%s -> %s" % [field["name"], field["snake_name"]])
	_assert_equal(mismatches, [], "Generated snake_name constants should match their camelCase field names")


func test_iap_events_have_wrapper_signals() -> void:
	# Every generated IapEvent must be observable through a wrapper signal of
	# the same (snake_case) name.
	var event_names = Types.IAP_EVENT_VALUES.values()
	_assert_true(event_names.size() >= 6, "IapEvent should expose at least 6 generated events (got %d)" % event_names.size())
	for event_name in event_names:
		var signal_name = str(event_name).replace("-", "_")
		_assert_true(
			GodotIapPlugin.has_signal(signal_name),
			"godot_iap.gd should emit IapEvent %s as signal %s" % [event_name, signal_name]
		)


func test_wrapper_signal_surface() -> void:
	var expected_signals: Array[String] = [
		"purchase_updated",
		"purchase_error",
		"products_fetched",
		"connected",
		"disconnected",
		"promoted_product_ios",
		"user_choice_billing_android",
		"developer_provided_billing_android",
		"subscription_billing_issue",
	]
	for signal_name in expected_signals:
		_assert_true(GodotIapPlugin.has_signal(signal_name), "godot_iap.gd should declare signal %s" % signal_name)


# ============================================
# Args Helper Shape Tests
# ============================================

func test_args_helper_shapes() -> void:
	# No-argument helpers serialize to empty payloads.
	_assert_equal(Types.open_redeem_offer_code_args(), {}, "open_redeem_offer_code_args should be empty")
	_assert_equal(Types.open_redeem_offer_code_android_args(), {}, "open_redeem_offer_code_android_args should be empty")
	_assert_equal(Types.end_connection_args(), {}, "end_connection_args should be empty")
	_assert_equal(Types.restore_purchases_args(), {}, "restore_purchases_args should be empty")
	_assert_equal(Types.sync_ios_args(), {}, "sync_ios_args should be empty")
	_assert_equal(Types.get_storefront_args(), {}, "get_storefront_args should be empty")
	_assert_equal(Types.init_connection_args(), {}, "init_connection_args without config should be empty")

	# Scalar arguments keep their generated camelCase keys.
	_assert_equal(
		Types.acknowledge_purchase_android_args("token-1"),
		{"purchaseToken": "token-1"},
		"acknowledge_purchase_android_args should use purchaseToken"
	)
	_assert_equal(
		Types.consume_purchase_android_args("token-2"),
		{"purchaseToken": "token-2"},
		"consume_purchase_android_args should use purchaseToken"
	)
	_assert_equal(
		Types.is_eligible_for_intro_offer_ios_args("group-1"),
		{"groupID": "group-1"},
		"is_eligible_for_intro_offer_ios_args should use groupID"
	)
	_assert_equal(
		Types.begin_refund_request_ios_args("sku-1"),
		{"sku": "sku-1"},
		"begin_refund_request_ios_args should use sku"
	)
	_assert_equal(
		Types.present_external_purchase_link_ios_args("https://example.com"),
		{"url": "https://example.com"},
		"present_external_purchase_link_ios_args should use url"
	)

	# Enum arguments serialize to their kebab-case wire values.
	_assert_equal(
		Types.is_billing_program_available_android_args(Types.BillingProgramAndroid.BILLING_CHOICE),
		{"program": "billing-choice"},
		"is_billing_program_available_android_args should serialize the enum"
	)
	_assert_equal(
		Types.get_external_purchase_custom_link_token_ios_args(Types.ExternalPurchaseCustomLinkTokenTypeIOS.SERVICES),
		{"tokenType": "services"},
		"get_external_purchase_custom_link_token_ios_args should serialize the enum"
	)
	_assert_equal(
		Types.show_external_purchase_custom_link_notice_ios_args(Types.ExternalPurchaseCustomLinkNoticeTypeIOS.BROWSER),
		{"noticeType": "browser"},
		"show_external_purchase_custom_link_notice_ios_args should serialize the enum"
	)
	var reporting_args = Types.create_billing_program_reporting_details_android_args(
		Types.BillingProgramAndroid.EXTERNAL_OFFER,
		Types.DeveloperBillingTypeAndroid.EXTERNAL_LINK
	)
	_assert_equal(reporting_args.get("program"), "external-offer", "reporting details args should serialize program")
	_assert_equal(reporting_args.get("developerBillingType"), "external-link", "reporting details args should serialize developerBillingType")
	_assert_equal(
		Types.create_billing_program_reporting_details_android_args(Types.BillingProgramAndroid.EXTERNAL_OFFER),
		{"program": "external-offer"},
		"reporting details args should omit developerBillingType when absent"
	)

	# Object arguments are serialized through to_dict().
	var config = Types.InitConnectionConfig.new()
	config.enable_billing_program_android = Types.BillingProgramAndroid.BILLING_CHOICE
	var config_args = Types.init_connection_args(config)
	_assert_equal(
		config_args.get("config", {}).get("enableBillingProgramAndroid"),
		"billing-choice",
		"init_connection_args should serialize InitConnectionConfig"
	)

	var request = Types.ProductRequest.new()
	var skus: Array[String] = ["sku.a"]
	request.skus = skus
	request.type = Types.ProductQueryType.IN_APP
	var fetch_args = Types.fetch_products_args(request)
	var fetch_skus = fetch_args.get("params", {}).get("skus", [])
	_assert_true(fetch_skus.size() == 1 and fetch_skus[0] == "sku.a", "fetch_products_args should serialize the request skus")
	_assert_equal(fetch_args.get("params", {}).get("type"), "in-app", "fetch_products_args should serialize the query type")

	var purchase = Types.PurchaseInput.new()
	purchase.product_id = "sku.b"
	purchase.purchase_state = Types.PurchaseState.PURCHASED
	var finish_args = Types.finish_transaction_args(purchase, true)
	_assert_equal(finish_args.get("purchase", {}).get("productId"), "sku.b", "finish_transaction_args should serialize the purchase")
	_assert_equal(finish_args.get("purchase", {}).get("purchaseState"), "purchased", "finish_transaction_args should serialize purchaseState")
	_assert_equal(finish_args.get("isConsumable"), true, "finish_transaction_args should include isConsumable")
	var finish_args_default = Types.finish_transaction_args(purchase)
	_assert_false(finish_args_default.has("isConsumable"), "finish_transaction_args should omit isConsumable when not provided")

	var options = Types.PurchaseOptions.new()
	options.only_include_active_items_ios = true
	var purchases_args = Types.get_available_purchases_args(options)
	_assert_equal(
		purchases_args.get("options", {}).get("onlyIncludeActiveItemsIOS"),
		true,
		"get_available_purchases_args should serialize PurchaseOptions"
	)
	_assert_equal(Types.get_available_purchases_args(), {}, "get_available_purchases_args should be empty without options")


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
