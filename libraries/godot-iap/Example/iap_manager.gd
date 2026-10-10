extends Node
## IAP Manager - Handles in-app purchases using GodotIap
##
## Product IDs (Google Play Console / App Store Connect에서 설정):
## - "dev.hyo.martie.10bulbs" : Consumable - 전구 10개
## - "dev.hyo.martie.30bulbs" : Consumable - 전구 30개
## - "dev.hyo.martie.certified" : Non-consumable - 인증 배지
## - "dev.hyo.martie.premium" : Subscription - Monthly premium access
## - "dev.hyo.martie.premium_year" : Subscription - 연간 프리미엄 구독

# Load OpenIAP types
const Types = preload("res://addons/godot-iap/types.gd")
const IapkitConfig = preload("res://iapkit_config.gd")

signal purchase_completed(product_id: String)
signal purchase_failed(product_id: String, error: String)
signal verification_changed(label: String)
signal verification_result(message: String, ok: bool)
signal subscription_entitlements_changed
signal purchases_restored
signal products_loaded
signal connection_changed(connected: bool)
signal loading_changed(loading: bool)

const PRODUCT_10_BULBS := "dev.hyo.martie.10bulbs"
const PRODUCT_30_BULBS := "dev.hyo.martie.30bulbs"
const PRODUCT_CERTIFIED := "dev.hyo.martie.certified"
const PRODUCT_PREMIUM := "dev.hyo.martie.premium"
const PRODUCT_PREMIUM_YEAR := "dev.hyo.martie.premium_year"

var store_connected := false
var products: Dictionary = {}  # product_id -> Types.ProductAndroid or Types.ProductIOS
var is_loading := false
var _processed_transactions: Dictionary = {}  # transactionId -> bool (to prevent duplicate processing)
var _verified_subscription_receipts: Dictionary = {}
var _reconciling_subscriptions := false
var _subscription_refresh_requested := false
var subscription_entitlements := {PRODUCT_PREMIUM: false, PRODUCT_PREMIUM_YEAR: false}

var _verifying_transactions: Dictionary = {}  # transactionId -> bool (in-flight verification)
var _amazon_catalog: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://amazon.sdktester.json"))

var verification_method: IapkitConfig.Method = IapkitConfig.default_method()


func _ready() -> void:
	await _init_godotiap()


func _init_godotiap() -> void:
	# Connect to GodotIap signals
	GodotIapPlugin.purchase_updated.connect(_on_purchase_updated)
	GodotIapPlugin.purchase_error.connect(_on_purchase_error)
	GodotIapPlugin.products_fetched.connect(_on_products_fetched)

	# Initialize connection
	_set_loading(true)
	store_connected = await GodotIapPlugin.init_connection()
	connection_changed.emit(store_connected)

	if store_connected:
		print("[IAPManager] GodotIap connected")
		# Delay product fetch to avoid blocking main thread during startup
		call_deferred("_fetch_products_delayed")
	else:
		_set_loading(false)
		push_warning("[IAPManager] Failed to connect to store")


func _set_loading(loading: bool) -> void:
	is_loading = loading
	loading_changed.emit(loading)


func _fetch_products_delayed() -> void:
	await get_tree().create_timer(0.5).timeout
	# Clear any pending purchases first
	await _clear_pending_purchases()
	print("[IAPManager] Fetching products...")
	await _fetch_products()


## Clear pending purchases that weren't finished (e.g., app crashed after purchase)
func _clear_pending_purchases() -> void:
	print("[IAPManager] Checking for pending purchases...")
	var pending_purchases: Array = []
	if OS.get_name() in ["iOS", "macOS"]:
		# Available purchases also lists every expired renewal; only an
		# unfinished transaction is still pending on iOS.
		pending_purchases = await GodotIapPlugin.get_pending_transactions_ios()
	else:
		var available_result = await GodotIapPlugin.get_available_purchases_result()
		if not available_result.get("success", false):
			push_warning(
				"[IAPManager] Could not query pending purchases: %s (%s)"
				% [
					available_result.get("error", "Unknown store error"),
					available_result.get("code", "unknown"),
				]
			)
			return
		pending_purchases = available_result.get("purchases", [])

	if pending_purchases.size() == 0:
		print("[IAPManager] No pending purchases found")
		return

	print("[IAPManager] Found %d purchase(s) for verification..." % pending_purchases.size())

	for purchase in pending_purchases:
		var purchase_dict := _purchase_to_dict(purchase)
		var product_id := _purchase_product_id(purchase, purchase_dict)
		var is_acknowledged := _purchase_is_acknowledged(purchase, purchase_dict)

		print("[IAPManager] Processing pending purchase: %s (acknowledged: %s)" % [product_id, is_acknowledged])

		# A recovered purchase takes the live path, so it is handled like a
		# live one.
		await _on_purchase_updated(purchase_dict)

	print("[IAPManager] Pending purchase review complete")


