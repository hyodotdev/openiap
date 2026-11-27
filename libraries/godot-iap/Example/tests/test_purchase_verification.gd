extends SceneTree
## Exercise the example's purchase flow wiring through native envelopes.

const EnvelopeTests = preload("res://tests/test_envelope_parsing.gd")
const Types = preload("res://addons/godot-iap/types.gd")
const Config = preload("res://iapkit_config.gd")
const AndroidStore = preload("res://addons/godot-iap/android_store.gd")

var _failed := false


class RecordingAndroidPlugin:
	extends EnvelopeTests.FakeAndroidJsonPlugin
	var provider_props := "{}"
	var calls: Array[String] = []
	var configs: Array[String] = []
	var connects := true
	var init_error := "{}"

	func _respond(method: String, fallback: String) -> String:
		calls.append(method)
		return super._respond(method, fallback)

	func verifyPurchaseWithProvider(props_json: String) -> String:
		provider_props = props_json
		return super(props_json)

	func initConnectionWithConfig(config_json: String) -> bool:
		calls.append("initConnectionWithConfig")
		configs.append(config_json)
		return connects

	func getLastInitError() -> String:
		return init_error

	func endConnection() -> bool:
		calls.append("endConnection")
		return true


class RecordingApplePlugin:
	extends EnvelopeTests.FakeImmediateApplePlugin

	var calls: Array[String] = []

	func _respond(method: String, fallback: String) -> String:
		calls.append(method)
		return super._respond(method, fallback)


func _init() -> void:
	_run.call_deferred()


