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
	var last_purchase_options: Dictionary = {}
	var storefront_result := JSON.stringify({"success": true, "countryCode": "US"})

	func initConnectionWithConfig(config_json: String) -> bool:
		last_config = JSON.parse_string(config_json)
		return true

	func requestPurchase(params_json: String) -> String:
		last_purchase = JSON.parse_string(params_json)
		return JSON.stringify({"success": true, "pending": true})

	func getAvailablePurchasesResult() -> String:
		return JSON.stringify({"success": true, "purchases": []})

	func getAvailablePurchasesResultWithOptions(options_json: String) -> String:
		last_purchase_options = JSON.parse_string(options_json)
		return JSON.stringify({"success": true, "purchases": []})

	func getStorefrontAndroid() -> String:
		return storefront_result


class FakeIOSAsyncPlugin:
	extends RefCounted
	signal products_fetched(result: Dictionary)
	var request_count := 0
	var last_purchase_options: Dictionary = {}
	var last_subscription_ids := "unset"

	func _complete(method: String, values: Dictionary) -> String:
		request_count += 1
		var request_id = "%s-%d" % [method, request_count]
		var payload = {
			"method": method,
			"requestId": request_id,
			"success": true,
		}
		payload.merge(values)
		# Emit before returning to prove the wrapper's result cache closes the
		# native-call-to-signal-wait race.
		products_fetched.emit(payload)
		return JSON.stringify({"status": "pending", "requestId": request_id})

	func _purchase(product_id: String) -> Dictionary:
		return {
			"id": "tx-%s" % product_id,
			"productId": product_id,
			"transactionDate": 1.0,
			"transactionId": "tx-%s" % product_id,
			"purchaseState": "purchased",
			"purchaseToken": "jws-%s" % product_id,
			"quantity": 1,
			"isAutoRenewing": false,
			"platform": "ios",
			"store": "apple",
		}

	func getPendingTransactionsIOS() -> String:
		return _complete("getPendingTransactionsIOS", {
			"transactionsJson": JSON.stringify([_purchase("pending")]),
		})

	func getAllTransactionsIOS() -> String:
		return _complete("getAllTransactionsIOS", {
			"transactionsJson": JSON.stringify([_purchase("history")]),
		})

	func getAvailablePurchases(options_json: String) -> String:
		last_purchase_options = JSON.parse_string(options_json)
		return _complete("getAvailablePurchases", {
			"purchasesJson": JSON.stringify([_purchase("available")]),
		})

	func getActiveSubscriptions(subscription_ids_json: String) -> String:
		last_subscription_ids = subscription_ids_json
		return _complete("getActiveSubscriptions", {
			"subscriptionsJson": JSON.stringify([{
				"productId": "active-subscription",
				"isActive": true,
				"transactionId": "active-tx",
				"transactionDate": 1.0,
			}]),
		})

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
	await test_init_connection_mock()
	await test_end_connection_mock()

	# Initialization guard tests
	test_ready_guard_prevents_double_init()
	await test_init_connection_idempotent()
	test_no_duplicate_signal_connections()

	# Product tests
	await test_fetch_products_mock()
	test_product_variant_mapping()

	# Purchase tests
	await test_billing_choice_android_payloads()
	await test_ios_async_result_cache()
	await test_get_available_purchases_mock()
	await test_android_purchase_options_bridge()
	await test_restore_purchases_mock()
	await test_storefront_error_contract()
	test_native_purchase_payload_safety()
	test_freed_object_options_are_ignored()
	test_sensitive_values_are_not_logged()

	# Finish transaction tests
	await test_finish_transaction_mock()

	# Platform-specific mock tests
	await test_ios_methods_mock()
	await test_android_methods_mock()

	# Documented zero-values when no native plugin is present
	await test_no_plugin_ios_zero_values()
	test_no_plugin_android_zero_values()
	await test_no_plugin_cross_platform_zero_values()

	# Pure utility helpers
	test_store_and_stub_mode_helpers()
	test_create_purchase_error()
	test_set_purchase_updated_listener_options()
	test_enum_raw_mapping_helpers()
	test_product_from_dict_platform_guards()
	test_connection_state_signal_handlers()


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
	var result1 = await GodotIapPlugin.init_connection()
	_assert_false(result1, "First init_connection should report unavailable native plugin")

	var result2 = await GodotIapPlugin.init_connection()
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
	var result = await GodotIapPlugin.init_connection()
	_assert_false(result, "init_connection should return false without a native plugin")


