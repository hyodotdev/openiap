extends Node
class_name GodotIapWrapper

## GodotIap - Cross-platform in-app purchase plugin for Godot
##
## Provides unified API for:
## - Google Play Billing (Android)
## - App Store / StoreKit 2 (iOS)
##
## @see https://openiap.dev/docs/apis

# Types from OpenIAP spec
const Types = preload("types.gd")

# ==========================================
# Signals (OpenIAP Events)
# ==========================================
signal purchase_updated(purchase: Dictionary)
signal purchase_error(error: Dictionary)
signal products_fetched(result: Dictionary)
signal connected()
signal disconnected()
signal promoted_product_ios(product_id: String)
signal user_choice_billing_android(details: Dictionary)
signal developer_provided_billing_android(details: Dictionary)

## Subscription billing-issue event (cross-platform).
##
## Emitted when an active subscription needs user attention for a payment
## problem. Unifies StoreKit 2 [code]Message.Reason.billingIssue[/code] (iOS / Mac Catalyst 16.4+, visionOS 1.0+)
## and Google Play Billing [code]Purchase.isSuspended[/code] (Play Billing 8.1+).
## Not emitted on the Meta Horizon flavor.
signal subscription_billing_issue(purchase: Dictionary)

# Native plugin reference
var _native_plugin: Object = null
var _is_connected: bool = false
static var _is_initialized: bool = false
var _purchase_updated_listener_options: Dictionary = {}
var _ios_async_results: Dictionary = {}

# Platform detection
var _platform: String = ""

func _ready() -> void:
	if _is_initialized:
		return
	_is_initialized = true
	_platform = OS.get_name()
	_init_native_plugin()

func _init_native_plugin() -> void:
	print("[GodotIap] Initializing native plugin...")
	print("[GodotIap] Platform: ", _platform)

	# iOS/macOS: Try ClassDB for SwiftGodot GDExtension
	if _platform == "iOS" or _platform == "macOS":
		if ClassDB.class_exists("GodotIap") and ClassDB.can_instantiate("GodotIap"):
			_native_plugin = ClassDB.instantiate("GodotIap")
			if _native_plugin:
				print("[GodotIap] Native plugin loaded via ClassDB (", _platform, ")")
				_connect_signals_ios()
				return

	# Android: Try GodotIap singleton
	if _platform == "Android":
		print("[GodotIap] Checking for Android singleton...")
		if Engine.has_singleton("GodotIap"):
			_native_plugin = Engine.get_singleton("GodotIap")
			print("[GodotIap] Native plugin loaded via Engine singleton (Android)")
			print("[GodotIap] Plugin class: ", _native_plugin.get_class())
			_connect_signals_android()
			return
		else:
			print("[GodotIap] ERROR: GodotIap singleton not found!")

	# No native plugin available - desktop/editor mode
	print("[GodotIap] Native plugin not available - running in no native plugin")
	print("[GodotIap] This is expected when running in the editor or on desktop")

func _connect_signals_ios() -> void:
	if not _native_plugin:
		return

	# iOS native plugin signals
	if _native_plugin.has_signal("purchase_updated"):
		_native_plugin.connect("purchase_updated", _on_native_purchase_updated)
	if _native_plugin.has_signal("purchase_error"):
		_native_plugin.connect("purchase_error", _on_native_purchase_error)
	if _native_plugin.has_signal("products_fetched"):
		_native_plugin.connect("products_fetched", _on_products_fetched)
	if _native_plugin.has_signal("connected"):
		_native_plugin.connect("connected", _on_connected)
	if _native_plugin.has_signal("disconnected"):
		_native_plugin.connect("disconnected", _on_disconnected)
	if _native_plugin.has_signal("promoted_product"):
		_native_plugin.connect("promoted_product", _on_native_promoted_product_ios)

	if _native_plugin.has_signal("subscription_billing_issue"):
		_native_plugin.connect("subscription_billing_issue", _on_native_subscription_billing_issue_ios)

func _connect_signals_android() -> void:
	if not _native_plugin:
		return

	print("[GodotIap] Connecting Android signals...")

	if _native_plugin.has_signal("purchase_updated"):
		_native_plugin.connect("purchase_updated", _on_android_purchase_updated)
		print("[GodotIap] Connected: purchase_updated")

	if _native_plugin.has_signal("purchase_error"):
		_native_plugin.connect("purchase_error", _on_android_purchase_error)
		print("[GodotIap] Connected: purchase_error")

	if _native_plugin.has_signal("products_fetched"):
		_native_plugin.connect("products_fetched", _on_android_products_fetched)
		print("[GodotIap] Connected: products_fetched")

	if _native_plugin.has_signal("connected"):
		_native_plugin.connect("connected", _on_connected)
		print("[GodotIap] Connected: connected")

	if _native_plugin.has_signal("disconnected"):
		_native_plugin.connect("disconnected", _on_disconnected)
		print("[GodotIap] Connected: disconnected")

	if _native_plugin.has_signal("user_choice_billing"):
		_native_plugin.connect("user_choice_billing", _on_android_user_choice_billing)
		print("[GodotIap] Connected: user_choice_billing")

	if _native_plugin.has_signal("developer_provided_billing"):
		_native_plugin.connect("developer_provided_billing", _on_android_developer_provided_billing)
		print("[GodotIap] Connected: developer_provided_billing")

	if _native_plugin.has_signal("subscription_billing_issue"):
		_native_plugin.connect("subscription_billing_issue", _on_android_subscription_billing_issue)
		print("[GodotIap] Connected: subscription_billing_issue")

	print("[GodotIap] Android signal connection complete")

# ==========================================
# Signal Handlers - iOS (SwiftGodot)
# ==========================================
func _on_native_purchase_updated(purchase: Dictionary) -> void:
	purchase_updated.emit(_canonical_purchase(purchase))

func _canonical_purchase(purchase: Dictionary) -> Dictionary:
	var purchase_json = purchase.get("purchaseJson")
	if purchase_json is String and not purchase_json.is_empty():
		var canonical = JSON.parse_string(purchase_json)
		if canonical is Dictionary:
			return canonical
	return purchase

func _on_native_purchase_error(error: Dictionary) -> void:
	purchase_error.emit(error)

func _on_products_fetched(result: Dictionary) -> void:
	var method = String(result.get("method", ""))
	var request_id = String(result.get("requestId", ""))
	if not method.is_empty() and not request_id.is_empty():
		_ios_async_results[_ios_async_result_key(method, request_id)] = result
	products_fetched.emit(result)

func _on_connected(_status_code: int = 0) -> void:
	_is_connected = true
	connected.emit()

func _on_disconnected(_status_code: int = 0) -> void:
	_is_connected = false
	disconnected.emit()

func _on_native_promoted_product_ios(product_id: String) -> void:
	promoted_product_ios.emit(product_id)

func _on_native_subscription_billing_issue_ios(purchase: Dictionary) -> void:
	subscription_billing_issue.emit(_canonical_purchase(purchase))

# ==========================================
# Signal Handlers - Android (JSON strings)
# ==========================================
func _on_android_purchase_updated(purchase_json: String) -> void:
	var purchase = JSON.parse_string(purchase_json)
	if purchase is Dictionary:
		purchase_updated.emit(purchase)

func _on_android_purchase_error(error_json: String) -> void:
	var error = JSON.parse_string(error_json)
	if error is Dictionary:
		purchase_error.emit(error)

func _on_android_products_fetched(result_json: String) -> void:
	var result = JSON.parse_string(result_json)
	if result is Dictionary:
		products_fetched.emit(result)

func _on_android_user_choice_billing(details_json: String) -> void:
	var details = JSON.parse_string(details_json)
	if details is Dictionary:
		user_choice_billing_android.emit(details)

func _on_android_developer_provided_billing(details_json: String) -> void:
	var details = JSON.parse_string(details_json)
	if details is Dictionary:
		developer_provided_billing_android.emit(details)

func _on_android_subscription_billing_issue(purchase_json: String) -> void:
	var purchase = JSON.parse_string(purchase_json)
	if purchase is Dictionary:
		subscription_billing_issue.emit(purchase)

# ==========================================
# Connection (OpenIAP Mutation)
# ==========================================

