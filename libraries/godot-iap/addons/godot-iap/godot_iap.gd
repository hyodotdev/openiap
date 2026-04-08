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

# Native plugin reference
var _native_plugin: Object = null
var _is_connected: bool = false

# Platform detection
var _platform: String = ""

func _ready() -> void:
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

	print("[GodotIap] Android signal connection complete")

# ==========================================
# Signal Handlers - iOS (SwiftGodot)
# ==========================================
func _on_native_purchase_updated(purchase: Dictionary) -> void:
	purchase_updated.emit(purchase)

func _on_native_purchase_error(error: Dictionary) -> void:
	purchase_error.emit(error)

func _on_products_fetched(result: Dictionary) -> void:
	products_fetched.emit(result)

func _on_connected(_status_code: int = 0) -> void:
	_is_connected = true
	connected.emit()

func _on_disconnected(_status_code: int = 0) -> void:
	_is_connected = false
	disconnected.emit()

func _on_native_promoted_product_ios(product_id: String) -> void:
	promoted_product_ios.emit(product_id)

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

# ==========================================
# Connection (OpenIAP Mutation)
# ==========================================

## Initialize the IAP connection.
## @return bool - true if connection was successful
func init_connection() -> bool:
	print("[GodotIap] init_connection called")
	if _native_plugin:
		if _platform == "Android":
			print("[GodotIap] Calling Android initConnection...")
			_is_connected = _native_plugin.call("initConnection")
			if not _is_connected:
				print("[GodotIap] ERROR: initConnection failed. Check Google Play Services and billing setup.")
			else:
				print("[GodotIap] initConnection result: ", _is_connected)
		elif _platform == "iOS":
			print("[GodotIap] Calling iOS initConnection...")
			_is_connected = _native_plugin.call("initConnection")
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
func end_connection() -> bool:
	print("[GodotIap] end_connection called")
	if _native_plugin:
		var result = _native_plugin.call("endConnection")
		_is_connected = false
		return result
	_is_connected = false
	disconnected.emit()
	return true

## Check if connected to the store.
## @return bool - true if currently connected
func is_store_connected() -> bool:
	return _is_connected

# ==========================================
# Products (OpenIAP Query)
# ==========================================

## Fetch products from the store.
## Note: This function is asynchronous and must be called with 'await'.
## On iOS, it awaits the 'products_fetched' signal internally.
## @param request: Types.ProductRequest - product request with SKUs and type
## @return Array[Types.ProductAndroid] or Array[Types.ProductIOS] depending on platform
func fetch_products(request) -> Array:
	print("[GodotIap] fetch_products called")
	var result = await _fetch_products_raw(request.to_dict())
	var products: Array = []

	if result.has("products"):
		for product_dict in result["products"]:
			if product_dict is Dictionary:
				if _platform == "Android":
					products.append(Types.ProductAndroid.from_dict(product_dict))
				elif _platform == "iOS":
					products.append(Types.ProductIOS.from_dict(product_dict))

	return products

## Internal: Fetch products with raw Dictionary (for backward compatibility)
func _fetch_products_raw(request: Dictionary) -> Dictionary:
	print("[GodotIap] _fetch_products_raw called with: ", request)
	if _native_plugin:
		var request_json = JSON.stringify(request)
		if _platform == "Android":
			print("[GodotIap] Calling fetchProducts with: ", request_json)
			var result_json = _native_plugin.call("fetchProducts", request_json)
			print("[GodotIap] fetchProducts result: ", result_json)
			var result = JSON.parse_string(result_json)
			if result is Dictionary:
				return result
			return { "products": [], "error": "Parse error" }
		elif _platform == "iOS":
			print("[GodotIap] Calling fetchProducts with: ", request_json)
			_native_plugin.call("fetchProducts", request_json)
			# Await the signal from Swift native plugin
			var signal_result: Dictionary = await products_fetched
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

