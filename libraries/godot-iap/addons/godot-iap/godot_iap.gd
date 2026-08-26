extends Node
class_name GodotIapWrapper

## GodotIap - Cross-platform in-app purchase plugin for Godot
##
## Provides unified API for:
## - Google Play Billing (Android)
## - App Store / StoreKit 2 (iOS and macOS)
##
## @see https://openiap.dev/docs/apis

# Types from OpenIAP spec
const Types = preload("types.gd")

const APPLE_PLATFORMS := ["iOS", "macOS"]
const APPLE_ASYNC_RESULT_CACHE_LIMIT := 64
const APPLE_ASYNC_TERMINAL_CACHE_LIMIT := 128


class AppleAsyncWaiter:
	extends RefCounted
	signal completed(payload: Dictionary)
	var is_completed := false
	var _timeout_timer = null
	var _timeout_callback := Callable()

	func arm_timeout(timer, callback: Callable) -> void:
		_timeout_timer = timer
		_timeout_callback = callback
		timer.timeout.connect(callback, CONNECT_ONE_SHOT)

	func complete(payload: Dictionary) -> void:
		if is_completed:
			return
		is_completed = true
		if _timeout_timer != null \
			and _timeout_timer.timeout.is_connected(_timeout_callback):
			_timeout_timer.timeout.disconnect(_timeout_callback)
		_timeout_timer = null
		_timeout_callback = Callable()
		completed.emit(payload)

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
var _apple_async_results: Dictionary = {}
var _apple_async_result_order: Array[String] = []
var _apple_async_waiters: Dictionary = {}
var _apple_async_terminal_keys: Dictionary = {}
var _apple_async_terminal_order: Array[String] = []
var _apple_async_cancellation_generation := 0
var _apple_async_timeout_seconds := 30.0
var _apple_async_restore_timeout_seconds := 120.0
var _apple_async_ui_timeout_seconds := 300.0

# Platform detection
var _platform: String = ""


func _is_apple() -> bool:
	return _platform in APPLE_PLATFORMS


func _ready() -> void:
	if _is_initialized:
		return
	_is_initialized = true
	_platform = OS.get_name()
	_init_native_plugin()


func _exit_tree() -> void:
	_cancel_pending_apple_async(
		"service-disconnected",
		"The IAP wrapper left the scene tree before the Apple operation completed"
	)

func _init_native_plugin() -> void:
	print("[GodotIap] Initializing native plugin...")
	print("[GodotIap] Platform: ", _platform)

	# iOS/macOS: Try ClassDB for SwiftGodot GDExtension
	if _is_apple():
		if ClassDB.class_exists("GodotIap") and ClassDB.can_instantiate("GodotIap"):
			_native_plugin = ClassDB.instantiate("GodotIap")
			if _native_plugin:
				print("[GodotIap] Native plugin loaded via ClassDB (", _platform, ")")
				_connect_signals_apple()
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

func _connect_signals_apple() -> void:
	if not _native_plugin:
		return

	# Apple native plugin signals
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
		_native_plugin.connect("subscription_billing_issue", _on_native_subscription_billing_issue_apple)

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
# Signal Handlers - Apple (SwiftGodot)
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
		var cache_key := _apple_async_result_key(method, request_id)
		if _apple_async_terminal_keys.has(cache_key):
			return
		if _apple_async_waiters.has(cache_key):
			var waiter = _apple_async_waiters[cache_key]
			if waiter is AppleAsyncWaiter:
				waiter.complete(result)
		elif not _apple_async_terminal_keys.has(cache_key):
			_cache_apple_async_result(cache_key, result)
	products_fetched.emit(result)

func _on_connected(_status_code: int = 0) -> void:
	_is_connected = true
	connected.emit()

func _on_disconnected(_status_code: int = 0) -> void:
	_is_connected = false
	_cancel_pending_apple_async(
		"service-disconnected",
		"The store disconnected before the Apple operation completed",
		"endConnection"
	)
	disconnected.emit()

func _on_native_promoted_product_ios(product_id: String) -> void:
	promoted_product_ios.emit(product_id)

func _on_native_subscription_billing_issue_apple(purchase: Dictionary) -> void:
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
		elif _is_apple():
			print("[GodotIap] Calling Apple initConnection...")
			_apply_purchase_updated_listener_options_apple()
			var payload = await _call_apple_async("initConnection")
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
		if _is_apple():
			_cancel_pending_apple_async(
				"service-disconnected",
				"The store connection ended before the Apple operation completed"
			)
			var payload = await _call_apple_async("endConnection")
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
## On Apple platforms, set [code]dedupe_transaction_ios[/code] to false to also receive
## StoreKit replay events for transaction IDs already delivered during the
## current connection session. Android ignores this flag.
func set_purchase_updated_listener_options(options = null) -> void:
	if typeof(options) == TYPE_OBJECT and options.has_method("to_dict"):
		_purchase_updated_listener_options = options.to_dict()
	elif options is Dictionary:
		_purchase_updated_listener_options = options
	else:
		_purchase_updated_listener_options = {}
	_apply_purchase_updated_listener_options_apple()

func _apply_purchase_updated_listener_options_apple() -> void:
	if not _is_apple() or not _native_plugin:
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


func _normalize_product_query_type(raw_type, default_type: String, allow_all: bool = true) -> String:
	if raw_type == null or str(raw_type).strip_edges().is_empty():
		return default_type
	var normalized := str(raw_type).strip_edges().to_lower()
	match normalized:
		"in-app":
			return "in-app"
		"subs":
			return "subs"
		"all":
			if allow_all:
				return "all"
	push_error(
		"[GodotIap] Unknown product query type `%s`. Expected `in-app`, `subs`, or `all`."
		% str(raw_type)
	)
	return ""