## Initialize the store connection. Must be called before any other IAP API.
##
## [param config]: optional [InitConnectionConfig]. On Android, set
## [code]enable_billing_program_android[/code] to Billing Choice and use
## [code]billing_choice_screen_type_android[/code] to match Play Console.
##
## Returns [code]true[/code] once the platform billing client is connected.
##
## [codeblock]
## var ok = await iap.init_connection()
## [/codeblock]
##
## See: https://openiap.dev/docs/apis/init-connection
func init_connection(config = null) -> bool:
	print("[GodotIap] init_connection called")
	if _native_plugin:
		if _platform == "Android":
			print("[GodotIap] Calling Android initConnection...")
			if config != null:
				var config_dict = config.to_dict() if typeof(config) == TYPE_OBJECT and config.has_method("to_dict") else config
				_is_connected = _native_plugin.call("initConnectionWithConfig", JSON.stringify(config_dict))
			else:
				_is_connected = _native_plugin.call("initConnection")
			if not _is_connected:
				print("[GodotIap] ERROR: initConnection failed. Check Google Play Services and billing setup.")
			else:
				print("[GodotIap] initConnection result: ", _is_connected)
		elif _platform == "iOS":
			print("[GodotIap] Calling iOS initConnection...")
			_apply_purchase_updated_listener_options_ios()
			var payload = await _call_ios_async("initConnection")
			_is_connected = payload.get("success", false)
			if not _is_connected:
				print("[GodotIap] ERROR: initConnection failed. Check StoreKit configuration.")
			else:
				print("[GodotIap] initConnection result: ", _is_connected)
		else:
			print("[GodotIap] No init method found, assuming connected")
			_is_connected = true
		return _is_connected
	# No native plugin available
	print("[GodotIap] ERROR: Cannot init connection — native plugin not available.")
	return false

## End the IAP connection.
## @return bool - true if disconnection was successful
##
## See: https://openiap.dev/docs/apis/end-connection
func end_connection() -> bool:
	print("[GodotIap] end_connection called")
	if _native_plugin:
		if _platform == "iOS":
			var payload = await _call_ios_async("endConnection")
			if not payload.get("success", false):
				return false
		else:
			var result = _native_plugin.call("endConnection")
			if not result:
				return false
		_is_connected = false
		return true
	_is_connected = false
	disconnected.emit()
	return true

## Check if connected to the store.
## @return bool - true if currently connected
func is_store_connected() -> bool:
	return _is_connected

## Configure purchase update listener options.
##
## On iOS, set [code]dedupe_transaction_ios[/code] to false to also receive
## StoreKit replay events for transaction IDs already delivered during the
## current connection session. Android ignores this flag.
func set_purchase_updated_listener_options(options = null) -> void:
	if typeof(options) == TYPE_OBJECT and options.has_method("to_dict"):
		_purchase_updated_listener_options = options.to_dict()
	elif options is Dictionary:
		_purchase_updated_listener_options = options
	else:
		_purchase_updated_listener_options = {}
	_apply_purchase_updated_listener_options_ios()

func _apply_purchase_updated_listener_options_ios() -> void:
	if _platform != "iOS" or not _native_plugin:
		return
	if not _native_plugin.has_method("setPurchaseUpdatedListenerOptions"):
		return
	_native_plugin.call(
		"setPurchaseUpdatedListenerOptions",
		JSON.stringify(_purchase_updated_listener_options)
	)

# ==========================================
# Products (OpenIAP Query)
# ==========================================

## Retrieve products or subscriptions from the store by SKU.
##
## [param request]: [ProductRequest] with [code]skus[/code] (Array[String]) and optional
## [code]type[/code] ([code]ProductQueryType.IN_APP[/code], [code]SUBS[/code], or [code]ALL[/code]).
##
## Returns an Array — typed as [Array] because GDScript can't express heterogeneous element
## types. The wrapper maps one-time products to [Types.ProductAndroid] / [Types.ProductIOS]
## and subscriptions to [Types.ProductSubscriptionAndroid] / [Types.ProductSubscriptionIOS].
##
## [codeblock]
## var request = ProductRequest.new()
## request.skus = ["com.app.coins_100", "com.app.premium"]
## request.type = ProductQueryType.IN_APP
## var products = await iap.fetch_products(request)
## [/codeblock]
##
## [b]Note:[/b] This is a regular awaitable call. Don't confuse with [code]request_*[/code]
## APIs (e.g. [method request_purchase]), which are event-based.
##
## See: https://openiap.dev/docs/apis/fetch-products
func fetch_products(request) -> Array:
	print("[GodotIap] fetch_products called")
	var result = await _fetch_products_raw(request.to_dict())
	var products: Array = []

	if result.has("products"):
		for product_dict in result["products"]:
			if product_dict is Dictionary:
				var product = _product_from_dict(product_dict)
				if product != null:
					products.append(product)

	return products


func _product_from_dict(product_dict: Dictionary) -> Variant:
	var raw_type = product_dict.get("type", "")
	var is_subscription = false
	if raw_type is String:
		is_subscription = raw_type.to_lower() in ["subs", "subscription", "subscriptions"]
	elif raw_type is int:
		is_subscription = raw_type == Types.ProductType.SUBS

	if _platform == "Android":
		if is_subscription:
			return Types.ProductSubscriptionAndroid.from_dict(product_dict)
		return Types.ProductAndroid.from_dict(product_dict)
	if _platform == "iOS":
		if is_subscription:
			return Types.ProductSubscriptionIOS.from_dict(product_dict)
		return Types.ProductIOS.from_dict(product_dict)
	return null

## Internal: Fetch products with raw Dictionary (for backward compatibility)
func _fetch_products_raw(request: Dictionary) -> Dictionary:
	print("[GodotIap] _fetch_products_raw called with: ", request)
	if _native_plugin:
		var request_json = JSON.stringify(request)
		if _platform == "Android":
			print("[GodotIap] Calling fetchProducts with: ", request_json)
			var result_json = _native_plugin.call("fetchProducts", request_json)
			var result = JSON.parse_string(result_json)
			if result is Dictionary:
				return result
			return { "products": [], "error": "Parse error" }
		elif _platform == "iOS":
			print("[GodotIap] Calling fetchProducts with: ", request_json)
			var signal_result = await _call_ios_async("fetchProducts", [request_json])
			var products_array: Array = []
			if signal_result.get("success", false):
				var products_json = signal_result.get("productsJson", "[]")
				var parsed = JSON.parse_string(products_json)
				if parsed is Array:
					products_array = parsed
			return {
				"products": products_array,
				"error": signal_result.get("error", "")
			}
	# No native plugin
	return { "products": [], "subscriptions": [] }

# ==========================================
# Purchases (OpenIAP Mutation)
# ==========================================

## Initiate a purchase or subscription flow. The result is delivered via the
## [signal purchase_updated] / [signal purchase_error] signals — NOT the return value.
##
## [param props]: [RequestPurchaseProps]. For one-time products, set
## [code]props.request.apple.sku[/code] and/or [code]props.request.google.skus[/code].
## For subscriptions, use [code]props.request_subscription[/code] with
## [code]RequestSubscriptionPropsByPlatforms[/code]; Android subscriptions normally also need
## [code]subscription_offers[/code].
##
## Returns the dispatched purchase payload — [b]do not rely on it[/b] for the outcome.
##
## [codeblock]
## var props = RequestPurchaseProps.new()
## props.request = RequestPurchasePropsByPlatforms.new()
## props.request.apple = RequestPurchaseIosProps.new()
## props.request.apple.sku = "com.app.premium"
## props.type = ProductQueryType.IN_APP
## await iap.request_purchase(props)
## [/codeblock]
##
## [b]Warning:[/b] Event-based. Connect to [signal purchase_updated] /
## [signal purchase_error] before calling this.
##
## See: https://openiap.dev/docs/apis/request-purchase
func request_purchase(props) -> Variant:
	var result = _request_purchase_raw(props.to_dict())
	if result.get("success", false):
		if _platform == "Android":
			return Types.PurchaseAndroid.from_dict(_normalize_android_purchase_dict(result))
		elif _platform == "iOS":
			return Types.PurchaseIOS.from_dict(_normalize_purchase_dict(result))
	return null