## Request a purchase from the store.
## @param props: Types.RequestPurchaseProps - purchase request properties
## @return Types.PurchaseAndroid or Types.PurchaseIOS on success, null on failure
func request_purchase(props) -> Variant:
	var result = _request_purchase_raw(props.to_dict())
	if result.get("success", false):
		if _platform == "Android":
			return Types.PurchaseAndroid.from_dict(result)
		elif _platform == "iOS":
			return Types.PurchaseIOS.from_dict(result)
	return null

## Internal: Request a purchase with raw Dictionary
func _request_purchase_raw(args: Dictionary) -> Dictionary:
	print("[GodotIap] _request_purchase_raw called with: ", args)
	if not _native_plugin:
		print("[GodotIap] ERROR: Native plugin not available. Cannot make purchases.")
		purchase_error.emit({ "code": "not-prepared", "message": "Native plugin not available" })
		return { "success": false, "error": "Native plugin not available" }

	# Support both "requestPurchase" (from to_dict) and "request" (legacy)
	var request = args.get("requestPurchase", args.get("request", {}))
	var purchase_type = args.get("type", "in-app")

	var result_raw = null
	if _platform == "Android":
		# Android requestPurchase is async — returns null, result comes via purchase_updated signal
		var google_props = request.get("google", request.get("android", {}))
		var params = {
			"type": purchase_type,
			"skus": google_props.get("skus", []),
			"obfuscatedAccountIdAndroid": google_props.get("obfuscatedAccountIdAndroid", ""),
			"obfuscatedProfileIdAndroid": google_props.get("obfuscatedProfileIdAndroid", ""),
			"isOfferPersonalized": google_props.get("isOfferPersonalized", false),
			"subscriptionOffers": google_props.get("subscriptionOffers", []),
			"purchaseTokenAndroid": google_props.get("purchaseTokenAndroid", ""),
			"replacementModeAndroid": google_props.get("replacementModeAndroid", 0),
		}
		var params_json = JSON.stringify(params)
		print("[GodotIap] Calling Android requestPurchase with: ", params_json)
		result_raw = _native_plugin.call("requestPurchase", params_json)
		# Android: null means the purchase dialog was launched, result comes via signal
		if result_raw == null:
			print("[GodotIap] Android purchase dialog launched. Awaiting purchase_updated signal.")
			return { "success": true, "pending": true }
	elif _platform == "iOS":
		var apple_props = request.get("apple", request.get("ios", {}))
		var sku = apple_props.get("sku", "")
		if sku.is_empty():
			return { "success": false, "error": "Invalid request: SKU is required" }
		result_raw = _native_plugin.call("requestPurchase", sku)
	else:
		return { "success": false, "error": "Unsupported platform" }

	if result_raw == null or str(result_raw) == "":
		var err_msg = "requestPurchase returned empty. Billing may not be connected."
		print("[GodotIap] ERROR: ", err_msg)
		purchase_error.emit({ "code": "service-error", "message": err_msg })
		return { "success": false, "error": err_msg }

	var result_json = str(result_raw)
	print("[GodotIap] requestPurchase result: ", result_json)
	var result = JSON.parse_string(result_json)
	if result is Dictionary:
		if not result.get("success", false) and result.has("error"):
			print("[GodotIap] requestPurchase error: ", result.get("error"))
			purchase_error.emit({ "code": result.get("code", "unknown"), "message": result.get("error", "Unknown error") })
		return result
	print("[GodotIap] requestPurchase parse error for: ", result_json)
	return { "success": false, "error": "Failed to parse response" }

## Finish a transaction (acknowledge or consume).
## @param purchase: Types.PurchaseInput - the purchase to finish
## @param is_consumable: bool - whether to consume (true) or acknowledge (false)
## @return Types.VoidResult
func finish_transaction(purchase, is_consumable: bool = false) -> Variant:
	print("[GodotIap] finish_transaction called, consumable: ", is_consumable)
	var result = _finish_transaction_raw(purchase.to_dict(), is_consumable)
	return Types.VoidResult.from_dict(result)

