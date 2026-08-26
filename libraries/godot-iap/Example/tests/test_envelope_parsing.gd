extends SceneTree
## JSON envelope parsing tests for godot_iap.gd.
##
## The native Android plugin speaks JSON strings and the native Apple plugin
## speaks {"success": true, ...} payload envelopes. These tests feed canned
## envelopes through fake native plugins to lock down the wrapper's
## parse/normalize/error paths without a real store.
## Run with: godot --headless --path Example --script res://tests/test_envelope_parsing.gd

const Types = preload("res://addons/godot-iap/types.gd")
const GodotIapWrapper = preload("res://addons/godot-iap/godot_iap.gd")

var _tests_passed := 0
var _tests_failed := 0
var GodotIapPlugin: Node = null
var _original_platform := ""


class FakeAndroidJsonPlugin:
	extends RefCounted
	## Canned JSON string responses keyed by native method name.
	var responses: Dictionary = {}
	var last_args: Array = []
	var last_method := ""

	func _respond(method: String, fallback: String) -> String:
		return responses.get(method, fallback)

	func fetchProducts(request_json: String) -> String:
		last_method = "fetchProducts"
		last_args = [request_json]
		return _respond("fetchProducts", JSON.stringify({"products": []}))

	func requestPurchase(params_json: String) -> String:
		last_method = "requestPurchase"
		last_args = [params_json]
		return _respond("requestPurchase", JSON.stringify({"success": true}))

	func finishTransaction(purchase_json: String, is_consumable: bool) -> String:
		last_args = [purchase_json, is_consumable]
		return _respond("finishTransaction", JSON.stringify({"success": true}))

	func getAvailablePurchases() -> String:
		last_args = []
		return _respond("getAvailablePurchases", "[]")

	func getAvailablePurchasesResult() -> String:
		last_args = []
		return _respond(
			"getAvailablePurchasesResult",
			JSON.stringify({"success": true, "purchases": []})
		)

	func getAvailablePurchasesResultWithOptions(options_json: String) -> String:
		last_args = [options_json]
		return _respond(
			"getAvailablePurchasesResultWithOptions",
			JSON.stringify({"success": true, "purchases": []})
		)

	func getActiveSubscriptions(ids_json) -> String:
		last_args = [ids_json]
		return _respond("getActiveSubscriptions", "[]")

	func getActiveSubscriptionsResult(ids_json) -> String:
		last_args = [ids_json]
		return _respond(
			"getActiveSubscriptionsResult",
			JSON.stringify({"success": true, "subscriptions": []})
		)

	func hasActiveSubscriptions(ids_json) -> String:
		last_args = [ids_json]
		return _respond(
			"hasActiveSubscriptions",
			JSON.stringify({"success": true, "hasActive": false})
		)

	func launchExternalLinkAndroid(params_json: String) -> String:
		last_args = [params_json]
		return _respond("launchExternalLinkAndroid", "{}")

	func openRedeemOfferCodeAndroid() -> String:
		last_method = "openRedeemOfferCodeAndroid"
		return _respond("openRedeemOfferCodeAndroid", "{}")

	func isBillingProgramAvailableAndroid(program) -> String:
		last_args = [program]
		return _respond("isBillingProgramAvailableAndroid", "{}")

	func createBillingProgramReportingDetailsAndroid(program) -> String:
		last_args = [program]
		return _respond("createBillingProgramReportingDetailsAndroid", "{}")

	func verifyPurchase(props_json: String) -> String:
		last_args = [props_json]
		return _respond("verifyPurchase", JSON.stringify({"isValid": false}))

	func deepLinkToSubscriptions(options_json: String) -> String:
		last_args = [options_json]
		return _respond("deepLinkToSubscriptions", JSON.stringify({"success": true}))

	func getStorefrontAndroid() -> String:
		return _respond("getStorefrontAndroid", JSON.stringify({"success": true, "countryCode": "US"}))


class FakeImmediateApplePlugin:
	extends RefCounted
	## Canned payloads returned synchronously WITHOUT a requestId, which
	## exercises _call_apple_async's immediate-payload and error fallbacks.
	var responses: Dictionary = {}
	var last_method := ""

	func _respond(method: String, fallback: String) -> String:
		last_method = method
		return responses.get(method, fallback)

	func initConnection() -> String:
		return _respond("initConnection", JSON.stringify({"success": true}))

	func endConnection() -> String:
		return _respond("endConnection", JSON.stringify({"success": true}))

	func setPurchaseUpdatedListenerOptions(options_json: String) -> void:
		responses["last_listener_options"] = options_json

	func getReceiptDataIOS() -> String:
		return _respond("getReceiptDataIOS", "0")

	func getStorefront() -> String:
		return _respond("getStorefront", "0")

	func fetchProducts(request_json: String) -> String:
		responses["last_fetch_request"] = request_json
		return _respond("fetchProducts", "0")

	func requestPurchaseWithPayload(request_json: String) -> String:
		responses["last_purchase_request"] = request_json
		return _respond(
			"requestPurchaseWithPayload",
			JSON.stringify({"success": true})
		)

	func finishTransaction(args_json: String) -> String:
		responses["last_finish_args"] = args_json
		return _respond("finishTransaction", JSON.stringify({"success": true}))

	func restorePurchases() -> String:
		return _respond(
			"restorePurchases",
			JSON.stringify({"success": true})
		)

	func getAvailablePurchases(options_json: String) -> String:
		responses["last_purchase_options"] = options_json
		return _respond("getAvailablePurchases", "0")

	func getActiveSubscriptions(ids_json: String) -> String:
		responses["last_subscription_ids"] = ids_json
		return _respond("getActiveSubscriptions", "0")

	func hasActiveSubscriptions(ids_json: String) -> String:
		responses["last_has_subscription_ids"] = ids_json
		return _respond("hasActiveSubscriptions", "0")

	func verifyPurchase(props_json: String) -> String:
		responses["last_verify_props"] = props_json
		return _respond("verifyPurchase", "0")

	func verifyPurchaseWithProvider(props_json: String) -> String:
		responses["last_provider_props"] = props_json
		return _respond("verifyPurchaseWithProvider", "0")

	func deepLinkToSubscriptions(options_json: String) -> String:
		responses["last_deep_link_options"] = options_json
		return _respond("deepLinkToSubscriptions", "0")

	func presentCodeRedemptionSheetIOS() -> String:
		return _respond("presentCodeRedemptionSheetIOS", "0")


func _init() -> void:
	_run_suite.call_deferred()


func _run_suite() -> void:
	GodotIapPlugin = GodotIapWrapper.new()
	root.add_child(GodotIapPlugin)
	await process_frame
	_original_platform = GodotIapPlugin._platform

	print("\n========================================")
	print("Running native envelope parsing tests...")
	print("========================================\n")

	await _run_all_tests()

	print("\n========================================")
	print("Results: %d passed, %d failed" % [_tests_passed, _tests_failed])
	print("========================================\n")

	quit(0 if _tests_failed == 0 else 1)