## Internal: Request a purchase with raw Dictionary
func _request_purchase_raw(args: Dictionary) -> Dictionary:
	print("[GodotIap] _request_purchase_raw called")
	if not _native_plugin:
		print("[GodotIap] ERROR: Native plugin not available. Cannot make purchases.")
		purchase_error.emit({ "code": "not-prepared", "message": "Native plugin not available" })
		return { "success": false, "error": "Native plugin not available" }

	# Support "requestPurchase", "requestSubscription", and legacy "request".
	var request = args.get("requestPurchase", args.get("requestSubscription", args.get("request", {})))
	var purchase_type = args.get("type", "in-app")

	var result_raw = null
	if _platform == "Android":
		# Android requestPurchase is async — returns a pending response, then
		# delivers the final state via purchase_updated / purchase_error.
		var google_props = request.get("google", request.get("android", {}))
		var offer_token = google_props.get("offerToken", google_props.get("offer_token", ""))
		var offer_token_arr: Array = []
		if not str(offer_token).is_empty():
			offer_token_arr.append(str(offer_token))
		var subscription_offers = google_props.get("subscriptionOffers", [])
		if subscription_offers.is_empty() and not str(offer_token).is_empty() and not google_props.get("skus", []).is_empty():
			subscription_offers = [{
				"sku": google_props.get("skus", [])[0],
				"offerToken": str(offer_token),
			}]
		var replacement_params = google_props.get("subscriptionProductReplacementParams", null)
		if typeof(replacement_params) == TYPE_OBJECT and replacement_params.has_method("to_dict"):
			replacement_params = replacement_params.to_dict()
		var developer_billing_option = google_props.get("developerBillingOption", null)
		if typeof(developer_billing_option) == TYPE_OBJECT and developer_billing_option.has_method("to_dict"):
			developer_billing_option = developer_billing_option.to_dict()
		var params = {
			"type": purchase_type,
			"skus": google_props.get("skus", []),
			"obfuscatedAccountId": google_props.get("obfuscatedAccountId", google_props.get("obfuscatedAccountIdAndroid", "")),
			"obfuscatedProfileId": google_props.get("obfuscatedProfileId", google_props.get("obfuscatedProfileIdAndroid", "")),
			"isOfferPersonalized": google_props.get("isOfferPersonalized", false),
			"offerTokenArr": offer_token_arr,
			"subscriptionOffers": subscription_offers,
			"purchaseToken": google_props.get("purchaseToken", google_props.get("purchaseTokenAndroid", "")),
			"originalExternalTransactionId": google_props.get("originalExternalTransactionId", ""),
			"replacementMode": google_props.get("replacementMode", google_props.get("replacementModeAndroid", 0)),
			"subscriptionProductReplacementParams": replacement_params,
			"developerBillingOption": developer_billing_option,
		}
		var params_json = JSON.stringify(params)
		print("[GodotIap] Calling Android requestPurchase: type=", purchase_type, ", skus=", params["skus"].size(), ", subscriptionOffers=", params["subscriptionOffers"].size(), ", hasPurchaseToken=", not str(params["purchaseToken"]).is_empty())
		result_raw = _native_plugin.call("requestPurchaseJson", params_json)
	elif _platform == "iOS":
		var apple_props = request.get("apple", request.get("ios", {}))
		var sku = apple_props.get("sku", "")
		if sku.is_empty():
			return { "success": false, "error": "Invalid request: SKU is required" }
		var ios_payload = { "type": purchase_type }
		if purchase_type == "subs":
			ios_payload["requestSubscription"] = { "apple": apple_props }
		else:
			ios_payload["requestPurchase"] = { "apple": apple_props }
		result_raw = _native_plugin.call("requestPurchaseWithPayload", JSON.stringify(ios_payload))
	else:
		return { "success": false, "error": "Unsupported platform" }

	if result_raw == null or str(result_raw) == "":
		var err_msg = "requestPurchase returned empty. Billing may not be connected."
		print("[GodotIap] ERROR: ", err_msg)
		purchase_error.emit({ "code": "service-error", "message": err_msg })
		return { "success": false, "error": err_msg }

	var result_json = str(result_raw)
	print("[GodotIap] requestPurchase result received")
	var result = JSON.parse_string(result_json)
	if result is Dictionary:
		if not result.get("success", false) and result.has("error"):
			print("[GodotIap] requestPurchase error: ", result.get("error"))
			purchase_error.emit({ "code": result.get("code", "unknown"), "message": result.get("error", "Unknown error") })
		return result
	print("[GodotIap] requestPurchase parse error")
	return { "success": false, "error": "Failed to parse response" }

## Complete a purchase transaction. Call after server-side verification.
##
## [param purchase]: the [Purchase] to finalize.
## [param is_consumable]: [code]true[/code] for consumables (re-buyable like coins),
## [code]false[/code] (default) for non-consumables and subscriptions.
##
## [codeblock]
## await iap.finish_transaction(purchase, false)
## [/codeblock]
##
## [b]Critical:[/b] Android purchases must be finalized within 3 days or Google auto-refunds.
## iOS unfinished transactions replay on every app launch.
##
## See: https://openiap.dev/docs/apis/finish-transaction
func finish_transaction(purchase, is_consumable: bool = false) -> Variant:
	print("[GodotIap] finish_transaction called, consumable: ", is_consumable)
	var result = await _finish_transaction_raw(purchase.to_dict(), is_consumable)
	return Types.VoidResult.from_dict(result)

## Finish transaction with raw Dictionary (convenience method).
## Use this when you have the purchase dictionary from purchase_updated signal.
## @param purchase: Dictionary - raw purchase dictionary with transactionId
## @param is_consumable: bool - whether to consume (true) or acknowledge (false)
## @return Types.VoidResult
func finish_transaction_dict(purchase: Dictionary, is_consumable: bool = false) -> Variant:
	print("[GodotIap] finish_transaction_dict called, consumable: ", is_consumable)
	var result = await _finish_transaction_raw(purchase, is_consumable)
	return Types.VoidResult.from_dict(result)

## Internal: Finish transaction with raw Dictionary
func _finish_transaction_raw(purchase: Dictionary, is_consumable: bool) -> Dictionary:
	print("[GodotIap] _finish_transaction_raw called for productId=", purchase.get("productId", ""), ", consumable: ", is_consumable)

	if not _native_plugin:
		return { "success": true }

	if _platform == "Android":
		# Use the Kotlin finishTransaction method which handles both consume and acknowledge
		# It internally calls store.finishTransaction(purchase, isConsumable) from OpenIAP
		var product_id = purchase.get("productId", "")
		if product_id.is_empty():
			return { "success": false, "error": "Product ID is required", "code": Types.ErrorCode.DEVELOPER_ERROR }

		var purchase_json = JSON.stringify(purchase)
		print("[GodotIap] Calling Android finishTransaction for productId=", product_id, ", isConsumable: ", is_consumable)

		# Note: has_method() doesn't work reliably with JNISingleton, so we call directly
		var result_json = _native_plugin.call("finishTransaction", purchase_json, is_consumable)
		print("[GodotIap] finishTransaction result received")
		var result = JSON.parse_string(result_json)
		if result is Dictionary:
			return result
		return { "success": false, "error": "Parse error" }

	elif _platform == "iOS":
		var args = { "purchase": purchase, "isConsumable": is_consumable }
		var args_json = JSON.stringify(args)
		print("[GodotIap] Calling finishTransaction for productId=", purchase.get("productId", ""), ", isConsumable: ", is_consumable)
		return await _call_ios_async("finishTransaction", [args_json])

	return { "success": true }

## Restore completed transactions.
## iOS: Performs a lightweight sync then fetches available purchases.
## Android: Simply fetches available purchases.
## @return Types.VoidResult
##
## See: https://openiap.dev/docs/apis/restore-purchases
func restore_purchases() -> Variant:
	print("[GodotIap] restore_purchases called")

	if _platform == "iOS" and _native_plugin:
		var payload = await _call_ios_async("restorePurchases")
		var ios_result = Types.VoidResult.new()
		ios_result.success = payload.get("success", false)
		return ios_result

	await get_available_purchases()
	var result = Types.VoidResult.new()
	result.success = true
	return result