## Finish transaction with raw Dictionary (convenience method).
## Use this when you have the purchase dictionary from purchase_updated signal.
## @param purchase: Dictionary - raw purchase dictionary with transactionId
## @param is_consumable: bool - whether to consume (true) or acknowledge (false)
## @return Types.VoidResult
func finish_transaction_dict(purchase: Dictionary, is_consumable: bool = false) -> Variant:
	print("[GodotIap] finish_transaction_dict called, consumable: ", is_consumable)
	var result = _finish_transaction_raw(purchase, is_consumable)
	return Types.VoidResult.from_dict(result)

## Internal: Finish transaction with raw Dictionary
func _finish_transaction_raw(purchase: Dictionary, is_consumable: bool) -> Dictionary:
	print("[GodotIap] _finish_transaction_raw called with: ", purchase, ", consumable: ", is_consumable)

	if not _native_plugin:
		return { "success": true }

	if _platform == "Android":
		# Use the Kotlin finishTransaction method which handles both consume and acknowledge
		# It internally calls store.finishTransaction(purchase, isConsumable) from OpenIAP
		var product_id = purchase.get("productId", "")
		if product_id.is_empty():
			return { "success": false, "error": "Product ID is required", "code": Types.ErrorCode.DEVELOPER_ERROR }

		var purchase_json = JSON.stringify(purchase)
		print("[GodotIap] Calling Android finishTransaction with: ", purchase_json, ", isConsumable: ", is_consumable)

		# Note: has_method() doesn't work reliably with JNISingleton, so we call directly
		var result_json = _native_plugin.call("finishTransaction", purchase_json, is_consumable)
		print("[GodotIap] finishTransaction result: ", result_json)
		var result = JSON.parse_string(result_json)
		if result is Dictionary:
			return result
		return { "success": false, "error": "Parse error" }

	elif _platform == "iOS":
		var args = { "purchase": purchase, "isConsumable": is_consumable }
		var args_json = JSON.stringify(args)
		print("[GodotIap] Calling finishTransaction with: ", args_json)
		var result_json = _native_plugin.call("finishTransaction", args_json)
		print("[GodotIap] finishTransaction result: ", result_json)
		var result = JSON.parse_string(result_json)
		if result is Dictionary:
			return result
		return { "success": false, "error": "Parse error" }

	return { "success": true }

## Restore completed transactions.
## iOS: Performs a lightweight sync then fetches available purchases.
## Android: Simply fetches available purchases.
## @return Types.VoidResult
func restore_purchases() -> Variant:
	print("[GodotIap] restore_purchases called")

	if _platform == "iOS" and _native_plugin:
		# iOS: sync first, then get available purchases
		sync_ios()

	var purchases = get_available_purchases()
	var result = Types.VoidResult.new()
	result.success = true
	return result

## Get available (owned) purchases.
## @param options: Types.PurchaseOptions or null - optional purchase query options
## @return Array[Types.PurchaseAndroid] or Array[Types.PurchaseIOS] depending on platform
func get_available_purchases(options = null) -> Array:
	print("[GodotIap] get_available_purchases called")
	var raw_purchases = _get_available_purchases_raw()
	var purchases: Array = []

	for purchase_dict in raw_purchases:
		if purchase_dict is Dictionary:
			if _platform == "Android":
				purchases.append(Types.PurchaseAndroid.from_dict(purchase_dict))
			elif _platform == "iOS":
				purchases.append(Types.PurchaseIOS.from_dict(purchase_dict))

	return purchases

## Internal: Get available purchases raw
func _get_available_purchases_raw() -> Array:
	if _native_plugin:
		if _platform == "Android" or _platform == "iOS":
			var result_json = _native_plugin.call("getAvailablePurchases")
			print("[GodotIap] getAvailablePurchases result: ", result_json)
			var result = JSON.parse_string(result_json)
			if result is Array:
				return result
			return []
	# No native plugin
	return []

# ==========================================
# Subscriptions (OpenIAP Query)
# ==========================================

