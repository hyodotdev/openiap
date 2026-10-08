extends SceneTree
## Exercise the example's verify-before-finish flow through native envelopes.

const EnvelopeTests = preload("res://tests/test_envelope_parsing.gd")
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

	manager.free()
	plugin._native_plugin = previous_plugin
	plugin._platform = previous_platform
	quit(1 if _failed else 0)


func _check(condition: bool, message: String) -> void:
	print("%s %s" % ["PASS" if condition else "FAIL", message])
	_failed = _failed or not condition