## List the user's unfinished purchases — non-consumables, active subscriptions, and any
## pending transactions not finished previously.
##
## [param options] (optional): [PurchaseOptions]. iOS-only flags
## ([code]also_publish_to_event_listener_ios[/code], [code]only_include_active_items_ios[/code]).
##
## Returns [Array][[Purchase]] currently held by the store.
##
## [codeblock]
## var purchases = await iap.get_available_purchases()
## for purchase in purchases:
##     if await verify_on_server(purchase):
##         await iap.finish_transaction(purchase, false)
## [/codeblock]
##
## See: https://openiap.dev/docs/apis/get-available-purchases
func get_available_purchases(options = null) -> Array:
	print("[GodotIap] get_available_purchases called")
	var raw_purchases = await _get_available_purchases_raw(options)
	var purchases: Array = []

	for purchase_dict in raw_purchases:
		if purchase_dict is Dictionary:
			if _platform == "Android":
				purchases.append(Types.PurchaseAndroid.from_dict(_normalize_android_purchase_dict(purchase_dict)))
			elif _platform == "iOS":
				purchases.append(Types.PurchaseIOS.from_dict(_normalize_purchase_dict(purchase_dict)))

	return purchases


func _normalize_purchase_dict(purchase_dict: Dictionary) -> Dictionary:
	var normalized := purchase_dict.duplicate()
	if normalized.has("ids") and normalized["ids"] is Array:
		var typed_ids: Array[String] = []
		for id in normalized["ids"]:
			if id != null:
				typed_ids.append(str(id))
		normalized["ids"] = typed_ids
	return normalized


func _normalize_android_purchase_dict(purchase_dict: Dictionary) -> Dictionary:
	var normalized := _normalize_purchase_dict(purchase_dict)
	if not normalized.has("isAcknowledgedAndroid") and normalized.has("isAcknowledged"):
		normalized["isAcknowledgedAndroid"] = normalized["isAcknowledged"]
	return normalized


func _as_dictionary(value) -> Dictionary:
	if is_instance_valid(value) and value.has_method("to_dict"):
		return value.to_dict()
	if value is Dictionary:
		return value
	return {}


## Internal: Get available purchases raw
func _get_available_purchases_raw(options = null) -> Array:
	if _native_plugin:
		var options_dict := _as_dictionary(options)
		if _platform == "Android":
			var result_json
			if options == null:
				result_json = _native_plugin.call("getAvailablePurchases")
			else:
				result_json = _native_plugin.call(
					"getAvailablePurchasesWithOptions",
					JSON.stringify(options_dict)
				)
			var result = JSON.parse_string(result_json)
			if result is Array:
				return result
			return []
		elif _platform == "iOS":
			var payload = await _call_ios_async(
				"getAvailablePurchases",
				[JSON.stringify(options_dict)]
			)
			if payload.get("success", false):
				var purchases = JSON.parse_string(payload.get("purchasesJson", "[]"))
				if purchases is Array:
					return purchases
			return []
	# No native plugin
	return []

# ==========================================
# Subscriptions (OpenIAP Query)
# ==========================================

## Get active subscriptions.
## @param subscription_ids: Array[String] - optional array of subscription IDs to filter
## @return Array[Types.ActiveSubscription]
##
## See: https://openiap.dev/docs/apis/get-active-subscriptions
func get_active_subscriptions(subscription_ids: Array[String] = []) -> Array:
	print("[GodotIap] get_active_subscriptions called")
	var raw_subs = await _get_active_subscriptions_raw(subscription_ids)
	var subscriptions: Array = []

	for sub_dict in raw_subs:
		if sub_dict is Dictionary:
			subscriptions.append(Types.ActiveSubscription.from_dict(sub_dict))

	return subscriptions

## Internal: Get active subscriptions raw
func _get_active_subscriptions_raw(subscription_ids: Array = []) -> Array:
	if _native_plugin:
		if _platform == "Android":
			var ids_json = JSON.stringify(subscription_ids) if subscription_ids.size() > 0 else null
			var result_json = _native_plugin.call("getActiveSubscriptions", ids_json)
			var result = JSON.parse_string(result_json)
			if result is Array:
				return result
			return []
		elif _platform == "iOS":
			var ids_json = JSON.stringify(subscription_ids) if subscription_ids.size() > 0 else ""
			var payload = await _call_ios_async("getActiveSubscriptions", [ids_json])
			if payload.get("success", false):
				var subscriptions = JSON.parse_string(payload.get("subscriptionsJson", "[]"))
				if subscriptions is Array:
					return subscriptions
			return []
	# No native plugin
	return []

## Check if user has any active subscriptions.
## @param subscription_ids: Array[String] - optional array of subscription IDs to check
## @return bool - true if any subscription is active
##
## See: https://openiap.dev/docs/apis/has-active-subscriptions
func has_active_subscriptions(subscription_ids: Array[String] = []) -> bool:
	print("[GodotIap] has_active_subscriptions called")
	if _native_plugin and (_platform == "Android" or _platform == "iOS"):
		var ids_json = JSON.stringify(subscription_ids) if subscription_ids.size() > 0 else ("" if _platform == "iOS" else null)
		var result = null
		if _platform == "iOS":
			result = await _call_ios_async("hasActiveSubscriptions", [ids_json])
		else:
			result = JSON.parse_string(_native_plugin.call("hasActiveSubscriptions", ids_json))
		if result is Dictionary:
			return result.get("hasActive", false)
	# Fallback: check manually
	var subscriptions = await get_active_subscriptions(subscription_ids)
	for sub in subscriptions:
		if sub.is_active:
			return true
	return false

# ==========================================
# Storefront (OpenIAP Query)
# ==========================================

## Get the current storefront country code.
## @return String - country code (e.g., "US" on Android, "USA" on Apple)
##
## See: https://openiap.dev/docs/apis/get-storefront
func get_storefront() -> String:
	print("[GodotIap] get_storefront called")
	if not _native_plugin:
		var unavailable_code = "not-prepared" if _platform == "Android" or _platform == "iOS" else "feature-not-supported"
		purchase_error.emit({
			"code": unavailable_code,
			"message": "Storefront lookup requires a native store plugin",
		})
		return ""
	if _platform == "iOS":
		return await get_storefront_ios()
	if _platform != "Android":
		purchase_error.emit({
			"code": "feature-not-supported",
			"message": "Storefront lookup is not supported on %s" % _platform,
		})
		return ""

	var result_json = _native_plugin.call("getStorefrontAndroid")
	var result = JSON.parse_string(result_json)
	if result is Dictionary and result.get("success", false):
		var country_code = String(result.get("countryCode", "")).strip_edges()
		if not country_code.is_empty():
			return country_code

	var error_code = "service-error"
	var error_message = "Storefront lookup returned no country code"
	if result is Dictionary:
		error_code = String(result.get("code", error_code))
		if not result.get("success", false):
			error_message = String(result.get("error", "Storefront lookup failed"))
	elif result_json == null or String(result_json).is_empty():
		error_message = "Storefront native method returned no response"
	else:
		error_message = "Storefront native method returned an invalid response"
	purchase_error.emit({
		"code": error_code,
		"message": error_message,
		"platform": "android",
	})
	return ""

# ==========================================
# Verification (OpenIAP Mutation)
# ==========================================

## Verify a purchase locally.
## @param props: Types.VerifyPurchaseProps - verification properties
## @return Types.VerifyPurchaseResultIOS or Types.VerifyPurchaseResultAndroid, or null on failure
##
## See: https://openiap.dev/docs/features/validation#verify-purchase
func verify_purchase(props) -> Variant:
	print("[GodotIap] verify_purchase called")
	var props_dict := _as_dictionary(props)
	if _native_plugin and _platform == "iOS":
		var payload = await _call_ios_async("verifyPurchase", [JSON.stringify(props_dict)])
		if payload is Dictionary and payload.get("success", false):
			var payload_json = payload.get("resultJson", "")
			var decoded = JSON.parse_string(payload_json)
			if decoded is Dictionary:
				return Types.VerifyPurchaseResultIOS.from_dict(decoded)
		return null

	var result = _verify_purchase_raw(props_dict)
	if result.get("success", false) or result.get("isValid", false):
		if _platform == "Android":
			return Types.VerifyPurchaseResultAndroid.from_dict(result)
	return null