func _run() -> void:
	if OS.get_name() not in ["iOS", "macOS"]:
		print("Apple local verification flow requires an Apple host")
		quit(0)
		return

	var plugin: Node = root.get_node("GodotIapPlugin")
	var manager: Node = root.get_node("IapManager")
	# Let the example finish its startup reads on the real plugin first.
	for _frame in 300:
		if not manager.is_loading:
			break
		await process_frame
	var previous_plugin = plugin._native_plugin
	var previous_platform: String = plugin._platform
	var previous_method = manager.verification_method
	var previous_key := Config._api_key
	var previous_url := Config._base_url
	var fake := RecordingApplePlugin.new()
	fake.responses["getActiveSubscriptions"] = JSON.stringify({"success": true, "subscriptionsJson": "[]"})
	plugin._native_plugin = fake
	plugin._platform = "macOS"
	var completed: Array[String] = []
	var results: Array = []
	var record_completed := func(product_id: String) -> void: completed.append(product_id)
	var record_result := func(message: String, ok: bool) -> void: results.append([message, ok])
	manager.purchase_completed.connect(record_completed)
	manager.verification_result.connect(record_result)

	manager.verification_method = Config.Method.NONE
	var bulbs := _apple_purchase("example-none", manager.PRODUCT_10_BULBS)
	var status = await manager.flow.process_purchase(bulbs)
	_check(status.status == "failed" and not fake.calls.has("finishTransaction") and completed.is_empty(), "Without a verification method the purchase stays unfinished")
	_check(results.back()[0].contains("try_again_later") and not results.back()[1], "The result shows the flow's guidance")

	fake.responses["getPendingTransactionsIOS"] = JSON.stringify({"success": true, "transactionsJson": JSON.stringify([bulbs])})
	await manager.set_verification_method(Config.Method.LOCAL_DEVICE)
	_check(completed == [manager.PRODUCT_10_BULBS] and fake.calls.count("finishTransaction") == 1, "Choosing Local (Device) recovers, credits, and finishes the retained purchase")
	_check(results.back()[0].contains("access_granted") and results.back()[1], "A granted purchase reads as granted")

	Config._api_key = "openiap-kit_pk_fixture"
	Config._base_url = "http://127.0.0.1:1234"
	manager.verification_method = Config.Method.IAPKIT_LOCAL
	var coins := _apple_purchase("example-iapkit", manager.PRODUCT_30_BULBS)
	coins["environmentIOS"] = "Sandbox"
	var verification := {"provider": "iapkit", "iapkit": {
		"isValid": false, "productId": manager.PRODUCT_30_BULBS, "store": "apple",
		"storeId": "apple", "state": "ready-to-consume", "environment": "Sandbox",
	}}
	fake.responses["verifyPurchaseWithProvider"] = JSON.stringify({"success": true, "resultJson": JSON.stringify(verification)})
	status = await manager.flow.process_purchase(coins)
	var props: Dictionary = JSON.parse_string(fake.responses["last_provider_props"])
	_check(props.iapkit == {"apiKey": Config._api_key, "baseUrl": Config._base_url, "apple": {"jws": coins.purchaseToken}}, "Local (IAPKit) verifies with the configured key and origin")
	_check(status.status == "failed" and fake.calls.count("finishTransaction") == 1 and completed.size() == 1, "A rejected verification stays unfinished and credits nothing")
	verification.iapkit.isValid = true
	fake.responses["verifyPurchaseWithProvider"] = JSON.stringify({"success": true, "resultJson": JSON.stringify(verification)})
	status = await manager.flow.process_purchase(coins)
	_check(status.status == "entitled" and completed.back() == manager.PRODUCT_30_BULBS and fake.calls.count("finishTransaction") == 2, "IAPKit credits the consumable in grant, then the flow finishes it")
	var retried := coins.merged({"id": "example-retried", "transactionId": "example-retried"}, true)
	fake.responses["finishTransaction"] = JSON.stringify({"success": false, "error": "Store unavailable"})
	status = await manager.flow.process_purchase(retried)
	fake.responses.erase("finishTransaction")
	var credits := completed.size()
	status = await manager.flow.process_purchase(retried)
	_check(status.status == "entitled" and status.finish_error == null and completed.size() == credits, "A purchase confirmed again after a failed finish is credited once")

	var android := RecordingAndroidPlugin.new()
	plugin._native_plugin = android
	plugin._platform = "Android"
	manager.verification_method = Config.Method.IAPKIT
	var environment = Config.amazon_expected_environment()
	if environment == null:
		environment = "Sandbox" if Config.amazon_rvs_sandbox() else "Production"
	for store_id in ["amazon", "amazon_example"]:
		var receipt := _android_purchase("example-" + store_id, manager.PRODUCT_PREMIUM, store_id)
		receipt["userIdAmazon"] = "fixture-user"
		android.responses["verifyPurchaseWithProvider"] = _provider_answer({"provider": "iapkit", "iapkit": {
			"isValid": true, "productId": "dev.hyo.martie.premium.base", "store": receipt.store,
			"storeId": store_id, "state": "entitled", "environment": environment,
		}})
		status = await manager.flow.process_purchase(receipt)
		props = JSON.parse_string(android.provider_props)
		_check(props.iapkit.get("amazon") == {"receiptId": receipt.purchaseToken, "expectedProductId": "dev.hyo.martie.premium.base", "sandbox": Config.amazon_rvs_sandbox(), "userId": "fixture-user"}, "An Amazon term verifies under its catalog base with the buyer (%s)" % store_id)
		_check(status.status == "entitled", "The Amazon receipt is granted (%s)" % store_id)

	var upgrade := _android_purchase("example-upgrade", manager.PRODUCT_PREMIUM, "play")
	upgrade["pendingPurchaseUpdateAndroid"] = {"products": [manager.PRODUCT_PREMIUM_YEAR]}
	android.responses["verifyPurchaseWithProvider"] = _provider_answer({"provider": "iapkit", "iapkit": {
		"isValid": true, "productId": manager.PRODUCT_PREMIUM, "store": "google", "storeId": "play", "state": "entitled",
	}})
	android.responses["finishTransaction"] = JSON.stringify({"success": true})
	plugin._on_android_purchase_updated(JSON.stringify(upgrade))
	await process_frame
	_check(results.back()[0].ends_with("Plan change to %s is pending. %s stays active until it applies." % [manager.PRODUCT_PREMIUM_YEAR, manager.PRODUCT_PREMIUM]), "A listener delivery shows a pending plan change in store-neutral copy")

	android.responses["getActiveSubscriptionsResult"] = JSON.stringify({"success": true, "subscriptions": [
		{"productId": manager.PRODUCT_PREMIUM_YEAR, "isActive": true, "transactionId": "yearly", "transactionDate": 1},
		{"productId": "dev.hyo.martie.premium.base", "currentPlanId": manager.PRODUCT_PREMIUM, "isActive": true, "transactionId": "amazon-monthly", "transactionDate": 1},
	]})
	await manager.refresh_subscriptions()
	_check(manager.active_subscriptions.has(manager.PRODUCT_PREMIUM) and manager.active_subscriptions.has(manager.PRODUCT_PREMIUM_YEAR), "Active subscriptions, an Amazon term included, grant premium")
	android.responses["getActiveSubscriptionsResult"] = JSON.stringify({"success": false, "code": "network-error", "error": "Offline"})
	await manager.refresh_subscriptions()
	_check(manager.active_subscriptions.size() == 2, "A failed subscription query keeps premium as it was")
	await _test_plan_change(plugin, manager, android)
	await _test_alternative_billing(manager, android)

	manager.purchase_completed.disconnect(record_completed)
	manager.verification_result.disconnect(record_result)
	manager.verification_method = previous_method
	Config._api_key = previous_key
	Config._base_url = previous_url
	await _test_verification_picker(plugin)
	plugin._native_plugin = previous_plugin
	plugin._platform = previous_platform
	quit(1 if _failed else 0)