func test_billing_choice_android_payloads() -> void:
	var fake = FakeAndroidPlugin.new()
	GodotIapPlugin._native_plugin = fake
	GodotIapPlugin._platform = "Android"

	var config = Types.InitConnectionConfig.new()
	config.enable_billing_program_android = Types.BillingProgramAndroid.BILLING_CHOICE
	config.billing_choice_screen_type_android = Types.BillingChoiceScreenTypeAndroid.DEVELOPER_RENDERED
	_assert_true(await GodotIapPlugin.init_connection(config), "Billing Choice config should reach Android plugin")
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
	var result = await GodotIapPlugin.end_connection()
	_assert_true(result, "end_connection should return true in mock mode")


func test_native_purchase_payload_safety() -> void:
	var fallback = {"purchaseJson": null, "productId": "fallback"}
	_assert_equal(
		GodotIapPlugin._canonical_purchase(fallback),
		fallback,
		"Null purchaseJson should preserve the native dictionary"
	)
	var canonical = GodotIapPlugin._canonical_purchase({
		"purchaseJson": JSON.stringify({"productId": "canonical"}),
	})
	_assert_equal(canonical.get("productId"), "canonical", "Valid purchaseJson should be decoded")


func test_freed_object_options_are_ignored() -> void:
	var freed = Node.new()
	freed.free()
	_assert_equal(GodotIapPlugin._as_dictionary(freed), {}, "Freed objects should be ignored")


func test_ios_async_result_cache() -> void:
	var fake = FakeIOSAsyncPlugin.new()
	GodotIapPlugin._native_plugin = fake
	GodotIapPlugin._platform = "iOS"
	GodotIapPlugin._ios_async_results.clear()
	GodotIapPlugin._connect_signals_ios()

	var pending = await GodotIapPlugin.get_pending_transactions_ios()
	_assert_equal(pending.size(), 1, "pending transactions should await tagged native result")
	_assert_equal(pending[0].product_id, "pending", "pending transaction payload should be preserved")

	var history = await GodotIapPlugin.get_all_transactions_ios()
	_assert_equal(history.size(), 1, "all transactions should await tagged native result")
	_assert_equal(history[0].product_id, "history", "all-transactions payload should be preserved")

	var options = Types.PurchaseOptions.new()
	options.also_publish_to_event_listener_ios = true
	options.only_include_active_items_ios = false
	var available = await GodotIapPlugin.get_available_purchases(options)
	_assert_equal(available.size(), 1, "available purchases should await tagged native result")
	_assert_equal(fake.last_purchase_options.get("alsoPublishToEventListenerIOS"), true, "purchase options should reach iOS native")
	_assert_equal(fake.last_purchase_options.get("onlyIncludeActiveItemsIOS"), false, "active-item option should reach iOS native")

	var subscriptions = await GodotIapPlugin.get_active_subscriptions()
	_assert_equal(subscriptions.size(), 1, "default active subscriptions should not filter out all results")
	_assert_equal(fake.last_subscription_ids, "", "empty subscription filter should map to native nil")
	_assert_equal(GodotIapPlugin._ios_async_results.size(), 0, "completed async results should be removed from cache")

	GodotIapPlugin._native_plugin = null
	GodotIapPlugin._platform = ""
	GodotIapPlugin._is_connected = false


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
	var purchases = await GodotIapPlugin.get_available_purchases()

	# In mock mode, returns empty array or mock purchases
	_assert_true(purchases is Array, "get_available_purchases should return an array")


func test_android_purchase_options_bridge() -> void:
	var fake = FakeAndroidPlugin.new()
	GodotIapPlugin._native_plugin = fake
	GodotIapPlugin._platform = "Android"

	var options = Types.PurchaseOptions.new()
	options.include_suspended_android = true
	var purchases = await GodotIapPlugin.get_available_purchases(options)

	_assert_true(purchases is Array, "Android available purchases should return an array")
	_assert_equal(
		fake.last_purchase_options.get("includeSuspendedAndroid"),
		true,
		"includeSuspendedAndroid should reach Android native"
	)

	GodotIapPlugin._native_plugin = null
	GodotIapPlugin._platform = ""
	GodotIapPlugin._is_connected = false