## Internal: Verify purchase with raw Dictionary
func _verify_purchase_raw(props: Dictionary) -> Dictionary:
	if _native_plugin and _platform == "Android":
		var props_json = JSON.stringify(props)
		var result_json = _native_plugin.call("verifyPurchase", props_json)
		var result = JSON.parse_string(result_json)
		if result is Dictionary:
			return result
	# No native plugin
	return { "isValid": false, "error": "Not available in no native plugin" }

## Verify a purchase using external provider (IAPKit).
## @param props: Types.VerifyPurchaseWithProviderProps - provider verification properties
## @return Types.VerifyPurchaseWithProviderResult
##
## See: https://openiap.dev/docs/features/validation#verify-purchase-with-provider
func verify_purchase_with_provider(props) -> Variant:
	print("[GodotIap] verify_purchase_with_provider called")
	var props_dict := _as_dictionary(props)
	if _native_plugin and _platform == "iOS":
		var payload = await _call_ios_async("verifyPurchaseWithProvider", [JSON.stringify(props_dict)])
		if payload is Dictionary and payload.get("success", false):
			var payload_json = payload.get("resultJson", "")
			var decoded = JSON.parse_string(payload_json)
			if decoded is Dictionary:
				return Types.VerifyPurchaseWithProviderResult.from_dict(decoded)
		return Types.VerifyPurchaseWithProviderResult.from_dict({
			"provider": props_dict.get("provider", "iapkit"),
			"errors": [
				{
					"code": "purchase-verification-failed",
					"message": payload.get("error", "Verification failed") if payload is Dictionary else "Verification failed",
				},
			],
		})

	var result = _verify_purchase_with_provider_raw(props_dict)
	return Types.VerifyPurchaseWithProviderResult.from_dict(result)

## Internal: Verify purchase with provider raw Dictionary
func _verify_purchase_with_provider_raw(props: Dictionary) -> Dictionary:
	if _native_plugin and _platform == "Android":
		var props_json = JSON.stringify(props)
		var result_json = _native_plugin.call("verifyPurchaseWithProvider", props_json)
		var result = JSON.parse_string(result_json)
		if result is Dictionary:
			return result
	# No native plugin
	return {
		"provider": props.get("provider", "iapkit"),
		"errors": [
			{
				"code": "feature-not-supported",
				"message": "Not available in no native plugin",
			},
		],
	}


# ==========================================
# iOS-Specific (OpenIAP)
# ==========================================

## Sync with App Store (iOS only).
## @return bool - true if the sync request completed successfully
##
## See: https://openiap.dev/docs/apis/ios/sync-ios
func sync_ios() -> bool:
	if not (_native_plugin and _platform == "iOS"):
		return false
	var payload = await _call_ios_async("syncIOS")
	return payload.get("success", false)

## Clear pending transactions from the StoreKit payment queue (iOS only).
## @return bool - true if pending transactions were cleared successfully
##
## See: https://openiap.dev/docs/apis/ios/clear-transaction-ios
func clear_transaction_ios() -> bool:
	if not (_native_plugin and _platform == "iOS"):
		return false
	var payload = await _call_ios_async("clearTransactionIOS")
	return payload.get("success", false)

## Get pending transactions (iOS only).
## @return Array[Types.PurchaseIOS]
##
## See: https://openiap.dev/docs/apis/ios/get-pending-transactions-ios
func get_pending_transactions_ios() -> Array:
	var purchases: Array = []
	if _native_plugin and _platform == "iOS":
		var payload = await _call_ios_async("getPendingTransactionsIOS")
		if payload.get("success", false):
			var transactions_json = payload.get("transactionsJson", "[]")
			var transactions = JSON.parse_string(transactions_json)
			if transactions is Array:
				for tx in transactions:
					if tx is Dictionary:
						purchases.append(Types.PurchaseIOS.from_dict(tx))
	return purchases

## Get all transactions including finished consumables (iOS only).
## Requires SKIncludeConsumableInAppPurchaseHistory Info.plist key for finished consumables (iOS 18+).
## @return Array of Types.PurchaseIOS
##
## See: https://openiap.dev/docs/apis/ios/get-all-transactions-ios
func get_all_transactions_ios() -> Array:
	var purchases: Array = []
	if _native_plugin and _platform == "iOS":
		var payload = await _call_ios_async("getAllTransactionsIOS")
		if payload.get("success", false):
			var transactions_json = payload.get("transactionsJson", "[]")
			var transactions = JSON.parse_string(transactions_json)
			if transactions is Array:
				for tx in transactions:
					if tx is Dictionary:
						purchases.append(Types.PurchaseIOS.from_dict(tx))
	return purchases

## Present code redemption sheet (iOS only).
## @return bool - true if the sheet was presented successfully
##
## See: https://openiap.dev/docs/apis/ios/present-code-redemption-sheet-ios
func present_code_redemption_sheet_ios() -> bool:
	if not (_native_plugin and _platform == "iOS"):
		return false
	var payload = await _call_ios_async("presentCodeRedemptionSheetIOS")
	return payload.get("success", false)

## Show manage subscriptions UI (iOS only).
## @return Array[Types.PurchaseIOS] - changed purchases
##
## See: https://openiap.dev/docs/apis/ios/show-manage-subscriptions-ios
func show_manage_subscriptions_ios() -> Array:
	var purchases: Array = []
	if _native_plugin and _platform == "iOS":
		var payload = await _call_ios_async("showManageSubscriptionsIOS")
		if payload.get("success", false):
			var purchases_json = payload.get("purchasesJson", "[]")
			var parsed = JSON.parse_string(purchases_json)
			if parsed is Array:
				for p in parsed:
					if p is Dictionary:
						purchases.append(Types.PurchaseIOS.from_dict(p))
	return purchases

## Begin refund request (iOS only).
## @param product_id: String - the product ID to request refund for
## @return String - refund request status, or empty string on failure
##
## See: https://openiap.dev/docs/apis/ios/begin-refund-request-ios
func begin_refund_request_ios(product_id: String) -> String:
	if not (_native_plugin and _platform == "iOS"):
		return ""
	var payload = await _call_ios_async("beginRefundRequestIOS", [product_id])
	if payload.get("success", false):
		return payload.get("status", "")
	return ""

## Get current entitlement for a product (iOS only).
## @param sku: String - product SKU
## @return Types.PurchaseIOS or null
##
## See: https://openiap.dev/docs/apis/ios/current-entitlement-ios
func current_entitlement_ios(sku: String) -> Variant:
	if _native_plugin and _platform == "iOS":
		var payload = await _call_ios_async("currentEntitlementIOS", [sku])
		if payload.get("success", false):
			var purchase_json = payload.get("purchaseJson", "null")
			if purchase_json != "null":
				var parsed = JSON.parse_string(purchase_json)
				if parsed is Dictionary:
					return Types.PurchaseIOS.from_dict(parsed)
	return null

## Get the latest transaction for a product (iOS only).
## @param sku: String - product SKU
## @return Types.PurchaseIOS or null
##
## See: https://openiap.dev/docs/apis/ios/latest-transaction-ios
func latest_transaction_ios(sku: String) -> Variant:
	if _native_plugin and _platform == "iOS":
		var payload = await _call_ios_async("latestTransactionIOS", [sku])
		if payload.get("success", false):
			var purchase_json = payload.get("purchaseJson", "null")
			if purchase_json != "null":
				var parsed = JSON.parse_string(purchase_json)
				if parsed is Dictionary:
					return Types.PurchaseIOS.from_dict(parsed)
	return null

## Get app transaction (iOS 16+).
## @return Types.AppTransaction or null
##
## See: https://openiap.dev/docs/apis/ios/get-app-transaction-ios
func get_app_transaction_ios() -> Variant:
	if _native_plugin and _platform == "iOS":
		var payload = await _call_ios_async("getAppTransactionIOS")
		if payload.get("success", false):
			var app_transaction_json = payload.get("appTransactionJson", "{}")
			var app_transaction = JSON.parse_string(app_transaction_json)
			if app_transaction is Dictionary:
				return Types.AppTransaction.from_dict(app_transaction)
	return null