func _product_from_dict(product_dict: Dictionary) -> Variant:
	var raw_type = product_dict.get("type", "")
	var is_subscription = false
	if raw_type is String:
		is_subscription = raw_type.to_lower() == "subs"
	elif raw_type is int:
		is_subscription = raw_type == Types.ProductType.SUBS

	if _platform == "Android":
		if is_subscription:
			return Types.ProductSubscriptionAndroid.from_dict(product_dict)
		return Types.ProductAndroid.from_dict(product_dict)
	if _is_apple():
		if is_subscription:
			return Types.ProductSubscriptionIOS.from_dict(product_dict)
		return Types.ProductIOS.from_dict(product_dict)
	return null

## Internal: Fetch products with a native Dictionary payload.
func _fetch_products_raw(request: Dictionary) -> Dictionary:
	print("[GodotIap] _fetch_products_raw called with: ", request)
	if _native_plugin:
		var normalized_request := request.duplicate(true)
		var query_type := _normalize_product_query_type(
			normalized_request.get("type", "all"),
			"all"
		)
		if query_type.is_empty():
			return { "products": [], "error": "Invalid product query type" }
		normalized_request["type"] = query_type
		var request_json = JSON.stringify(normalized_request)
		if _platform == "Android":
			print("[GodotIap] Calling fetchProducts with: ", request_json)
			var result_json = _native_plugin.call("fetchProducts", request_json)
			var result = JSON.parse_string(result_json)
			if result is Dictionary:
				return result
			return { "products": [], "error": "Parse error" }
		elif _is_apple():
			print("[GodotIap] Calling fetchProducts with: ", request_json)
			var signal_result = await _call_apple_async("fetchProducts", [request_json])
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
	var result = _request_purchase_raw(_as_dictionary(props))
	if result.get("status", "") == "pending" or result.get("pending", false):
		return null
	if result.get("success", false):
		if _platform == "Android":
			return Types.PurchaseAndroid.from_dict(_normalize_android_purchase_dict(result))
		elif _is_apple():
			return Types.PurchaseIOS.from_dict(_normalize_purchase_dict(result))
		# A success envelope on an unrecognized platform cannot be mapped to a
		# typed purchase. Report it instead of returning a bare null, which is
		# the silent-failure shape this contract forbids.
		_purchase_failure(
			"feature-not-supported",
			"Purchase succeeded on an unsupported platform: %s" % _platform
		)
	return null


func _is_nonempty_string_array(value) -> bool:
	if not value is Array:
		return false
	if value.is_empty():
		return false
	for item in value:
		if not item is String or item.is_empty():
			return false
	return true


func _is_valid_subscription_offer_array(value, requested_skus: Array) -> bool:
	if not value is Array:
		return false
	if value.is_empty():
		return true
	var requested := {}
	for sku in requested_skus:
		requested[sku] = true
	var offered := {}
	for item in value:
		if typeof(item) == TYPE_OBJECT and item.has_method("to_dict"):
			item = item.to_dict()
		if not item is Dictionary:
			return false
		if not item.get("sku") is String or item.get("sku").is_empty():
			return false
		if not item.get("offerToken") is String or item.get("offerToken").is_empty():
			return false
		var sku = item["sku"]
		if not requested.has(sku):
			return false
		offered[sku] = true
	for sku in requested:
		if not offered.has(sku):
			return false
	return true


func _purchase_failure(code: String, message: String, details: Dictionary = {}) -> Dictionary:
	var error_payload := {
		"code": code,
		"message": message,
	}
	for key in details:
		if key not in ["success", "error", "code", "message"]:
			error_payload[key] = details[key]
	purchase_error.emit(error_payload)
	var result := error_payload.duplicate()
	result["success"] = false
	result["error"] = message
	return result