func _run_all_tests() -> void:
	# Pure helpers (no fake plugin required)
	test_canonical_purchase_envelopes()
	test_product_query_type_normalization()
	test_normalize_purchase_dict()
	test_normalize_android_purchase_dict()
	test_parse_request_id()
	test_apple_async_result_key()
	await test_products_fetched_cache()
	await test_apple_async_timeout_and_late_callback()
	await test_apple_async_disconnect_and_concurrency()
	await test_ios_restore_failure_emits_purchase_error()
	test_android_signal_handlers_parse_json()

	# Android JSON envelopes
	await test_android_fetch_products_envelope()
	await test_android_fetch_products_parse_error()
	test_android_request_purchase_success_envelope()
	test_android_request_purchase_error_envelope()
	test_android_request_purchase_empty_response()
	test_android_request_purchase_unparseable_response()
	test_android_request_purchase_unsuccessful_response()
	test_android_request_purchase_pending_response()
	test_request_purchase_unsupported_platform()
	test_ios_request_purchase_requires_sku()
	test_android_purchase_uses_canonical_native_wire()
	test_android_purchase_rejects_invalid_optional_request_fields()
	test_removed_purchase_inputs_are_rejected()
	test_ambiguous_purchase_branches_are_rejected()
	await test_android_finish_transaction_envelopes()
	await test_android_available_purchases_envelope()
	await test_android_active_subscriptions_envelope()
	await test_android_has_active_subscriptions_envelope()
	test_android_billing_program_envelopes()
	await test_android_open_redeem_offer_code_envelope()
	await test_android_verify_purchase_envelope()
	test_android_is_billing_program_available_envelope()
	await test_android_deep_link_envelope()
	await test_android_storefront_invalid_envelopes()

	# iOS immediate payload envelopes
	await test_ios_immediate_payload_envelope()
	await test_ios_missing_request_id_envelope()
	await test_ios_open_redeem_offer_code_envelope()
	await test_macos_shared_api_routing()


func _install_android_fake() -> FakeAndroidJsonPlugin:
	var fake = FakeAndroidJsonPlugin.new()
	GodotIapPlugin._native_plugin = fake
	GodotIapPlugin._platform = "Android"
	return fake


func _install_ios_fake() -> FakeImmediateApplePlugin:
	return _install_apple_fake("iOS")


func _install_apple_fake(platform: String) -> FakeImmediateApplePlugin:
	var fake = FakeImmediateApplePlugin.new()
	GodotIapPlugin._native_plugin = fake
	GodotIapPlugin._platform = platform
	return fake


func _uninstall_fake() -> void:
	GodotIapPlugin._native_plugin = null
	GodotIapPlugin._platform = _original_platform
	GodotIapPlugin._is_connected = false


# ============================================
# Pure Envelope Helpers
# ============================================

func test_canonical_purchase_envelopes() -> void:
	var decoded = GodotIapPlugin._canonical_purchase({
		"purchaseJson": JSON.stringify({"productId": "canonical", "quantity": 2}),
	})
	_assert_equal(decoded.get("productId"), "canonical", "Valid purchaseJson should replace the native dictionary")
	_assert_equal(decoded.get("quantity"), 2, "Canonical payload fields should be preserved")

	var empty_json = {"purchaseJson": "", "productId": "raw"}
	_assert_equal(GodotIapPlugin._canonical_purchase(empty_json), empty_json, "Empty purchaseJson should keep the native dictionary")

	var non_dict_json = {"purchaseJson": "[1, 2]", "productId": "raw"}
	_assert_equal(GodotIapPlugin._canonical_purchase(non_dict_json), non_dict_json, "Non-dictionary purchaseJson should keep the native dictionary")

	var missing_json = {"productId": "raw"}
	_assert_equal(GodotIapPlugin._canonical_purchase(missing_json), missing_json, "Missing purchaseJson should keep the native dictionary")


func test_product_query_type_normalization() -> void:
	_assert_equal(
		GodotIapPlugin._normalize_product_query_type("in-app", "all"),
		"in-app",
		"Canonical in-app should remain a one-time product query"
	)
	_assert_equal(
		GodotIapPlugin._normalize_product_query_type("subs", "all"),
		"subs",
		"Canonical subs should remain a subscription query"
	)
	_assert_equal(
		GodotIapPlugin._normalize_product_query_type("all", "in-app"),
		"all",
		"Canonical all should remain a mixed query"
	)
	_assert_equal(
		GodotIapPlugin._normalize_product_query_type("in_app", "all"),
		"",
		"Removed product query aliases should be rejected"
	)
	_assert_equal(
		GodotIapPlugin._normalize_product_query_type("typo", "all"),
		"",
		"Unknown query types should be rejected instead of silently becoming all"
	)
	_assert_equal(
		GodotIapPlugin._normalize_product_query_type("all", "in-app", false),
		"",
		"A purchase request should reject the mixed all query type"
	)


func test_normalize_purchase_dict() -> void:
	var source = {"productId": "p", "ids": ["a", null, 3]}
	var normalized = GodotIapPlugin._normalize_purchase_dict(source)
	_assert_equal(normalized["ids"].size(), 2, "Null ids entries should be dropped")
	_assert_equal(normalized["ids"][0], "a", "String ids should be preserved")
	_assert_equal(normalized["ids"][1], "3", "Non-string ids should be stringified")
	_assert_equal(source["ids"].size(), 3, "Normalization should not mutate the source dictionary")

	var no_ids = {"productId": "p"}
	_assert_equal(GodotIapPlugin._normalize_purchase_dict(no_ids), no_ids, "Dictionaries without ids should pass through unchanged")


func test_normalize_android_purchase_dict() -> void:
	var mirrored = GodotIapPlugin._normalize_android_purchase_dict({"isAcknowledged": true})
	_assert_equal(mirrored.get("isAcknowledgedAndroid"), true, "isAcknowledged should mirror into isAcknowledgedAndroid")

	var explicit = GodotIapPlugin._normalize_android_purchase_dict({
		"isAcknowledged": false,
		"isAcknowledgedAndroid": true,
	})
	_assert_equal(explicit.get("isAcknowledgedAndroid"), true, "Existing isAcknowledgedAndroid should not be overwritten")

	var absent = GodotIapPlugin._normalize_android_purchase_dict({"productId": "p"})
	_assert_false(absent.has("isAcknowledgedAndroid"), "No acknowledgement key should be invented")


func test_parse_request_id() -> void:
	_assert_equal(GodotIapPlugin._parse_request_id(JSON.stringify({"requestId": "req-1"})), "req-1", "requestId should be extracted from pending JSON")
	_assert_equal(GodotIapPlugin._parse_request_id(JSON.stringify({"status": "pending"})), "", "Missing requestId should map to empty string")
	_assert_equal(GodotIapPlugin._parse_request_id("12"), "", "Non-dictionary JSON should map to empty string")
	_assert_equal(GodotIapPlugin._parse_request_id(42), "", "Non-string pending values should map to empty string")


func test_apple_async_result_key() -> void:
	_assert_equal(GodotIapPlugin._apple_async_result_key("syncIOS", "req-9"), "syncIOS:req-9", "Async cache keys should be method:requestId")


func test_products_fetched_cache() -> void:
	GodotIapPlugin._apple_async_results.clear()
	GodotIapPlugin._on_products_fetched({"method": "syncIOS", "requestId": "req-1", "success": true})
	_assert_true(GodotIapPlugin._apple_async_results.has("syncIOS:req-1"), "Tagged native completions should be cached")

	GodotIapPlugin._on_products_fetched({"success": true})
	_assert_equal(GodotIapPlugin._apple_async_results.size(), 1, "Untagged completions should not be cached")

	var payload = await GodotIapPlugin._await_products_fetched_for("syncIOS", "req-1")
	_assert_equal(payload.get("success"), true, "Cached completions should resolve the awaiting coroutine")
	_assert_equal(GodotIapPlugin._apple_async_results.size(), 0, "Resolved completions should be evicted from the cache")