## Get active subscriptions.
## @param subscription_ids: Array[String] - optional array of subscription IDs to filter
## @return Array[Types.ActiveSubscription]
func get_active_subscriptions(subscription_ids: Array[String] = []) -> Array:
	print("[GodotIap] get_active_subscriptions called")
	var raw_subs = _get_active_subscriptions_raw(subscription_ids)
	var subscriptions: Array = []

	for sub_dict in raw_subs:
		if sub_dict is Dictionary:
			subscriptions.append(Types.ActiveSubscription.from_dict(sub_dict))

	return subscriptions

## Internal: Get active subscriptions raw
func _get_active_subscriptions_raw(subscription_ids: Array = []) -> Array:
	if _native_plugin:
		if _platform == "Android" or _platform == "iOS":
			var ids_json = JSON.stringify(subscription_ids) if subscription_ids.size() > 0 else "[]"
			var result_json = _native_plugin.call("getActiveSubscriptions", ids_json)
			print("[GodotIap] getActiveSubscriptions result: ", result_json)
			var result = JSON.parse_string(result_json)
			if result is Array:
				return result
			return []
	# No native plugin
	return []

## Check if user has any active subscriptions.
## @param subscription_ids: Array[String] - optional array of subscription IDs to check
## @return bool - true if any subscription is active
func has_active_subscriptions(subscription_ids: Array[String] = []) -> bool:
	print("[GodotIap] has_active_subscriptions called")
	if _native_plugin and (_platform == "Android" or _platform == "iOS"):
		var ids_json = JSON.stringify(subscription_ids) if subscription_ids.size() > 0 else ""
		var result_json = _native_plugin.call("hasActiveSubscriptions", ids_json)
		var result = JSON.parse_string(result_json)
		if result is Dictionary:
			return result.get("hasActive", false)
	# Fallback: check manually
	var subscriptions = get_active_subscriptions(subscription_ids)
	for sub in subscriptions:
		if sub.is_active:
			return true
	return false

# ==========================================
# Storefront (OpenIAP Query)
# ==========================================

## Get the current storefront country code.
## @return String - country code (e.g., "US")
func get_storefront() -> String:
	print("[GodotIap] get_storefront called")
	if _native_plugin:
		if _platform == "iOS":
			var result_json = _native_plugin.call("getStorefrontIOS")
			var result = JSON.parse_string(result_json)
			if result is Dictionary and result.get("success", false):
				return result.get("storefront", "")
		elif _platform == "Android":
			var result_json = _native_plugin.call("getStorefrontAndroid")
			var result = JSON.parse_string(result_json)
			if result is Dictionary and result.get("success", false):
				return result.get("countryCode", "")
	# No native plugin
	return "US"

# ==========================================
# Verification (OpenIAP Mutation)
# ==========================================

## Verify a purchase locally.
## @param props: Types.VerifyPurchaseProps - verification properties
## @return Types.VerifyPurchaseResultIOS or Types.VerifyPurchaseResultAndroid, or null on failure
func verify_purchase(props) -> Variant:
	print("[GodotIap] verify_purchase called")
	var result = _verify_purchase_raw(props.to_dict())
	if result.get("success", false) or result.get("isValid", false):
		if _platform == "iOS":
			return Types.VerifyPurchaseResultIOS.from_dict(result)
		elif _platform == "Android":
			return Types.VerifyPurchaseResultAndroid.from_dict(result)
	return null

## Internal: Verify purchase with raw Dictionary
func _verify_purchase_raw(props: Dictionary) -> Dictionary:
	if _native_plugin and (_platform == "Android" or _platform == "iOS"):
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
func verify_purchase_with_provider(props) -> Variant:
	print("[GodotIap] verify_purchase_with_provider called")
	var result = _verify_purchase_with_provider_raw(props.to_dict())
	return Types.VerifyPurchaseWithProviderResult.from_dict(result)

## Internal: Verify purchase with provider raw Dictionary
func _verify_purchase_with_provider_raw(props: Dictionary) -> Dictionary:
	if _native_plugin and (_platform == "Android" or _platform == "iOS"):
		var props_json = JSON.stringify(props)
		var result_json = _native_plugin.call("verifyPurchaseWithProvider", props_json)
		var result = JSON.parse_string(result_json)
		if result is Dictionary:
			return result
	# No native plugin
	return { "success": false, "isValid": false, "error": "Not available in no native plugin" }