## Internal: Request a purchase with raw Dictionary
func _request_purchase_raw(args: Dictionary) -> Dictionary:
	print("[GodotIap] _request_purchase_raw called")
	if not _native_plugin:
		print("[GodotIap] ERROR: Native plugin not available. Cannot make purchases.")
		return _purchase_failure("not-prepared", "Native plugin not available")

	if args.has("requestPurchase") and args.has("requestSubscription"):
		return _purchase_failure(
			"developer-error",
			"Invalid request: choose either requestPurchase or requestSubscription"
		)
	if not args.has("requestPurchase") and not args.has("requestSubscription"):
		return _purchase_failure(
			"developer-error",
			"Invalid request: requestPurchase or requestSubscription is required"
		)
	var request = args.get("requestPurchase", args.get("requestSubscription"))
	if not request is Dictionary:
		return _purchase_failure(
			"developer-error",
			"Invalid request: platform payload must be a Dictionary"
		)
	var default_purchase_type := "subs" if args.has("requestSubscription") else "in-app"
	var purchase_type := _normalize_product_query_type(
		args.get("type", default_purchase_type),
		default_purchase_type,
		false
	)
	if purchase_type.is_empty():
		return _purchase_failure("developer-error", "Invalid purchase type")
	if args.has("requestPurchase") and purchase_type != "in-app":
		return _purchase_failure("developer-error", "requestPurchase requires type `in-app`")
	if args.has("requestSubscription") and purchase_type != "subs":
		return _purchase_failure("developer-error", "requestSubscription requires type `subs`")

	var result_raw = null
	if _platform == "Android":
		# Android requestPurchase is async — returns a pending response, then
		# delivers the final state via purchase_updated / purchase_error.
		var google_props = request.get("google", {})
		if not google_props is Dictionary:
			return _purchase_failure(
				"developer-error",
				"Invalid request: google payload must be a Dictionary"
			)
		if not google_props.has("skus") or not _is_nonempty_string_array(google_props["skus"]):
			return _purchase_failure(
				"developer-error",
				"Invalid request: skus must contain only non-empty strings"
			)
		var offer_token = google_props.get("offerToken", "")
		if offer_token == null:
			offer_token = ""
		elif not offer_token is String:
			return _purchase_failure(
				"developer-error",
				"Invalid request: offerToken must be a string"
			)
		if google_props.has("offerToken") and google_props["offerToken"] != null and purchase_type != "in-app":
			return _purchase_failure(
				"developer-error",
				"Invalid request: offerToken requires type `in-app`"
			)
		var has_subscription_offers = (
			google_props.has("subscriptionOffers") and google_props["subscriptionOffers"] != null
		)
		var subscription_offers = google_props.get("subscriptionOffers", [])
		if subscription_offers == null:
			subscription_offers = []
		if not _is_valid_subscription_offer_array(subscription_offers, google_props["skus"]):
			return _purchase_failure(
				"developer-error",
				"Invalid request: subscriptionOffers must contain sku and offerToken strings"
			)
		if has_subscription_offers and purchase_type != "subs":
			return _purchase_failure(
				"developer-error",
				"Invalid request: subscriptionOffers requires type `subs`"
			)
		var has_replacement_params = (
			google_props.has("subscriptionProductReplacementParams")
			and google_props["subscriptionProductReplacementParams"] != null
		)
		var replacement_params = google_props.get("subscriptionProductReplacementParams", null)
		if has_replacement_params and purchase_type != "subs":
			return _purchase_failure(
				"developer-error",
				"Invalid request: subscriptionProductReplacementParams requires type `subs`"
			)
		if typeof(replacement_params) == TYPE_OBJECT and replacement_params.has_method("to_dict"):
			replacement_params = replacement_params.to_dict()
		var has_developer_billing_option = (
			google_props.has("developerBillingOption") and google_props["developerBillingOption"] != null
		)
		var developer_billing_option = google_props.get("developerBillingOption", null)
		if typeof(developer_billing_option) == TYPE_OBJECT and developer_billing_option.has_method("to_dict"):
			developer_billing_option = developer_billing_option.to_dict()
		for field in ["purchaseToken", "originalExternalTransactionId"]:
			var value = google_props.get(field, null)
			if value != null and not value is String:
				return _purchase_failure(
					"developer-error",
					"Invalid request: %s must be a string" % field
				)
			if google_props.has(field) and value != null and purchase_type != "subs":
				return _purchase_failure(
					"developer-error",
					"Invalid request: %s requires type `subs`" % field
				)
		var params = {
			"type": purchase_type,
			"skus": google_props.get("skus", []),
			"obfuscatedAccountId": google_props.get("obfuscatedAccountId", ""),
			"obfuscatedProfileId": google_props.get("obfuscatedProfileId", ""),
			"isOfferPersonalized": google_props.get("isOfferPersonalized", false),
		}
		if has_subscription_offers:
			params["subscriptionOffers"] = subscription_offers
		if has_replacement_params:
			params["subscriptionProductReplacementParams"] = replacement_params
		if has_developer_billing_option:
			params["developerBillingOption"] = developer_billing_option
		for field in ["purchaseToken", "originalExternalTransactionId"]:
			if google_props.has(field) and google_props[field] != null:
				params[field] = google_props[field]
		if purchase_type == "in-app" and not offer_token.is_empty():
			params["offerToken"] = offer_token
		var params_json = JSON.stringify(params)
		print("[GodotIap] Calling Android requestPurchase: type=", purchase_type, ", skus=", params["skus"].size(), ", subscriptionOffers=", subscription_offers.size(), ", hasPurchaseToken=", params.has("purchaseToken"))
		result_raw = _native_plugin.call("requestPurchase", params_json)
	elif _is_apple():
		var apple_props = request.get("apple", {})
		if not apple_props is Dictionary:
			return _purchase_failure(
				"developer-error",
				"Invalid request: apple payload must be a Dictionary"
			)
		var sku = apple_props.get("sku", "")
		if sku.is_empty():
			return _purchase_failure("developer-error", "Invalid request: SKU is required")
		var apple_payload = { "type": purchase_type }
		if purchase_type == "subs":
			apple_payload["requestSubscription"] = { "apple": apple_props }
		else:
			apple_payload["requestPurchase"] = { "apple": apple_props }
		result_raw = _native_plugin.call("requestPurchaseWithPayload", JSON.stringify(apple_payload))
	else:
		return _purchase_failure("feature-not-supported", "Unsupported platform")

	if result_raw == null or str(result_raw) == "":
		var err_msg = "requestPurchase returned empty. Billing may not be connected."
		print("[GodotIap] ERROR: ", err_msg)
		return _purchase_failure("service-error", err_msg)

	var result_json = str(result_raw)
	print("[GodotIap] requestPurchase result received")
	var result = JSON.parse_string(result_json)
	if result is Dictionary:
		if result.get("success", false):
			return result
		if result.get("status", "") == "pending":
			return result
		var error_message := String(
			result.get("error", "requestPurchase returned an unsuccessful response")
		)
		print("[GodotIap] requestPurchase error: ", error_message)
		return _purchase_failure(
			String(result.get("code", "unknown")),
			error_message,
			result
		)
	print("[GodotIap] requestPurchase parse error")
	return _purchase_failure("service-error", "Failed to parse response")

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
## Unfinished StoreKit transactions replay on every app launch.
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

	elif _is_apple():
		var args = { "purchase": purchase, "isConsumable": is_consumable }
		var args_json = JSON.stringify(args)
		print("[GodotIap] Calling finishTransaction for productId=", purchase.get("productId", ""), ", isConsumable: ", is_consumable)
		return await _call_apple_async("finishTransaction", [args_json])

	return { "success": true }