func test_apple_async_timeout_and_late_callback() -> void:
	GodotIapPlugin._apple_async_results.clear()
	GodotIapPlugin._apple_async_waiters.clear()
	GodotIapPlugin._apple_async_terminal_keys.clear()
	GodotIapPlugin._apple_async_terminal_order.clear()
	var published: Array[Dictionary] = []
	var capture = func(payload: Dictionary) -> void:
		published.append(payload)
	GodotIapPlugin.products_fetched.connect(capture)

	var result = await GodotIapPlugin._await_products_fetched_for(
		"syncIOS", "timeout-1", 0.01
	)
	_assert_equal(result.get("success"), false, "Timed-out iOS calls should fail")
	_assert_equal(result.get("code"), "service-timeout", "Timed-out iOS calls should use service-timeout")
	_assert_equal(GodotIapPlugin._apple_async_waiters.size(), 0, "Timed-out waiters should be removed")

	GodotIapPlugin._on_products_fetched({
		"method": "syncIOS",
		"requestId": "timeout-1",
		"success": true,
	})
	_assert_equal(published.size(), 0, "Late completions after timeout should be ignored")
	_assert_equal(GodotIapPlugin._apple_async_results.size(), 0, "Late completions should not refill the cache")
	GodotIapPlugin.products_fetched.disconnect(capture)


func test_apple_async_disconnect_and_concurrency() -> void:
	GodotIapPlugin._apple_async_results.clear()
	GodotIapPlugin._apple_async_waiters.clear()
	GodotIapPlugin._apple_async_terminal_keys.clear()
	GodotIapPlugin._apple_async_terminal_order.clear()

	var first_state = GodotIapPlugin._await_products_fetched_for("syncIOS", "first", 1.0)
	var second_state = GodotIapPlugin._await_products_fetched_for("syncIOS", "second", 1.0)
	await process_frame
	GodotIapPlugin._on_products_fetched({
		"method": "syncIOS",
		"requestId": "second",
		"success": true,
		"value": 2,
	})
	GodotIapPlugin._on_disconnected()

	var first = await first_state
	var second = await second_state
	_assert_equal(first.get("code"), "service-disconnected", "Disconnect should cancel every pending request")
	_assert_equal(second.get("value"), 2, "Concurrent completions should resolve only their requestId")
	_assert_equal(GodotIapPlugin._apple_async_waiters.size(), 0, "Disconnect should leave no pending waiters")

	var tree_exit_state = GodotIapPlugin._await_products_fetched_for(
		"getAvailablePurchases", "tree-exit", 1.0
	)
	await process_frame
	GodotIapPlugin._exit_tree()
	var tree_exit_result = await tree_exit_state
	_assert_equal(
		tree_exit_result.get("code"),
		"service-disconnected",
		"Leaving the scene tree should cancel pending iOS requests"
	)
	_assert_equal(
		GodotIapPlugin._apple_async_waiters.size(),
		0,
		"Tree-exit cancellation should leave no pending waiters"
	)

	GodotIapPlugin._apple_async_results.clear()
	GodotIapPlugin._apple_async_result_order.clear()
	GodotIapPlugin._apple_async_terminal_keys.clear()
	GodotIapPlugin._apple_async_terminal_order.clear()
	for index in range(GodotIapPlugin.APPLE_ASYNC_RESULT_CACHE_LIMIT + 10):
		GodotIapPlugin._on_products_fetched({
			"method": "syncIOS",
			"requestId": "cached-%d" % index,
			"success": true,
		})
	_assert_equal(
		GodotIapPlugin._apple_async_results.size(),
		GodotIapPlugin.APPLE_ASYNC_RESULT_CACHE_LIMIT,
		"Unclaimed iOS completions should respect the result-cache limit"
	)
	var evicted = await GodotIapPlugin._await_products_fetched_for(
		"syncIOS", "cached-0", 1.0
	)
	_assert_equal(
		evicted.get("code"),
		"service-error",
		"Evicted completions should fail immediately instead of waiting for timeout"
	)


func test_android_signal_handlers_parse_json() -> void:
	var purchases: Array[Dictionary] = []
	var errors: Array[Dictionary] = []
	var choices: Array[Dictionary] = []
	var billing_issues: Array[Dictionary] = []
	var capture_purchase = func(purchase: Dictionary) -> void:
		purchases.append(purchase)
	var capture_error = func(error: Dictionary) -> void:
		errors.append(error)
	var capture_choice = func(details: Dictionary) -> void:
		choices.append(details)
	var capture_billing_issue = func(purchase: Dictionary) -> void:
		billing_issues.append(purchase)
	GodotIapPlugin.purchase_updated.connect(capture_purchase)
	GodotIapPlugin.purchase_error.connect(capture_error)
	GodotIapPlugin.user_choice_billing_android.connect(capture_choice)
	GodotIapPlugin.subscription_billing_issue.connect(capture_billing_issue)

	GodotIapPlugin._on_android_purchase_updated(JSON.stringify({"productId": "sku.a"}))
	_assert_equal(purchases.size(), 1, "Valid purchase JSON should emit purchase_updated")
	_assert_equal(purchases[0].get("productId"), "sku.a", "purchase_updated payload should be the parsed dictionary")

	GodotIapPlugin._on_android_purchase_updated("[]")
	_assert_equal(purchases.size(), 1, "Non-dictionary purchase JSON should not emit purchase_updated")

	GodotIapPlugin._on_android_purchase_error(JSON.stringify({"code": "user-cancelled", "message": "cancelled"}))
	_assert_equal(errors.size(), 1, "Valid error JSON should emit purchase_error")
	_assert_equal(errors[0].get("code"), "user-cancelled", "purchase_error payload should preserve the error code")

	GodotIapPlugin._on_android_user_choice_billing(JSON.stringify({"externalTransactionToken": "ect"}))
	_assert_equal(choices.size(), 1, "Valid details JSON should emit user_choice_billing_android")
	_assert_equal(choices[0].get("externalTransactionToken"), "ect", "user_choice_billing payload should be preserved")

	GodotIapPlugin._on_android_subscription_billing_issue(JSON.stringify({"productId": "sub.a", "isSuspendedAndroid": true}))
	_assert_equal(billing_issues.size(), 1, "Valid purchase JSON should emit subscription_billing_issue")
	_assert_equal(billing_issues[0].get("isSuspendedAndroid"), true, "subscription_billing_issue payload should be preserved")

	GodotIapPlugin._on_android_subscription_billing_issue("[]")
	_assert_equal(billing_issues.size(), 1, "Non-dictionary billing-issue JSON should not emit")

	GodotIapPlugin.purchase_updated.disconnect(capture_purchase)
	GodotIapPlugin.purchase_error.disconnect(capture_error)
	GodotIapPlugin.user_choice_billing_android.disconnect(capture_choice)
	GodotIapPlugin.subscription_billing_issue.disconnect(capture_billing_issue)


# ============================================
# Android JSON Envelopes
# ============================================

func test_android_fetch_products_envelope() -> void:
	var fake = _install_android_fake()
	fake.responses["fetchProducts"] = JSON.stringify({
		"products": [
			{
				"id": "coins.100",
				"title": "Coins",
				"description": "100 coins",
				"type": "in-app",
				"platform": "android",
				"displayPrice": "$0.99",
				"currency": "USD",
				"nameAndroid": "Coins",
			},
			{
				"id": "premium.monthly",
				"title": "Premium",
				"description": "Premium subscription",
				"type": "subs",
				"platform": "android",
				"displayPrice": "$9.99",
				"currency": "USD",
				"nameAndroid": "Premium",
			},
			"garbage",
			42,
		],
	})

	var request = Types.ProductRequest.new()
	var skus: Array[String] = ["coins.100", "premium.monthly"]
	request.skus = skus
	request.type = Types.ProductQueryType.ALL
	var products = await GodotIapPlugin.fetch_products(request)

	_assert_equal(products.size(), 2, "Malformed product entries should be skipped")
	_assert_true(products[0] is Types.ProductAndroid, "In-app envelope entries should map to ProductAndroid")
	_assert_equal(products[0].id, "coins.100", "Product fields should survive the envelope")
	_assert_true(products[1] is Types.ProductSubscriptionAndroid, "Subscription envelope entries should map to ProductSubscriptionAndroid")

	var sent_request = JSON.parse_string(fake.last_args[0])
	_assert_equal(sent_request.get("skus", []).size(), 2, "The serialized request should reach the native plugin")
	_assert_equal(sent_request.get("type"), "all", "The query type should serialize to its wire value")
	_uninstall_fake()