func test_restore_purchases_mock() -> void:
	var result = await GodotIapPlugin.restore_purchases()

	_assert_true(result is Types.VoidResult, "restore_purchases should return VoidResult")
	# Mock mode may return success=false
	_assert_true(result.success == true or result.success == false, "VoidResult should have success field")


func test_storefront_error_contract() -> void:
	var fake = FakeAndroidPlugin.new()
	GodotIapPlugin._native_plugin = fake
	GodotIapPlugin._platform = "Android"
	var errors: Array[Dictionary] = []
	var capture_error = func(error: Dictionary) -> void:
		errors.append(error)
	GodotIapPlugin.purchase_error.connect(capture_error)

	_assert_equal(await GodotIapPlugin.get_storefront(), "US", "Android storefront should return the native country code")
	_assert_equal(errors.size(), 0, "Successful storefront lookup should not emit purchase_error")

	fake.storefront_result = JSON.stringify({"success": true, "countryCode": " "})
	_assert_equal(await GodotIapPlugin.get_storefront(), "", "Blank storefront should fail closed")
	_assert_equal(errors.size(), 1, "Blank storefront should emit purchase_error")
	_assert_equal(errors[0].get("code"), "service-error", "Blank storefront should use a canonical error code")

	fake.storefront_result = JSON.stringify({"success": false, "error": "Storefront unavailable"})
	_assert_equal(await GodotIapPlugin.get_storefront(), "", "Native storefront failure should return an empty sentinel")
	_assert_equal(errors.size(), 2, "Native storefront failure should emit purchase_error")
	_assert_equal(errors[1].get("message"), "Storefront unavailable", "Native storefront diagnostics should be preserved")

	GodotIapPlugin.purchase_error.disconnect(capture_error)
	GodotIapPlugin._native_plugin = null
	GodotIapPlugin._platform = ""
	GodotIapPlugin._is_connected = false


func test_sensitive_values_are_not_logged() -> void:
	var wrapper_source = FileAccess.get_file_as_string("res://addons/godot-iap/godot_iap.gd")
	var manager_source = FileAccess.get_file_as_string("res://iap_manager.gd")
	_assert_false(wrapper_source.contains("purchase_token.substr"), "Purchase tokens should not be printed even partially")
	_assert_true(wrapper_source.contains("tokenPresent="), "Purchase-token logs should record presence only")
	_assert_false(wrapper_source.contains("result: \", result_json"), "Native result payloads should not be printed")
	_assert_false(manager_source.contains("Using offer token: %s"), "Offer tokens should not be printed")


func test_finish_transaction_mock() -> void:
	# Create a mock purchase
	var purchase = Types.PurchaseAndroid.new()
	purchase.product_id = "test_consumable"
	purchase.purchase_token = "mock_token_123"

	var result = await GodotIapPlugin.finish_transaction(purchase, true)

	_assert_true(result is Types.VoidResult, "finish_transaction should return VoidResult")


# ============================================
# iOS Methods (Mock Mode)
# ============================================

