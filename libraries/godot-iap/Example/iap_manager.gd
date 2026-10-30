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
const PurchaseFlow = preload("res://addons/godot-iap/purchase_flow.gd")
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
const CONSUMABLES := [PRODUCT_10_BULBS, PRODUCT_30_BULBS]

var store_connected := false
var products: Dictionary = {}  # product_id -> Types.ProductAndroid or Types.ProductIOS
var is_loading := false
var subscription_entitlements := {PRODUCT_PREMIUM: false, PRODUCT_PREMIUM_YEAR: false}
var verification_method: IapkitConfig.Method = IapkitConfig.default_method()
## One flow for the whole app: it confirms, credits, and finishes every purchase.
var flow: PurchaseFlow
var _amazon_catalog: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://amazon.sdktester.json"))
# Credited purchase ids; a real app keeps them in its own store.
var _granted_ids := {}


func _ready() -> void:
	flow = GodotIapPlugin.create_purchase_flow({
		"confirm_with_backend": _confirm,
		"is_consumable": func(product_id: String) -> bool: return product_id in CONSUMABLES,
	})
	flow.purchase_processed.connect(_on_purchase_processed)
	GodotIapPlugin.purchase_error.connect(_on_purchase_error)
	GodotIapPlugin.products_fetched.connect(_on_products_fetched)

	_set_loading(true)
	store_connected = await GodotIapPlugin.init_connection()
	connection_changed.emit(store_connected)

	if not store_connected:
		_set_loading(false)
		push_warning("[IAPManager] Failed to connect to store")
		return
	print("[IAPManager] GodotIap connected")
	# Purchases left unfinished, e.g. by a crash, go through the flow first.
	await flow.recover_purchases()
	print("[IAPManager] Fetching products...")
	await _fetch_products()


func _set_loading(loading: bool) -> void:
	is_loading = loading
	loading_changed.emit(loading)


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
	if result.get("method", "fetchProducts") != "fetchProducts":
		return
	print("[IAPManager] Products fetched (async): %d" % result.get("products", []).size())
	_set_loading(false)

	if result.has("products"):
		for product_dict in result["products"]:
			if product_dict is Dictionary:
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


func set_verification_method(method: IapkitConfig.Method) -> void:
	verification_method = method
	verification_changed.emit(IapkitConfig.method_label(verification_method))
	if verification_method != IapkitConfig.Method.NONE:
		# Purchases the previous method left unfinished get another try.
		await flow.recover_purchases()


# Reads the selected method on every call, so changing it needs no new flow.
func _confirm(purchase: Dictionary, is_consumable: bool) -> Variant:
	match verification_method:
		IapkitConfig.Method.LOCAL_DEVICE:
			var confirm := GodotIapPlugin.confirm_on_device_ios({"grant": _grant})
			return await confirm.call(purchase, is_consumable)
		IapkitConfig.Method.IAPKIT_LOCAL, IapkitConfig.Method.IAPKIT:
			var confirm := GodotIapPlugin.confirm_with_iapkit({
				"api_key": IapkitConfig.api_key(),
				"base_url": IapkitConfig.local_base_url() if verification_method == IapkitConfig.Method.IAPKIT_LOCAL else "",
				"amazon": {
					"sandbox": IapkitConfig.amazon_rvs_sandbox(),
					"expected_environment": IapkitConfig.amazon_expected_environment(),
					"verified_product_id": _amazon_parent_sku,
				},
				"verify_as": _verify_as,
				"grant": _grant,
			})
			return await confirm.call(purchase, is_consumable)
	return PurchaseFlow.Failure.new("No verification method selected; the purchase stays unfinished")


# RVS reports a subscription term under its parent SKU.
func _amazon_parent_sku(product_id: String) -> String:
	return _amazon_catalog.get(product_id, {}).get("subscriptionBase", product_id)


# The educational community provider sends Amazon receipts.
func _verify_as(purchase: Dictionary) -> Variant:
	return "amazon" if purchase.get("storeId") == "amazon_example" else null


# Bulbs are credited here, once per purchase id, before the flow consumes them.
func _grant(purchase: Dictionary, _is_consumable: bool) -> bool:
	if _granted_ids.has(purchase.id):
		print("[IAPManager] %s was already credited" % purchase.id)
		return true
	_granted_ids[purchase.id] = true
	purchase_completed.emit(purchase.productId)
	return true


func _on_purchase_processed(purchase: Dictionary, status: PurchaseFlow.Status) -> void:
	var guidance := PurchaseFlow.describe_purchase_flow_status(status)
	var result := "%s: %s" % [purchase.productId, guidance.key]
	if guidance.key == "change_pending":
		result = "Plan change to %s is pending. %s stays active until it applies." % [
			", ".join(PackedStringArray(purchase.pendingPurchaseUpdateAndroid.products)), purchase.productId,
		]
	elif status.error != null:
		result += " (%s)" % status.error
	verification_result.emit("%s — %s" % [IapkitConfig.method_label(verification_method), result], status.status == "entitled")
	if status.status == "entitled":
		refresh_subscriptions()


func _on_purchase_error(error: Dictionary) -> void:
	if error.get("method") == "verifyAppOwnership":
		return
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
		await flow.recover_purchases(true)
		await refresh_subscriptions()
		purchases_restored.emit()


## Premium follows the store's active subscriptions.
func refresh_subscriptions() -> void:
	var result := await GodotIapPlugin.get_active_subscriptions_result()
	if not result.get("success", false):
		push_warning("[IAPManager] Subscription query failed; premium stays as it was")
		return
	var active := {PRODUCT_PREMIUM: false, PRODUCT_PREMIUM_YEAR: false}
	for subscription in result.subscriptions:
		# Amazon reports the parent SKU, and the term in current_plan_id.
		var term = subscription.current_plan_id if subscription.current_plan_id in active else subscription.product_id
		if subscription.is_active and term in active:
			active[term] = true
	subscription_entitlements = active
	subscription_entitlements_changed.emit()
