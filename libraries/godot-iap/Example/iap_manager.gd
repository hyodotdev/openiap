extends Node
## IAP Manager - Handles in-app purchases using GodotIap
##
## Product IDs (Google Play Console / App Store Connect에서 설정):
## - "dev.hyo.martie.10bulbs" : Consumable - 전구 10개
## - "dev.hyo.martie.30bulbs" : Consumable - 전구 30개
## - "dev.hyo.martie.certified" : Non-consumable - 인증 배지
## - "dev.hyo.martie.premium" : Non-consumable - 프리미엄 (무제한 전구)
## - "dev.hyo.martie.premium_year" : Subscription - 연간 프리미엄 구독

# Load OpenIAP types
const Types = preload("res://addons/godot-iap/types.gd")

signal purchase_completed(product_id: String)
signal purchase_failed(product_id: String, error: String)
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


func _ready() -> void:
	_init_godotiap()


func _init_godotiap() -> void:
	# Connect to GodotIap signals
	GodotIapPlugin.purchase_updated.connect(_on_purchase_updated)
	GodotIapPlugin.purchase_error.connect(_on_purchase_error)
	GodotIapPlugin.products_fetched.connect(_on_products_fetched)

	# Initialize connection
	_set_loading(true)
	store_connected = GodotIapPlugin.init_connection()
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
	_clear_pending_purchases()
	print("[IAPManager] Fetching products...")
	_fetch_products()


## Clear pending purchases that weren't finished (e.g., app crashed after purchase)
func _clear_pending_purchases() -> void:
	print("[IAPManager] Checking for pending purchases...")
	var pending_purchases = GodotIapPlugin.get_available_purchases()

	if pending_purchases.size() == 0:
		print("[IAPManager] No pending purchases found")
		return

	print("[IAPManager] Found %d pending purchase(s), finishing..." % pending_purchases.size())

	for purchase in pending_purchases:
		# Types.PurchaseAndroid/PurchaseIOS objects have direct properties
		var product_id: String = purchase.product_id
		var is_acknowledged: bool = purchase.is_acknowledged_android if "is_acknowledged_android" in purchase else false

		print("[IAPManager] Processing pending purchase: %s (acknowledged: %s)" % [product_id, is_acknowledged])

		# Skip already acknowledged purchases (non-consumables that are properly owned)
		if is_acknowledged:
			print("[IAPManager] Skipping acknowledged purchase: %s" % product_id)
			continue

		# Determine if consumable
		var is_consumable = (product_id == PRODUCT_10_BULBS or product_id == PRODUCT_30_BULBS)

		print("[IAPManager] Finishing pending purchase: %s (consumable: %s)" % [product_id, is_consumable])

		var result = GodotIapPlugin.finish_transaction_dict(purchase.to_dict(), is_consumable)
		print("[IAPManager] finish_transaction_dict result: success=%s" % result.success)

	print("[IAPManager] Pending purchases cleared")


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
	print("[IAPManager] Products fetched (async): ", result)
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
		products[id] = product
		var price = product.get("displayPrice", product.get("localizedPrice", "")) if product is Dictionary else product.display_price
		print("[IAPManager] Product loaded: %s - %s" % [id, price])
	products_loaded.emit()