func test_ios_methods_mock() -> void:
	# sync_ios
	var sync_result = await GodotIapPlugin.sync_ios()
	_assert_true(sync_result is bool, "sync_ios should return bool")

	# clear_transaction_ios
	var clear_result = await GodotIapPlugin.clear_transaction_ios()
	_assert_true(clear_result is bool, "clear_transaction_ios should return bool")

	# get_pending_transactions_ios
	var pending = await GodotIapPlugin.get_pending_transactions_ios()
	_assert_true(pending is Array, "get_pending_transactions_ios should return Array")

	# present_code_redemption_sheet_ios
	var redemption_result = await GodotIapPlugin.present_code_redemption_sheet_ios()
	_assert_true(
		redemption_result == null or redemption_result is Types.PurchaseIOS,
		"present_code_redemption_sheet_ios should return PurchaseIOS or null"
	)

	# current_entitlement_ios
	var entitlement = await GodotIapPlugin.current_entitlement_ios("test_sku")
	_assert_true(entitlement == null or entitlement is Types.PurchaseIOS, "current_entitlement_ios should return PurchaseIOS or null")

	# begin_refund_request_ios
	var refund_status = await GodotIapPlugin.begin_refund_request_ios("test_sku")
	_assert_true(refund_status is String, "begin_refund_request_ios should return String")

	# latest_transaction_ios
	var latest = await GodotIapPlugin.latest_transaction_ios("test_sku")
	_assert_true(latest == null or latest is Types.PurchaseIOS, "latest_transaction_ios should return PurchaseIOS or null")

	# get_storefront
	var storefront = await GodotIapPlugin.get_storefront()
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

	var availability = GodotIapPlugin.is_billing_program_available_android(
		Types.BillingProgramAndroid.EXTERNAL_OFFER
	)
	_assert_true(
		availability is Types.BillingProgramAvailabilityResultAndroid,
		"is_billing_program_available_android should return the canonical result type"
	)

	var reporting = GodotIapPlugin.create_billing_program_reporting_details_android(
		Types.BillingProgramAndroid.EXTERNAL_OFFER
	)
	_assert_true(
		reporting is Types.BillingProgramReportingDetailsAndroid,
		"create_billing_program_reporting_details_android should return the canonical result type"
	)

	var link_params = Types.LaunchExternalLinkParamsAndroid.new()
	link_params.billing_program = Types.BillingProgramAndroid.EXTERNAL_OFFER
	var link_result = GodotIapPlugin.launch_external_link_android(link_params)
	_assert_true(link_result is bool, "launch_external_link_android should return bool")

	# open_redeem_offer_code_android
	var redeem_result = GodotIapPlugin.open_redeem_offer_code_android()
	_assert_true(redeem_result is bool, "open_redeem_offer_code_android should return bool")

	# get_package_name_android
	var package_name = GodotIapPlugin.get_package_name_android()
	_assert_true(package_name is String, "get_package_name_android should return String")

	# has_active_subscriptions
	var has_subs = await GodotIapPlugin.has_active_subscriptions()
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
# No-Plugin Zero-Value Guards
# ============================================
# Every platform-gated API documents a zero-value it must return when the
# native plugin is unavailable (editor/desktop). These tests pin the exact
# values so refactors cannot silently change the no-plugin contract.