func test_android_fetch_products_parse_error() -> void:
	var fake = _install_android_fake()
	fake.responses["fetchProducts"] = "[]"

	var raw = await GodotIapPlugin._fetch_products_raw({"skus": ["x"]})
	_assert_equal(raw.get("products", null), [], "Non-dictionary envelopes should yield an empty product list")
	_assert_equal(raw.get("error"), "Parse error", "Non-dictionary envelopes should surface a parse error")

	var request = Types.ProductRequest.new()
	var skus: Array[String] = ["x"]
	request.skus = skus
	var products = await GodotIapPlugin.fetch_products(request)
	_assert_equal(products.size(), 0, "fetch_products should degrade to an empty array on parse errors")
	_uninstall_fake()


func _make_purchase_props(sku: String) -> Variant:
	var platforms = Types.RequestPurchasePropsByPlatforms.new()
	platforms.google = Types.RequestPurchaseAndroidProps.new()
	var skus: Array[String] = [sku]
	platforms.google.skus = skus
	return Types.RequestPurchaseProps.in_app(platforms)


func test_android_request_purchase_success_envelope() -> void:
	var fake = _install_android_fake()
	fake.responses["requestPurchase"] = JSON.stringify({
		"success": true,
		"id": "txn-1",
		"transactionId": "txn-1",
		"productId": "sku.one",
		"ids": ["sku.one", null],
		"purchaseToken": "token-1",
		"isAcknowledged": true,
		"purchaseState": "purchased",
		"platform": "android",
		"store": "google",
		"quantity": 1,
		"isAutoRenewing": false,
		"transactionDate": 1720000000000.0,
	})

	var purchase = GodotIapPlugin.request_purchase(_make_purchase_props("sku.one"))
	_assert_true(purchase is Types.PurchaseAndroid, "Successful Android envelopes should map to PurchaseAndroid")
	_assert_equal(purchase.product_id, "sku.one", "Purchase fields should survive the envelope")
	_assert_equal(purchase.is_acknowledged_android, true, "isAcknowledged should normalize into is_acknowledged_android")
	_assert_equal(purchase.ids.size(), 1, "Null ids entries should be dropped before typing")
	_assert_equal(purchase.purchase_state, Types.PurchaseState.PURCHASED, "purchaseState strings should map to the enum")
	_assert_equal(purchase.store, Types.IapStore.GOOGLE, "store strings should map to the enum")

	var sent_params = JSON.parse_string(fake.last_args[0])
	_assert_equal(fake.last_method, "requestPurchase", "The GDS wrapper should call the canonical Android native method")
	_assert_equal(sent_params.get("skus", []), ["sku.one"], "The requested skus should reach the native plugin")
	_assert_equal(sent_params.get("type"), "in-app", "The purchase type should reach the native plugin")
	_assert_false(sent_params.has("offerTokenArr"), "Canonical GDS calls should not emit legacy offerTokenArr")
	_assert_false(sent_params.has("replacementMode"), "Canonical GDS calls should not invent replacementMode: 0")
	_uninstall_fake()


## The non-iOS restore path reports failures through purchase_error. The iOS
## path used to return success = false silently, so a caller listening only to
## the signal saw Android restore failures but never iOS ones.
func test_ios_restore_failure_emits_purchase_error() -> void:
	var previous_platform = GodotIapPlugin._platform
	var previous_plugin = GodotIapPlugin._native_plugin
	GodotIapPlugin._apple_async_results.clear()
	GodotIapPlugin._apple_async_result_order.clear()
	GodotIapPlugin._apple_async_terminal_keys.clear()
	GodotIapPlugin._apple_async_terminal_order.clear()

	var errors: Array[Dictionary] = []
	var capture_error = func(error: Dictionary) -> void:
		errors.append(error)
	GodotIapPlugin.purchase_error.connect(capture_error)

	# The fake returns its payload without a requestId, so `_call_apple_async`
	# takes the immediate-payload path and `restore_purchases()` runs its real
	# iOS branch rather than the test re-implementing it.
	var fake = _install_ios_fake()
	fake.responses["restorePurchases"] = JSON.stringify({
		"success": false,
		"code": "network-error",
		"error": "Restore failed while offline",
	})

	var ios_result = await GodotIapPlugin.restore_purchases()

	_assert_false(ios_result.success, "A rejected iOS restore should not report success")
	_assert_equal(errors.size(), 1, "A failed iOS restore should emit purchase_error")
	_assert_equal(errors[0].get("code"), "network-error", "The native restore error code should be preserved")
	_assert_equal(
		errors[0].get("message"),
		"Restore failed while offline",
		"The native restore error message should be preserved"
	)

	GodotIapPlugin.purchase_error.disconnect(capture_error)
	_uninstall_fake()
	GodotIapPlugin._platform = previous_platform
	GodotIapPlugin._native_plugin = previous_plugin


func test_android_request_purchase_error_envelope() -> void:
	var fake = _install_android_fake()
	fake.responses["requestPurchase"] = JSON.stringify({
		"success": false,
		"error": "User cancelled the purchase",
		"code": "user-cancelled",
	})
	var errors: Array[Dictionary] = []
	var capture_error = func(error: Dictionary) -> void:
		errors.append(error)
	GodotIapPlugin.purchase_error.connect(capture_error)

	var purchase = GodotIapPlugin.request_purchase(_make_purchase_props("sku.two"))
	_assert_equal(purchase, null, "Error envelopes should return null")
	_assert_equal(errors.size(), 1, "Error envelopes should emit purchase_error")
	_assert_equal(errors[0].get("code"), "user-cancelled", "The native error code should be preserved")
	_assert_equal(errors[0].get("message"), "User cancelled the purchase", "The native error message should be preserved")

	GodotIapPlugin.purchase_error.disconnect(capture_error)
	_uninstall_fake()


func test_android_request_purchase_empty_response() -> void:
	var fake = _install_android_fake()
	fake.responses["requestPurchase"] = ""
	var errors: Array[Dictionary] = []
	var capture_error = func(error: Dictionary) -> void:
		errors.append(error)
	GodotIapPlugin.purchase_error.connect(capture_error)

	var purchase = GodotIapPlugin.request_purchase(_make_purchase_props("sku.three"))
	_assert_equal(purchase, null, "Empty native responses should return null")
	_assert_equal(errors.size(), 1, "Empty native responses should emit purchase_error")
	_assert_equal(errors[0].get("code"), "service-error", "Empty native responses should map to service-error")

	GodotIapPlugin.purchase_error.disconnect(capture_error)
	_uninstall_fake()


func test_android_request_purchase_unparseable_response() -> void:
	var fake = _install_android_fake()
	fake.responses["requestPurchase"] = "[]"

	var result = GodotIapPlugin._request_purchase_raw({
		"type": "in-app",
		"requestPurchase": {"google": {"skus": ["sku.four"]}},
	})
	_assert_equal(result.get("success"), false, "Non-dictionary responses should fail")
	_assert_equal(result.get("error"), "Failed to parse response", "Non-dictionary responses should surface a parse failure")
	_uninstall_fake()


func test_android_request_purchase_unsuccessful_response() -> void:
	var fake = _install_android_fake()
	fake.responses["requestPurchase"] = "{}"
	var errors: Array[Dictionary] = []
	var capture_error = func(error: Dictionary) -> void:
		errors.append(error)
	GodotIapPlugin.purchase_error.connect(capture_error)

	var purchase = GodotIapPlugin.request_purchase(_make_purchase_props("sku.unsuccessful"))
	_assert_equal(purchase, null, "Empty success envelopes should not become purchases")
	_assert_equal(errors.size(), 1, "Empty success envelopes should emit exactly one purchase_error")
	_assert_equal(errors[0].get("code"), "unknown", "Unclassified native failures should use unknown")

	GodotIapPlugin.purchase_error.disconnect(capture_error)
	_uninstall_fake()