# ==========================================
# iOS-Specific (OpenIAP)
# ==========================================

## Sync with App Store (iOS only).
## @return Types.VoidResult
func sync_ios() -> Variant:
	var result = Types.VoidResult.new()
	result.success = false
	if _native_plugin and _platform == "iOS":
		var result_json = _native_plugin.call("syncIOS")
		var parsed = JSON.parse_string(result_json)
		if parsed is Dictionary:
			return Types.VoidResult.from_dict(parsed)
	return result

## Clear pending transactions from the StoreKit payment queue (iOS only).
## @return Types.VoidResult
func clear_transaction_ios() -> Variant:
	var result = Types.VoidResult.new()
	result.success = false
	if _native_plugin and _platform == "iOS":
		var result_json = _native_plugin.call("clearTransactionIOS")
		var parsed = JSON.parse_string(result_json)
		if parsed is Dictionary:
			return Types.VoidResult.from_dict(parsed)
	return result

## Get pending transactions (iOS only).
## @return Array[Types.PurchaseIOS]
func get_pending_transactions_ios() -> Array:
	var purchases: Array = []
	if _native_plugin and _platform == "iOS":
		var result_json = _native_plugin.call("getPendingTransactionsIOS")
		var result = JSON.parse_string(result_json)
		if result is Dictionary and result.get("success", false):
			var transactions_json = result.get("transactionsJson", "[]")
			var transactions = JSON.parse_string(transactions_json)
			if transactions is Array:
				for tx in transactions:
					if tx is Dictionary:
						purchases.append(Types.PurchaseIOS.from_dict(tx))
	return purchases

## Present code redemption sheet (iOS only).
## @return Types.VoidResult
func present_code_redemption_sheet_ios() -> Variant:
	var result = Types.VoidResult.new()
	result.success = false
	if _native_plugin and _platform == "iOS":
		var result_json = _native_plugin.call("presentCodeRedemptionSheetIOS")
		var parsed = JSON.parse_string(result_json)
		if parsed is Dictionary:
			return Types.VoidResult.from_dict(parsed)
	return result

## Show manage subscriptions UI (iOS only).
## @return Array[Types.PurchaseIOS] - changed purchases
func show_manage_subscriptions_ios() -> Array:
	var purchases: Array = []
	if _native_plugin and _platform == "iOS":
		var result_json = _native_plugin.call("showManageSubscriptionsIOS")
		var result = JSON.parse_string(result_json)
		if result is Dictionary and result.get("success", false):
			var purchases_json = result.get("purchasesJson", "[]")
			var parsed = JSON.parse_string(purchases_json)
			if parsed is Array:
				for p in parsed:
					if p is Dictionary:
						purchases.append(Types.PurchaseIOS.from_dict(p))
	return purchases

## Begin refund request (iOS only).
## @param product_id: String - the product ID to request refund for
## @return Types.RefundResultIOS
func begin_refund_request_ios(product_id: String) -> Variant:
	if _native_plugin and _platform == "iOS":
		var result_json = _native_plugin.call("beginRefundRequestIOS", product_id)
		var result = JSON.parse_string(result_json)
		if result is Dictionary:
			return Types.RefundResultIOS.from_dict(result)
	var default_result = Types.RefundResultIOS.new()
	return default_result

## Get current entitlement for a product (iOS only).
## @param sku: String - product SKU
## @return Types.PurchaseIOS or null
func current_entitlement_ios(sku: String) -> Variant:
	if _native_plugin and _platform == "iOS":
		var result_json = _native_plugin.call("currentEntitlementIOS", sku)
		var result = JSON.parse_string(result_json)
		if result is Dictionary and result.get("success", false):
			var purchase_json = result.get("purchaseJson", "null")
			if purchase_json != "null":
				var parsed = JSON.parse_string(purchase_json)
				if parsed is Dictionary:
					return Types.PurchaseIOS.from_dict(parsed)
	return null