func _test_plan_change(plugin: Node, manager: Node, android: RecordingAndroidPlugin) -> void:
	var previous_connection: bool = manager.store_connected
	manager.store_connected = true
	android.responses["requestPurchase"] = JSON.stringify({"status": "pending"})
	var previous_products: Dictionary = manager.products
	_own_subscription(android, manager.PRODUCT_PREMIUM)
	await manager.refresh_subscriptions()
	manager.products = {}
	android.calls.clear()
	manager.purchase_premium_year()
	_check(not android.calls.has("requestPurchase"), "A plan change waits for the new plan's offers")
	manager.purchase_subscription_with_offer(manager.PRODUCT_PREMIUM_YEAR, "explicit-offer")
	_check(not android.calls.has("requestPurchase"), "A plan change with an offer the catalog lacks waits too")
	var renewing := {"subscriptionOffers": [{"offerToken": "renewing-offer", "pricingPhases": {"pricingPhaseList": [{"recurrenceMode": 1}]}}]}
	manager.products = {manager.PRODUCT_PREMIUM: renewing, manager.PRODUCT_PREMIUM_YEAR: renewing}
	var params: Dictionary
	for change in [
		[manager.PRODUCT_PREMIUM, manager.PRODUCT_PREMIUM_YEAR, "with-time-proration"],
		[manager.PRODUCT_PREMIUM_YEAR, manager.PRODUCT_PREMIUM, "deferred"],
	]:
		_own_subscription(android, change[0])
		await manager.refresh_subscriptions()
		manager._purchase(change[1])
		params = JSON.parse_string(android.last_args[0])
		_check(params.get("subscriptionProductReplacementParams") == {"oldProductId": change[0], "replacementMode": change[2]} and params.get("purchaseToken") == "owned-token" and params.skus == [change[1]], "Buying %s while owning %s changes the plan with %s" % [change[1], change[0], change[2]])
	var previous_feature: Callable = plugin._has_feature
	plugin._has_feature = func(feature: String) -> bool: return feature == AndroidStore.store_feature("amazon")
	manager.purchase_premium_year()
	params = JSON.parse_string(android.last_args[0])
	_check(not params.has("subscriptionProductReplacementParams") and not params.has("purchaseToken"), "Amazon buys the other plan as a separate purchase")
	plugin._has_feature = previous_feature
	manager.purchase_10_bulbs()
	params = JSON.parse_string(android.last_args[0])
	_check(not params.has("subscriptionProductReplacementParams") and not params.has("purchaseToken"), "A consumable never replaces a plan")
	android.responses["getActiveSubscriptionsResult"] = JSON.stringify({"success": true, "subscriptions": []})
	await manager.refresh_subscriptions()
	manager.purchase_premium_year()
	params = JSON.parse_string(android.last_args[0])
	_check(not params.has("subscriptionProductReplacementParams") and not params.has("purchaseToken"), "Without an owned plan the subscription is a new purchase")

	manager.products = {manager.PRODUCT_PREMIUM_YEAR: {"subscriptionOffers": [{"offerToken": "prepaid-offer", "pricingPhases": {"pricingPhaseList": [{"recurrenceMode": 3}]}}]}}
	_own_subscription(android, manager.PRODUCT_PREMIUM)
	await manager.refresh_subscriptions()
	manager.purchase_premium_year()
	params = JSON.parse_string(android.last_args[0])
	_check(params.get("subscriptionProductReplacementParams", {}).get("replacementMode") == "charge-full-price", "A change into a prepaid plan charges the full price, as Play requires")
	manager.products = previous_products

	android.responses["getActiveSubscriptionsResult"] = JSON.stringify({"success": true, "subscriptions": [
		{"productId": manager.PRODUCT_PREMIUM, "isActive": true, "transactionId": "owned", "transactionDate": 1},
	]})
	await manager.refresh_subscriptions()
	android.calls.clear()
	manager.purchase_premium_year()
	_check(not android.calls.has("requestPurchase"), "A plan change without the current purchase token does not start")
	android.responses.erase("requestPurchase")
	manager.store_connected = previous_connection