func _purchase_to_dict(purchase: Variant) -> Dictionary:
	if purchase is Dictionary:
		return purchase
	if typeof(purchase) == TYPE_OBJECT and purchase != null and purchase.has_method("to_dict"):
		var data = purchase.to_dict()
		if data is Dictionary:
			return data
	return {}


func _purchase_product_id(purchase: Variant, purchase_dict: Dictionary) -> String:
	var product_id := _string_field(purchase_dict, ["productId", "product_id"])
	if product_id.is_empty() and typeof(purchase) == TYPE_OBJECT and purchase != null:
		product_id = _string_field(purchase, ["product_id"])
	if _verification_store(purchase_dict) == "amazon":
		var term_id := _subscription_product_id(product_id, _string_field(purchase_dict, ["currentPlanId", "current_plan_id"]))
		if not term_id.is_empty():
			return term_id
	return product_id


func _subscription_product_id(product_id: String, plan_id: String) -> String:
	if product_id in [PRODUCT_PREMIUM, PRODUCT_PREMIUM_YEAR]:
		return product_id
	if plan_id not in [PRODUCT_PREMIUM, PRODUCT_PREMIUM_YEAR]:
		return ""
	var item: Dictionary = _amazon_catalog.get(plan_id, {})
	if item.get("itemType") == "SUBSCRIPTION" and product_id == item.get("subscriptionBase"):
		return plan_id
	return ""


func _purchase_is_acknowledged(purchase: Variant, purchase_dict: Dictionary) -> bool:
	var keys := [
		"isAcknowledgedAndroid",
		"isAcknowledged",
		"is_acknowledged_android",
		"is_acknowledged",
	]
	for key in keys:
		if purchase_dict.has(key) and purchase_dict[key] != null:
			return _variant_to_bool(purchase_dict[key])
	if typeof(purchase) == TYPE_OBJECT and purchase != null:
		var acknowledged = purchase.get("is_acknowledged_android")
		if acknowledged != null:
			return _variant_to_bool(acknowledged)
	return false


func _variant_to_bool(value: Variant) -> bool:
	match typeof(value):
		TYPE_BOOL:
			return value
		TYPE_INT, TYPE_FLOAT:
			return value != 0
		TYPE_STRING:
			return value.to_lower() == "true"
		_:
			return false


func _fetch_products() -> void:
	# Create typed ProductRequest
	var request = Types.ProductRequest.new()
	var sku_list: Array[String] = [PRODUCT_10_BULBS, PRODUCT_30_BULBS, PRODUCT_CERTIFIED, PRODUCT_PREMIUM, PRODUCT_PREMIUM_YEAR]
	request.skus = sku_list
	request.type = Types.ProductQueryType.ALL

	# fetch_products now returns Array of typed products
	var fetched_products = await GodotIapPlugin.fetch_products(request)

	_set_loading(false)

	if fetched_products.size() > 0:
		_process_products(fetched_products)


func _on_products_fetched(result: Dictionary) -> void:
	# Called asynchronously on iOS when products are fetched
	print("[IAPManager] Products fetched (async): %d" % result.get("products", []).size())
	_set_loading(false)

	if result.has("products"):
		# Convert raw dictionaries to typed objects
		for product_dict in result["products"]:
			if product_dict is Dictionary:
				# Note: In async callback, we need to convert manually
				# In production, you might want to detect platform here
				products[product_dict.get("id", "")] = product_dict
		products_loaded.emit()
	elif result.has("error"):
		push_error("[IAPManager] Failed to fetch products: %s" % result.get("error", "Unknown"))