func test_android_request_purchase_pending_response() -> void:
	var fake = _install_android_fake()
	var errors: Array[Dictionary] = []
	var capture_error = func(error: Dictionary) -> void:
		errors.append(error)
	GodotIapPlugin.purchase_error.connect(capture_error)

	fake.responses["requestPurchase"] = JSON.stringify({"status": "pending"})
	var result = GodotIapPlugin._request_purchase_raw({
		"type": "in-app",
		"requestPurchase": {"google": {"skus": ["sku.pending"]}},
	})
	_assert_equal(result.get("status"), "pending", "Pending dispatch envelopes should be accepted")
	_assert_equal(errors.size(), 0, "Pending dispatch should not emit purchase_error")

	fake.responses["requestPurchase"] = JSON.stringify({"success": true, "pending": true})
	var public_result = GodotIapPlugin.request_purchase(_make_purchase_props("sku.pending"))
	_assert_equal(
		public_result,
		null,
		"Pending Android dispatch should not become an incomplete PurchaseAndroid"
	)
	_assert_equal(errors.size(), 0, "Pending Android dispatch should remain event-driven")

	GodotIapPlugin.purchase_error.disconnect(capture_error)
	_uninstall_fake()


func test_request_purchase_unsupported_platform() -> void:
	var fake = FakeAndroidJsonPlugin.new()
	GodotIapPlugin._native_plugin = fake
	GodotIapPlugin._platform = "Linux"

	var result = GodotIapPlugin._request_purchase_raw({
		"type": "in-app",
		"requestPurchase": {"google": {"skus": ["sku.five"]}},
	})
	_assert_equal(result.get("success"), false, "Unsupported platforms should fail")
	_assert_equal(result.get("error"), "Unsupported platform", "Unsupported platforms should be named in the envelope")
	_uninstall_fake()


func test_ios_request_purchase_requires_sku() -> void:
	_install_ios_fake()

	var result = GodotIapPlugin._request_purchase_raw({
		"type": "in-app",
		"requestPurchase": {"apple": {}},
	})
	_assert_equal(result.get("success"), false, "iOS purchases without a SKU should fail")
	_assert_equal(result.get("error"), "Invalid request: SKU is required", "The SKU guard should run before the native call")
	_uninstall_fake()


func test_android_purchase_uses_canonical_native_wire() -> void:
	var fake = _install_android_fake()
	var result = GodotIapPlugin._request_purchase_raw({
		"type": "in-app",
		"requestPurchase": {
			"google": {
				"skus": ["coins.discounted"],
				"offerToken": "canonical-offer-token",
			},
		},
	})
	_assert_equal(result.get("success"), true, "Canonical raw purchase requests should remain compatible")
	_assert_equal(fake.last_method, "requestPurchase", "The canonical Android native method should be used")
	var sent = JSON.parse_string(fake.last_args[0])
	_assert_equal(sent.get("type"), "in-app", "Canonical purchase type should be preserved")
	_assert_equal(sent.get("offerToken"), "canonical-offer-token", "One-time offerToken should use its canonical key")
	_assert_false(sent.has("offerTokenArr"), "Canonical calls should never emit legacy offerTokenArr")
	_assert_false(sent.has("replacementMode"), "Missing replacement options should remain absent")
	_assert_false(
		sent.has("subscriptionProductReplacementParams"),
		"Missing product replacement params should remain absent"
	)
	_assert_false(
		sent.has("developerBillingOption"),
		"Missing developer billing options should remain absent"
	)
	_uninstall_fake()


func test_android_purchase_rejects_invalid_optional_request_fields() -> void:
	var fake = _install_android_fake()
	var null_replacement = GodotIapPlugin._request_purchase_raw({
		"type": "subs",
		"requestSubscription": {"google": {
			"skus": ["subscription"],
			"subscriptionProductReplacementParams": null,
		}},
	})
	_assert_equal(null_replacement.get("success"), true, "Null replacement params should behave as absent")
	var null_replacement_payload = JSON.parse_string(fake.last_args[0])
	_assert_false(
		null_replacement_payload.has("subscriptionProductReplacementParams"),
		"Null replacement params should not reach the native plugin"
	)

	var null_billing = GodotIapPlugin._request_purchase_raw({
		"type": "in-app",
		"requestPurchase": {"google": {
			"skus": ["coins"],
			"developerBillingOption": null,
		}},
	})
	_assert_equal(null_billing.get("success"), true, "Null developer billing options should behave as absent")
	var null_billing_payload = JSON.parse_string(fake.last_args[0])
	_assert_false(
		null_billing_payload.has("developerBillingOption"),
		"Null developer billing options should not reach the native plugin"
	)

	fake.last_method = ""
	var in_app_replacement = GodotIapPlugin._request_purchase_raw({
		"type": "in-app",
		"requestPurchase": {"google": {
			"skus": ["coins"],
			"subscriptionProductReplacementParams": {
				"oldProductId": "legacy",
				"replacementMode": "without-proration",
			},
		}},
	})
	_assert_equal(in_app_replacement.get("success"), false, "In-app replacement params should fail")
	_assert_equal(fake.last_method, "", "In-app replacement params must not reach the native plugin")
	_uninstall_fake()


func test_removed_purchase_inputs_are_rejected() -> void:
	var fake = _install_android_fake()
	var removed_envelope = GodotIapPlugin._request_purchase_raw({
		"type": "in-app",
		"request": {
			"google": {"skus": ["removed-envelope"]},
		},
	})
	_assert_equal(
		removed_envelope.get("success", false),
		false,
		"The removed request envelope must not dispatch"
	)
	_assert_equal(fake.last_method, "", "Removed purchase input must not reach the native plugin")
	_uninstall_fake()


func test_ambiguous_purchase_branches_are_rejected() -> void:
	var fake = _install_android_fake()
	var result = GodotIapPlugin._request_purchase_raw({
		"requestPurchase": {"google": {"skus": ["one-time"]}},
		"requestSubscription": {"google": {"skus": ["subscription"]}},
	})
	_assert_equal(
		result.get("success", false),
		false,
		"Ambiguous canonical purchase branches should be rejected"
	)
	_assert_equal(
		fake.last_method,
		"",
		"Ambiguous canonical purchase branches should not reach the native plugin"
	)
	_uninstall_fake()


func test_android_finish_transaction_envelopes() -> void:
	var fake = _install_android_fake()

	var missing_product = await GodotIapPlugin._finish_transaction_raw({}, false)
	_assert_equal(missing_product.get("success"), false, "finish_transaction without productId should fail")
	_assert_equal(missing_product.get("code"), Types.ErrorCode.DEVELOPER_ERROR, "Missing productId should map to DEVELOPER_ERROR")

	fake.responses["finishTransaction"] = "[]"
	var parse_error = await GodotIapPlugin._finish_transaction_raw({"productId": "sku.six"}, false)
	_assert_equal(parse_error.get("success"), false, "Non-dictionary finish envelopes should fail")
	_assert_equal(parse_error.get("error"), "Parse error", "Non-dictionary finish envelopes should surface a parse error")

	fake.responses["finishTransaction"] = JSON.stringify({"success": true})
	var finished = await GodotIapPlugin.finish_transaction_dict({"productId": "sku.six"}, true)
	_assert_true(finished is Types.VoidResult, "finish_transaction_dict should return a VoidResult")
	_assert_equal(finished.success, true, "Success envelopes should map to VoidResult.success")
	_assert_equal(fake.last_args[1], true, "The consumable flag should reach the native plugin")
	_uninstall_fake()


