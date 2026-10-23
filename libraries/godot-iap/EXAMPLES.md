# Godot IAP Examples

This guide provides step-by-step tutorials for implementing in-app purchases in your Godot game using the type-safe API.

## Table of Contents

1. [Setup](#1-setup)
2. [Basic Purchase Flow](#2-basic-purchase-flow)
3. [Subscription Implementation](#3-subscription-implementation)
4. [Working with Discount Offers](#4-working-with-discount-offers)
5. [Restoring Purchases](#5-restoring-purchases)
6. [Complete Store UI](#6-complete-store-ui)

---

## 1. Setup

### 1.1 Loading Types

All examples use the OpenIAP type system for type safety:

```gdscript
# Load OpenIAP types at the top of your script
const Types = preload("res://addons/godot-iap/types.gd")
```

### 1.2 Scene-Based Setup

Add `GodotIapWrapper` as a child node in your scene:

```gdscript
extends Node

const Types = preload("res://addons/godot-iap/types.gd")

# Reference to GodotIapWrapper node (add as child in scene)
@onready var iap = $GodotIapWrapper

func _ready():
    # Connect signals
    iap.purchase_updated.connect(_on_purchase_updated)
    iap.purchase_error.connect(_on_purchase_error)
    iap.products_fetched.connect(_on_products_fetched)

    # Initialize connection
    if iap.init_connection():
        print("IAP connected!")
```

### 1.3 Autoload Setup

For global access, create an Autoload singleton:

```gdscript
# iap_manager.gd - Add as Autoload in Project Settings
extends Node

const Types = preload("res://addons/godot-iap/types.gd")

var iap: Node
var is_connected: bool = false

func _ready():
    _setup_iap_node()
    _initialize_iap()

func _setup_iap_node():
    # Create GodotIapWrapper node dynamically
    var wrapper = preload("res://addons/godot-iap/godot_iap.gd").new()
    wrapper.name = "GodotIapWrapper"
    add_child(wrapper)
    iap = wrapper

func _initialize_iap():
    iap.purchase_updated.connect(_on_purchase_updated)
    iap.purchase_error.connect(_on_purchase_error)
    iap.products_fetched.connect(_on_products_fetched)

    is_connected = iap.init_connection()
```

---

## 2. Basic Purchase Flow

### 2.1 Fetching Products

```gdscript
const PRODUCT_IDS = {
    "coins_100": "com.yourgame.coins_100",
    "coins_500": "com.yourgame.coins_500",
    "remove_ads": "com.yourgame.remove_ads"
}

var products: Dictionary = {}  # product_id -> product object

func fetch_products():
    # Create typed ProductRequest
    var request = Types.ProductRequest.new()
    var skus: Array[String] = []
    for sku in PRODUCT_IDS.values():
        skus.append(sku)
    request.skus = skus
    request.type = Types.ProductQueryType.ALL

    # Returns Array of Types.ProductAndroid or Types.ProductIOS
    var fetched = await iap.fetch_products(request)

    for product in fetched:
        # Access typed properties directly
        products[product.id] = product
        print("Product: %s - %s" % [product.title, product.display_price])
```

### 2.2 Making a Purchase

```gdscript
func buy_product(product_id: String):
    if not is_connected:
        push_error("IAP not connected")
        return

    # Create typed RequestPurchaseProps
    var props = Types.RequestPurchaseProps.new()
    props.request = Types.RequestPurchasePropsByPlatforms.new()

    # Android configuration
    props.request.google = Types.RequestPurchaseAndroidProps.new()
    var skus: Array[String] = [product_id]
    props.request.google.skus = skus

    # iOS configuration
    props.request.apple = Types.RequestPurchaseIosProps.new()
    props.request.apple.sku = product_id

    props.type = Types.ProductQueryType.IN_APP

    # Returns typed purchase object or null
    var purchase = iap.request_purchase(props)
    if purchase:
        print("Purchase initiated: ", purchase.product_id)
```

### 2.3 Handling Purchase Results

The purchase flow confirms each purchase the store delivers, credits it, and
then finishes it. Create one for the whole app, then recover what a crash or an
offline backend left unfinished:

```gdscript
const PurchaseFlow = preload("res://addons/godot-iap/purchase_flow.gd")
const CONSUMABLES = ["com.yourgame.coins_100", "com.yourgame.coins_500"]

var flow: PurchaseFlow

func _ready():
    flow = iap.create_purchase_flow({
        # An app with a backend calls it here instead.
        "confirm_with_backend": iap.confirm_with_iapkit({
            "api_key": "openiap-kit_pk_...",
            # Runs before the flow consumes the purchase.
            "grant": func(purchase, _is_consumable): _grant_purchase(purchase.productId),
        }),
        "is_consumable": func(product_id): return product_id in CONSUMABLES,
    })
    flow.purchase_processed.connect(_on_purchase_processed)
    iap.purchase_error.connect(_on_purchase_error)
    if await iap.init_connection():
        await flow.recover_purchases()

func _on_purchase_processed(purchase: Dictionary, status):
    var guidance = PurchaseFlow.describe_purchase_flow_status(status)
    print("%s: %s" % [purchase.productId, guidance.key])

func _on_purchase_error(error: Dictionary):
    if error.get("code", "") != "user-cancelled":
        print("Purchase error: %s - %s" % [error.get("code", ""), error.get("message", "")])

func _grant_purchase(product_id: String):
    match product_id:
        "com.yourgame.coins_100":
            GameState.add_coins(100)
        "com.yourgame.coins_500":
            GameState.add_coins(500)
        "com.yourgame.remove_ads":
            GameState.set_ads_removed(true)
```

`guidance.key` is one of `payment_pending`, `change_pending`,
`verification_delayed`, `owned_by_another_account`,
`test_purchase_not_accepted`, `purchase_not_valid`, `access_pending`,
`access_granted`, or `try_again_later`. Offer buying again only when
`guidance.offerPurchase` is true.

---

## 3. Subscription Implementation

### 3.1 Fetching Subscriptions

```gdscript
const SUBSCRIPTION_IDS = {
    "monthly": "com.yourgame.premium_monthly",
    "yearly": "com.yourgame.premium_yearly"
}

var subscriptions: Array = []

func fetch_subscriptions():
    var request = Types.ProductRequest.new()
    var skus: Array[String] = []
    for sku in SUBSCRIPTION_IDS.values():
        skus.append(sku)
    request.skus = skus
    request.type = Types.ProductQueryType.SUBS

    subscriptions = await iap.fetch_products(request)

    for sub in subscriptions:
        print("Subscription: %s - %s" % [sub.title, get_subscription_price(sub)])
```

### 3.2 Getting Subscription Price

```gdscript
func get_subscription_price(subscription) -> String:
    # Typed object access - use display_price directly
    if subscription is Object and subscription.display_price:
        return subscription.display_price

    # Cross-platform: use subscription_offers field
    if subscription.subscription_offers and subscription.subscription_offers.size() > 0:
        return subscription.subscription_offers[0].display_price

    return "$9.99"
```

### 3.3 Purchasing a Subscription

```gdscript
func purchase_subscription(subscription_id: String):
    if not is_connected:
        push_error("Not connected to store")
        return

    var subscription = _find_subscription(subscription_id)
    if not subscription:
        push_error("Subscription not found")
        return

    var props = Types.RequestPurchaseProps.new()
    props.request = Types.RequestPurchasePropsByPlatforms.new()
    props.type = Types.ProductQueryType.SUBS

    # Android configuration with offer token (required for subscriptions)
    props.request.google = Types.RequestPurchaseAndroidProps.new()
    var skus: Array[String] = [subscription_id]
    props.request.google.skus = skus

    # Use cross-platform subscription_offers field
    if subscription.subscription_offers and subscription.subscription_offers.size() > 0:
        var first_offer = subscription.subscription_offers[0]
        if first_offer.offer_token_android:
            var sub_offers: Array[Types.AndroidSubscriptionOfferInput] = []
            var offer = Types.AndroidSubscriptionOfferInput.new()
            offer.sku = subscription_id
            offer.offer_token = first_offer.offer_token_android
            sub_offers.append(offer)
            props.request.google.subscription_offers = sub_offers

    # iOS configuration
    props.request.apple = Types.RequestPurchaseIosProps.new()
    props.request.apple.sku = subscription_id

    iap.request_purchase(props)

func _find_subscription(subscription_id: String):
    for sub in subscriptions:
        var sub_id = sub.id if sub is Object else sub.get("id", "")
        if sub_id == subscription_id:
            return sub
    return null
```

### 3.4 Checking Subscription Status

```gdscript
func check_subscription_status() -> Variant:
    var ids: Array[String] = []
    for sku in SUBSCRIPTION_IDS.values():
        ids.append(sku)
    var result = await iap.get_active_subscriptions_result(ids)
    if not result.get("success", false):
        # Leave the existing entitlement state unchanged on store failure.
        return null
    var active = result.subscriptions.any(func(subscription): return subscription.is_active)
    GameState.set_premium(active)
    return active
```

### 3.5 Opening Subscription Management

```gdscript
func manage_subscriptions():
    var options = Types.DeepLinkOptions.new()

    if OS.get_name() == "Android":
        options.package_name_android = ProjectSettings.get_setting(
            "application/config/package_name"
        )

    iap.deep_link_to_subscriptions(options)
```

---

## 4. Working with Discount Offers

### 4.1 Understanding Offer Types

OpenIAP provides cross-platform offer types for handling discounts and promotional offers:

```gdscript
const Types = preload("res://addons/godot-iap/types.gd")

# DiscountOffer - For one-time product discounts
# Used for: Introductory offers, promotional pricing, one-time discounts (Android)

# SubscriptionOffer - For subscription-specific offers
# Used for: Free trials, introductory subscription pricing, promotional offers

# Offer types enum
enum DiscountOfferType {
    INTRODUCTORY = 0,  # First-time purchase discount
    PROMOTIONAL = 1,   # Existing/returning customer offer
    ONE_TIME = 2,      # Android-only one-time discount (Billing 8.0+)
}

# Payment modes for subscription offers
enum PaymentMode {
    FREE_TRIAL = 0,    # No charge during offer period
    PAY_AS_YOU_GO = 1, # Reduced price each period
    PAY_UP_FRONT = 2,  # Full discounted amount upfront
}
```

### 4.2 Accessing Product Offers

Products now include discount and subscription offers:

```gdscript
func fetch_products_with_offers():
    var request = Types.ProductRequest.new()
    var skus: Array[String] = ["com.yourgame.premium_monthly", "com.yourgame.coins_100"]
    request.skus = skus
    request.type = Types.ProductQueryType.ALL

    var products = await iap.fetch_products(request)

    for product in products:
        print("Product: %s" % product.id)

        # Access discount offers (for one-time products)
        if product.discount_offers and product.discount_offers.size() > 0:
            print("  Discount Offers:")
            for offer in product.discount_offers:
                _display_discount_offer(offer)

        # Access subscription offers (for subscriptions)
        if product.subscription_offers and product.subscription_offers.size() > 0:
            print("  Subscription Offers:")
            for offer in product.subscription_offers:
                _display_subscription_offer(offer)

func _display_discount_offer(offer: Types.DiscountOffer):
    print("    Offer ID: %s" % offer.id)
    print("    Price: %s (%s)" % [offer.display_price, offer.currency])
    print("    Type: %s" % _get_offer_type_name(offer.type))

    # Android-specific fields
    if OS.get_name() == "Android":
        print("    Offer token selected")
        if offer.percentage_discount_android > 0:
            print("    Discount: %d%% off" % offer.percentage_discount_android)

func _display_subscription_offer(offer: Types.SubscriptionOffer):
    print("    Offer ID: %s" % offer.id)
    print("    Price: %s" % offer.display_price)
    print("    Type: %s" % _get_offer_type_name(offer.type))
    print("    Payment Mode: %s" % _get_payment_mode_name(offer.payment_mode))
    print("    Period: %d %s(s)" % [offer.period.value, _get_period_unit_name(offer.period.unit)])
    print("    Period Count: %d" % offer.period_count)

func _get_offer_type_name(type: Types.DiscountOfferType) -> String:
    match type:
        Types.DiscountOfferType.INTRODUCTORY:
            return "Introductory"
        Types.DiscountOfferType.PROMOTIONAL:
            return "Promotional"
        Types.DiscountOfferType.ONE_TIME:
            return "One-Time"
    return "Unknown"

func _get_payment_mode_name(mode: Types.PaymentMode) -> String:
    match mode:
        Types.PaymentMode.FREE_TRIAL:
            return "Free Trial"
        Types.PaymentMode.PAY_AS_YOU_GO:
            return "Pay As You Go"
        Types.PaymentMode.PAY_UP_FRONT:
            return "Pay Up Front"
    return "Unknown"

func _get_period_unit_name(unit: Types.SubscriptionPeriodUnit) -> String:
    match unit:
        Types.SubscriptionPeriodUnit.DAY:
            return "day"
        Types.SubscriptionPeriodUnit.WEEK:
            return "week"
        Types.SubscriptionPeriodUnit.MONTH:
            return "month"
        Types.SubscriptionPeriodUnit.YEAR:
            return "year"
    return "unknown"
```

### 4.3 Purchasing with Offers (Android)

On Android, subscription offers require an offer token:

```gdscript
func purchase_subscription_with_offer(subscription_id: String, offer: Types.SubscriptionOffer):
    var props = Types.RequestPurchaseProps.new()
    props.request = Types.RequestPurchasePropsByPlatforms.new()
    props.type = Types.ProductQueryType.SUBS

    # Android configuration with offer
    props.request.google = Types.RequestPurchaseAndroidProps.new()
    var skus: Array[String] = [subscription_id]
    props.request.google.skus = skus

    # Add subscription offer with token
    var sub_offers: Array[Types.AndroidSubscriptionOfferInput] = []
    var offer_input = Types.AndroidSubscriptionOfferInput.new()
    offer_input.sku = subscription_id
    offer_input.offer_token = offer.offer_token_android
    sub_offers.append(offer_input)
    props.request.google.subscription_offers = sub_offers

    # iOS configuration
    props.request.apple = Types.RequestPurchaseIosProps.new()
    props.request.apple.sku = subscription_id

    iap.request_purchase(props)
```

### 4.4 Purchasing with Promotional Offers (iOS)

On iOS, promotional offers require server-side signature generation:

```gdscript
func purchase_with_promotional_offer_ios(sku: String, offer: Types.SubscriptionOffer):
    # Note: Signature must be generated server-side with your App Store Connect credentials
    var discount_input = Types.DiscountOfferInputIOS.new()
    discount_input.identifier = offer.id
    discount_input.key_identifier = offer.key_identifier_ios
    discount_input.nonce = offer.nonce_ios
    discount_input.signature = offer.signature_ios
    discount_input.timestamp = offer.timestamp_ios

    var props = Types.RequestPurchaseProps.new()
    props.request = Types.RequestPurchasePropsByPlatforms.new()
    props.type = Types.ProductQueryType.SUBS

    props.request.apple = Types.RequestPurchaseIosProps.new()
    props.request.apple.sku = sku
    props.request.apple.with_offer = discount_input

    iap.request_purchase(props)
```

### 4.5 Displaying Offers in UI

```gdscript
func create_offer_ui(product) -> Control:
    var container = VBoxContainer.new()

    # Main product info
    var title = Label.new()
    title.text = product.title
    container.add_child(title)

    var price = Label.new()
    price.text = "Regular: %s" % product.display_price
    container.add_child(price)

    # Show best offer if available
    var best_offer = _find_best_offer(product)
    if best_offer:
        var offer_label = Label.new()
        offer_label.add_theme_color_override("font_color", Color.GREEN)

        if best_offer is Types.SubscriptionOffer:
            match best_offer.payment_mode:
                Types.PaymentMode.FREE_TRIAL:
                    offer_label.text = "FREE for %d %s(s)!" % [
                        best_offer.period_count,
                        _get_period_unit_name(best_offer.period.unit)
                    ]
                Types.PaymentMode.PAY_AS_YOU_GO:
                    offer_label.text = "Special: %s" % best_offer.display_price
                _:
                    offer_label.text = "Offer: %s" % best_offer.display_price
        else:  # DiscountOffer
            if best_offer.percentage_discount_android > 0:
                offer_label.text = "%d%% OFF!" % best_offer.percentage_discount_android
            else:
                offer_label.text = "Special: %s" % best_offer.display_price

        container.add_child(offer_label)

    return container

func _find_best_offer(product) -> Variant:
    # Prefer free trials, then introductory, then promotional
    if product.subscription_offers:
        for offer in product.subscription_offers:
            if offer.payment_mode == Types.PaymentMode.FREE_TRIAL:
                return offer
        for offer in product.subscription_offers:
            if offer.type == Types.DiscountOfferType.INTRODUCTORY:
                return offer
        if product.subscription_offers.size() > 0:
            return product.subscription_offers[0]

    if product.discount_offers and product.discount_offers.size() > 0:
        for offer in product.discount_offers:
            if offer.type == Types.DiscountOfferType.INTRODUCTORY:
                return offer
        return product.discount_offers[0]

    return null
```

---

## 5. Restoring Purchases

### 5.1 Basic Restore

Restoring runs every owned purchase through the purchase flow from 2.3 again,
so `grant` and `purchase_processed` report what came back:

```gdscript
func restore_purchases() -> bool:
    var restored = await iap.restore_purchases()
    if not restored.success:
        return false
    var outcomes = await flow.recover_purchases(true)
    if outcomes is PurchaseFlow.Failure:
        push_error("Restore failed: %s" % outcomes.message)
        return false
    print("Restored %d purchases" % outcomes.size())
    return true
```

---

## 6. Complete Store UI

### 6.1 Store Manager (Autoload)

```gdscript
# store_manager.gd
extends Node

const Types = preload("res://addons/godot-iap/types.gd")
const PurchaseFlow = preload("res://addons/godot-iap/purchase_flow.gd")

var iap: Node
var flow: PurchaseFlow
var is_connected: bool = false
var products: Dictionary = {}

const PRODUCT_IDS = {
    "coins_100": "com.yourgame.coins_100",
    "coins_500": "com.yourgame.coins_500",
    "remove_ads": "com.yourgame.remove_ads",
    "premium_monthly": "com.yourgame.premium_monthly"
}

signal connection_changed(connected: bool)
signal products_loaded(products: Array)
signal purchase_completed(product_id: String)
signal purchase_failed(error: Dictionary)

func _ready():
    var wrapper = preload("res://addons/godot-iap/godot_iap.gd").new()
    wrapper.name = "GodotIapWrapper"
    add_child(wrapper)
    iap = wrapper

    flow = iap.create_purchase_flow({
        "confirm_with_backend": iap.confirm_with_iapkit({
            "api_key": "openiap-kit_pk_...",
            "grant": func(purchase, _is_consumable): _grant_purchase(purchase.productId),
        }),
        "is_consumable": func(product_id): return product_id in [PRODUCT_IDS.coins_100, PRODUCT_IDS.coins_500],
    })
    flow.purchase_processed.connect(_on_purchase_processed)
    iap.purchase_error.connect(_on_purchase_error)

    is_connected = await iap.init_connection()
    connection_changed.emit(is_connected)

    if is_connected:
        await flow.recover_purchases()
        _fetch_products()

func _fetch_products():
    var request = Types.ProductRequest.new()
    var skus: Array[String] = []
    for sku in PRODUCT_IDS.values():
        skus.append(sku)
    request.skus = skus
    request.type = Types.ProductQueryType.ALL

    for product in await iap.fetch_products(request):
        products[product.id] = product
    products_loaded.emit(products.values())

func _on_purchase_processed(purchase: Dictionary, status):
    if status.status == "entitled":
        purchase_completed.emit(purchase.productId)

func _on_purchase_error(error: Dictionary):
    if error.get("code", "") != "user-cancelled":
        purchase_failed.emit(error)

func _grant_purchase(product_id: String):
    match product_id:
        "com.yourgame.coins_100":
            GameState.add_coins(100)
        "com.yourgame.coins_500":
            GameState.add_coins(500)
        "com.yourgame.remove_ads":
            GameState.set_ads_removed(true)
        "com.yourgame.premium_monthly":
            GameState.set_premium(true)

# Public API
func buy(product_id: String):
    if not is_connected:
        purchase_failed.emit({"code": "not-prepared", "message": "Store not available"})
        return

    var props = Types.RequestPurchaseProps.new()
    props.request = Types.RequestPurchasePropsByPlatforms.new()

    props.request.google = Types.RequestPurchaseAndroidProps.new()
    var skus: Array[String] = [product_id]
    props.request.google.skus = skus

    props.request.apple = Types.RequestPurchaseIosProps.new()
    props.request.apple.sku = product_id

    props.type = Types.ProductQueryType.IN_APP

    iap.request_purchase(props)

func get_product(product_id: String):
    return products.get(product_id, null)

func get_price(product_id: String) -> String:
    var product = get_product(product_id)
    return product.display_price if product != null else "$0.99"

func restore():
    var result = await iap.restore_purchases()
    if result.success:
        await flow.recover_purchases(true)
    return result.success
```

### 6.2 Store UI

```gdscript
# store_ui.gd
extends Control

@onready var product_list: VBoxContainer = $ProductList
@onready var loading_label: Label = $LoadingLabel
@onready var restore_button: Button = $RestoreButton

var product_button_scene = preload("res://ui/product_button.tscn")

func _ready():
    StoreManager.connection_changed.connect(_on_connection_changed)
    StoreManager.products_loaded.connect(_on_products_loaded)
    StoreManager.purchase_completed.connect(_on_purchase_completed)
    StoreManager.purchase_failed.connect(_on_purchase_failed)

    restore_button.pressed.connect(_on_restore_pressed)

    if StoreManager.is_connected:
        loading_label.text = "Loading products..."
    else:
        loading_label.text = "Connecting to store..."

func _on_connection_changed(connected: bool):
    if connected:
        loading_label.text = "Loading products..."
    else:
        loading_label.text = "Store unavailable"

func _on_products_loaded(products: Array):
    loading_label.hide()
    _display_products(products)

func _display_products(products: Array):
    for child in product_list.get_children():
        child.queue_free()

    for product in products:
        var button = product_button_scene.instantiate()
        var product_id = product.id if product is Object else product.get("id", "")
        var title = product.title if product is Object else product.get("title", "")
        var price = product.display_price if product is Object else product.get("displayPrice", "")

        button.setup(product_id, title, price)
        button.pressed.connect(func(): _on_product_pressed(product_id))
        product_list.add_child(button)

func _on_product_pressed(product_id: String):
    _set_buttons_enabled(false)
    StoreManager.buy(product_id)

func _on_purchase_completed(product_id: String):
    _set_buttons_enabled(true)
    _show_dialog("Success", "Purchase completed!")

func _on_purchase_failed(error: Dictionary):
    _set_buttons_enabled(true)
    _show_dialog("Error", error.get("message", "Purchase failed"))

func _on_restore_pressed():
    _set_buttons_enabled(false)
    StoreManager.restore()
    await get_tree().create_timer(2.0).timeout
    _set_buttons_enabled(true)

func _set_buttons_enabled(enabled: bool):
    for child in product_list.get_children():
        if child is Button:
            child.disabled = not enabled
    restore_button.disabled = not enabled

func _show_dialog(title: String, message: String):
    var dialog = AcceptDialog.new()
    dialog.title = title
    dialog.dialog_text = message
    add_child(dialog)
    dialog.popup_centered()
    dialog.confirmed.connect(dialog.queue_free)
```

### 6.3 Product Button

```gdscript
# product_button.gd
extends Button

@onready var title_label: Label = $TitleLabel
@onready var price_label: Label = $PriceLabel

var product_id: String = ""

func setup(id: String, title: String, price: String):
    product_id = id
    title_label.text = title
    price_label.text = price
```

---

## Best Practices

1. **Let the purchase flow finish transactions**: it finishes a purchase only after your backend or IAPKit confirms it
2. **Recover on startup**: call `flow.recover_purchases()` after connecting
3. **Include restore button**: Required by Apple for non-consumable purchases
4. **Confirm purchases server-side**: pass your backend call as `confirm_with_backend`; apps without one use `confirm_with_iapkit`
5. **Handle errors gracefully**: Show user-friendly messages for failures
6. **Test on real devices**: Sandbox/test mode required for IAP testing

## See Also

- [Full Documentation](https://openiap.dev/docs/setup/godot)
- [API Reference](https://openiap.dev/docs/apis)
- [OpenIAP Specification](https://openiap.dev)