func _process_products(products_array: Array) -> void:
	for product in products_array:
		var id = product.get("id", "") if product is Dictionary else product.id
		if products.has(id) and products[id] is Dictionary and not (product is Dictionary):
			continue
		products[id] = product
		var price = product.get("displayPrice", product.get("localizedPrice", "")) if product is Dictionary else product.display_price
		print("[IAPManager] Product loaded: %s - %s" % [id, price])
	products_loaded.emit()


func _on_purchase_updated(purchase: Dictionary) -> void:
	var product_id := _purchase_product_id(purchase, purchase)
	var purchase_state: String = purchase.get("purchaseState", "")
	var transaction_id: String = purchase.get("transactionId", purchase.get("id", ""))
	if product_id not in [PRODUCT_10_BULBS, PRODUCT_30_BULBS, PRODUCT_CERTIFIED, PRODUCT_PREMIUM, PRODUCT_PREMIUM_YEAR]:
		return

	print("[IAPManager] Purchase updated: %s (state: %s, txn: %s)" % [product_id, purchase_state, transaction_id])

	# Prevent duplicate processing of the same transaction
	if transaction_id != "" and _processed_transactions.has(transaction_id):
		print("[IAPManager] Transaction already processed, skipping: %s" % transaction_id)
		return

	# A redelivery can arrive while the first verification is still in flight.
	if transaction_id != "" and _verifying_transactions.has(transaction_id):
		print("[IAPManager] Transaction already verifying, skipping: %s" % transaction_id)
		return

	if purchase_state == "Purchased" or purchase_state == "purchased":
		if transaction_id != "":
			_verifying_transactions[transaction_id] = true

		# An unverified purchase is left unfinished so the store retries it.
		# Marking it processed here would drop that redelivery for the session.
		var verified := await _verify_purchase(purchase, product_id)
		if transaction_id != "":
			_verifying_transactions.erase(transaction_id)
		if not verified:
			return

		if transaction_id != "":
			_processed_transactions[transaction_id] = true

		# Finish transaction (consumables: 10bulbs, 30bulbs)
		var consumable = (product_id == PRODUCT_10_BULBS or product_id == PRODUCT_30_BULBS)

		# Use the raw purchase dictionary directly to preserve transactionId
		var needs_finish := consumable or not _purchase_is_acknowledged(purchase, purchase)
		var finished = await GodotIapPlugin.finish_transaction_dict(purchase, consumable) if needs_finish else null
		if needs_finish and (finished == null or not finished.success):
			# The store redelivers an unfinished transaction; crediting now
			# would credit it again on that redelivery.
			if transaction_id != "":
				_processed_transactions.erase(transaction_id)
			push_warning("[IAPManager] Finish failed, leaving %s for redelivery" % product_id)
			return

		if product_id in [PRODUCT_PREMIUM, PRODUCT_PREMIUM_YEAR]:
			_verified_subscription_receipts[_subscription_receipt_identity(purchase)] = product_id
		purchase_completed.emit(product_id)


func cycle_verification_method() -> void:
	verification_method = IapkitConfig.next_method(verification_method)
	verification_changed.emit(IapkitConfig.method_label(verification_method))
	if verification_method != IapkitConfig.Method.NONE:
		await _clear_pending_purchases()
		await reconcile_subscription_entitlements()


func verification_label() -> String:
	return IapkitConfig.method_label(verification_method)