func test_android_available_purchases_envelope() -> void:
	var fake = _install_android_fake()
	fake.responses["getAvailablePurchasesResult"] = JSON.stringify({
		"success": true,
		"purchases": [{
			"id": "txn-9",
			"productId": "owned.sku",
			"purchaseToken": "token-9",
			"isAcknowledged": true,
			"purchaseState": "purchased",
			"platform": "android",
			"store": "google",
			"quantity": 1,
			"isAutoRenewing": false,
			"transactionDate": 1720000000000.0,
		}],
	})

	var purchases = await GodotIapPlugin.get_available_purchases()
	_assert_equal(purchases.size(), 1, "Array envelopes should map to typed purchases")
	_assert_true(purchases[0] is Types.PurchaseAndroid, "Android purchases should be PurchaseAndroid")
	_assert_equal(purchases[0].is_acknowledged_android, true, "isAcknowledged should normalize for available purchases too")
	var structured = await GodotIapPlugin.get_available_purchases_result()
	_assert_equal(structured.get("success"), true, "Structured available-purchases results should preserve success")
	_assert_equal(structured.get("purchases", []).size(), 1, "Structured results should contain the typed purchases")

	fake.responses["getAvailablePurchasesResult"] = "{}"
	var failed = await GodotIapPlugin.get_available_purchases_result()
	_assert_equal(failed.get("success"), false, "Missing success must remain distinguishable from an empty store")
	_assert_equal(failed.get("code"), "service-error", "Native failure envelopes should preserve a service code")
	var not_an_array = await GodotIapPlugin.get_available_purchases()
	_assert_equal(not_an_array.size(), 0, "Non-array envelopes should degrade to an empty purchase list")

	fake.responses["getAvailablePurchasesResult"] = JSON.stringify({
		"success": true,
		"purchases": [{
			"id": "valid",
			"productId": "valid",
			"purchaseState": "purchased",
			"store": "google",
			"transactionDate": 1.0,
			"quantity": 1.0,
			"isAutoRenewing": false,
		}, {"productId": "broken"}],
	})
	var malformed = await GodotIapPlugin.get_available_purchases_result()
	_assert_equal(malformed.get("success"), false, "One malformed purchase should reject the full batch")
	_assert_equal(malformed.get("code"), "billing-response-json-parse-error", "Malformed batches should use the decode error code")

	fake.responses["getAvailablePurchasesResult"] = JSON.stringify({
		"success": true,
		"purchases": [{
			"id": "foreign",
			"productId": "foreign",
			"transactionId": "foreign",
			"purchaseState": "purchased",
			"store": "apple",
			"transactionDate": 1.0,
			"quantity": 1,
			"isAutoRenewing": false,
		}],
	})
	var foreign = await GodotIapPlugin.get_available_purchases_result()
	_assert_equal(foreign.get("success"), false, "Android results should reject foreign stores")
	_assert_equal(foreign.get("code"), "billing-response-json-parse-error", "Foreign stores should use the decode error code")

	var restore_errors: Array[Dictionary] = []
	var capture_restore_error = func(error: Dictionary) -> void:
		restore_errors.append(error)
	GodotIapPlugin.purchase_error.connect(capture_restore_error)
	var restored = await GodotIapPlugin.restore_purchases()
	_assert_equal(restored.success, false, "Restore should fail when available purchases cannot be decoded")
	_assert_equal(restore_errors.size(), 1, "Failed Android restore should emit exactly one purchase_error")
	GodotIapPlugin.purchase_error.disconnect(capture_restore_error)
	_uninstall_fake()


func test_android_active_subscriptions_envelope() -> void:
	var fake = _install_android_fake()
	fake.responses["getActiveSubscriptionsResult"] = JSON.stringify({
		"success": true,
		"subscriptions": [{
			"productId": "sub.gold",
			"isActive": true,
			"transactionId": "txn-11",
			"transactionDate": 1720000000000.0,
			"autoRenewingAndroid": true,
		}],
	})

	var subscriptions = await GodotIapPlugin.get_active_subscriptions()
	_assert_equal(subscriptions.size(), 1, "Subscription envelopes should map to typed results")
	_assert_true(subscriptions[0] is Types.ActiveSubscription, "Entries should be ActiveSubscription")
	_assert_equal(subscriptions[0].product_id, "sub.gold", "Subscription fields should survive the envelope")
	_assert_equal(subscriptions[0].auto_renewing_android, true, "Android-only fields should survive the envelope")
	_assert_equal(fake.last_args[0], null, "An empty filter should be sent to Android as null")

	var filter: Array[String] = ["sub.gold"]
	await GodotIapPlugin.get_active_subscriptions(filter)
	_assert_equal(fake.last_args[0], JSON.stringify(["sub.gold"]), "Non-empty filters should serialize to JSON")

	fake.responses["getActiveSubscriptionsResult"] = JSON.stringify({
		"success": true,
		"subscriptions": [{"productId": "broken"}],
	})
	var malformed = await GodotIapPlugin.get_active_subscriptions_result()
	_assert_equal(malformed.get("success"), false, "Malformed subscription batches should fail atomically")
	_assert_equal(malformed.get("code"), "billing-response-json-parse-error", "Malformed subscriptions should use the decode error code")
	_uninstall_fake()


func test_android_has_active_subscriptions_envelope() -> void:
	var fake = _install_android_fake()
	fake.responses["hasActiveSubscriptions"] = JSON.stringify({"success": true, "hasActive": true})
	_assert_true(await GodotIapPlugin.has_active_subscriptions(), "hasActive envelopes should map to true")

	# A malformed envelope must not become a false entitlement result.
	fake.responses["hasActiveSubscriptions"] = "[]"
	var malformed = await GodotIapPlugin.has_active_subscriptions_result()
	_assert_equal(malformed.get("success"), false, "Malformed status envelopes should remain failures")
	_assert_equal(malformed.get("code"), "billing-response-json-parse-error", "Malformed status should use the decode error code")
	_assert_false(await GodotIapPlugin.has_active_subscriptions(), "Compatibility status should still map failure to false")
	_uninstall_fake()


func test_android_billing_program_envelopes() -> void:
	var fake = _install_android_fake()

	fake.responses["createBillingProgramReportingDetailsAndroid"] = JSON.stringify({
		"billingProgram": "external-offer",
		"externalTransactionToken": "abt-1",
	})
	var reporting = GodotIapPlugin.create_billing_program_reporting_details_android(
		Types.BillingProgramAndroid.EXTERNAL_OFFER
	)
	_assert_true(
		reporting is Types.BillingProgramReportingDetailsAndroid,
		"Reporting-details envelopes should map to the canonical type"
	)
	_assert_equal(
		reporting.external_transaction_token,
		"abt-1",
		"Reporting-details envelopes should preserve the external transaction token"
	)
	_assert_equal(
		fake.last_args[0],
		"external-offer",
		"The billing program should be serialized for the native call"
	)

	var params = Types.LaunchExternalLinkParamsAndroid.new()
	params.billing_program = Types.BillingProgramAndroid.EXTERNAL_OFFER
	params.launch_mode = Types.ExternalLinkLaunchModeAndroid.LAUNCH_IN_EXTERNAL_BROWSER_OR_APP
	fake.responses["launchExternalLinkAndroid"] = JSON.stringify({"launched": true})
	_assert_true(GodotIapPlugin.launch_external_link_android(params), "launched envelopes should map to true")
	fake.responses["launchExternalLinkAndroid"] = JSON.stringify({"success": true})
	_assert_true(GodotIapPlugin.launch_external_link_android(params), "Legacy success envelopes should map to true")
	fake.responses["launchExternalLinkAndroid"] = "{}"
	_assert_false(GodotIapPlugin.launch_external_link_android(params), "Empty envelopes should map to false")
	_uninstall_fake()