## Get subscription status (iOS only).
## @param sku: String - product SKU
## @return Array[Types.SubscriptionStatusIOS]
##
## See: https://openiap.dev/docs/apis/ios/subscription-status-ios
func subscription_status_ios(sku: String) -> Array:
	var statuses: Array = []
	if _native_plugin and _platform == "iOS":
		var payload = await _call_ios_async("subscriptionStatusIOS", [sku])
		if payload.get("success", false):
			var statuses_json = payload.get("statusesJson", "[]")
			var parsed = JSON.parse_string(statuses_json)
			if parsed is Array:
				for s in parsed:
					if s is Dictionary:
						statuses.append(Types.SubscriptionStatusIOS.from_dict(s))
	return statuses

## Check if eligible for intro offer (iOS only).
## @param group_id: String - subscription group ID
## @return bool - true if eligible for introductory offer
##
## See: https://openiap.dev/docs/apis/ios/is-eligible-for-intro-offer-ios
func is_eligible_for_intro_offer_ios(group_id: String) -> bool:
	if _native_plugin and _platform == "iOS":
		var payload = await _call_ios_async("isEligibleForIntroOfferIOS", [group_id])
		return payload.get("success", false) and payload.get("isEligible", false)
	return false

## Get promoted product (iOS only).
## @return Types.ProductIOS or null
##
## See: https://openiap.dev/docs/apis/ios/get-promoted-product-ios
func get_promoted_product_ios() -> Variant:
	if _native_plugin and _platform == "iOS":
		var payload = await _call_ios_async("getPromotedProductIOS")
		if payload.get("success", false):
			var product_json = payload.get("productJson", "null")
			if product_json != "null":
				var parsed = JSON.parse_string(product_json)
				if parsed is Dictionary:
					return Types.ProductIOS.from_dict(parsed)
	return null

## Request purchase on promoted product (iOS only).
## @return bool - true if the promoted product purchase request succeeded
##
## See: https://openiap.dev/docs/apis/ios/request-purchase-on-promoted-product-ios
func request_purchase_on_promoted_product_ios() -> bool:
	if not (_native_plugin and _platform == "iOS"):
		return false
	var payload = await _call_ios_async("requestPurchaseOnPromotedProductIOS")
	return payload.get("success", false)

## Check if can present external purchase notice (iOS 18.2+).
## @return bool - true if external purchase notice can be presented
##
## See: https://openiap.dev/docs/apis/ios/can-present-external-purchase-notice-ios
func can_present_external_purchase_notice_ios() -> bool:
	if _native_plugin and _platform == "iOS":
		var payload = await _call_ios_async("canPresentExternalPurchaseNoticeIOS")
		return payload.get("success", false) and payload.get("canPresent", false)
	return false

## Present external purchase notice sheet (iOS 18.2+).
## @return Types.ExternalPurchaseNoticeResultIOS
##
## See: https://openiap.dev/docs/apis/ios/present-external-purchase-notice-sheet-ios
func present_external_purchase_notice_sheet_ios() -> Variant:
	if _native_plugin and _platform == "iOS":
		var payload = await _call_ios_async("presentExternalPurchaseNoticeSheetIOS")
		if payload.get("success", false):
			var decoded = JSON.parse_string(payload.get("resultJson", "{}"))
			if decoded is Dictionary:
				return Types.ExternalPurchaseNoticeResultIOS.from_dict(decoded)
	var default_result = Types.ExternalPurchaseNoticeResultIOS.new()
	return default_result

## Present external purchase link (iOS 18.2+).
## @param url: String - external purchase URL
## @return Types.ExternalPurchaseLinkResultIOS
##
## See: https://openiap.dev/docs/apis/ios/present-external-purchase-link-ios
func present_external_purchase_link_ios(url: String) -> Variant:
	if _native_plugin and _platform == "iOS":
		var payload = await _call_ios_async("presentExternalPurchaseLinkIOS", [url])
		if payload.get("success", false):
			var decoded = JSON.parse_string(payload.get("resultJson", "{}"))
			if decoded is Dictionary:
				return Types.ExternalPurchaseLinkResultIOS.from_dict(decoded)
	var default_result = Types.ExternalPurchaseLinkResultIOS.new()
	return default_result

## Get receipt data (iOS only).
## @return String - receipt data as base64
##
## See: https://openiap.dev/docs/apis/ios/get-receipt-data-ios
func get_receipt_data_ios() -> String:
	if _native_plugin and _platform == "iOS":
		var payload = await _call_ios_async("getReceiptDataIOS")
		if payload.get("success", false):
			return payload.get("receiptData", "")
	return ""

## Check if transaction is verified (iOS only).
## @param sku: String - product SKU
## @return bool - true if transaction is verified
##
## See: https://openiap.dev/docs/apis/ios/is-transaction-verified-ios
func is_transaction_verified_ios(sku: String) -> bool:
	if _native_plugin and _platform == "iOS":
		var payload = await _call_ios_async("isTransactionVerifiedIOS", [sku])
		return payload.get("success", false) and payload.get("isVerified", false)
	return false

## Get transaction JWS (iOS only).
## @param sku: String - product SKU
## @return String - JWS representation of the transaction
##
## See: https://openiap.dev/docs/apis/ios/get-transaction-jws-ios
func get_transaction_jws_ios(sku: String) -> String:
	if _native_plugin and _platform == "iOS":
		var payload = await _call_ios_async("getTransactionJwsIOS", [sku])
		if payload.get("success", false):
			return payload.get("jws", "")
	return ""

## Await the completion matching the native method and request token.
func _await_products_fetched_for(method: String, request_id: String) -> Dictionary:
	var cache_key = _ios_async_result_key(method, request_id)
	while true:
		if _ios_async_results.has(cache_key):
			var cached = _ios_async_results[cache_key]
			_ios_async_results.erase(cache_key)
			return cached as Dictionary
		var payload = await products_fetched
		if payload is Dictionary \
				and payload.get("method", "") == method \
				and payload.get("requestId", "") == request_id:
			_ios_async_results.erase(cache_key)
			return payload as Dictionary
	return {}

## Dispatch an iOS native method that returns a pending request token, then
## await its method/requestId-tagged completion. Native completions are cached
## by `_on_products_fetched` so a very fast Swift Task cannot emit before this
## coroutine installs its signal waiter and get lost.
func _call_ios_async(method: String, args: Array = []) -> Dictionary:
	if not (_native_plugin and _platform == "iOS"):
		return {"success": false, "error": "iOS native plugin is unavailable"}
	var pending = _native_plugin.callv(method, args)
	var request_id = _parse_request_id(pending)
	if request_id.is_empty():
		if pending is String:
			var immediate = JSON.parse_string(pending)
			if immediate is Dictionary:
				return immediate
		return {"success": false, "error": "%s did not return a requestId" % method}
	return await _await_products_fetched_for(method, request_id)

func _ios_async_result_key(method: String, request_id: String) -> String:
	return "%s:%s" % [method, request_id]

## Extract the native `requestId` token from the synchronous "pending" JSON
## returned by a GDExtension @Callable, or empty string if missing.
func _parse_request_id(pending_json) -> String:
	if pending_json is String:
		var decoded = JSON.parse_string(pending_json)
		if decoded is Dictionary:
			return String(decoded.get("requestId", ""))
	return ""

## Get the current App Store storefront country code (iOS).
## The native method dispatches asynchronously and emits the result via
## `products_fetched`; this wrapper awaits that emit and returns the country
## code, so callers can use it like a synchronous getter.
## @deprecated Prefer cross-platform get_storefront() which also works on iOS.
## @return String ISO 3166-1 alpha-3 country code, or empty string on failure
##
## See: https://openiap.dev/docs/apis/ios/get-storefront-ios
func get_storefront_ios() -> String:
	if not (_native_plugin and _platform == "iOS"):
		return ""
	var payload = await _call_ios_async("getStorefrontIOS")
	if payload.get("success", false):
		var storefront = String(payload.get("storefront", "")).strip_edges()
		if not storefront.is_empty():
			return storefront
	var error_message = String(payload.get("error", "Storefront lookup returned no country code"))
	purchase_error.emit({
		"code": String(payload.get("code", "service-error")),
		"message": error_message,
		"platform": "ios",
	})
	return ""