func _verify_purchase(purchase: Dictionary, product_id: String, pending_only: bool = true) -> bool:
	var label := IapkitConfig.method_label(verification_method)

	match verification_method:
		IapkitConfig.Method.NONE:
			verification_result.emit("%s — receipt retained; select verification to retry" % label, false)
			return false
		IapkitConfig.Method.LOCAL_DEVICE:
			if OS.get_name() not in ["iOS", "macOS"]:
				verification_result.emit("%s — unavailable here; choose Local (IAPKit) or IAPKit (Server)" % label, false)
				return false
			var receipts: Array = []
			if pending_only:
				receipts = await GodotIapPlugin.get_pending_transactions_ios()
			else:
				var owned := await GodotIapPlugin.get_available_purchases_result({"onlyIncludeActiveItemsIOS": true})
				if owned.get("success", false):
					receipts = owned.get("purchases", [])
			var is_valid := _matches_apple_receipt(purchase, receipts)
			verification_result.emit("%s — valid: %s" % [label, str(is_valid)], is_valid)
			return is_valid

	var api_key := IapkitConfig.api_key()
	if api_key.is_empty():
		verification_result.emit("%s — api_key not set in iapkit.cfg" % label, false)
		return false

	var base_url := ""
	if verification_method == IapkitConfig.Method.IAPKIT_LOCAL:
		base_url = IapkitConfig.local_base_url()
		if base_url.is_empty():
			verification_result.emit("%s — base_url not set in iapkit.cfg" % label, false)
			return false

	var iapkit := {"apiKey": api_key}
	if not base_url.is_empty():
		iapkit["baseUrl"] = base_url

	var token := str(purchase.get("purchaseToken", ""))
	var store := _verification_store(purchase)
	match store:
		"apple":
			iapkit["apple"] = {"jws": token}
		"amazon":
			# IAPKit rejects an Amazon receipt without the buyer's id.
			var amazon_user_id := str(purchase.get("userIdAmazon", "")).strip_edges()
			iapkit["amazon"] = {
				"expectedProductId": _verification_product_id(product_id, "amazon"),
				"receiptId": token,
				"sandbox": IapkitConfig.amazon_rvs_sandbox(),
			}
			if not amazon_user_id.is_empty():
				iapkit["amazon"]["userId"] = amazon_user_id
		"horizon":
			# Horizon identifies the entitlement by SKU, not a token.
			iapkit["horizon"] = {"sku": product_id}
		"google":
			iapkit["google"] = {"purchaseToken": token}
		_:
			verification_result.emit("Unsupported verification store; receipt retained", false)
			return false

	if store != "horizon" and token.is_empty():
		verification_result.emit("%s — no purchase token" % label, false)
		return false

	var result = await GodotIapPlugin.verify_purchase_with_provider({
		"provider": "iapkit",
		"iapkit": iapkit,
	})

	var verified = result.iapkit if result != null else null
	if not _accepts_verification(verified, product_id, str(purchase.get("store", "")).to_lower(), str(purchase.get("storeId", "")), purchase.get("environmentIOS")):
		var reason := "invalid" if verified != null else "no response"
		verification_result.emit("%s — %s" % [label, reason], false)
		purchase_failed.emit(product_id, "%s failed" % label)
		return false

	verification_result.emit(
		"%s — valid, %s" % [label, _iapkit_state_name(verified.state)], true
	)
	return true


func _matches_apple_receipt(purchase: Dictionary, receipts: Array) -> bool:
	if purchase.get("store") != "apple" or purchase.get("storeId") != "apple" or str(purchase.get("id", "")).is_empty():
		return false
	for receipt in receipts:
		var data := _purchase_to_dict(receipt)
		if data.get("store") != "apple" or data.get("storeId") != "apple" or data.get("id") != purchase.get("id") or data.get("productId") != purchase.get("productId"):
			continue
		if data.get("revocationDateIOS") != null or data.get("isUpgradedIOS") == true:
			continue
		if data.get("expirationDateIOS") != null and float(data.expirationDateIOS) <= Time.get_unix_time_from_system() * 1000:
			continue
		if purchase.get("environmentIOS") == null or data.get("environmentIOS") == purchase.get("environmentIOS"):
			return true
	return false


# Only this known community adapter uses Amazon's server verification.
func _verification_store(purchase: Dictionary) -> String:
	var store := str(purchase.get("store", "")).to_lower()
	return "amazon" if store == "unknown" and purchase.get("storeId") == "amazon_example" else store


func _verification_product_id(product_id: String, store: String) -> String:
	var item: Dictionary = _amazon_catalog.get(product_id, {})
	if store == "amazon" and item.get("itemType") == "SUBSCRIPTION":
		return item.get("subscriptionBase", item.get("subscriptionParent", product_id))
	return product_id