func _on_purchase_updated(purchase: Dictionary) -> void:
	var product_id: String = purchase.get("productId", "")
	var purchase_state: String = purchase.get("purchaseState", "")
	var transaction_id: String = purchase.get("transactionId", "")

	print("[IAPManager] Purchase updated: %s (state: %s, txn: %s)" % [product_id, purchase_state, transaction_id])

	# Prevent duplicate processing of the same transaction
	if transaction_id != "" and _processed_transactions.has(transaction_id):
		print("[IAPManager] Transaction already processed, skipping: %s" % transaction_id)
		return

	if purchase_state == "Purchased" or purchase_state == "purchased":
		# Mark transaction as processed to prevent duplicates
		if transaction_id != "":
			_processed_transactions[transaction_id] = true

		# Finish transaction (consumables: 10bulbs, 30bulbs)
		var consumable = (product_id == PRODUCT_10_BULBS or product_id == PRODUCT_30_BULBS)

		# Use the raw purchase dictionary directly to preserve transactionId
		GodotIapPlugin.finish_transaction_dict(purchase, consumable)

		purchase_completed.emit(product_id)


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
	var is_subscription = (product_id == PRODUCT_PREMIUM_YEAR)

	# Create typed RequestPurchaseProps
	var props = Types.RequestPurchaseProps.new()
	props.request = Types.RequestPurchasePropsByPlatforms.new()

	# Set Google (Android) props
	props.request.google = Types.RequestPurchaseAndroidProps.new()
	var google_skus: Array[String] = [product_id]
	props.request.google.skus = google_skus

	# For subscriptions on Android, offer_token is required
	if is_subscription:
		if offer_token.is_empty():
			# Get default offer token from product if not provided
			offer_token = _get_default_offer_token(product_id)

		if not offer_token.is_empty():
			props.request.google.offer_token = offer_token
			print("[IAPManager] Using offer token: %s" % offer_token.substr(0, 20) + "...")
		else:
			push_warning("[IAPManager] No offer token available for subscription")

	# Set Apple (iOS) props
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
	if "subscription_offer_details_android" in product and product.subscription_offer_details_android:
		for offer in product.subscription_offer_details_android:
			if offer.offer_token:
				return offer.offer_token

	return ""


## Get all available offers for a subscription product
func get_subscription_offers(product_id: String) -> Array:
	if not products.has(product_id):
		return []

	var product = products[product_id]
	var offers: Array = []

	# Android: Get subscription offer details
	if "subscription_offer_details_android" in product and product.subscription_offer_details_android:
		for offer_detail in product.subscription_offer_details_android:
			var offer_info = {
				"id": offer_detail.offer_id if offer_detail.offer_id else "base_plan",
				"base_plan_id": offer_detail.base_plan_id if "base_plan_id" in offer_detail else "",
				"offer_token": offer_detail.offer_token if "offer_token" in offer_detail else "",
				"is_base_plan": offer_detail.offer_id == null or offer_detail.offer_id == ""
			}

			# Get pricing info from pricing phases
			if "pricing_phases" in offer_detail and offer_detail.pricing_phases:
				var phases = offer_detail.pricing_phases
				if "pricing_phase_list" in phases and phases.pricing_phase_list.size() > 0:
					var first_phase = phases.pricing_phase_list[0]
					offer_info["display_price"] = first_phase.formatted_price if "formatted_price" in first_phase else ""
					offer_info["billing_period"] = first_phase.billing_period if "billing_period" in first_phase else ""

			offers.append(offer_info)

	return offers


## Purchase a subscription with a specific offer
func purchase_subscription_with_offer(product_id: String, offer_token: String) -> void:
	_purchase(product_id, offer_token)


## Purchase a one-time product with a discount offer (Android 7.0+)
## Example: Purchase with a promotional discount
func purchase_with_discount(product_id: String) -> void:
	if not products.has(product_id):
		push_error("[IAPManager] Product not found: %s" % product_id)
		purchase_failed.emit(product_id, "Product not found")
		return

	var product = products[product_id]

	# Check for discount offers (one-time product offers, Android 7.0+)
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
	var result: Types.VoidResult = GodotIapPlugin.restore_purchases()

	if result.success:
		purchases_restored.emit()


func is_premium_purchased() -> bool:
	## Check if premium was purchased (for non-consumables)
	## Returns typed purchase objects (Types.PurchaseAndroid or Types.PurchaseIOS)
	var purchases = GodotIapPlugin.get_available_purchases()
	for purchase in purchases:
		# Access typed property directly
		if purchase.product_id == PRODUCT_PREMIUM:
			return true
	return false