func _test_alternative_billing(manager: Node, android: RecordingAndroidPlugin) -> void:
	var previous_connection: bool = manager.store_connected
	manager.store_connected = true
	_own_subscription(android, manager.PRODUCT_PREMIUM)
	var scene = load("res://main.tscn").instantiate()
	root.add_child(scene)
	await process_frame
	_check(scene.store_contents.get_node("BuyPremiumYearButton").text.begins_with("Change plan: ") and not scene.store_contents.get_node("BuyPremiumButton").text.begins_with("Change plan: "), "The other Play plan reads as a plan change")
	_check(scene.billing_button.visible, "Google Play shows Alternative Billing")
	scene.billing_button.pressed.emit()
	_check(scene.billing_panel.visible and scene.overlay.visible, "Alternative Billing opens its own panel")
	var picker: OptionButton = scene.billing_program_picker
	await scene._on_billing_program_selected(picker.get_item_index(Types.BillingProgramAndroid.EXTERNAL_OFFER))
	_check(JSON.parse_string(android.configs.back()).enableBillingProgramAndroid == "external-offer" and scene.billing_program == Types.BillingProgramAndroid.EXTERNAL_OFFER, "Picking External Offer reconnects with it")

	android.responses["isBillingProgramAvailableAndroid"] = JSON.stringify({"isAvailable": true, "billingProgram": "external-offer"})
	android.responses["createBillingProgramReportingDetailsAndroid"] = JSON.stringify({"billingProgram": "external-offer", "externalTransactionToken": "fixture-token"})
	android.responses["launchExternalLinkAndroid"] = JSON.stringify({"launched": true})
	android.calls.clear()
	scene._on_billing_buy_pressed()
	_check(android.calls == ["isBillingProgramAvailableAndroid", "createBillingProgramReportingDetailsAndroid", "launchExternalLinkAndroid"], "External Offer creates fresh reporting details right before the launch")
	var link: Dictionary = JSON.parse_string(android.last_args[0])
	_check(link.billingProgram == "external-offer" and link.linkUri == scene.billing_url.text and link.launchMode == "launch-in-external-browser-or-app", "The launch carries the program and the entered URL")
	_check(scene.billing_result_label.text == "External link launched. Report its token after payment." and not scene.billing_result_label.text.contains("fixture-token"), "The result never shows the token")
	android.responses["createBillingProgramReportingDetailsAndroid"] = JSON.stringify({"billingProgram": "external-offer", "externalTransactionToken": ""})
	android.calls.clear()
	scene._on_billing_buy_pressed()
	_check(not android.calls.has("launchExternalLinkAndroid") and scene.billing_result_label.text == "Could not create reporting details", "No token, no launch")

	android.connects = false
	android.init_error = JSON.stringify({"connected": true, "code": "developer-error", "message": "A purchase is in progress"})
	await scene._on_billing_program_selected(picker.get_item_index(Types.BillingProgramAndroid.EXTERNAL_PAYMENTS))
	_check(scene.billing_program == Types.BillingProgramAndroid.EXTERNAL_OFFER and picker.get_selected_id() == Types.BillingProgramAndroid.EXTERNAL_OFFER and manager.store_connected, "A refused reconnect keeps the live program")
	android.connects = true
	android.init_error = "{}"

	await scene._on_billing_program_selected(picker.get_item_index(Types.BillingProgramAndroid.EXTERNAL_PAYMENTS))
	android.responses["isBillingProgramAvailableAndroid"] = JSON.stringify({"isAvailable": false, "billingProgram": "external-payments"})
	android.calls.clear()
	scene._on_billing_buy_pressed()
	_check(not android.calls.has("requestPurchase") and scene.billing_result_label.text.ends_with("is not available for this user"), "An unavailable program starts no purchase")
	android.responses["isBillingProgramAvailableAndroid"] = JSON.stringify({"isAvailable": true, "billingProgram": "external-payments"})
	android.responses["requestPurchase"] = JSON.stringify({"status": "pending"})
	scene._on_billing_buy_pressed()
	var purchase: Dictionary = JSON.parse_string(android.last_args[0])
	_check(purchase.skus == [manager.PRODUCT_10_BULBS] and purchase.developerBillingOption == {"billingProgram": "external-payments", "launchMode": "launch-in-external-browser-or-app", "linkUri": scene.billing_url.text}, "External Payments buys with the developer billing option")
	manager.purchase_with_external_payments(manager.PRODUCT_PREMIUM, scene.billing_url.text)
	purchase = JSON.parse_string(android.last_args[0])
	_check(purchase.skus == [manager.PRODUCT_PREMIUM] and purchase.get("developerBillingOption", {}).get("billingProgram") == "external-payments", "A subscription keeps the developer billing option")
	android.responses.erase("requestPurchase")
	root.get_node("GodotIapPlugin")._on_android_developer_provided_billing(JSON.stringify({"externalTransactionToken": "fixture-token", "products": []}))
	_check(scene.billing_result_label.text.begins_with("The user chose your billing.\nToken: present"), "Choosing developer billing reads as chosen")

	await scene._on_billing_program_selected(picker.get_item_index(Types.BillingProgramAndroid.USER_CHOICE_BILLING))
	android.responses["requestPurchase"] = JSON.stringify({"status": "pending"})
	scene._on_billing_buy_pressed()
	purchase = JSON.parse_string(android.last_args[0])
	_check(purchase.skus == [manager.PRODUCT_10_BULBS] and not purchase.has("developerBillingOption"), "User Choice Billing buys normally; Play shows the choice")
	android.responses.erase("requestPurchase")
	root.get_node("GodotIapPlugin")._on_android_user_choice_billing(JSON.stringify({"externalTransactionToken": "", "products": [manager.PRODUCT_10_BULBS]}))
	_check(scene.billing_result_label.text.begins_with("The user chose your billing.\nToken: missing"), "A user choice without a token says so")

	android.calls.clear()
	await scene._on_billing_close_pressed()
	_check(JSON.parse_string(android.configs.back()).enableBillingProgramAndroid == "unspecified" and not android.calls.has("endConnection"), "Closing returns to standard billing without ending the connection")
	_check(not scene.billing_panel.visible and not scene.overlay.visible and scene.billing_program == Types.BillingProgramAndroid.UNSPECIFIED, "Closing hides the panel")
	# A switch that finishes after the panel closed returns to standard billing too.
	await scene._on_billing_program_selected(picker.get_item_index(Types.BillingProgramAndroid.EXTERNAL_OFFER))
	_check(JSON.parse_string(android.configs.back()).enableBillingProgramAndroid == "unspecified" and scene.billing_program == Types.BillingProgramAndroid.UNSPECIFIED, "A switch that ends after closing returns to standard billing")
	# Play refuses the restore while a purchase runs; the purchase's outcome retries it.
	scene._set_panel_visible(scene.billing_panel, true)
	await scene._on_billing_program_selected(picker.get_item_index(Types.BillingProgramAndroid.EXTERNAL_OFFER))
	android.connects = false
	android.init_error = JSON.stringify({"connected": true, "code": "developer-error", "message": "A purchase is in progress"})
	await scene._on_billing_close_pressed()
	_check(scene.billing_program == Types.BillingProgramAndroid.EXTERNAL_OFFER, "A restore refused during a purchase keeps the program")
	android.connects = true
	android.init_error = "{}"
	manager.purchase_failed.emit("", "Code: user-cancelled")
	await process_frame
	_check(scene.billing_program == Types.BillingProgramAndroid.UNSPECIFIED, "The purchase's outcome returns to standard billing")
	scene.queue_free()
	await process_frame
	manager.store_connected = previous_connection