func _accepts_verification(verified: Variant, product_id: String, store: String, store_id: String = "", environment: Variant = null) -> bool:
	if verified == null or not verified.is_valid:
		return false
	var store_names := {"apple": Types.IapStore.APPLE, "google": Types.IapStore.GOOGLE, "amazon": Types.IapStore.AMAZON, "horizon": Types.IapStore.HORIZON, "unknown": Types.IapStore.UNKNOWN}
	if not store_names.has(store) or verified.store != store_names[store]:
		return false
	if (store == "unknown" and store_id != "amazon_example") or (not store_id.is_empty() and verified.store_id != store_id):
		return false
	if store == "apple" and environment != null and verified.environment != environment:
		return false
	store = _verification_store({"store": store, "storeId": store_id})
	if verified.product_id != _verification_product_id(product_id, store):
		return false
	var consumable := product_id in [PRODUCT_10_BULBS, PRODUCT_30_BULBS]
	match store:
		"apple", "amazon":
			if store == "amazon" and verified.environment != ("Sandbox" if IapkitConfig.amazon_rvs_sandbox() else "Production"):
				return false
			return verified.state == (Types.IapkitPurchaseState.READY_TO_CONSUME if consumable else Types.IapkitPurchaseState.ENTITLED)
		"google":
			return verified.state in [Types.IapkitPurchaseState.ENTITLED, Types.IapkitPurchaseState.PENDING_ACKNOWLEDGMENT] or (consumable and verified.state == Types.IapkitPurchaseState.READY_TO_CONSUME)
		"horizon":
			return verified.state == Types.IapkitPurchaseState.ENTITLED
	return false


func _iapkit_state_name(state: int) -> String:
	var names := Types.IapkitPurchaseState.keys()
	return str(names[state]) if state >= 0 and state < names.size() else "UNKNOWN"


func _on_purchase_error(error: Dictionary) -> void:
	var message = error.get("message", "Unknown error")
	var code = error.get("code", "")

	# User cancellation is not a real error, just log it
	if code == "user-cancelled" or code == "USER_CANCELLED":
		print("[IAPManager] Purchase cancelled by user")
	else:
		push_error("[IAPManager] Purchase error: %s (code: %s)" % [message, code])

	purchase_failed.emit("", message)


# ============================================
# Public API
# ============================================

func purchase_10_bulbs() -> void:
	_purchase(PRODUCT_10_BULBS)


func purchase_30_bulbs() -> void:
	_purchase(PRODUCT_30_BULBS)


func purchase_certified() -> void:
	_purchase(PRODUCT_CERTIFIED)


func purchase_premium() -> void:
	_purchase(PRODUCT_PREMIUM)


func purchase_premium_year() -> void:
	_purchase(PRODUCT_PREMIUM_YEAR)


func _purchase(product_id: String, offer_token: String = "") -> void:
	if not store_connected:
		push_error("[IAPManager] Not connected to store")
		purchase_failed.emit(product_id, "Not connected")
		return

	print("[IAPManager] Requesting purchase: %s" % product_id)

	# Determine product type (subscription vs in-app)
	var is_subscription = product_id in [PRODUCT_PREMIUM, PRODUCT_PREMIUM_YEAR]

	# Create typed RequestPurchaseProps
	var props = Types.RequestPurchaseProps.new()
	var google_skus: Array[String] = [product_id]

	if is_subscription:
		props.request_subscription = Types.RequestSubscriptionPropsByPlatforms.new()
		props.request_subscription.google = Types.RequestSubscriptionAndroidProps.new()
		props.request_subscription.google.skus = google_skus
		props.request_subscription.apple = Types.RequestSubscriptionIosProps.new()
		props.request_subscription.apple.sku = product_id

		# For subscriptions on Android, an offer token is normally required.
		if offer_token.is_empty():
			# Get default offer token from product if not provided
			offer_token = _get_default_offer_token(product_id)

		if not offer_token.is_empty():
			var subscription_offer = Types.AndroidSubscriptionOfferInput.new()
			subscription_offer.sku = product_id
			subscription_offer.offer_token = offer_token
			props.request_subscription.google.subscription_offers.append(subscription_offer)
			print("[IAPManager] Using configured subscription offer")
		else:
			push_warning("[IAPManager] No offer token available for subscription")
	else:
		props.request = Types.RequestPurchasePropsByPlatforms.new()
		props.request.google = Types.RequestPurchaseAndroidProps.new()
		props.request.google.skus = google_skus
		props.request.apple = Types.RequestPurchaseIosProps.new()
		props.request.apple.sku = product_id

	# Set correct product type
	props.type = Types.ProductQueryType.SUBS if is_subscription else Types.ProductQueryType.IN_APP

	var _result = GodotIapPlugin.request_purchase(props)