## Validate a receipt with the App Store for a specific SKU (iOS).
## Kicks off the native async validation and awaits the next `products_fetched`
## emit matching this call's requestId. Returns null on error.
## @deprecated Use verify_purchase or verify_purchase_with_provider instead.
## @param props: Types.VerifyPurchaseProps with `apple: {sku: String}` set
## @return Variant Types.VerifyPurchaseResultIOS on success, null otherwise
##
## See: https://openiap.dev/docs/apis/ios/validate-receipt-ios
func validate_receipt_ios(props) -> Variant:
	if not (_native_plugin and _platform == "iOS"):
		return null
	var props_dict := _as_dictionary(props)
	var props_json = JSON.stringify(props_dict)
	var payload = await _call_ios_async("validateReceiptIOS", [props_json])
	if payload.get("success", false):
		var payload_json = payload.get("resultJson", "")
		var decoded = JSON.parse_string(payload_json)
		if decoded is Dictionary:
			return Types.VerifyPurchaseResultIOS.from_dict(decoded)
	return null

## Cross-platform wrapper for receipt validation.
## @deprecated Use verify_purchase instead.
## @param props: Types.VerifyPurchaseProps with platform-specific fields
## @return Variant Types.VerifyPurchaseResultIOS | Types.VerifyPurchaseResultAndroid | null
##
## See: https://openiap.dev/docs/apis/validate-receipt
func validate_receipt(props) -> Variant:
	if _platform == "iOS":
		return await validate_receipt_ios(props)
	if _platform == "Android":
		# Android path is synchronous via the `verifyPurchase` native call.
		var props_dict := _as_dictionary(props)
		var raw = _verify_purchase_raw(props_dict)
		if raw.get("success", false) or raw.get("isValid", false):
			return Types.VerifyPurchaseResultAndroid.from_dict(raw)
	return null

## ExternalPurchaseCustomLink: check eligibility (iOS 18.1+).
## Kicks off the native async check and awaits the next `products_fetched`
## emit tagged with method == "isEligibleForExternalPurchaseCustomLinkIOS";
## returns false on any error.
## @return bool true if the current context can show external purchase custom link
##
## See: https://openiap.dev/docs/apis/ios/is-eligible-for-external-purchase-custom-link-ios
func is_eligible_for_external_purchase_custom_link_ios() -> bool:
	if not (_native_plugin and _platform == "iOS"):
		return false
	var payload = await _call_ios_async("isEligibleForExternalPurchaseCustomLinkIOS")
	if payload.get("success", false):
		return bool(payload.get("eligible", false))
	return false

## ExternalPurchaseCustomLink: request a token for Apple reporting (iOS 18.1+).
## Kicks off the native async request and awaits the next `products_fetched`
## emit tagged with method == "getExternalPurchaseCustomLinkTokenIOS".
## Returns null on error or on unsupported platforms (i.e. iOS < 18.1).
## @param token_type: String "acquisition" | "services"
## @return Variant Types.ExternalPurchaseCustomLinkTokenResultIOS or null
##
## See: https://openiap.dev/docs/apis/ios/get-external-purchase-custom-link-token-ios
func get_external_purchase_custom_link_token_ios(token_type: String) -> Variant:
	if not (_native_plugin and _platform == "iOS"):
		return null
	var payload = await _call_ios_async("getExternalPurchaseCustomLinkTokenIOS", [token_type])
	if payload.get("success", false):
		var payload_json = payload.get("resultJson", "")
		var decoded = JSON.parse_string(payload_json)
		if decoded is Dictionary:
			return Types.ExternalPurchaseCustomLinkTokenResultIOS.from_dict(decoded)
	return null

## ExternalPurchaseCustomLink: show the disclosure notice sheet (iOS 18.1+).
## Kicks off the native async UI and awaits the next `products_fetched` emit
## tagged with method == "showExternalPurchaseCustomLinkNoticeIOS". Returns
## null on error.
## @param notice_type: String "browser"
## @return Variant Types.ExternalPurchaseCustomLinkNoticeResultIOS or null
##
## See: https://openiap.dev/docs/apis/ios/show-external-purchase-custom-link-notice-ios
func show_external_purchase_custom_link_notice_ios(notice_type: String) -> Variant:
	if not (_native_plugin and _platform == "iOS"):
		return null
	var payload = await _call_ios_async("showExternalPurchaseCustomLinkNoticeIOS", [notice_type])
	if payload.get("success", false):
		var payload_json = payload.get("resultJson", "")
		var decoded = JSON.parse_string(payload_json)
		if decoded is Dictionary:
			return Types.ExternalPurchaseCustomLinkNoticeResultIOS.from_dict(decoded)
	return null

# ==========================================
# Android-Specific (OpenIAP)
# ==========================================

## Acknowledge a purchase (Android only, for non-consumables).
## @param purchase_token: String - the purchase token to acknowledge
## @return bool - true if the purchase was acknowledged successfully
##
## See: https://openiap.dev/docs/apis/android/acknowledge-purchase-android
func acknowledge_purchase_android(purchase_token: String) -> bool:
	var result = _acknowledge_purchase_android_raw(purchase_token)
	return result.get("success", false)

## Internal: Acknowledge purchase raw
func _acknowledge_purchase_android_raw(purchase_token: String) -> Dictionary:
	print("[GodotIap] _acknowledge_purchase_android_raw tokenPresent=", not purchase_token.is_empty())
	if _native_plugin and _platform == "Android":
		print("[GodotIap] Calling acknowledgePurchaseAndroid...")
		var result_json = _native_plugin.call("acknowledgePurchaseAndroid", purchase_token)
		var result = JSON.parse_string(result_json)
		if result is Dictionary:
			return result
	return { "success": false, "error": "Not available" }

## Consume a purchase (Android only, for consumables).
## @param purchase_token: String - the purchase token to consume
## @return bool - true if the purchase was consumed successfully
##
## See: https://openiap.dev/docs/apis/android/consume-purchase-android
func consume_purchase_android(purchase_token: String) -> bool:
	var result = _consume_purchase_android_raw(purchase_token)
	return result.get("success", false)

## Internal: Consume purchase raw
func _consume_purchase_android_raw(purchase_token: String) -> Dictionary:
	print("[GodotIap] _consume_purchase_android_raw tokenPresent=", not purchase_token.is_empty())
	if _native_plugin and _platform == "Android":
		print("[GodotIap] Calling consumePurchaseAndroid...")
		var result_json = _native_plugin.call("consumePurchaseAndroid", purchase_token)
		var result = JSON.parse_string(result_json)
		if result is Dictionary:
			return result
	return { "success": false, "error": "Not available" }

## Check alternative billing availability (Android).
## @return bool - true if alternative billing is available
##
## See: https://openiap.dev/docs/apis/android/check-alternative-billing-availability-android
func check_alternative_billing_availability_android() -> bool:
	if _native_plugin and _platform == "Android":
		var result_json = _native_plugin.call("checkAlternativeBillingAvailabilityAndroid")
		var result = JSON.parse_string(result_json)
		if result is Dictionary:
			return result.get("isAvailable", false)
	return false

## Show alternative billing dialog (Android).
## @return bool - true if the user accepted the dialog
##
## See: https://openiap.dev/docs/apis/android/show-alternative-billing-dialog-android
func show_alternative_billing_dialog_android() -> bool:
	if _native_plugin and _platform == "Android":
		var result_json = _native_plugin.call("showAlternativeBillingDialogAndroid")
		var result = JSON.parse_string(result_json)
		if result is Dictionary:
			return result.get("userAccepted", false)
	return false

## Create alternative billing token (Android).
## @return String - reporting token, or empty string on failure
##
## See: https://openiap.dev/docs/apis/android/create-alternative-billing-token-android
func create_alternative_billing_token_android() -> String:
	if _native_plugin and _platform == "Android":
		var result_json = _native_plugin.call("createAlternativeBillingTokenAndroid")
		var result = JSON.parse_string(result_json)
		if result is Dictionary and result.get("success", false):
			return result.get("token", "")
	return ""

## Check if a billing program is available (Android 8.2.0+).
## @param billing_program: Types.BillingProgramAndroid - billing program enum value
## @return Types.BillingProgramAvailabilityResultAndroid
##
## See: https://openiap.dev/docs/apis/android/is-billing-program-available-android
func is_billing_program_available_android(billing_program) -> Variant:
	if _native_plugin and _platform == "Android":
		var result_json = _native_plugin.call("isBillingProgramAvailableAndroid", _billing_program_to_raw(billing_program))
		var result = JSON.parse_string(result_json)
		if result is Dictionary:
			return Types.BillingProgramAvailabilityResultAndroid.from_dict(result)
	var default_result = Types.BillingProgramAvailabilityResultAndroid.new()
	default_result.is_available = false
	default_result.billing_program = billing_program
	return default_result

