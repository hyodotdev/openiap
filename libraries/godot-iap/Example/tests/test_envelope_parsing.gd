extends SceneTree
## JSON envelope parsing tests for godot_iap.gd.
##
## The native Android plugin speaks JSON strings and the native iOS plugin
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

	func _respond(method: String, fallback: String) -> String:
		return responses.get(method, fallback)

	func fetchProducts(request_json: String) -> String:
		last_args = [request_json]
		return _respond("fetchProducts", JSON.stringify({"products": []}))

	func requestPurchaseJson(params_json: String) -> String:
		last_args = [params_json]
		return _respond("requestPurchaseJson", JSON.stringify({"success": true}))

	func finishTransaction(purchase_json: String, is_consumable: bool) -> String:
		last_args = [purchase_json, is_consumable]
		return _respond("finishTransaction", JSON.stringify({"success": true}))

	func getAvailablePurchases() -> String:
		last_args = []
		return _respond("getAvailablePurchases", "[]")

	func getActiveSubscriptions(ids_json) -> String:
		last_args = [ids_json]
		return _respond("getActiveSubscriptions", "[]")

	func hasActiveSubscriptions(ids_json) -> String:
		last_args = [ids_json]
		return _respond("hasActiveSubscriptions", JSON.stringify({"hasActive": false}))

	func checkAlternativeBillingAvailabilityAndroid() -> String:
		return _respond("checkAlternativeBillingAvailabilityAndroid", "{}")

	func createAlternativeBillingTokenAndroid() -> String:
		return _respond("createAlternativeBillingTokenAndroid", "{}")

	func launchExternalLinkAndroid(params_json: String) -> String:
		last_args = [params_json]
		return _respond("launchExternalLinkAndroid", "{}")

	func openRedeemOfferCodeAndroid() -> String:
		return _respond("openRedeemOfferCodeAndroid", "{}")

	func isBillingProgramAvailableAndroid(program) -> String:
		last_args = [program]
		return _respond("isBillingProgramAvailableAndroid", "{}")

	func verifyPurchase(props_json: String) -> String:
		last_args = [props_json]
		return _respond("verifyPurchase", JSON.stringify({"isValid": false}))

	func deepLinkToSubscriptions(options_json: String) -> String:
		last_args = [options_json]
		return _respond("deepLinkToSubscriptions", JSON.stringify({"success": true}))

	func getStorefrontAndroid() -> String:
		return _respond("getStorefrontAndroid", JSON.stringify({"success": true, "countryCode": "US"}))


class FakeImmediateIOSPlugin:
	extends RefCounted
	## Canned payloads returned synchronously WITHOUT a requestId, which
	## exercises _call_ios_async's immediate-payload and error fallbacks.
	var responses: Dictionary = {}

	func getReceiptDataIOS() -> String:
		return responses.get("getReceiptDataIOS", "0")

	func getStorefrontIOS() -> String:
		return responses.get("getStorefrontIOS", "0")

	func fetchProducts(request_json: String) -> String:
		responses["last_fetch_request"] = request_json
		return responses.get("fetchProducts", "0")


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
	test_normalize_purchase_dict()
	test_normalize_android_purchase_dict()
	test_parse_request_id()
	test_ios_async_result_key()
	await test_products_fetched_cache()
	test_android_signal_handlers_parse_json()

	# Android JSON envelopes
	await test_android_fetch_products_envelope()
	await test_android_fetch_products_parse_error()
	test_android_request_purchase_success_envelope()
	test_android_request_purchase_error_envelope()
	test_android_request_purchase_empty_response()
	test_android_request_purchase_unparseable_response()
	test_request_purchase_unsupported_platform()
	test_ios_request_purchase_requires_sku()
	await test_android_finish_transaction_envelopes()
	await test_android_available_purchases_envelope()
	await test_android_active_subscriptions_envelope()
	await test_android_has_active_subscriptions_envelope()
	test_android_alternative_billing_envelopes()
	test_android_open_redeem_offer_code_envelope()
	await test_android_verify_purchase_envelope()
	test_android_is_billing_program_available_envelope()
	await test_android_deep_link_envelope()
	await test_android_storefront_invalid_envelopes()

	# iOS immediate payload envelopes
	await test_ios_immediate_payload_envelope()
	await test_ios_missing_request_id_envelope()


func _install_android_fake() -> FakeAndroidJsonPlugin:
	var fake = FakeAndroidJsonPlugin.new()
	GodotIapPlugin._native_plugin = fake
	GodotIapPlugin._platform = "Android"
	return fake


func _install_ios_fake() -> FakeImmediateIOSPlugin:
	var fake = FakeImmediateIOSPlugin.new()
	GodotIapPlugin._native_plugin = fake
	GodotIapPlugin._platform = "iOS"
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


func test_ios_async_result_key() -> void:
	_assert_equal(GodotIapPlugin._ios_async_result_key("syncIOS", "req-9"), "syncIOS:req-9", "Async cache keys should be method:requestId")