## Restore completed transactions.
## Apple platforms: Performs a lightweight sync then fetches available purchases.
## Android: Simply fetches available purchases.
## @return Types.VoidResult
##
## See: https://openiap.dev/docs/apis/restore-purchases
func restore_purchases() -> Variant:
	print("[GodotIap] restore_purchases called")

	if _is_apple() and _native_plugin:
		var payload = await _call_apple_async(
			"restorePurchases",
			[],
			_apple_async_restore_timeout_seconds
		)
		var apple_result = Types.VoidResult.new()
		apple_result.success = payload.get("success", false)
		# The non-Apple path below reports a failed restore through
		# purchase_error. Emit it here too, otherwise a caller that only
		# listens to the signal sees Android restore failures but not Apple ones.
		if not apple_result.success:
			_purchase_failure(
				String(payload.get("code", "service-error")),
				String(payload.get("error", "Failed to restore purchases")),
				payload
			)
		return apple_result

	var available_result := await get_available_purchases_result()
	var result = Types.VoidResult.new()
	result.success = available_result.get("success", false)
	if not result.success:
		_purchase_failure(
			String(available_result.get("code", "service-error")),
			String(available_result.get("error", "Failed to restore purchases")),
			available_result
		)
	return result

## List the user's unfinished purchases — non-consumables, active subscriptions, and any
## pending transactions not finished previously.
##
## [param options] (optional): [PurchaseOptions]. Apple-platform flags
## ([code]also_publish_to_event_listener_ios[/code], [code]only_include_active_items_ios[/code]).
##
## Returns [Array][[Purchase]] currently held by the store. This compatibility
## method maps native/bridge failures to an empty array. Entitlement and restore
## flows must use [method get_available_purchases_result] so a failure cannot be
## mistaken for an authoritative empty store result.
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
	var result := await get_available_purchases_result(options)
	return result.get("purchases", []) if result.get("success", false) else []


## List available purchases while preserving the distinction between an
## authoritative empty store result and a store/bridge failure.
##
## Returns a Dictionary with `success`, `purchases`, and, on failure, `code`
## plus `error`. Neither this method nor [method get_available_purchases] emits
## [signal purchase_error] — entitlement reads are queries, not purchase
## attempts, so callers own the failure policy. The difference is the return
## shape: [method get_available_purchases] collapses a failure into an empty
## array, while this method preserves it.
func get_available_purchases_result(options = null) -> Dictionary:
	print("[GodotIap] get_available_purchases_result called")
	var raw_result := await _get_available_purchases_result_raw(options)
	if not raw_result.get("success", false):
		return raw_result

	var raw_purchases = raw_result.get("purchases", [])
	var purchases: Array = []

	for purchase_dict in raw_purchases:
		if _platform == "Android":
			purchases.append(Types.PurchaseAndroid.from_dict(_normalize_android_purchase_dict(purchase_dict)))
		elif _is_apple():
			purchases.append(Types.PurchaseIOS.from_dict(_normalize_purchase_dict(purchase_dict)))

	return {
		"success": true,
		"purchases": purchases,
	}


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


## Internal compatibility helper. Prefer `_get_available_purchases_result_raw`
## so failures cannot be mistaken for an authoritative empty result.
func _get_available_purchases_raw(options = null) -> Array:
	var result := await _get_available_purchases_result_raw(options)
	if result.get("success", false):
		return result.get("purchases", [])
	return []


func _get_available_purchases_result_raw(options = null) -> Dictionary:
	if not _native_plugin:
		return {
			"success": false,
			"code": "not-prepared",
			"error": "Native plugin not available",
		}

	var options_dict := _as_dictionary(options)
	if _platform == "Android":
		var result_json
		if options == null:
			result_json = _native_plugin.call("getAvailablePurchasesResult")
		else:
			result_json = _native_plugin.call(
				"getAvailablePurchasesResultWithOptions",
				JSON.stringify(options_dict)
			)
		var result = JSON.parse_string(result_json)
		if not result is Dictionary:
			return {
				"success": false,
				"code": "billing-response-json-parse-error",
				"error": "Failed to parse the Android available-purchases response",
			}
		if not result.get("success", false):
			return {
				"success": false,
				"code": String(result.get("code", "service-error")),
				"error": String(result.get("error", "Failed to get available purchases")),
			}
		return _validated_purchase_batch(result.get("purchases", null), "Android")

	if _is_apple():
		var payload = await _call_apple_async(
			"getAvailablePurchases",
			[JSON.stringify(options_dict)]
		)
		if not payload.get("success", false):
			return {
				"success": false,
				"code": String(payload.get("code", "service-error")),
				"error": String(payload.get("error", "Failed to get available purchases")),
			}
		var purchases = JSON.parse_string(payload.get("purchasesJson", ""))
		return _validated_purchase_batch(purchases, _platform)

	return {
		"success": false,
		"code": "feature-not-supported",
		"error": "Unsupported platform",
	}


func _validated_purchase_batch(value, platform_name: String) -> Dictionary:
	if not value is Array:
		return {
			"success": false,
			"code": "billing-response-json-parse-error",
			"error": "%s returned a malformed available-purchases payload" % platform_name,
		}
	for item in value:
		if not _is_valid_purchase_dictionary(item):
			return {
				"success": false,
				"code": "billing-response-json-parse-error",
				"error": "%s returned a malformed purchase item" % platform_name,
			}
	return {
		"success": true,
		"purchases": value,
	}