## Get the default offer token for a subscription product (Android)
func _get_default_offer_token(product_id: String) -> String:
	if not products.has(product_id):
		return ""

	var product = products[product_id]

	# Check if product has subscription offer details (Android)
	for offer in _subscription_offer_details(product):
		var offer_token := _offer_token_from_detail(offer)
		if not offer_token.is_empty():
			return offer_token

	return ""


## Get all available offers for a subscription product
func get_subscription_offers(product_id: String) -> Array:
	if not products.has(product_id):
		return []

	var product = products[product_id]
	var offers: Array = []

	# Android: Get subscription offer details
	for offer_detail in _subscription_offer_details(product):
		var offer_id := _string_field(offer_detail, ["offerId", "offer_id", "id"])
		var offer_info = {
			"id": offer_id if not offer_id.is_empty() else "base_plan",
			"base_plan_id": _string_field(offer_detail, ["basePlanId", "base_plan_id", "basePlanIdAndroid", "base_plan_id_android"]),
			"offer_token": _offer_token_from_detail(offer_detail),
			"is_base_plan": offer_id.is_empty()
		}

		# Get pricing info from pricing phases
		var phases = _field(offer_detail, ["pricingPhases", "pricing_phases", "pricingPhasesAndroid", "pricing_phases_android"])
		var phase_list = _field(phases, ["pricingPhaseList", "pricing_phase_list"])
		if phase_list is Array and phase_list.size() > 0:
			var first_phase = phase_list[0]
			offer_info["display_price"] = _string_field(first_phase, ["formattedPrice", "formatted_price", "displayPrice", "display_price"])
			offer_info["billing_period"] = _string_field(first_phase, ["billingPeriod", "billing_period"])

		offers.append(offer_info)

	return offers


func _subscription_offer_details(product: Variant) -> Array:
	var offers = _field(product, [
		"subscriptionOffers",
		"subscription_offers",
	])
	if offers is Array:
		return offers

	return []


func _offer_token_from_detail(offer_detail: Variant) -> String:
	return _string_field(offer_detail, [
		"offerToken",
		"offer_token",
		"offerTokenAndroid",
		"offer_token_android",
	])


func _string_field(source: Variant, keys: Array) -> String:
	var value = _field(source, keys)
	return "" if value == null else str(value)


func _field(source: Variant, keys: Array) -> Variant:
	if source == null:
		return null
	if source is Dictionary:
		for key in keys:
			if source.has(key):
				return source[key]
		return null
	if typeof(source) == TYPE_OBJECT:
		for key in keys:
			var value = source.get(key)
			if value != null:
				return value
	return null


## Purchase a subscription with a specific offer
func purchase_subscription_with_offer(product_id: String, offer_token: String) -> void:
	_purchase(product_id, offer_token)


## Purchase a one-time product with a discount offer (Android 8.0+)
## Example: Purchase with a promotional discount
func purchase_with_discount(product_id: String) -> void:
	if not products.has(product_id):
		push_error("[IAPManager] Product not found: %s" % product_id)
		purchase_failed.emit(product_id, "Product not found")
		return

	var product = products[product_id]

	# Check for discount offers (one-time product offers, Android 8.0+)
	if "discount_offers" in product and product.discount_offers.size() > 0:
		var discount_offer = product.discount_offers[0]
		print("[IAPManager] Found discount offer: %s%% off" % discount_offer.percentage_discount_android)

		# Create purchase request with discount offer token
		var props = Types.RequestPurchaseProps.new()
		props.request = Types.RequestPurchasePropsByPlatforms.new()
		props.type = Types.ProductQueryType.IN_APP

		props.request.google = Types.RequestPurchaseAndroidProps.new()
		var google_skus: Array[String] = [product_id]
		props.request.google.skus = google_skus
		# Pass the offer token from the discount offer (note: response field has _android suffix)
		props.request.google.offer_token = discount_offer.offer_token_android

		props.request.apple = Types.RequestPurchaseIosProps.new()
		props.request.apple.sku = product_id

		var _result = GodotIapPlugin.request_purchase(props)
	else:
		# No discount available, purchase at regular price
		_purchase(product_id)