func _billing_program_to_raw(billing_program) -> Variant:
	if typeof(billing_program) == TYPE_INT and Types.BILLING_PROGRAM_ANDROID_VALUES.has(billing_program):
		return Types.BILLING_PROGRAM_ANDROID_VALUES[billing_program]
	return billing_program

func _developer_billing_type_to_raw(developer_billing_type) -> Variant:
	if typeof(developer_billing_type) == TYPE_INT and Types.DEVELOPER_BILLING_TYPE_ANDROID_VALUES.has(developer_billing_type):
		return Types.DEVELOPER_BILLING_TYPE_ANDROID_VALUES[developer_billing_type]
	return developer_billing_type

## Fetch Play Billing assets and loyalty text for developer-rendered Billing Choice screens (Android 9.1.0+).
## @param params: Types.GetBillingChoiceInfoParamsAndroid - Billing Choice info parameters
## @return Types.BillingChoiceInfoAndroid
##
## See: https://openiap.dev/docs/apis/android/get-billing-choice-info-android
func get_billing_choice_info_android(params) -> Variant:
	if _native_plugin and _platform == "Android":
		var params_json = JSON.stringify(params.to_dict())
		var result_json = _native_plugin.call("getBillingChoiceInfoAndroid", params_json)
		var result = JSON.parse_string(result_json)
		if result is Dictionary:
			return Types.BillingChoiceInfoAndroid.from_dict(result)
	return Types.BillingChoiceInfoAndroid.new()

## Launch external link (Android 8.2.0+).
## @param params: Types.LaunchExternalLinkParamsAndroid - external link parameters
## @return bool - true if the external link flow was accepted/launched
##
## See: https://openiap.dev/docs/apis/android/launch-external-link-android
func launch_external_link_android(params) -> bool:
	if _native_plugin and _platform == "Android":
		var params_json = JSON.stringify(params.to_dict())
		var result_json = _native_plugin.call("launchExternalLinkAndroid", params_json)
		var result = JSON.parse_string(result_json)
		if result is Dictionary:
			return bool(result.get("launched", result.get("success", false)))
	return false

## Create billing program reporting details (Android 8.2.0+).
## @param billing_program: Types.BillingProgramAndroid - billing program enum value
## @param developer_billing_type: Types.DeveloperBillingTypeAndroid or null
## @return Types.BillingProgramReportingDetailsAndroid
##
## See: https://openiap.dev/docs/apis/android/create-billing-program-reporting-details-android
func create_billing_program_reporting_details_android(billing_program, developer_billing_type = null) -> Variant:
	if _native_plugin and _platform == "Android":
		var result_json: String
		if developer_billing_type == null:
			result_json = _native_plugin.call("createBillingProgramReportingDetailsAndroid", _billing_program_to_raw(billing_program))
		else:
			result_json = _native_plugin.call("createBillingProgramReportingDetailsAndroidWithType", JSON.stringify({
				"billingProgram": _billing_program_to_raw(billing_program),
				"developerBillingType": _developer_billing_type_to_raw(developer_billing_type)
			}))
		var result = JSON.parse_string(result_json)
		if result is Dictionary:
			return Types.BillingProgramReportingDetailsAndroid.from_dict(result)
	var default_result = Types.BillingProgramReportingDetailsAndroid.new()
	default_result.billing_program = billing_program
	return default_result

## Show Google's mandatory information dialog before a developer-rendered,
## in-app Billing Choice screen (Android 9.1.0+).
## @param params: Types.BillingProgramInformationDialogParamsAndroid
## @return Types.BillingResultAndroid
##
## See: https://openiap.dev/docs/apis/android/show-billing-program-information-dialog-android
func show_billing_program_information_dialog_android(params) -> Variant:
	if _native_plugin and _platform == "Android":
		var result_json = _native_plugin.call("showBillingProgramInformationDialogAndroid", JSON.stringify(params.to_dict()))
		var result = JSON.parse_string(result_json)
		if result is Dictionary:
			return Types.BillingResultAndroid.from_dict(result)
	return Types.BillingResultAndroid.new()

## Show Play Billing in-app messages (Android).
## @param params: Types.InAppMessageParamsAndroid or null
## @return Types.InAppMessageResultAndroid
##
## See: https://openiap.dev/docs/apis/android/show-in-app-messages-android
func show_in_app_messages_android(params = null) -> Variant:
	if _native_plugin and _platform == "Android":
		var params_dict = params.to_dict() if params != null and params is Object and params.has_method("to_dict") else {}
		var result_json = _native_plugin.call("showInAppMessagesAndroid", JSON.stringify(params_dict))
		var result = JSON.parse_string(result_json)
		if result is Dictionary:
			return Types.InAppMessageResultAndroid.from_dict(result)
	var default_result = Types.InAppMessageResultAndroid.new()
	default_result.response_code = Types.InAppMessageResponseCodeAndroid.NO_ACTION_NEEDED
	return default_result

## Get the package name (Android only).
## @return String - Android package name
func get_package_name_android() -> String:
	if _native_plugin and _platform == "Android":
		return _native_plugin.call("getPackageNameAndroid")
	return ""

# ==========================================
# Deep Link (OpenIAP Mutation)
# ==========================================

## Open subscription management deep link.
## @param options: Types.DeepLinkOptions or null - optional deep link configuration
## @return Types.VoidResult
##
## See: https://openiap.dev/docs/apis/deep-link-to-subscriptions
func deep_link_to_subscriptions(options = null) -> Variant:
	var opts = options if options != null else Types.DeepLinkOptions.new()
	if _native_plugin and _platform == "Android":
		var android_options_json = JSON.stringify(opts.to_dict())
		var android_result_json = _native_plugin.call("deepLinkToSubscriptions", android_options_json)
		var android_result = JSON.parse_string(android_result_json)
		if android_result is Dictionary:
			return Types.VoidResult.from_dict(android_result)
	elif _native_plugin and _platform == "iOS":
		var ios_options_json = JSON.stringify(opts.to_dict())
		var ios_payload = await _call_ios_async("deepLinkToSubscriptions", [ios_options_json])
		return Types.VoidResult.from_dict(ios_payload)
	elif _platform == "iOS":
		# iOS: Open App Store subscription management URL
		OS.shell_open("https://apps.apple.com/account/subscriptions")
		var ios_fallback_result = Types.VoidResult.new()
		ios_fallback_result.success = true
		return ios_fallback_result
	elif _platform == "Android":
		# Android: Open Play Store subscription management URL
		var sku = opts.sku_android if opts.sku_android else ""
		var package_name = opts.package_name_android if opts.package_name_android else get_package_name_android()
		if not sku.is_empty() and not package_name.is_empty():
			var encoded_sku = sku.uri_encode()
			var encoded_package = package_name.uri_encode()
			OS.shell_open("https://play.google.com/store/account/subscriptions?sku=%s&package=%s" % [encoded_sku, encoded_package])
		else:
			OS.shell_open("https://play.google.com/store/account/subscriptions")
		var android_fallback_result = Types.VoidResult.new()
		android_fallback_result.success = true
		return android_fallback_result
	var unavailable_result = Types.VoidResult.new()
	unavailable_result.success = false
	return unavailable_result

# ==========================================
# Utility Functions
# ==========================================

## Get current platform
## Returns "Android", "iOS", "macOS", etc.
func get_platform() -> String:
	return _platform

## Check if running in no native plugin (no native plugin)
func is_stub_mode() -> bool:
	return _native_plugin == null

## Get the current store type
## Returns Types.IapStore enum value
func get_store() -> Variant:
	if _platform == "Android":
		return Types.IapStore.GOOGLE
	elif _platform == "iOS":
		return Types.IapStore.APPLE
	return Types.IapStore.UNKNOWN

## Create a PurchaseError object
## @param code: Types.ErrorCode enum value
## @param message: Error message
## @param product_id: Optional product ID
## Returns Types.PurchaseError
func create_purchase_error(code, message: String, product_id: String = "") -> Variant:
	var error = Types.PurchaseError.new()
	error.code = code
	error.message = message
	error.product_id = product_id
	return error