## Get the latest transaction for a product (iOS only).
## @param sku: String - product SKU
## @return Types.PurchaseIOS or null
func latest_transaction_ios(sku: String) -> Variant:
	if _native_plugin and _platform == "iOS":
		var result_json = _native_plugin.call("latestTransactionIOS", sku)
		var result = JSON.parse_string(result_json)
		if result is Dictionary and result.get("success", false):
			var purchase_json = result.get("purchaseJson", "null")
			if purchase_json != "null":
				var parsed = JSON.parse_string(purchase_json)
				if parsed is Dictionary:
					return Types.PurchaseIOS.from_dict(parsed)
	return null

## Get app transaction (iOS 16+).
## @return Types.AppTransaction or null
func get_app_transaction_ios() -> Variant:
	if _native_plugin and _platform == "iOS":
		var result_json = _native_plugin.call("getAppTransactionIOS")
		var result = JSON.parse_string(result_json)
		if result is Dictionary and result.get("success", false):
			var app_transaction_json = result.get("appTransactionJson", "{}")
			var app_transaction = JSON.parse_string(app_transaction_json)
			if app_transaction is Dictionary:
				return Types.AppTransaction.from_dict(app_transaction)
	return null

## Get subscription status (iOS only).
## @param sku: String - product SKU
## @return Array[Types.SubscriptionStatusIOS]
func subscription_status_ios(sku: String) -> Array:
	var statuses: Array = []
	if _native_plugin and _platform == "iOS":
		var result_json = _native_plugin.call("subscriptionStatusIOS", sku)
		var result = JSON.parse_string(result_json)
		if result is Dictionary and result.get("success", false):
			var statuses_json = result.get("statusesJson", "[]")
			var parsed = JSON.parse_string(statuses_json)
			if parsed is Array:
				for s in parsed:
					if s is Dictionary:
						statuses.append(Types.SubscriptionStatusIOS.from_dict(s))
	return statuses

## Check if eligible for intro offer (iOS only).
## @param group_id: String - subscription group ID
## @return bool - true if eligible for introductory offer
func is_eligible_for_intro_offer_ios(group_id: String) -> bool:
	if _native_plugin and _platform == "iOS":
		var result_json = _native_plugin.call("isEligibleForIntroOfferIOS", group_id)
		var result = JSON.parse_string(result_json)
		if result is Dictionary:
			return result.get("isEligible", false)
	return false

## Get promoted product (iOS only).
## @return Types.ProductIOS or null
func get_promoted_product_ios() -> Variant:
	if _native_plugin and _platform == "iOS":
		var result_json = _native_plugin.call("getPromotedProductIOS")
		var result = JSON.parse_string(result_json)
		if result is Dictionary and result.get("success", false):
			var product_json = result.get("productJson", "null")
			if product_json != "null":
				var parsed = JSON.parse_string(product_json)
				if parsed is Dictionary:
					return Types.ProductIOS.from_dict(parsed)
	return null

## Request purchase on promoted product (iOS only).
## @return Types.VoidResult
func request_purchase_on_promoted_product_ios() -> Variant:
	var result = Types.VoidResult.new()
	result.success = false
	if _native_plugin and _platform == "iOS":
		var result_json = _native_plugin.call("requestPurchaseOnPromotedProductIOS")
		var parsed = JSON.parse_string(result_json)
		if parsed is Dictionary:
			return Types.VoidResult.from_dict(parsed)
	return result

## Check if can present external purchase notice (iOS 18.2+).
## @return bool - true if external purchase notice can be presented
func can_present_external_purchase_notice_ios() -> bool:
	if _native_plugin and _platform == "iOS":
		var result_json = _native_plugin.call("canPresentExternalPurchaseNoticeIOS")
		var result = JSON.parse_string(result_json)
		if result is Dictionary:
			return result.get("canPresent", false)
	return false

## Present external purchase notice sheet (iOS 18.2+).
## @return Types.ExternalPurchaseNoticeResultIOS
func present_external_purchase_notice_sheet_ios() -> Variant:
	if _native_plugin and _platform == "iOS":
		var result_json = _native_plugin.call("presentExternalPurchaseNoticeSheetIOS")
		var result = JSON.parse_string(result_json)
		if result is Dictionary:
			return Types.ExternalPurchaseNoticeResultIOS.from_dict(result)
	var default_result = Types.ExternalPurchaseNoticeResultIOS.new()
	return default_result