func _is_valid_purchase_dictionary(value) -> bool:
	if not value is Dictionary:
		return false
	for required_string in ["id", "productId", "store", "purchaseState"]:
		if not value.get(required_string) is String \
			or String(value.get(required_string)).is_empty():
			return false
	var store := String(value.get("store"))
	if _is_apple() and store != "apple":
		return false
	if _platform == "Android" and store not in ["google", "amazon", "horizon"]:
		return false
	var transaction_date = value.get("transactionDate")
	if not transaction_date is float and not transaction_date is int:
		return false
	if transaction_date is float and not is_finite(transaction_date):
		return false
	var quantity = value.get("quantity")
	if not quantity is int and not (
		quantity is float \
		and is_finite(quantity) \
		and quantity == floor(quantity)
	):
		return false
	if not value.get("isAutoRenewing") is bool:
		return false
	if value.has("ids"):
		if not value.get("ids") is Array:
			return false
		for id in value.get("ids"):
			if not id is String:
				return false
	for optional_object in [
		"pendingPurchaseUpdateAndroid",
		"offerIOS",
		"renewalInfoIOS",
		"commitmentInfoIOS",
		"advancedCommerceInfoIOS",
	]:
		if value.has(optional_object) \
			and value.get(optional_object) != null \
			and not value.get(optional_object) is Dictionary:
			return false
	if _is_apple() and (
		not value.get("transactionId") is String \
		or String(value.get("transactionId")).is_empty()
	):
		return false
	return true

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
	var result := await get_active_subscriptions_result(subscription_ids)
	return result.get("subscriptions", []) if result.get("success", false) else []


## Get active subscriptions while preserving store and bridge failures.
## Returns `success`, `subscriptions`, and, on failure, `code` plus `error`.
func get_active_subscriptions_result(
	subscription_ids: Array[String] = []
) -> Dictionary:
	print("[GodotIap] get_active_subscriptions_result called")
	var raw_result := await _get_active_subscriptions_result_raw(subscription_ids)
	if not raw_result.get("success", false):
		return raw_result

	var subscriptions: Array = []
	for sub_dict in raw_result.get("subscriptions", []):
		subscriptions.append(Types.ActiveSubscription.from_dict(sub_dict))
	return {
		"success": true,
		"subscriptions": subscriptions,
	}

## Internal: Get active subscriptions raw
func _get_active_subscriptions_raw(subscription_ids: Array = []) -> Array:
	var result := await _get_active_subscriptions_result_raw(subscription_ids)
	if result.get("success", false):
		return result.get("subscriptions", [])
	return []


func _get_active_subscriptions_result_raw(subscription_ids: Array = []) -> Dictionary:
	if not _native_plugin:
		return {
			"success": false,
			"code": "not-prepared",
			"error": "Native plugin not available",
		}
	var ids_json = JSON.stringify(subscription_ids) if subscription_ids.size() > 0 else ("" if _is_apple() else null)
	if _platform == "Android":
		var result = JSON.parse_string(
			_native_plugin.call("getActiveSubscriptionsResult", ids_json)
		)
		if not result is Dictionary:
			return _active_subscription_failure(
				"billing-response-json-parse-error",
				"Failed to parse the Android active-subscriptions response"
			)
		if not result.get("success", false):
			return _active_subscription_failure(
				String(result.get("code", "service-error")),
				String(result.get("error", "Failed to get active subscriptions"))
			)
		return _validated_active_subscription_batch(result.get("subscriptions", null), "Android")
	if _is_apple():
		var payload = await _call_apple_async("getActiveSubscriptions", [ids_json])
		if not payload.get("success", false):
			return _active_subscription_failure(
				String(payload.get("code", "service-error")),
				String(payload.get("error", "Failed to get active subscriptions"))
			)
		var subscriptions = JSON.parse_string(payload.get("subscriptionsJson", ""))
		return _validated_active_subscription_batch(subscriptions, _platform)
	return _active_subscription_failure("feature-not-supported", "Unsupported platform")


func _validated_active_subscription_batch(value, platform_name: String) -> Dictionary:
	if not value is Array:
		return _active_subscription_failure(
			"billing-response-json-parse-error",
			"%s returned a malformed active-subscriptions payload" % platform_name
		)
	for item in value:
		if not _is_valid_active_subscription_dictionary(item):
			return _active_subscription_failure(
				"billing-response-json-parse-error",
				"%s returned a malformed active subscription" % platform_name
			)
	return {
		"success": true,
		"subscriptions": value,
	}


func _is_valid_active_subscription_dictionary(value) -> bool:
	if not value is Dictionary:
		return false
	for required_string in ["productId", "transactionId"]:
		if not value.get(required_string) is String \
			or String(value.get(required_string)).is_empty():
			return false
	if not value.get("isActive") is bool:
		return false
	var transaction_date = value.get("transactionDate")
	if not transaction_date is float and not transaction_date is int:
		return false
	if transaction_date is float and not is_finite(transaction_date):
		return false
	if value.has("renewalInfoIOS") \
		and value.get("renewalInfoIOS") != null \
		and not value.get("renewalInfoIOS") is Dictionary:
		return false
	return true


func _active_subscription_failure(code: String, message: String) -> Dictionary:
	return {
		"success": false,
		"code": code,
		"error": message,
	}

## Check if user has any active subscriptions.
## @param subscription_ids: Array[String] - optional array of subscription IDs to check
## @return bool - true if any subscription is active
##
## See: https://openiap.dev/docs/apis/has-active-subscriptions
func has_active_subscriptions(subscription_ids: Array[String] = []) -> bool:
	print("[GodotIap] has_active_subscriptions called")
	var result := await has_active_subscriptions_result(subscription_ids)
	return result.get("hasActive", false) if result.get("success", false) else false