func test_products_fetched_cache() -> void:
	GodotIapPlugin._ios_async_results.clear()
	GodotIapPlugin._on_products_fetched({"method": "syncIOS", "requestId": "req-1", "success": true})
	_assert_true(GodotIapPlugin._ios_async_results.has("syncIOS:req-1"), "Tagged native completions should be cached")

	GodotIapPlugin._on_products_fetched({"success": true})
	_assert_equal(GodotIapPlugin._ios_async_results.size(), 1, "Untagged completions should not be cached")

	var payload = await GodotIapPlugin._await_products_fetched_for("syncIOS", "req-1")
	_assert_equal(payload.get("success"), true, "Cached completions should resolve the awaiting coroutine")
	_assert_equal(GodotIapPlugin._ios_async_results.size(), 0, "Resolved completions should be evicted from the cache")


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
	fake.responses["requestPurchaseJson"] = JSON.stringify({
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
	_assert_equal(sent_params.get("skus", []), ["sku.one"], "The requested skus should reach the native plugin")
	_assert_equal(sent_params.get("type"), "in-app", "The purchase type should reach the native plugin")
	_uninstall_fake()


func test_android_request_purchase_error_envelope() -> void:
	var fake = _install_android_fake()
	fake.responses["requestPurchaseJson"] = JSON.stringify({
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
	fake.responses["requestPurchaseJson"] = ""
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
	fake.responses["requestPurchaseJson"] = "[]"

	var result = GodotIapPlugin._request_purchase_raw({
		"type": "in-app",
		"requestPurchase": {"google": {"skus": ["sku.four"]}},
	})
	_assert_equal(result.get("success"), false, "Non-dictionary responses should fail")
	_assert_equal(result.get("error"), "Failed to parse response", "Non-dictionary responses should surface a parse failure")
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
	fake.responses["getAvailablePurchases"] = JSON.stringify([
		{
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
		},
	])

	var purchases = await GodotIapPlugin.get_available_purchases()
	_assert_equal(purchases.size(), 1, "Array envelopes should map to typed purchases")
	_assert_true(purchases[0] is Types.PurchaseAndroid, "Android purchases should be PurchaseAndroid")
	_assert_equal(purchases[0].is_acknowledged_android, true, "isAcknowledged should normalize for available purchases too")

	fake.responses["getAvailablePurchases"] = "{}"
	var not_an_array = await GodotIapPlugin.get_available_purchases()
	_assert_equal(not_an_array.size(), 0, "Non-array envelopes should degrade to an empty purchase list")
	_uninstall_fake()


func test_android_active_subscriptions_envelope() -> void:
	var fake = _install_android_fake()
	fake.responses["getActiveSubscriptions"] = JSON.stringify([
		{
			"productId": "sub.gold",
			"isActive": true,
			"transactionId": "txn-11",
			"transactionDate": 1720000000000.0,
			"autoRenewingAndroid": true,
		},
	])

	var subscriptions = await GodotIapPlugin.get_active_subscriptions()
	_assert_equal(subscriptions.size(), 1, "Subscription envelopes should map to typed results")
	_assert_true(subscriptions[0] is Types.ActiveSubscription, "Entries should be ActiveSubscription")
	_assert_equal(subscriptions[0].product_id, "sub.gold", "Subscription fields should survive the envelope")
	_assert_equal(subscriptions[0].auto_renewing_android, true, "Android-only fields should survive the envelope")
	_assert_equal(fake.last_args[0], null, "An empty filter should be sent to Android as null")

	var filter: Array[String] = ["sub.gold"]
	await GodotIapPlugin.get_active_subscriptions(filter)
	_assert_equal(fake.last_args[0], JSON.stringify(["sub.gold"]), "Non-empty filters should serialize to JSON")
	_uninstall_fake()


func test_android_has_active_subscriptions_envelope() -> void:
	var fake = _install_android_fake()
	fake.responses["hasActiveSubscriptions"] = JSON.stringify({"hasActive": true})
	_assert_true(await GodotIapPlugin.has_active_subscriptions(), "hasActive envelopes should map to true")

	# A malformed envelope must fall back to counting active subscriptions.
	fake.responses["hasActiveSubscriptions"] = "[]"
	fake.responses["getActiveSubscriptions"] = JSON.stringify([
		{"productId": "sub.gold", "isActive": true, "transactionId": "txn-12", "transactionDate": 1.0},
	])
	_assert_true(await GodotIapPlugin.has_active_subscriptions(), "Malformed envelopes should fall back to the subscription list")
	_uninstall_fake()


func test_android_alternative_billing_envelopes() -> void:
	var fake = _install_android_fake()

	fake.responses["checkAlternativeBillingAvailabilityAndroid"] = JSON.stringify({"isAvailable": true})
	_assert_true(GodotIapPlugin.check_alternative_billing_availability_android(), "isAvailable envelopes should map to true")
	fake.responses["checkAlternativeBillingAvailabilityAndroid"] = "[]"
	_assert_false(GodotIapPlugin.check_alternative_billing_availability_android(), "Malformed envelopes should map to false")

	fake.responses["createAlternativeBillingTokenAndroid"] = JSON.stringify({"success": true, "token": "abt-1"})
	_assert_equal(GodotIapPlugin.create_alternative_billing_token_android(), "abt-1", "Token envelopes should return the token")
	fake.responses["createAlternativeBillingTokenAndroid"] = JSON.stringify({"success": false})
	_assert_equal(GodotIapPlugin.create_alternative_billing_token_android(), "", "Failed token envelopes should return an empty string")

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
	fake.responses["getStorefrontIOS"] = "0"
	var errors: Array[Dictionary] = []
	var capture_error = func(error: Dictionary) -> void:
		errors.append(error)
	GodotIapPlugin.purchase_error.connect(capture_error)

	_assert_equal(await GodotIapPlugin.get_storefront_ios(), "", "Payloads without a requestId should fail closed")
	_assert_equal(errors.size(), 1, "Payloads without a requestId should emit purchase_error")
	_assert_equal(errors[0].get("code"), "service-error", "Missing requestId should map to service-error")
	_assert_true(
		str(errors[0].get("message", "")).contains("did not return a requestId"),
		"The missing requestId should be diagnosed in the error message"
	)

	GodotIapPlugin.purchase_error.disconnect(capture_error)
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