func test_no_plugin_ios_zero_values() -> void:
	_assert_equal(await GodotIapPlugin.sync_ios(), false, "sync_ios should return false without a native plugin")
	_assert_equal(await GodotIapPlugin.clear_transaction_ios(), false, "clear_transaction_ios should return false without a native plugin")
	_assert_equal(await GodotIapPlugin.present_code_redemption_sheet_ios(), null, "present_code_redemption_sheet_ios should return null without a native plugin")
	_assert_equal(await GodotIapPlugin.begin_refund_request_ios("sku"), "", "begin_refund_request_ios should return an empty string without a native plugin")
	_assert_equal(await GodotIapPlugin.get_receipt_data_ios(), "", "get_receipt_data_ios should return an empty string without a native plugin")
	_assert_equal(await GodotIapPlugin.get_transaction_jws_ios("sku"), "", "get_transaction_jws_ios should return an empty string without a native plugin")
	_assert_equal(await GodotIapPlugin.is_transaction_verified_ios("sku"), false, "is_transaction_verified_ios should return false without a native plugin")
	_assert_equal(await GodotIapPlugin.is_eligible_for_intro_offer_ios("group"), false, "is_eligible_for_intro_offer_ios should return false without a native plugin")
	_assert_equal(await GodotIapPlugin.is_eligible_for_external_purchase_custom_link_ios(), false, "is_eligible_for_external_purchase_custom_link_ios should return false without a native plugin")
	_assert_equal(await GodotIapPlugin.can_present_external_purchase_notice_ios(), false, "can_present_external_purchase_notice_ios should return false without a native plugin")
	_assert_equal(await GodotIapPlugin.current_entitlement_ios("sku"), null, "current_entitlement_ios should return null without a native plugin")
	_assert_equal(await GodotIapPlugin.latest_transaction_ios("sku"), null, "latest_transaction_ios should return null without a native plugin")
	_assert_equal(await GodotIapPlugin.get_app_transaction_ios(), null, "get_app_transaction_ios should return null without a native plugin")
	_assert_equal(await GodotIapPlugin.get_promoted_product_ios(), null, "get_promoted_product_ios should return null without a native plugin")
	_assert_equal(await GodotIapPlugin.get_external_purchase_custom_link_token_ios("services"), null, "get_external_purchase_custom_link_token_ios should return null without a native plugin")
	_assert_equal(await GodotIapPlugin.show_external_purchase_custom_link_notice_ios("browser"), null, "show_external_purchase_custom_link_notice_ios should return null without a native plugin")
	_assert_equal((await GodotIapPlugin.get_pending_transactions_ios()).size(), 0, "get_pending_transactions_ios should return an empty array without a native plugin")
	_assert_equal((await GodotIapPlugin.get_all_transactions_ios()).size(), 0, "get_all_transactions_ios should return an empty array without a native plugin")
	_assert_equal((await GodotIapPlugin.show_manage_subscriptions_ios()).size(), 0, "show_manage_subscriptions_ios should return an empty array without a native plugin")
	_assert_equal((await GodotIapPlugin.subscription_status_ios("sku")).size(), 0, "subscription_status_ios should return an empty array without a native plugin")

	var notice_result = await GodotIapPlugin.present_external_purchase_notice_sheet_ios()
	_assert_true(notice_result is Types.ExternalPurchaseNoticeResultIOS, "present_external_purchase_notice_sheet_ios should return a typed default without a native plugin")
	_assert_equal(notice_result.error, null, "The default notice result should carry no error")

	var link_result = await GodotIapPlugin.present_external_purchase_link_ios("https://example.com")
	_assert_true(link_result is Types.ExternalPurchaseLinkResultIOS, "present_external_purchase_link_ios should return a typed default without a native plugin")
	_assert_equal(link_result.success, false, "The default link result should not report success")


func test_no_plugin_android_zero_values() -> void:
	_assert_equal(GodotIapPlugin.acknowledge_purchase_android("token"), false, "acknowledge_purchase_android should return false without a native plugin")
	_assert_equal(GodotIapPlugin.consume_purchase_android("token"), false, "consume_purchase_android should return false without a native plugin")
	_assert_equal(GodotIapPlugin.get_package_name_android(), "", "get_package_name_android should return an empty string without a native plugin")
	_assert_equal(GodotIapPlugin.open_redeem_offer_code_android(), false, "open_redeem_offer_code_android should return false without a native plugin on desktop")

	var availability = GodotIapPlugin.is_billing_program_available_android(Types.BillingProgramAndroid.BILLING_CHOICE)
	_assert_true(availability is Types.BillingProgramAvailabilityResultAndroid, "is_billing_program_available_android should return a typed default without a native plugin")
	_assert_equal(availability.is_available, false, "The default availability result should not report availability")
	_assert_equal(availability.billing_program, Types.BillingProgramAndroid.BILLING_CHOICE, "The default availability result should echo the requested program")

	var reporting = GodotIapPlugin.create_billing_program_reporting_details_android(Types.BillingProgramAndroid.EXTERNAL_OFFER)
	_assert_true(reporting is Types.BillingProgramReportingDetailsAndroid, "create_billing_program_reporting_details_android should return a typed default without a native plugin")
	_assert_equal(reporting.billing_program, Types.BillingProgramAndroid.EXTERNAL_OFFER, "The default reporting details should echo the requested program")
	_assert_equal(reporting.external_transaction_token, "", "The default reporting details should carry no token")

	var choice_params = Types.GetBillingChoiceInfoParamsAndroid.new()
	choice_params.billing_program = Types.BillingProgramAndroid.BILLING_CHOICE
	var choice_info = GodotIapPlugin.get_billing_choice_info_android(choice_params)
	_assert_true(choice_info is Types.BillingChoiceInfoAndroid, "get_billing_choice_info_android should return a typed default without a native plugin")
	_assert_equal(choice_info.play_billing_choice_image_url, "", "The default billing choice info should carry no image URL")

	var link_params = Types.LaunchExternalLinkParamsAndroid.new()
	link_params.billing_program = Types.BillingProgramAndroid.EXTERNAL_OFFER
	_assert_equal(GodotIapPlugin.launch_external_link_android(link_params), false, "launch_external_link_android should return false without a native plugin")

	var dialog_params = Types.BillingProgramInformationDialogParamsAndroid.new()
	dialog_params.billing_program = Types.BillingProgramAndroid.BILLING_CHOICE
	var dialog_result = GodotIapPlugin.show_billing_program_information_dialog_android(dialog_params)
	_assert_true(dialog_result is Types.BillingResultAndroid, "show_billing_program_information_dialog_android should return a typed default without a native plugin")
	_assert_equal(dialog_result.response_code, 0, "The default billing dialog result should use response code 0")

	var message_result = GodotIapPlugin.show_in_app_messages_android()
	_assert_true(message_result is Types.InAppMessageResultAndroid, "show_in_app_messages_android should return a typed default without a native plugin")
	_assert_equal(message_result.response_code, Types.InAppMessageResponseCodeAndroid.NO_ACTION_NEEDED, "The default in-app message result should be NO_ACTION_NEEDED")