func restore_purchases() -> void:
	## Restore previous purchases
	print("[IAPManager] Restoring purchases...")
	var result: Types.VoidResult = await GodotIapPlugin.restore_purchases()

	if result.success:
		await _clear_pending_purchases()
		await reconcile_subscription_entitlements()
		purchases_restored.emit()


func reconcile_subscription_entitlements() -> bool:
	_subscription_refresh_requested = true
	if _reconciling_subscriptions:
		return false
	_reconciling_subscriptions = true
	var succeeded := false
	while _subscription_refresh_requested:
		_subscription_refresh_requested = false
		succeeded = await _reconcile_subscription_entitlements()
	_reconciling_subscriptions = false
	return succeeded


func _reconcile_subscription_entitlements() -> bool:
	var ids: Array[String] = [PRODUCT_PREMIUM, PRODUCT_PREMIUM_YEAR]
	# Amazon restore reports the shared base and the exact term in currentPlanId.
	for term_id in ids.duplicate():
		var item: Dictionary = _amazon_catalog.get(term_id, {})
		var base_id: String = item.get("subscriptionBase", "")
		if not base_id.is_empty() and base_id not in ids:
			ids.append(base_id)
	var result := await GodotIapPlugin.get_active_subscriptions_result(ids)
	if not result.get("success", false):
		push_warning("Subscription query failed; existing entitlements retained")
		return false
	var active := {}
	for subscription in result.get("subscriptions", []):
		var term_id := _subscription_product_id(subscription.product_id, _string_field(subscription, ["current_plan_id"]))
		if not term_id.is_empty() and subscription.is_active and not subscription.transaction_id.is_empty():
			if not active.has(term_id):
				active[term_id] = []
			active[term_id].append(subscription.transaction_id)
	var next := {PRODUCT_PREMIUM: false, PRODUCT_PREMIUM_YEAR: false}
	if not active.is_empty():
		var available := await GodotIapPlugin.get_available_purchases_result()
		if not available.get("success", false):
			return false
		for receipt in available.get("purchases", []):
			var data := _purchase_to_dict(receipt)
			var id := _purchase_product_id(receipt, data)
			var receipt_id := _subscription_receipt_identity(data)
			var transaction_id := str(data.get("transactionId", data.get("id", "")))
			if not transaction_id in active.get(id, []) or receipt_id.is_empty() or data.get("purchaseState", "") != "purchased":
				continue
			if _verified_subscription_receipts.get(receipt_id) != id:
				if data.get("store") == "apple" and data.get("storeId") == "apple":
					var pending: Array = await GodotIapPlugin.get_pending_transactions_ios()
					if _matches_apple_receipt(data, pending):
						await _on_purchase_updated(data)
					elif await _verify_purchase(data, id, false):
						_verified_subscription_receipts[receipt_id] = id
				elif _purchase_is_acknowledged(receipt, data) or _processed_transactions.has(transaction_id):
					if await _verify_purchase(data, id):
						_verified_subscription_receipts[receipt_id] = id
				else:
					await _on_purchase_updated(data)
			next[id] = next[id] or _verified_subscription_receipts.get(receipt_id) == id
	# A purchase or resume during these queries needs a fresh ownership snapshot.
	if _subscription_refresh_requested:
		return false

	subscription_entitlements = next
	subscription_entitlements_changed.emit()
	return true


func _subscription_receipt_identity(purchase: Dictionary) -> String:
	var id := str(purchase.get("transactionId", purchase.get("id", "")))
	if id.is_empty():
		return ""
	return "%s:%s" % [purchase.get("storeId", purchase.get("store", "")), id]


func is_premium_purchased() -> Variant:
	if not await reconcile_subscription_entitlements():
		return null
	return subscription_entitlements[PRODUCT_PREMIUM]