func test_android_open_redeem_offer_code_envelope() -> void:
	var fake = _install_android_fake()

	fake.responses["openRedeemOfferCodeAndroid"] = JSON.stringify({"launched": true})
	_assert_true(GodotIapPlugin.open_redeem_offer_code_android(), "launched envelopes should map to true")
	fake.responses["openRedeemOfferCodeAndroid"] = JSON.stringify({"success": true})
	_assert_true(GodotIapPlugin.open_redeem_offer_code_android(), "Legacy success envelopes should map to true")
	fake.responses["openRedeemOfferCodeAndroid"] = "{}"
	_assert_false(GodotIapPlugin.open_redeem_offer_code_android(), "Empty envelopes should map to false")

	# Unified op keeps the released native dispatch but resolves null by contract.
	fake.last_method = ""
	fake.responses["openRedeemOfferCodeAndroid"] = JSON.stringify({"success": true, "launched": true})
	_assert_equal(await GodotIapPlugin.open_redeem_offer_code(), null, "Unified Android redemption should resolve null after launching")
	_assert_equal(fake.last_method, "openRedeemOfferCodeAndroid", "Unified Android redemption should dispatch the released native method")
	fake.responses["openRedeemOfferCodeAndroid"] = JSON.stringify({"success": false, "error": "Activity not available"})
	_assert_equal(await GodotIapPlugin.open_redeem_offer_code(), null, "Unified Android redemption should resolve null on failure envelopes")
	_uninstall_fake()


func test_android_verify_purchase_envelope() -> void:
	var fake = _install_android_fake()
	fake.responses["verifyPurchase"] = JSON.stringify({
		"isValid": true,
		"productId": "sku.verified",
		"productType": "in-app",
	})

	var result = await GodotIapPlugin.verify_purchase({"google": {"purchaseToken": "token-v"}})
	_assert_true(result is Types.VerifyPurchaseResultAndroid, "Valid envelopes should map to VerifyPurchaseResultAndroid")
	_assert_equal(result.product_id, "sku.verified", "Verification fields should survive the envelope")

	var sent_props = JSON.parse_string(fake.last_args[0])
	_assert_equal(sent_props.get("google", {}).get("purchaseToken"), "token-v", "Verification props should reach the native plugin")

	fake.responses["verifyPurchase"] = JSON.stringify({"isValid": false})
	var invalid = await GodotIapPlugin.verify_purchase({"google": {"purchaseToken": "token-x"}})
	_assert_equal(invalid, null, "Invalid verifications should return null")
	_uninstall_fake()


func test_android_is_billing_program_available_envelope() -> void:
	var fake = _install_android_fake()
	fake.responses["isBillingProgramAvailableAndroid"] = JSON.stringify({
		"isAvailable": true,
		"billingProgram": "billing-choice",
		"choiceScreenType": "developer-rendered",
	})

	var result = GodotIapPlugin.is_billing_program_available_android(Types.BillingProgramAndroid.BILLING_CHOICE)
	_assert_true(result is Types.BillingProgramAvailabilityResultAndroid, "Envelopes should map to the typed result")
	_assert_equal(result.is_available, true, "isAvailable should survive the envelope")
	_assert_equal(result.billing_program, Types.BillingProgramAndroid.BILLING_CHOICE, "billingProgram strings should map back to the enum")
	_assert_equal(result.choice_screen_type, Types.BillingChoiceScreenTypeAndroid.DEVELOPER_RENDERED, "choiceScreenType strings should map back to the enum")
	_assert_equal(fake.last_args[0], "billing-choice", "The billing program should be serialized for the native call")
	_uninstall_fake()


func test_android_deep_link_envelope() -> void:
	var fake = _install_android_fake()
	fake.responses["deepLinkToSubscriptions"] = JSON.stringify({"success": true})

	var result = await GodotIapPlugin.deep_link_to_subscriptions()
	_assert_true(result is Types.VoidResult, "deep_link_to_subscriptions should return VoidResult")
	_assert_equal(result.success, true, "Success envelopes should map to VoidResult.success")
	_uninstall_fake()


func test_android_storefront_invalid_envelopes() -> void:
	var fake = _install_android_fake()
	var errors: Array[Dictionary] = []
	var capture_error = func(error: Dictionary) -> void:
		errors.append(error)
	GodotIapPlugin.purchase_error.connect(capture_error)

	fake.responses["getStorefrontAndroid"] = "[]"
	_assert_equal(await GodotIapPlugin.get_storefront(), "", "Non-dictionary storefront envelopes should fail closed")
	_assert_equal(errors.size(), 1, "Non-dictionary storefront envelopes should emit purchase_error")
	_assert_equal(errors[0].get("message"), "Storefront native method returned an invalid response", "Invalid responses should be diagnosed")

	fake.responses["getStorefrontAndroid"] = ""
	_assert_equal(await GodotIapPlugin.get_storefront(), "", "Empty storefront responses should fail closed")
	_assert_equal(errors.size(), 2, "Empty storefront responses should emit purchase_error")
	_assert_equal(errors[1].get("message"), "Storefront native method returned no response", "Missing responses should be diagnosed")

	GodotIapPlugin.purchase_error.disconnect(capture_error)
	_uninstall_fake()


# ============================================
# iOS Immediate Payload Envelopes
# ============================================

func test_ios_immediate_payload_envelope() -> void:
	var fake = _install_ios_fake()
	fake.responses["getReceiptDataIOS"] = JSON.stringify({"success": true, "receiptData": "receipt-b64"})
	_assert_equal(await GodotIapPlugin.get_receipt_data_ios(), "receipt-b64", "Immediate success payloads should resolve without a requestId")

	fake.responses["fetchProducts"] = JSON.stringify({
		"success": true,
		"productsJson": JSON.stringify([
			{
				"id": "ios.sku",
				"title": "iOS Product",
				"description": "A product",
				"type": "in-app",
				"typeIOS": "consumable",
				"platform": "ios",
				"displayPrice": "$1.99",
				"currency": "USD",
			},
		]),
	})
	var request = Types.ProductRequest.new()
	var skus: Array[String] = ["ios.sku"]
	request.skus = skus
	var products = await GodotIapPlugin.fetch_products(request)
	_assert_equal(products.size(), 1, "Nested productsJson envelopes should be decoded")
	_assert_true(products[0] is Types.ProductIOS, "iOS envelope entries should map to ProductIOS")
	_assert_equal(products[0].id, "ios.sku", "Product fields should survive the nested envelope")
	_uninstall_fake()


func test_ios_missing_request_id_envelope() -> void:
	var fake = _install_ios_fake()
	fake.responses["getStorefront"] = "0"
	var errors: Array[Dictionary] = []
	var capture_error = func(error: Dictionary) -> void:
		errors.append(error)
	GodotIapPlugin.purchase_error.connect(capture_error)

	_assert_equal(await GodotIapPlugin.get_storefront(), "", "Payloads without a requestId should fail closed")
	_assert_equal(errors.size(), 1, "Payloads without a requestId should emit purchase_error")
	_assert_equal(errors[0].get("code"), "service-error", "Missing requestId should map to service-error")
	_assert_true(
		str(errors[0].get("message", "")).contains("did not return a requestId"),
		"The missing requestId should be diagnosed in the error message"
	)

	GodotIapPlugin.purchase_error.disconnect(capture_error)
	_uninstall_fake()