## Check active-subscription status without turning a query failure into false.
func has_active_subscriptions_result(
	subscription_ids: Array[String] = []
) -> Dictionary:
	print("[GodotIap] has_active_subscriptions_result called")
	if _native_plugin and (_platform == "Android" or _is_apple()):
		var ids_json = JSON.stringify(subscription_ids) if subscription_ids.size() > 0 else ("" if _is_apple() else null)
		var result = null
		if _is_apple():
			result = await _call_apple_async("hasActiveSubscriptions", [ids_json])
		else:
			result = JSON.parse_string(_native_plugin.call("hasActiveSubscriptions", ids_json))
		if not result is Dictionary:
			return _active_subscription_failure(
				"billing-response-json-parse-error",
				"Failed to parse the active-subscription status response"
			)
		if not result.get("success", false):
			return _active_subscription_failure(
				String(result.get("code", "service-error")),
				String(result.get("error", "Failed to check active subscriptions"))
			)
		if not result.get("hasActive") is bool:
			return _active_subscription_failure(
				"billing-response-json-parse-error",
				"Native bridge returned an invalid active-subscription status"
			)
		return {
			"success": true,
			"hasActive": result.get("hasActive"),
		}
	return _active_subscription_failure(
		"not-prepared" if _platform == "Android" or _is_apple() else "feature-not-supported",
		"Active-subscription status requires a native store plugin"
	)

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
		var unavailable_code = "not-prepared" if _platform == "Android" or _is_apple() else "feature-not-supported"
		purchase_error.emit({
			"code": unavailable_code,
			"message": "Storefront lookup requires a native store plugin",
		})
		return ""
	if _is_apple():
		var payload = await _call_apple_async("getStorefront")
		if payload.get("success", false):
			return String(payload.get("countryCode", "")).strip_edges()
		purchase_error.emit({
			"code": String(payload.get("code", "service-error")),
			"message": String(payload.get("error", "Storefront lookup failed")),
		})
		return ""
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
	if _native_plugin and _is_apple():
		var payload = await _call_apple_async("verifyPurchase", [JSON.stringify(props_dict)])
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
	if _native_plugin and _is_apple():
		var payload = await _call_apple_async("verifyPurchaseWithProvider", [JSON.stringify(props_dict)])
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
	var payload = await _call_apple_async("syncIOS")
	return payload.get("success", false)

## Clear pending transactions from the StoreKit payment queue (iOS only).
## @return bool - true if pending transactions were cleared successfully
##
## See: https://openiap.dev/docs/apis/ios/clear-transaction-ios
func clear_transaction_ios() -> bool:
	if not (_native_plugin and _platform == "iOS"):
		return false
	var payload = await _call_apple_async("clearTransactionIOS")
	return payload.get("success", false)

## Get pending transactions (iOS only).
## @return Array[Types.PurchaseIOS]
##
## See: https://openiap.dev/docs/apis/ios/get-pending-transactions-ios
func get_pending_transactions_ios() -> Array:
	var purchases: Array = []
	if _native_plugin and _platform == "iOS":
		var payload = await _call_apple_async("getPendingTransactionsIOS")
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
		var payload = await _call_apple_async("getAllTransactionsIOS")
		if payload.get("success", false):
			var transactions_json = payload.get("transactionsJson", "[]")
			var transactions = JSON.parse_string(transactions_json)
			if transactions is Array:
				for tx in transactions:
					if tx is Dictionary:
						purchases.append(Types.PurchaseIOS.from_dict(tx))
	return purchases

## Present the code redemption sheet (iOS only).
## @return Types.PurchaseIOS for a verified Apple 27+ redemption from an Xcode
## 27+ build. Returns null on unsupported platforms, native request failures,
## missing or invalid purchaseJson, and system-sheet paths that cannot return
## the transaction directly. Mac Catalyst 15 also returns null without showing
## a sheet because StoreKit 1 has no effect there.
##
## See: https://openiap.dev/docs/apis/ios/present-code-redemption-sheet-ios
## @deprecated Use open_redeem_offer_code(). Scheduled for removal in OpenIAP 4.0.
func present_code_redemption_sheet_ios() -> Variant:
	if not (_native_plugin and _platform == "iOS"):
		return null
	var payload = await _call_apple_async(
		"presentCodeRedemptionSheetIOS", [], _apple_async_ui_timeout_seconds
	)
	if not payload.get("success", false):
		return null
	var purchase_json = payload.get("purchaseJson", "")
	if purchase_json is String and not purchase_json.is_empty():
		var purchase = JSON.parse_string(purchase_json)
		if purchase is Dictionary:
			return Types.PurchaseIOS.from_dict(purchase)
	return null

## Show manage subscriptions UI (iOS only).
## @return Array[Types.PurchaseIOS] - changed purchases
##
## See: https://openiap.dev/docs/apis/ios/show-manage-subscriptions-ios
func show_manage_subscriptions_ios() -> Array:
	var purchases: Array = []
	if _native_plugin and _platform == "iOS":
		var payload = await _call_apple_async(
			"showManageSubscriptionsIOS", [], _apple_async_ui_timeout_seconds
		)
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
	var payload = await _call_apple_async(
		"beginRefundRequestIOS", [product_id], _apple_async_ui_timeout_seconds
	)
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
		var payload = await _call_apple_async("currentEntitlementIOS", [sku])
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
		var payload = await _call_apple_async("latestTransactionIOS", [sku])
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
		var payload = await _call_apple_async("getAppTransactionIOS")
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
		var payload = await _call_apple_async("subscriptionStatusIOS", [sku])
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
		var payload = await _call_apple_async("isEligibleForIntroOfferIOS", [group_id])
		return payload.get("success", false) and payload.get("isEligible", false)
	return false

## Get promoted product (iOS only).
## @return Types.ProductIOS or null
##
## See: https://openiap.dev/docs/apis/ios/get-promoted-product-ios
func get_promoted_product_ios() -> Variant:
	if _native_plugin and _platform == "iOS":
		var payload = await _call_apple_async("getPromotedProductIOS")
		if payload.get("success", false):
			var product_json = payload.get("productJson", "null")
			if product_json != "null":
				var parsed = JSON.parse_string(product_json)
				if parsed is Dictionary:
					return Types.ProductIOS.from_dict(parsed)
	return null

