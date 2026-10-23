extends SceneTree
## Exercise the example's purchase flow wiring through native envelopes.

const EnvelopeTests = preload("res://tests/test_envelope_parsing.gd")
const Types = preload("res://addons/godot-iap/types.gd")
const Config = preload("res://iapkit_config.gd")

var _failed := false


class RecordingAndroidPlugin:
	extends EnvelopeTests.FakeAndroidJsonPlugin
	var provider_props := "{}"

	func verifyPurchaseWithProvider(props_json: String) -> String:
		provider_props = props_json
		return super(props_json)


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

	var android := RecordingAndroidPlugin.new()
	plugin._native_plugin = android
	plugin._platform = "Android"
	manager.verification_method = Config.Method.IAPKIT
	var environment := "Sandbox" if Config.amazon_rvs_sandbox() else "Production"
	for store_id in ["amazon", "amazon_example"]:
		var receipt := _android_purchase("example-" + store_id, manager.PRODUCT_PREMIUM, store_id)
		receipt["userIdAmazon"] = "fixture-user"
		android.responses["verifyPurchaseWithProvider"] = JSON.stringify({"provider": "iapkit", "iapkit": {
			"isValid": true, "productId": "dev.hyo.martie.premium.base", "store": receipt.store,
			"storeId": store_id, "state": "entitled", "environment": environment,
		}})
		status = await manager.flow.process_purchase(receipt)
		props = JSON.parse_string(android.provider_props)
		_check(props.iapkit.get("amazon") == {"receiptId": receipt.purchaseToken, "expectedProductId": "dev.hyo.martie.premium.base", "sandbox": Config.amazon_rvs_sandbox(), "userId": "fixture-user"}, "An Amazon term verifies under its catalog base with the buyer (%s)" % store_id)
		_check(status.status == "entitled", "The Amazon receipt is granted (%s)" % store_id)

	var upgrade := _android_purchase("example-upgrade", manager.PRODUCT_PREMIUM, "play")
	upgrade["pendingPurchaseUpdateAndroid"] = {"products": [manager.PRODUCT_PREMIUM_YEAR]}
	android.responses["verifyPurchaseWithProvider"] = JSON.stringify({"provider": "iapkit", "iapkit": {
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
	_check(manager.subscription_entitlements.values().all(func(active): return active), "Active subscriptions, an Amazon term included, grant premium")
	android.responses["getActiveSubscriptionsResult"] = JSON.stringify({"success": false, "code": "network-error", "error": "Offline"})
	await manager.refresh_subscriptions()
	_check(manager.subscription_entitlements.values().all(func(active): return active), "A failed subscription query keeps premium as it was")

	manager.purchase_completed.disconnect(record_completed)
	manager.verification_result.disconnect(record_result)
	manager.verification_method = previous_method
	Config._api_key = previous_key
	Config._base_url = previous_url
	await _test_verification_picker(plugin)
	plugin._native_plugin = previous_plugin
	plugin._platform = previous_platform
	quit(1 if _failed else 0)


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
	_check(connecting_scene.status_label.text == "Connecting..." and not connecting_scene.store_button.disabled and connecting_scene.loading_label.visible, "An unfinished connection keeps ownership diagnostics accessible")
	_check(connecting_scene.store_contents.get_node("Buy10BulbsButton").disabled and connecting_scene.store_contents.get_node("RestoreButton").disabled and connecting_scene.verification_picker.disabled, "An unfinished connection keeps purchase and receipt operations disabled")
	connecting_scene._on_store_button_pressed()
	_check(connecting_scene.store_panel.visible and not connecting_scene.ownership_check_button.disabled, "The normal Store exposes ownership independently of billing connection")
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