func test_ios_open_redeem_offer_code_envelope() -> void:
	var fake = _install_ios_fake()

	fake.responses["presentCodeRedemptionSheetIOS"] = JSON.stringify({
		"success": true,
		"purchaseJson": JSON.stringify({
			"id": "redeem-tx",
			"productId": "redeem.sku",
			"transactionDate": 1.0,
			"transactionId": "redeem-tx",
			"purchaseState": "purchased",
			"quantity": 1,
			"isAutoRenewing": false,
			"platform": "ios",
			"store": "apple",
		}),
	})
	var redeemed = await GodotIapPlugin.open_redeem_offer_code()
	_assert_true(redeemed is Types.PurchaseIOS, "Redeemed purchase envelopes should map to PurchaseIOS")
	_assert_equal(redeemed.product_id, "redeem.sku", "Purchase fields should survive the redemption envelope")
	var deprecated_redeemed = await GodotIapPlugin.present_code_redemption_sheet_ios()
	_assert_true(deprecated_redeemed is Types.PurchaseIOS, "The deprecated sheet wrapper should keep parsing the same envelope")

	fake.responses["presentCodeRedemptionSheetIOS"] = JSON.stringify({"success": true})
	_assert_equal(await GodotIapPlugin.open_redeem_offer_code(), null, "Sheet-only success envelopes should resolve null")

	fake.responses["presentCodeRedemptionSheetIOS"] = JSON.stringify({"success": false, "error": "cancelled"})
	_assert_equal(await GodotIapPlugin.open_redeem_offer_code(), null, "Failure envelopes should resolve null")
	_uninstall_fake()


func test_macos_shared_api_routing() -> void:
	var fake = _install_apple_fake("macOS")
	var purchase_dict := {
		"success": true,
		"id": "mac-tx",
		"productId": "mac.sku",
		"transactionDate": 1.0,
		"transactionId": "mac-tx",
		"purchaseState": "purchased",
		"quantity": 1,
		"isAutoRenewing": false,
		"store": "apple",
	}

	_assert_true(GodotIapPlugin._is_apple(), "macOS should use the Apple platform path")
	GodotIapPlugin.set_purchase_updated_listener_options({"dedupeTransactionIOS": false})
	_assert_equal(
		JSON.parse_string(fake.responses.get("last_listener_options", "{}")),
		{"dedupeTransactionIOS": false},
		"macOS should configure the shared Apple purchase listener"
	)
	fake.responses["initConnection"] = JSON.stringify({"success": false})
	_assert_false(
		await GodotIapPlugin.init_connection(),
		"macOS should preserve StoreKit initialization failures"
	)
	_assert_equal(fake.last_method, "initConnection", "macOS should call Apple initConnection")
	fake.responses["initConnection"] = JSON.stringify({"success": true})
	_assert_true(await GodotIapPlugin.init_connection(), "macOS should initialize through StoreKit")
	_assert_equal(fake.last_method, "initConnection", "macOS should retry Apple initConnection")

	fake.responses["fetchProducts"] = JSON.stringify({
		"success": true,
		"productsJson": JSON.stringify([{
			"id": "mac.sku",
			"title": "macOS Product",
			"description": "A product",
			"type": "in-app",
			"typeIOS": "consumable",
			"platform": "ios",
			"displayPrice": "$1.99",
			"currency": "USD",
		}]),
	})
	var product_request = Types.ProductRequest.new()
	var skus: Array[String] = ["mac.sku"]
	product_request.skus = skus
	var products = await GodotIapPlugin.fetch_products(product_request)
	_assert_equal(products.size(), 1, "macOS should fetch products through StoreKit")
	_assert_true(products[0] is Types.ProductIOS, "macOS products should use Apple product types")

	fake.responses["requestPurchaseWithPayload"] = JSON.stringify(purchase_dict)
	var purchase = GodotIapPlugin.request_purchase({
		"requestPurchase": {"apple": {"sku": "mac.sku"}},
		"type": "in-app",
	})
	_assert_true(purchase is Types.PurchaseIOS, "macOS should request purchases through StoreKit")
	_assert_equal(purchase.product_id, "mac.sku", "macOS purchase fields should be preserved")

	fake.responses["finishTransaction"] = JSON.stringify({"success": true})
	var finished = await GodotIapPlugin.finish_transaction_dict(purchase_dict)
	_assert_true(finished.success, "macOS should finish transactions through StoreKit")
	_assert_equal(fake.last_method, "finishTransaction", "macOS should call Apple finishTransaction")
	_assert_true((await GodotIapPlugin.restore_purchases()).success, "macOS should restore StoreKit purchases")

	fake.responses["getAvailablePurchases"] = JSON.stringify({
		"success": true,
		"purchasesJson": JSON.stringify([purchase_dict]),
	})
	var available = await GodotIapPlugin.get_available_purchases()
	_assert_equal(available.size(), 1, "macOS should return available StoreKit purchases")
	_assert_true(available[0] is Types.PurchaseIOS, "macOS purchases should use Apple purchase types")

	fake.responses["getActiveSubscriptions"] = JSON.stringify({
		"success": true,
		"subscriptionsJson": JSON.stringify([{
			"productId": "mac.sub",
			"transactionId": "mac-sub-tx",
			"transactionDate": 1.0,
			"isActive": true,
		}]),
	})
	fake.responses["hasActiveSubscriptions"] = JSON.stringify({
		"success": true,
		"hasActive": true,
	})
	_assert_equal(
		(await GodotIapPlugin.get_active_subscriptions()).size(),
		1,
		"macOS should query active StoreKit subscriptions"
	)
	_assert_true(
		await GodotIapPlugin.has_active_subscriptions(),
		"macOS should query StoreKit subscription status"
	)

	fake.responses["getStorefront"] = JSON.stringify({
		"success": true,
		"countryCode": "USA",
	})
	_assert_equal(await GodotIapPlugin.get_storefront(), "USA", "macOS should query the App Store storefront")

	fake.responses["verifyPurchase"] = JSON.stringify({
		"success": true,
		"resultJson": JSON.stringify({"isValid": true}),
	})
	var verification = await GodotIapPlugin.verify_purchase({"apple": {"sku": "mac.sku"}})
	_assert_true(verification is Types.VerifyPurchaseResultIOS, "macOS should use Apple purchase verification")
	_assert_true(verification.is_valid, "macOS verification results should be preserved")

	fake.responses["verifyPurchaseWithProvider"] = JSON.stringify({
		"success": true,
		"resultJson": JSON.stringify({"provider": "iapkit", "errors": []}),
	})
	var provider_result = await GodotIapPlugin.verify_purchase_with_provider({"provider": "iapkit"})
	_assert_true(
		provider_result is Types.VerifyPurchaseWithProviderResult,
		"macOS should use Apple provider verification"
	)

	fake.responses["deepLinkToSubscriptions"] = JSON.stringify({"success": true})
	_assert_true(
		(await GodotIapPlugin.deep_link_to_subscriptions()).success,
		"macOS should open subscription management through the Apple plugin"
	)
	_assert_equal(GodotIapPlugin.get_store(), Types.IapStore.APPLE, "macOS should report the Apple store")

	fake.responses["getReceiptDataIOS"] = JSON.stringify({
		"success": true,
		"receiptData": "mac-receipt",
	})
	_assert_equal(
		await GodotIapPlugin.get_receipt_data_ios(),
		"",
		"macOS should not widen explicitly named iOS APIs"
	)
	fake.responses["endConnection"] = JSON.stringify({"success": false})
	_assert_false(
		await GodotIapPlugin.end_connection(),
		"macOS should preserve StoreKit disconnection failures"
	)
	_assert_equal(fake.last_method, "endConnection", "macOS should call Apple endConnection")
	fake.responses["endConnection"] = JSON.stringify({"success": true})
	_assert_true(await GodotIapPlugin.end_connection(), "macOS should end the StoreKit connection")
	_assert_equal(fake.last_method, "endConnection", "macOS should retry Apple endConnection")
	_uninstall_fake()


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