func _own_subscription(android: RecordingAndroidPlugin, product_id: String) -> void:
	android.responses["getActiveSubscriptionsResult"] = JSON.stringify({"success": true, "subscriptions": [
		{"productId": product_id, "isActive": true, "transactionId": "owned", "transactionDate": 1, "purchaseToken": "owned-token"},
	]})


func _apple_purchase(id: String, product_id: String) -> Dictionary:
	return {
		"id": id, "transactionId": id, "productId": product_id, "purchaseToken": "jws-" + id,
		"purchaseState": "purchased", "transactionDate": 1, "quantity": 1,
		"isAutoRenewing": false, "store": "apple", "storeId": "apple",
	}


func _android_purchase(id: String, product_id: String, store_id: String) -> Dictionary:
	return {
		"id": id, "productId": product_id, "purchaseToken": "token-" + id,
		"purchaseState": "purchased", "transactionDate": 1, "quantity": 1,
		"isAutoRenewing": false, "isAcknowledgedAndroid": false, "storeId": store_id,
		"store": {"play": "google", "amazon": "amazon"}.get(store_id, "unknown"),
	}


func _test_verification_picker(plugin: Node) -> void:
	var fake := RecordingApplePlugin.new()
	plugin._native_plugin = fake
	plugin._platform = "macOS"
	var manager: Node = root.get_node("IapManager")
	var previous_method = manager.verification_method
	var previous_key := Config._api_key
	var previous_url := Config._base_url
	Config._api_key = "openiap-kit_pk_fixture"
	Config._base_url = "http://127.0.0.1:1234"
	manager.verification_method = Config.Method.IAPKIT_LOCAL
	var purchase := {
		"id": "picker-retry", "transactionId": "picker-retry",
		"productId": manager.PRODUCT_10_BULBS, "purchaseToken": "fixture-jws",
		"purchaseState": "purchased", "transactionDate": 1, "quantity": 1,
		"isAutoRenewing": false, "store": "apple", "storeId": "apple",
		"environmentIOS": "Sandbox",
	}
	fake.responses["getPendingTransactionsIOS"] = JSON.stringify({"success": true, "transactionsJson": JSON.stringify([purchase])})
	fake.responses["getActiveSubscriptions"] = JSON.stringify({"success": true, "subscriptionsJson": "[]"})
	var verification := {"provider": "iapkit", "iapkit": {
		"isValid": false, "productId": manager.PRODUCT_10_BULBS, "store": "apple",
		"storeId": "apple", "state": "ready-to-consume", "environment": "Sandbox",
	}}
	fake.responses["verifyPurchaseWithProvider"] = JSON.stringify({"success": true, "resultJson": JSON.stringify(verification)})
	var game = load("res://main.gd").new()
	var panel := Panel.new()
	var container := VBoxContainer.new()
	container.name = "VBoxContainer"
	panel.add_child(container)
	root.add_child(panel)
	game.store_panel = panel
	game.store_contents = container
	game.status_label = Label.new()
	panel.add_child(game.status_label)
	game.loading_label = Label.new()
	panel.add_child(game.loading_label)
	manager.loading_changed.connect(game._on_loading_changed)
	game._setup_verification_picker()
	var picker: OptionButton = game.verification_picker
	_check(picker.get_selected_id() == Config.Method.IAPKIT_LOCAL, "Picker starts at the configured method")
	picker.get_popup().popup()
	await process_frame
	picker.get_popup().hide()
	_check(fake.calls.is_empty(), "Opening and dismissing the picker performs no purchase query")
	picker.item_selected.emit(picker.get_item_index(Config.Method.NONE))
	_check(manager.verification_method == Config.Method.NONE and fake.calls.is_empty(), "LOCAL to None skips hosted and device verification")
	await manager.flow.process_purchase(purchase)
	var retained_status: String = game.status_label.text
	picker.item_selected.emit(picker.get_item_index(Config.Method.IAPKIT_LOCAL))
	await process_frame
	var props: Dictionary = JSON.parse_string(fake.responses.get("last_provider_props", "{}"))
	_check(props.get("iapkit", {}).get("baseUrl") == Config._base_url, "None to LOCAL routes directly to the configured endpoint")
	_check(fake.calls.count("getPendingTransactionsIOS") == 1 and fake.calls.count("verifyPurchaseWithProvider") == 1 and not fake.calls.has("finishTransaction"), "Direct LOCAL selection leaves failed verification unfinished")
	var failed_status: String = game.status_label.text
	_check(failed_status.begins_with("❌ "), "Failed verification stays visible")
	manager.loading_changed.emit(true)
	_check(game.loading_label.visible and game.status_label.text == failed_status, "Loading shows its indicator without hiding the failed receipt result")
	manager.loading_changed.emit(false)
	_check(not game.loading_label.visible and game.status_label.text == failed_status, "Loading completion preserves the failed receipt result")
	fake.calls.clear()
	verification.iapkit.isValid = true
	fake.responses["verifyPurchaseWithProvider"] = JSON.stringify({"success": true, "resultJson": JSON.stringify(verification)})
	_check(picker.allow_reselect, "The picker permits selecting its current method")
	picker.item_selected.emit(picker.get_item_index(Config.Method.IAPKIT_LOCAL))
	await process_frame
	_check(fake.calls.count("verifyPurchaseWithProvider") == 1 and fake.calls.count("finishTransaction") == 1, "Selecting the current LOCAL method retries without another mode")
	_check(game.status_label.text.begins_with("✅ "), "Successful verification stays visible after the subscription refresh")
	var scene = load("res://main.tscn").instantiate()
	var status: Label = scene.get_node("UI/StatusLabel").duplicate()
	scene.free()
	panel.add_child(status)
	status.text = retained_status
	await process_frame
	_check(status.autowrap_mode == TextServer.AUTOWRAP_WORD_SMART and status.size.x <= 660 and status.get_line_count() > 1, "The actual scene wraps the receipt result within the portrait viewport")
	game.free()
	panel.free()
	var previous_connection: bool = manager.store_connected
	var previous_loading: bool = manager.is_loading
	manager.store_connected = true
	manager.is_loading = false
	var connected_scene = load("res://main.tscn").instantiate()
	root.add_child(connected_scene)
	await process_frame
	_check(connected_scene.status_label.text == "Connected" and not connected_scene.store_button.disabled and not connected_scene.loading_label.visible, "The scene shows an autoload connection completed before its signals were registered")
	connected_scene.queue_free()
	await process_frame
	manager.store_connected = false
	manager.is_loading = true
	var connecting_scene = load("res://main.tscn").instantiate()
	root.add_child(connecting_scene)
	await process_frame
	_check(connecting_scene.status_label.text == "Connecting..." and not connecting_scene.ownership_button.disabled and connecting_scene.loading_label.visible, "An unfinished connection keeps ownership diagnostics accessible")
	_check(not connecting_scene.billing_button.visible, "Apple hides the Google Play billing programs")
	_check(connecting_scene.store_contents.get_node("Buy10BulbsButton").disabled and connecting_scene.store_contents.get_node("RestoreButton").disabled and connecting_scene.verification_picker.disabled, "An unfinished connection keeps purchase and receipt operations disabled")
	connecting_scene.ownership_button.pressed.emit()
	_check(connecting_scene.ownership_panel.visible and not connecting_scene.store_panel.visible and connecting_scene.ownership_panel.is_ancestor_of(connecting_scene.ownership_check_button) and not connecting_scene.ownership_check_button.disabled, "App Ownership opens its own panel, independent of billing connection")
	var calls_before: Array[String] = fake.calls.duplicate()
	connecting_scene.ownership_project_number.text = "123"
	await connecting_scene._on_check_ownership_pressed()
	_check(connecting_scene.ownership_result_label.text.begins_with("developer-error:") and fake.calls == calls_before, "Partial Google ownership inputs fail inline without a native request")
	connecting_scene.ownership_project_number.text = ""
	fake.responses["verifyAppOwnership"] = JSON.stringify({"success": false, "method": "verifyAppOwnership", "code": "developer-error", "error": "Fixture ownership input error"})
	await connecting_scene._on_check_ownership_pressed()
	_check(connecting_scene.ownership_result_label.text.begins_with("developer-error:") and manager.is_loading, "A native ownership failure stays inline and preserves purchase loading")
	var catalog_events: Array[bool] = []
	var capture_catalog = func() -> void: catalog_events.append(true)
	manager.products_loaded.connect(capture_catalog)
	for platform in ["macOS", "Android"]:
		plugin._platform = platform
		for success in [true, false]:
			var request_id := "ownership-catalog-%s-%s" % [platform, success]
			fake.responses["verifyAppOwnership"] = JSON.stringify({"status": "pending", "requestId": request_id})
			_start_ownership_check(connecting_scene)
			await process_frame
			var completion := {"method": "verifyAppOwnership", "requestId": request_id, "success": success}
			if success:
				completion["ownershipJson"] = JSON.stringify({"status": "unknown", "storeId": "horizon", "reason": "unsupported"})
			else:
				completion["code"] = "developer-error"
				completion["error"] = "Fixture ownership completion error"
			if platform == "Android":
				plugin._on_android_products_fetched(JSON.stringify(completion))
			else:
				plugin._on_products_fetched(completion)
			await process_frame
			_check(not connecting_scene.ownership_checking, "A tagged native signal completes the normal ownership check")
			_check(manager.is_loading and catalog_events.is_empty(), "Ownership completion preserves an in-flight catalog query")
			_check(connecting_scene.ownership_result_label.text.begins_with("Status: unknown") if success else connecting_scene.ownership_result_label.text.begins_with("developer-error:"), "Tagged ownership results and errors remain inline")
	plugin._on_products_fetched({"method": "fetchProducts", "products": []})
	_check(not manager.is_loading and catalog_events.size() == 1, "Only a catalog completion ends product loading")
	manager.products_loaded.disconnect(capture_catalog)
	plugin._platform = "macOS"
	fake.calls.clear()
	fake.responses["getPendingTransactionsIOS"] = JSON.stringify({"success": true, "transactionsJson": "[]"})
	fake.responses["getAvailablePurchases"] = JSON.stringify({"success": false, "code": "network-error", "error": "Offline"})
	await connecting_scene._on_restore_pressed()
	_check(connecting_scene.status_label.text.begins_with("Restore failed: "), "A failed recovery pass reads as failed")
	_check(connecting_scene.store_status_label.text == connecting_scene.status_label.text, "The store panel shows the restore status")
	fake.responses["getAvailablePurchases"] = JSON.stringify({"success": true, "purchasesJson": "[]"})
	await connecting_scene._on_restore_pressed()
	_check(connecting_scene.status_label.text == "Purchases restored.", "A completed restore reads as restored")
	_check(not fake.calls.has("restorePurchases"), "A restore runs through the flow, without the store's restore")
	manager.verification_method = Config.Method.NONE
	var owned := _apple_purchase("example-restore", manager.PRODUCT_10_BULBS)
	fake.responses["getAvailablePurchases"] = JSON.stringify({"success": true, "purchasesJson": JSON.stringify([owned])})
	await connecting_scene._on_restore_pressed()
	_check(connecting_scene.status_label.text.begins_with("Restore failed: "), "A failed confirmation fails the restore")
	plugin.purchase_error.emit({"code": "user-cancelled", "message": "Cancelled", "debugMessage": "Response code 1"})
	_check(connecting_scene.store_status_label.text == "Purchase failed\nCode: user-cancelled\nMessage: Cancelled\nDebug: Response code 1", "A purchase error shows its code, message, and debug message")
	plugin._on_products_fetched({"method": "fetchProducts", "success": false, "code": "empty-sku-list", "error": "Empty SKU list provided"})
	_check(connecting_scene.store_status_label.text == "Product fetch failed\nCode: empty-sku-list\nMessage: Empty SKU list provided", "A failed product fetch shows its code and message")
	plugin._on_products_fetched({"method": "verifyAppOwnership", "success": false, "code": "developer-error", "error": "Fixture ownership error"})
	_check(connecting_scene.store_status_label.text.begins_with("Product fetch failed\nCode: empty-sku-list"), "Another method's failure is not a product fetch failure")
	fake.calls.clear()
	fake.responses["fetchProducts"] = JSON.stringify({"success": false, "code": "empty-sku-list", "error": "Empty SKU list provided"})
	await connecting_scene._on_fetch_without_skus_pressed()
	_check(JSON.parse_string(fake.responses["last_fetch_request"]).skus.is_empty(), "The debug fetch requests no SKUs")
	fake.responses["deepLinkToSubscriptions"] = JSON.stringify({"success": true})
	await connecting_scene._on_manage_subscriptions_pressed()
	_check(fake.calls.has("deepLinkToSubscriptions") and connecting_scene.status_label.text.begins_with("Product fetch failed"), "Manage Subscriptions opens the store's subscription page")
	fake.responses["deepLinkToSubscriptions"] = JSON.stringify({"success": false, "code": "service-error", "error": "Unavailable"})
	await connecting_scene._on_manage_subscriptions_pressed()
	_check(connecting_scene.store_status_label.text == "Manage subscriptions failed", "A failed subscription page reads as failed")
	connecting_scene.queue_free()
	await process_frame
	manager.store_connected = previous_connection
	manager.is_loading = previous_loading
	manager.verification_method = previous_method
	Config._api_key = previous_key
	Config._base_url = previous_url


func _start_ownership_check(scene: Node) -> void:
	await scene._on_check_ownership_pressed()


func _check(condition: bool, message: String) -> void:
	print("%s %s" % ["PASS" if condition else "FAIL", message])
	_failed = _failed or not condition


# The Android plugin answers verifyPurchaseWithProvider through products_fetched, like Apple.
func _provider_answer(result: Dictionary) -> String:
	return JSON.stringify({"success": true, "resultJson": JSON.stringify(result)})