## Present external purchase link (iOS 18.2+).
## @param url: String - external purchase URL
## @return Types.ExternalPurchaseLinkResultIOS
func present_external_purchase_link_ios(url: String) -> Variant:
	if _native_plugin and _platform == "iOS":
		var result_json = _native_plugin.call("presentExternalPurchaseLinkIOS", url)
		var result = JSON.parse_string(result_json)
		if result is Dictionary:
			return Types.ExternalPurchaseLinkResultIOS.from_dict(result)
	var default_result = Types.ExternalPurchaseLinkResultIOS.new()
	return default_result

## Get receipt data (iOS only).
## @return String - receipt data as base64
func get_receipt_data_ios() -> String:
	if _native_plugin and _platform == "iOS":
		var result_json = _native_plugin.call("getReceiptDataIOS")
		var result = JSON.parse_string(result_json)
		if result is Dictionary and result.get("success", false):
			return result.get("receiptData", "")
	return ""

## Check if transaction is verified (iOS only).
## @param sku: String - product SKU
## @return bool - true if transaction is verified
func is_transaction_verified_ios(sku: String) -> bool:
	if _native_plugin and _platform == "iOS":
		var result_json = _native_plugin.call("isTransactionVerifiedIOS", sku)
		var result = JSON.parse_string(result_json)
		if result is Dictionary:
			return result.get("isVerified", false)
	return false

## Get transaction JWS (iOS only).
## @param sku: String - product SKU
## @return String - JWS representation of the transaction
func get_transaction_jws_ios(sku: String) -> String:
	if _native_plugin and _platform == "iOS":
		var result_json = _native_plugin.call("getTransactionJwsIOS", sku)
		var result = JSON.parse_string(result_json)
		if result is Dictionary and result.get("success", false):
			return result.get("jws", "")
	return ""

# ==========================================
# Android-Specific (OpenIAP)
# ==========================================

## Acknowledge a purchase (Android only, for non-consumables).
## @param purchase_token: String - the purchase token to acknowledge
## @return Types.VoidResult
func acknowledge_purchase_android(purchase_token: String) -> Variant:
	var result = _acknowledge_purchase_android_raw(purchase_token)
	return Types.VoidResult.from_dict(result)

## Internal: Acknowledge purchase raw
func _acknowledge_purchase_android_raw(purchase_token: String) -> Dictionary:
	print("[GodotIap] _acknowledge_purchase_android_raw called with token: ", purchase_token.substr(0, 20), "...")
	if _native_plugin and _platform == "Android":
		print("[GodotIap] Calling acknowledgePurchaseAndroid...")
		var result_json = _native_plugin.call("acknowledgePurchaseAndroid", purchase_token)
		print("[GodotIap] acknowledgePurchaseAndroid result: ", result_json)
		var result = JSON.parse_string(result_json)
		if result is Dictionary:
			return result
	return { "success": false, "error": "Not available" }

## Consume a purchase (Android only, for consumables).
## @param purchase_token: String - the purchase token to consume
## @return Types.VoidResult
func consume_purchase_android(purchase_token: String) -> Variant:
	var result = _consume_purchase_android_raw(purchase_token)
	return Types.VoidResult.from_dict(result)

## Internal: Consume purchase raw
func _consume_purchase_android_raw(purchase_token: String) -> Dictionary:
	print("[GodotIap] _consume_purchase_android_raw called with token: ", purchase_token.substr(0, 20), "...")
	if _native_plugin and _platform == "Android":
		print("[GodotIap] Calling consumePurchaseAndroid...")
		var result_json = _native_plugin.call("consumePurchaseAndroid", purchase_token)
		print("[GodotIap] consumePurchaseAndroid result: ", result_json)
		var result = JSON.parse_string(result_json)
		if result is Dictionary:
			return result
	return { "success": false, "error": "Not available" }

