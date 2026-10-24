extends SceneTree
## Load the old public path before the wrapper or extracted confirmers.
const PurchaseFlow = preload("res://addons/godot-iap/purchase_flow.gd")


func _init() -> void:
	_run.call_deferred()


func _run() -> void:
	var purchase := {"id": "tx-premium", "productId": "premium", "store": "apple", "storeId": "apple", "purchaseToken": "synthetic-jws"}
	var result := {"iapkit": {"store": "apple", "storeId": "apple", "isValid": true, "state": "entitled", "productId": "premium"}}
	var props = PurchaseFlow.to_iapkit_verification_props(purchase, {})
	if not props is Dictionary or props.iapkit.apple.jws != "synthetic-jws":
		quit(1)
		return
	var verdict = PurchaseFlow.read_iapkit_verification(result, purchase, false)
	var iapkit = PurchaseFlow.create_iapkit_confirmation(func(_props): return result, {})
	var device = PurchaseFlow.create_device_confirmation_ios(func(): return [purchase])
	if verdict != {"status": "entitled", "alreadyGranted": false} \
		or await iapkit.call(purchase, false) != verdict \
		or await device.call(purchase, false) != verdict \
		or PurchaseFlow.IAPKIT_UNKNOWN_RETRY_MS != 30000:
		quit(1)
		return
	var failure: PurchaseFlow.Failure = PurchaseFlow.to_iapkit_verification_props(purchase.merged({"store": "unknown"}, true), {})
	var failed_verifier = PurchaseFlow.create_iapkit_confirmation(func(_props): return failure, {})
	if not failure is PurchaseFlow.Failure or str(failure) != failure.message \
		or await failed_verifier.call(purchase, false) != failure:
		quit(1)
		return
	print("PASS published legacy confirmation paths and defaults")
	quit(0)