## Check if can present external purchase notice (iOS 18.2+).
## @return bool - true if external purchase notice can be presented
##
## See: https://openiap.dev/docs/apis/ios/can-present-external-purchase-notice-ios
func can_present_external_purchase_notice_ios() -> bool:
	if _native_plugin and _platform == "iOS":
		var payload = await _call_apple_async("canPresentExternalPurchaseNoticeIOS")
		return payload.get("success", false) and payload.get("canPresent", false)
	return false

## Present external purchase notice sheet (iOS 18.2+).
## @return Types.ExternalPurchaseNoticeResultIOS
##
## See: https://openiap.dev/docs/apis/ios/present-external-purchase-notice-sheet-ios
func present_external_purchase_notice_sheet_ios() -> Variant:
	if _native_plugin and _platform == "iOS":
		var payload = await _call_apple_async(
			"presentExternalPurchaseNoticeSheetIOS", [], _apple_async_ui_timeout_seconds
		)
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
		var payload = await _call_apple_async(
			"presentExternalPurchaseLinkIOS", [url], _apple_async_ui_timeout_seconds
		)
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
		var payload = await _call_apple_async("getReceiptDataIOS")
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
		var payload = await _call_apple_async("isTransactionVerifiedIOS", [sku])
		return payload.get("success", false) and payload.get("isVerified", false)
	return false

## Get transaction JWS (iOS only).
## @param sku: String - product SKU
## @return String - JWS representation of the transaction
##
## See: https://openiap.dev/docs/apis/ios/get-transaction-jws-ios
func get_transaction_jws_ios(sku: String) -> String:
	if _native_plugin and _platform == "iOS":
		var payload = await _call_apple_async("getTransactionJwsIOS", [sku])
		if payload.get("success", false):
			return payload.get("jws", "")
	return ""

## Await the completion matching the native method and request token.
func _await_products_fetched_for(
	method: String,
	request_id: String,
	timeout_seconds: float = -1.0
) -> Dictionary:
	var cache_key := _apple_async_result_key(method, request_id)
	if _apple_async_results.has(cache_key):
		var cached = _take_cached_apple_async_result(cache_key)
		_mark_apple_async_terminal(cache_key)
		return cached
	if _apple_async_terminal_keys.has(cache_key):
		return {
			"success": false,
			"code": "service-error",
			"error": "%s completion is no longer available" % method,
			"method": method,
			"requestId": request_id,
		}

	var waiter := AppleAsyncWaiter.new()
	_apple_async_waiters[cache_key] = waiter

	# `_on_products_fetched` can cache an immediate native completion before
	# the requestId-returning call finishes. Consume it after installing the
	# request-scoped waiter so neither ordering can lose the completion.
	if _apple_async_results.has(cache_key):
		var cached = _take_cached_apple_async_result(cache_key)
		_apple_async_waiters.erase(cache_key)
		_mark_apple_async_terminal(cache_key)
		return cached

	var effective_timeout := timeout_seconds
	if effective_timeout <= 0.0:
		effective_timeout = _apple_async_timeout_seconds
	# `create_timer` needs a live SceneTree. Outside it — during shutdown, or
	# before the autoload is attached — no timeout could ever fire, so waiting
	# here would reintroduce the unbounded wait this guard exists to prevent.
	var tree := get_tree()
	if tree == null:
		_apple_async_waiters.erase(cache_key)
		_mark_apple_async_terminal(cache_key)
		return {
			"success": false,
			"code": "not-prepared",
			"error": "%s cannot await a completion outside the scene tree" % method,
			"method": method,
			"requestId": request_id,
		}
	var timer := tree.create_timer(effective_timeout)
	var timeout_callback := func() -> void:
			_complete_apple_async_waiter(cache_key, {
				"success": false,
				"code": "service-timeout",
				"error": "%s timed out after %.1f seconds" % [method, effective_timeout],
				"method": method,
				"requestId": request_id,
			})
	waiter.arm_timeout(timer, timeout_callback)

	var payload = await waiter.completed
	_apple_async_waiters.erase(cache_key)
	_mark_apple_async_terminal(cache_key)
	if payload is Dictionary:
		return payload
	return {
		"success": false,
		"code": "service-error",
		"error": "%s returned an invalid completion" % method,
	}


func _complete_apple_async_waiter(cache_key: String, payload: Dictionary) -> void:
	if not _apple_async_waiters.has(cache_key):
		return
	var waiter = _apple_async_waiters[cache_key]
	if waiter is AppleAsyncWaiter:
		waiter.complete(payload)


func _cancel_pending_apple_async(
	code: String,
	message: String,
	excluded_method: String = ""
) -> void:
	_apple_async_cancellation_generation += 1
	for cache_key in _apple_async_waiters.keys():
		if not excluded_method.is_empty() \
			and String(cache_key).begins_with("%s:" % excluded_method):
			continue
		_complete_apple_async_waiter(String(cache_key), {
			"success": false,
			"code": code,
			"error": message,
		})


func _cache_apple_async_result(cache_key: String, payload: Dictionary) -> void:
	if not _apple_async_results.has(cache_key):
		_apple_async_result_order.append(cache_key)
	_apple_async_results[cache_key] = payload
	while _apple_async_result_order.size() > APPLE_ASYNC_RESULT_CACHE_LIMIT:
		var oldest := _apple_async_result_order.pop_front()
		_apple_async_results.erase(oldest)
		_mark_apple_async_terminal(oldest)


func _take_cached_apple_async_result(cache_key: String) -> Dictionary:
	var payload = _apple_async_results.get(cache_key, {})
	_apple_async_results.erase(cache_key)
	_apple_async_result_order.erase(cache_key)
	if payload is Dictionary:
		return payload
	return {}