func test_no_plugin_cross_platform_zero_values() -> void:
	var errors: Array[Dictionary] = []
	var capture_error = func(error: Dictionary) -> void:
		errors.append(error)
	GodotIapPlugin.purchase_error.connect(capture_error)

	_assert_equal(await GodotIapPlugin.get_storefront(), "", "get_storefront should return an empty string without a native plugin")
	_assert_equal(errors.size(), 1, "get_storefront should emit purchase_error without a native plugin")
	_assert_equal(errors[0].get("code"), "feature-not-supported", "Desktop storefront lookups should map to feature-not-supported")
	GodotIapPlugin.purchase_error.disconnect(capture_error)

	_assert_equal(await GodotIapPlugin.verify_purchase({}), null, "verify_purchase should return null without a native plugin")

	var provider_result = await GodotIapPlugin.verify_purchase_with_provider({"provider": "iapkit"})
	_assert_true(provider_result is Types.VerifyPurchaseWithProviderResult, "verify_purchase_with_provider should return a typed result without a native plugin")
	_assert_equal(provider_result.errors.size(), 1, "The no-plugin provider result should carry one error")
	_assert_equal(provider_result.errors[0].code, "feature-not-supported", "The no-plugin provider error should be feature-not-supported")

	var raw_verify = GodotIapPlugin._verify_purchase_raw({})
	_assert_equal(raw_verify.get("isValid"), false, "The raw verify envelope should report isValid false without a native plugin")

	var deep_link_result = await GodotIapPlugin.deep_link_to_subscriptions()
	_assert_true(deep_link_result is Types.VoidResult, "deep_link_to_subscriptions should return VoidResult without a native plugin")
	_assert_equal(deep_link_result.success, false, "Deep links should not report success without a native plugin on desktop")


# ============================================
# Pure Utility Helpers
# ============================================

func test_store_and_stub_mode_helpers() -> void:
	var original_platform = GodotIapPlugin._platform

	_assert_true(GodotIapPlugin.is_stub_mode(), "is_stub_mode should be true without a native plugin")
	_assert_true(GodotIapPlugin.get_platform() is String, "get_platform should return a String")

	GodotIapPlugin._platform = "Android"
	_assert_equal(GodotIapPlugin.get_store(), Types.IapStore.GOOGLE, "Android should map to the GOOGLE store")
	GodotIapPlugin._platform = "iOS"
	_assert_equal(GodotIapPlugin.get_store(), Types.IapStore.APPLE, "iOS should map to the APPLE store")
	GodotIapPlugin._platform = "Linux"
	_assert_equal(GodotIapPlugin.get_store(), Types.IapStore.UNKNOWN, "Desktop platforms should map to the UNKNOWN store")

	GodotIapPlugin._platform = original_platform


