extends SceneTree
## Exercise the example's verify-before-finish flow through native envelopes.

const EnvelopeTests = preload("res://tests/test_envelope_parsing.gd")
const Types = preload("res://addons/godot-iap/types.gd")
const Config = preload("res://iapkit_config.gd")

var _failed := false


func _init() -> void:
	_run.call_deferred()


func _run() -> void:
	if OS.get_name() not in ["iOS", "macOS"]:
		print("Apple local verification flow requires an Apple host")
		quit(0)
		return

	var plugin: Node = root.get_node("GodotIapPlugin")
	var previous_plugin = plugin._native_plugin
	var previous_platform: String = plugin._platform
	var fake = EnvelopeTests.FakeImmediateApplePlugin.new()
	plugin._native_plugin = fake
	plugin._platform = "macOS"
	var manager = load("res://iap_manager.gd").new()
	manager.verification_method = Config.Method.LOCAL_DEVICE
	var purchase := {
		"id": "example-local",
		"transactionId": "example-local",
		"productId": "dev.hyo.martie.10bulbs",
		"purchaseToken": "test-jws",
		"purchaseState": "purchased",
		"transactionDate": 1,
		"quantity": 1,
		"isAutoRenewing": false,
		"store": "apple",
		"storeId": "apple",
	}
	fake.responses["verifyPurchase"] = JSON.stringify({
		"success": true,
		"resultJson": JSON.stringify({"isValid": false}),
	})
	await manager._on_purchase_updated(purchase)
	_check(fake.responses.has("last_verify_props"), "Local mode calls store verification")
	_check(not fake.responses.has("last_finish_args"), "Invalid local verification stays unfinished")
	_check(not manager._processed_transactions.has("example-local"), "Invalid verification permits retry")

	fake.responses["verifyPurchase"] = JSON.stringify({
		"success": true,
		"resultJson": JSON.stringify({"isValid": true}),
	})
	await manager._on_purchase_updated(purchase)
	_check(fake.responses.has("last_finish_args"), "The same transaction finishes after valid verification")
	_check(manager._processed_transactions.has("example-local"), "Successful finish records completion")

	fake.responses.erase("last_verify_props")
	fake.responses.erase("last_finish_args")
	purchase["id"] = "example-pending"
	purchase["transactionId"] = "example-pending"
	purchase["purchaseState"] = "pending"
	await manager._on_purchase_updated(purchase)
	_check(not fake.responses.has("last_verify_props"), "Pending purchases are not verified")
	_check(not fake.responses.has("last_finish_args"), "Pending purchases stay unfinished")

	purchase["purchaseState"] = "purchased"
	manager.verification_method = Config.Method.NONE
	await manager._on_purchase_updated(purchase)
	_check(not fake.responses.has("last_finish_args"), "Disabled verification retains completed receipts")
	_check(not manager._processed_transactions.has("example-pending"), "Disabled verification permits retry")
	manager.verification_method = Config.Method.LOCAL_DEVICE
	purchase["productId"] = "foreign.product"
	await manager._on_purchase_updated(purchase)
	_check(not fake.responses.has("last_verify_props"), "Foreign products are left to their owner")

	var verified = Types.RequestVerifyPurchaseWithIapkitResult.from_dict({
		"isValid": true, "productId": "dev.hyo.martie.premium.base",
		"store": "amazon", "storeId": "amazon", "state": "entitled",
		"environment": "Sandbox" if Config.amazon_rvs_sandbox() else "Production",
	})
	for sku in [manager.PRODUCT_PREMIUM, manager.PRODUCT_PREMIUM_YEAR]:
		_check(manager._accepts_verification(verified, sku, "amazon"), "Amazon term matches its catalog base")
	verified.product_id = "foreign.base"
	_check(not manager._accepts_verification(verified, manager.PRODUCT_PREMIUM, "amazon"), "Wrong product cannot fulfill")
	verified.product_id = "dev.hyo.martie.premium.base"
	verified.environment = "Production" if Config.amazon_rvs_sandbox() else "Sandbox"
	_check(not manager._accepts_verification(verified, manager.PRODUCT_PREMIUM, "amazon"), "Wrong Amazon environment cannot fulfill")
	verified.environment = "Sandbox" if Config.amazon_rvs_sandbox() else "Production"
	verified.state = Types.IapkitPurchaseState.READY_TO_CONSUME
	_check(not manager._accepts_verification(verified, manager.PRODUCT_PREMIUM, "amazon"), "Consumable state cannot fulfill subscription")
	verified.store = Types.IapStore.GOOGLE
	verified.product_id = manager.PRODUCT_10_BULBS
	_check(manager._accepts_verification(verified, manager.PRODUCT_10_BULBS, "google"), "Google consumable state can fulfill consumable")
	_check(not manager._accepts_verification(verified, manager.PRODUCT_10_BULBS, "amazon"), "Wrong verified store cannot fulfill")

	manager.verification_method = Config.Method.NONE
	var subscription_receipts: Array = []
	var active_subscriptions: Array = []
	for sku in [manager.PRODUCT_PREMIUM, manager.PRODUCT_PREMIUM_YEAR]:
		var receipt := purchase.duplicate()
		receipt["id"] = sku
		receipt["transactionId"] = sku
		receipt["productId"] = sku
		receipt["isAcknowledged"] = true
		subscription_receipts.append(receipt)
		active_subscriptions.append({"productId": sku, "isActive": true, "transactionId": sku, "transactionDate": 1})
	fake.responses["getActiveSubscriptions"] = JSON.stringify({"success": true, "subscriptionsJson": JSON.stringify(active_subscriptions)})
	fake.responses["getAvailablePurchases"] = JSON.stringify({"success": true, "purchasesJson": JSON.stringify(subscription_receipts)})
	fake.responses.erase("last_finish_args")
	await manager.reconcile_subscription_entitlements()
	_check(not manager.subscription_entitlements.values().has(true), "Active store ownership alone cannot grant unverified subscriptions")
	manager.verification_method = Config.Method.LOCAL_DEVICE
	await manager.reconcile_subscription_entitlements()
	_check(manager.subscription_entitlements.values().all(func(active): return active), "Verified active monthly and yearly subscriptions grant current access")
	_check(fake.responses.has("last_finish_args"), "Unfinished Apple subscriptions complete after verification")
	fake.responses["getActiveSubscriptions"] = JSON.stringify({"success": false, "code": "network-error", "error": "Offline"})
	_check(not await manager.reconcile_subscription_entitlements(), "Failed subscription query is reported")
	_check(manager.subscription_entitlements.values().all(func(active): return active), "Query failure preserves existing access")
	fake.responses["getActiveSubscriptions"] = "malformed"
	_check(not await manager.reconcile_subscription_entitlements(), "Malformed subscription response is reported")
	_check(manager.subscription_entitlements.values().all(func(active): return active), "Malformed response does not revoke existing access")
	fake.responses["getActiveSubscriptions"] = JSON.stringify({"success": true, "subscriptionsJson": "[]"})
	await manager.reconcile_subscription_entitlements()
	_check(not manager.subscription_entitlements.values().has(true), "Empty current ownership revokes both subscription terms")
	_check(not await manager.is_premium_purchased(), "Historical verified receipts cannot grant inactive subscriptions")


	var replacement: Dictionary = subscription_receipts[0].duplicate()
	replacement["id"] = "renewal-new-receipt"
	replacement["transactionId"] = "renewal-new-receipt"
	fake.responses["getActiveSubscriptions"] = JSON.stringify({"success": true, "subscriptionsJson": JSON.stringify(active_subscriptions)})
	fake.responses["getAvailablePurchases"] = JSON.stringify({"success": true, "purchasesJson": JSON.stringify([replacement])})
	fake.responses["verifyPurchase"] = JSON.stringify({"success": true, "resultJson": JSON.stringify({"isValid": false})})
	fake.responses.erase("last_finish_args")
	await manager.reconcile_subscription_entitlements()
	_check(not manager.subscription_entitlements[manager.PRODUCT_PREMIUM], "Another receipt for the same SKU needs its own verification")
	_check(not fake.responses.has("last_finish_args"), "Invalid renewal stays unfinished")
	fake.responses["verifyPurchase"] = JSON.stringify({"success": true, "resultJson": JSON.stringify({"isValid": true})})
	await manager.reconcile_subscription_entitlements()
	_check(manager.subscription_entitlements[manager.PRODUCT_PREMIUM], "The same renewal can retry after verification recovers")

	manager.purchase_completed.connect(func(_sku): manager.reconcile_subscription_entitlements())
	fake.responses["getActiveSubscriptions"] = JSON.stringify({"status": "pending", "requestId": "old-ownership-snapshot"})
	create_timer(0.05).timeout.connect(func() -> void:
		var incoming := replacement.duplicate()
		incoming["id"] = "purchased-during-refresh"
		incoming["transactionId"] = "purchased-during-refresh"
		await manager._on_purchase_updated(incoming)
		fake.responses["getActiveSubscriptions"] = JSON.stringify({"success": true, "subscriptionsJson": JSON.stringify(active_subscriptions)})
		fake.responses["getAvailablePurchases"] = JSON.stringify({"success": true, "purchasesJson": JSON.stringify([incoming])})
		plugin._on_products_fetched({"method": "getActiveSubscriptions", "requestId": "old-ownership-snapshot", "success": true, "subscriptionsJson": "[]"})
	)
	await manager.reconcile_subscription_entitlements()
	_check(manager.subscription_entitlements[manager.PRODUCT_PREMIUM], "A purchase during refresh replaces the stale empty snapshot")

	var android_fake = EnvelopeTests.FakeAndroidJsonPlugin.new()
	plugin._native_plugin = android_fake
	plugin._platform = "Android"
	var previous_key := Config._api_key
	Config._api_key = "openiap-kit_pk_fixture"
	manager.verification_method = Config.Method.IAPKIT
	var acknowledged := replacement.duplicate()
	acknowledged["id"] = "acknowledged-android"
	acknowledged["transactionId"] = "acknowledged-android"
	acknowledged["store"] = "google"
	acknowledged["storeId"] = "play"
	acknowledged["isAcknowledgedAndroid"] = true
	android_fake.responses["getActiveSubscriptionsResult"] = JSON.stringify({"success": true, "subscriptions": active_subscriptions})
	android_fake.responses["getAvailablePurchasesResult"] = JSON.stringify({"success": true, "purchases": [acknowledged]})
	android_fake.responses["verifyPurchaseWithProvider"] = JSON.stringify({"provider": "iapkit", "iapkit": {"isValid": true, "productId": manager.PRODUCT_PREMIUM, "store": "google", "storeId": "play", "state": "entitled"}})
	await manager.reconcile_subscription_entitlements()
	_check(manager.subscription_entitlements[manager.PRODUCT_PREMIUM], "Acknowledged Android subscription is verified before granting access")
	_check(android_fake.last_args.size() == 1 and JSON.parse_string(android_fake.last_args[0]).get("provider") == "iapkit", "Acknowledged Android receipt is not finished again")
	Config._api_key = previous_key

	manager.free()
	plugin._native_plugin = previous_plugin
	plugin._platform = previous_platform
	quit(1 if _failed else 0)


func _check(condition: bool, message: String) -> void:
	print("%s %s" % ["PASS" if condition else "FAIL", message])
	_failed = _failed or not condition