## Check alternative billing availability (Android).
## @return Types.BillingProgramAvailabilityResultAndroid
func check_alternative_billing_availability_android() -> Variant:
	if _native_plugin and _platform == "Android":
		var result_json = _native_plugin.call("checkAlternativeBillingAvailabilityAndroid")
		var result = JSON.parse_string(result_json)
		if result is Dictionary:
			return Types.BillingProgramAvailabilityResultAndroid.from_dict(result)
	var default_result = Types.BillingProgramAvailabilityResultAndroid.new()
	default_result.is_available = false
	return default_result

## Show alternative billing dialog (Android).
## @return Types.UserChoiceBillingDetails
func show_alternative_billing_dialog_android() -> Variant:
	if _native_plugin and _platform == "Android":
		var result_json = _native_plugin.call("showAlternativeBillingDialogAndroid")
		var result = JSON.parse_string(result_json)
		if result is Dictionary:
			return Types.UserChoiceBillingDetails.from_dict(result)
	var default_result = Types.UserChoiceBillingDetails.new()
	return default_result

## Create alternative billing token (Android).
## @return Types.BillingProgramReportingDetailsAndroid
func create_alternative_billing_token_android() -> Variant:
	if _native_plugin and _platform == "Android":
		var result_json = _native_plugin.call("createAlternativeBillingTokenAndroid")
		var result = JSON.parse_string(result_json)
		if result is Dictionary:
			return Types.BillingProgramReportingDetailsAndroid.from_dict(result)
	var default_result = Types.BillingProgramReportingDetailsAndroid.new()
	return default_result

## Check if a billing program is available (Android 8.2.0+).
## @param billing_program: Types.BillingProgramAndroid - billing program enum value
## @return Types.BillingProgramAvailabilityResultAndroid
func is_billing_program_available_android(billing_program) -> Variant:
	if _native_plugin and _platform == "Android":
		var result_json = _native_plugin.call("isBillingProgramAvailableAndroid", billing_program)
		var result = JSON.parse_string(result_json)
		if result is Dictionary:
			return Types.BillingProgramAvailabilityResultAndroid.from_dict(result)
	var default_result = Types.BillingProgramAvailabilityResultAndroid.new()
	default_result.is_available = false
	default_result.billing_program = billing_program
	return default_result

## Launch external link (Android 8.2.0+).
## @param params: Types.LaunchExternalLinkParamsAndroid - external link parameters
## @return Types.VoidResult
func launch_external_link_android(params) -> Variant:
	if _native_plugin and _platform == "Android":
		var params_json = JSON.stringify(params.to_dict())
		var result_json = _native_plugin.call("launchExternalLinkAndroid", params_json)
		var result = JSON.parse_string(result_json)
		if result is Dictionary:
			return Types.VoidResult.from_dict(result)
	var default_result = Types.VoidResult.new()
	default_result.success = false
	return default_result

## Create billing program reporting details (Android 8.2.0+).
## @param billing_program: Types.BillingProgramAndroid - billing program enum value
## @return Types.BillingProgramReportingDetailsAndroid
func create_billing_program_reporting_details_android(billing_program) -> Variant:
	if _native_plugin and _platform == "Android":
		var result_json = _native_plugin.call("createBillingProgramReportingDetailsAndroid", billing_program)
		var result = JSON.parse_string(result_json)
		if result is Dictionary:
			return Types.BillingProgramReportingDetailsAndroid.from_dict(result)
	var default_result = Types.BillingProgramReportingDetailsAndroid.new()
	default_result.billing_program = billing_program
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
## @return void
func deep_link_to_subscriptions(options = null) -> void:
	var opts = options if options != null else Types.DeepLinkOptions.new()
	if _native_plugin and (_platform == "Android" or _platform == "iOS"):
		var options_json = JSON.stringify(opts.to_dict())
		_native_plugin.call("deepLinkToSubscriptions", options_json)
	elif _platform == "iOS":
		# iOS: Open App Store subscription management URL
		OS.shell_open("https://apps.apple.com/account/subscriptions")
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