func _mark_apple_async_terminal(cache_key: String) -> void:
	if not _apple_async_terminal_keys.has(cache_key):
		_apple_async_terminal_keys[cache_key] = true
		_apple_async_terminal_order.append(cache_key)
	while _apple_async_terminal_order.size() > APPLE_ASYNC_TERMINAL_CACHE_LIMIT:
		var oldest := _apple_async_terminal_order.pop_front()
		_apple_async_terminal_keys.erase(oldest)

## Dispatch an Apple native method that returns a pending request token, then
## await its method/requestId-tagged completion. Native completions are cached
## by `_on_products_fetched` so a very fast Swift Task cannot emit before this
## coroutine installs its signal waiter and get lost.
func _call_apple_async(
	method: String,
	args: Array = [],
	timeout_seconds: float = -1.0
) -> Dictionary:
	if not (_native_plugin and _is_apple()):
		return {
			"success": false,
			"code": "not-prepared",
			"error": "Apple native plugin is unavailable",
		}
	var cancellation_generation := _apple_async_cancellation_generation
	var pending = _native_plugin.callv(method, args)
	var request_id = _parse_request_id(pending)
	if request_id.is_empty():
		if pending is String:
			var immediate = JSON.parse_string(pending)
			if immediate is Dictionary:
				return immediate
		return {
			"success": false,
			"code": "service-error",
			"error": "%s did not return a requestId" % method,
		}
	if method != "endConnection" \
		and cancellation_generation != _apple_async_cancellation_generation:
		var cache_key := _apple_async_result_key(method, request_id)
		_take_cached_apple_async_result(cache_key)
		_mark_apple_async_terminal(cache_key)
		return {
			"success": false,
			"code": "service-disconnected",
			"error": "The store disconnected before %s could start waiting" % method,
		}
	return await _await_products_fetched_for(method, request_id, timeout_seconds)

func _apple_async_result_key(method: String, request_id: String) -> String:
	return "%s:%s" % [method, request_id]

## Extract the native `requestId` token from the synchronous "pending" JSON
## returned by a GDExtension @Callable, or empty string if missing.
func _parse_request_id(pending_json) -> String:
	if pending_json is String:
		var decoded = JSON.parse_string(pending_json)
		if decoded is Dictionary:
			return String(decoded.get("requestId", ""))
	return ""

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
	var payload = await _call_apple_async("isEligibleForExternalPurchaseCustomLinkIOS")
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
	var payload = await _call_apple_async("getExternalPurchaseCustomLinkTokenIOS", [token_type])
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
	var payload = await _call_apple_async(
		"showExternalPurchaseCustomLinkNoticeIOS",
		[notice_type],
		_apple_async_ui_timeout_seconds
	)
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

## Open the Google Play offer/promo code redemption flow (Android).
## Opens the Play Store redeem page. A listener can receive the redeemed purchase
## while the app has an active billing connection; reconcile on app resume.
## Does not require the billing client to be initialized.
## @return bool - true if launched, false if unavailable
##
## See: https://openiap.dev/docs/apis/android/open-redeem-offer-code-android
## @deprecated Use open_redeem_offer_code(). Scheduled for removal in OpenIAP 4.0.
func open_redeem_offer_code_android() -> bool:
	if _native_plugin and _platform == "Android":
		var result_json = _native_plugin.call("openRedeemOfferCodeAndroid")
		var result = JSON.parse_string(result_json)
		if result is Dictionary:
			return bool(result.get("launched", result.get("success", false)))
	elif _platform == "Android":
		# No native plugin: open the Play Store redeem page directly
		return OS.shell_open("https://play.google.com/redeem") == OK
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
	elif _native_plugin and _is_apple():
		var apple_options_json = JSON.stringify(opts.to_dict())
		var apple_payload = await _call_apple_async("deepLinkToSubscriptions", [apple_options_json])
		return Types.VoidResult.from_dict(apple_payload)
	elif _is_apple():
		# Apple: Open App Store subscription management URL
		var apple_fallback_result = Types.VoidResult.new()
		apple_fallback_result.success = OS.shell_open(
			"https://apps.apple.com/account/subscriptions"
		) == OK
		return apple_fallback_result
	elif _platform == "Android":
		# Android: Open Play Store subscription management URL
		var subscription_url := "https://play.google.com/store/account/subscriptions"
		var sku = opts.sku_android if opts.sku_android else ""
		var package_name = opts.package_name_android if opts.package_name_android else get_package_name_android()
		if not sku.is_empty() and not package_name.is_empty():
			var encoded_sku = sku.uri_encode()
			var encoded_package = package_name.uri_encode()
			subscription_url += "?sku=%s&package=%s" % [encoded_sku, encoded_package]
		var android_fallback_result = Types.VoidResult.new()
		android_fallback_result.success = OS.shell_open(subscription_url) == OK
		return android_fallback_result
	var unavailable_result = Types.VoidResult.new()
	unavailable_result.success = false
	return unavailable_result

# ==========================================
# Offer Code Redemption (OpenIAP Mutation)
# ==========================================

## Open the platform offer/promo code redemption flow (cross-platform).
## Returns the redeemed purchase only when the store reports it synchronously;
## every other path returns null, so reconcile with get_available_purchases()
## on resume.
## @return Types.PurchaseIOS or null
##
## See: https://openiap.dev/docs/apis/open-redeem-offer-code
func open_redeem_offer_code() -> Variant:
	if _native_plugin and _platform == "Android":
		# openiap-google 3.4.0 only launches the redeem page; map the launched envelope to null.
		_native_plugin.call("openRedeemOfferCodeAndroid")
		return null
	# iOS reuses the released sheet dispatch and its purchase parsing; other surfaces resolve null.
	return await present_code_redemption_sheet_ios()

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
	elif _is_apple():
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