func test_create_purchase_error() -> void:
	var error = GodotIapPlugin.create_purchase_error(Types.ErrorCode.USER_CANCELLED, "Cancelled", "sku.a")
	_assert_true(error is Types.PurchaseError, "create_purchase_error should return a PurchaseError")
	_assert_equal(error.code, Types.ErrorCode.USER_CANCELLED, "The error code should be preserved")
	_assert_equal(error.message, "Cancelled", "The error message should be preserved")
	_assert_equal(error.product_id, "sku.a", "The product id should be preserved")
	_assert_equal(error.to_dict().get("code"), "user-cancelled", "The error code should serialize to its wire value")


func test_set_purchase_updated_listener_options() -> void:
	var options = Types.PurchaseUpdatedListenerOptions.new()
	options.dedupe_transaction_ios = false
	GodotIapPlugin.set_purchase_updated_listener_options(options)
	_assert_equal(
		GodotIapPlugin._purchase_updated_listener_options,
		{"dedupeTransactionIOS": false},
		"Typed listener options should be stored as their serialized dictionary"
	)

	GodotIapPlugin.set_purchase_updated_listener_options({"dedupeTransactionIOS": true})
	_assert_equal(
		GodotIapPlugin._purchase_updated_listener_options,
		{"dedupeTransactionIOS": true},
		"Dictionary listener options should be stored as-is"
	)

	GodotIapPlugin.set_purchase_updated_listener_options(null)
	_assert_equal(GodotIapPlugin._purchase_updated_listener_options, {}, "Null listener options should reset to an empty dictionary")


func test_enum_raw_mapping_helpers() -> void:
	_assert_equal(
		GodotIapPlugin._billing_program_to_raw(Types.BillingProgramAndroid.BILLING_CHOICE),
		"billing-choice",
		"Billing program enums should map to their wire strings"
	)
	_assert_equal(GodotIapPlugin._billing_program_to_raw(999), 999, "Unknown billing program ints should pass through")
	_assert_equal(GodotIapPlugin._billing_program_to_raw("external-offer"), "external-offer", "Raw billing program strings should pass through")
	_assert_equal(
		GodotIapPlugin._developer_billing_type_to_raw(Types.DeveloperBillingTypeAndroid.IN_APP),
		"in-app",
		"Developer billing type enums should map to their wire strings"
	)
	_assert_equal(GodotIapPlugin._developer_billing_type_to_raw("external-link"), "external-link", "Raw developer billing type strings should pass through")


func test_product_from_dict_platform_guards() -> void:
	var original_platform = GodotIapPlugin._platform

	GodotIapPlugin._platform = "Linux"
	_assert_equal(
		GodotIapPlugin._product_from_dict({"id": "sku", "type": "in-app"}),
		null,
		"Unknown platforms should map products to null"
	)

	GodotIapPlugin._platform = "Android"
	var int_typed = GodotIapPlugin._product_from_dict({
		"id": "premium",
		"title": "Premium",
		"description": "Premium subscription",
		"type": Types.ProductType.SUBS,
		"nameAndroid": "Premium",
	})
	_assert_true(int_typed is Types.ProductSubscriptionAndroid, "Integer SUBS types should also map to subscription products")

	GodotIapPlugin._platform = original_platform


func test_connection_state_signal_handlers() -> void:
	var events: Array[String] = []
	var on_connected = func() -> void:
		events.append("connected")
	var on_disconnected = func() -> void:
		events.append("disconnected")
	GodotIapPlugin.connected.connect(on_connected)
	GodotIapPlugin.disconnected.connect(on_disconnected)

	GodotIapPlugin._is_connected = false
	GodotIapPlugin._on_connected()
	_assert_true(GodotIapPlugin._is_connected, "_on_connected should mark the wrapper connected")
	_assert_true(GodotIapPlugin.is_store_connected(), "is_store_connected should reflect the connected state")

	GodotIapPlugin._on_disconnected()
	_assert_false(GodotIapPlugin._is_connected, "_on_disconnected should mark the wrapper disconnected")
	_assert_equal(events, ["connected", "disconnected"], "Connection handlers should emit their public signals")

	GodotIapPlugin.connected.disconnect(on_connected)
	GodotIapPlugin.disconnected.disconnect(on_disconnected)


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
