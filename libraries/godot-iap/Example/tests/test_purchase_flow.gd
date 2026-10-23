extends SceneTree
## Runs the shared purchase-flow vectors, then the checks GDScript needs on its
## own: signal delivery, timers, dispose, and the wrapper's store binding.
## Vector fakes answer on the next frame, like the TS runner's async fakes.
## Run with: godot --headless --path Example --script res://tests/test_purchase_flow.gd

const PurchaseFlow = preload("res://addons/godot-iap/purchase_flow.gd")
const GodotIapWrapper = preload("res://addons/godot-iap/godot_iap.gd")
const EnvelopeTests = preload("res://tests/test_envelope_parsing.gd")
const Types = preload("res://addons/godot-iap/types.gd")
# A copy synced from specs/client/src/purchase-flow.vectors.json.
const VECTORS_PATH := "res://tests/fixtures/purchase-flow.vectors.json"

var _passed := 0
var _failed := 0


class RecordingAndroidPlugin:
	extends EnvelopeTests.FakeAndroidJsonPlugin
	var provider_props := "{}"

	func verifyPurchaseWithProvider(props_json: String) -> String:
		provider_props = props_json
		return super(props_json)


func _init() -> void:
	_run.call_deferred()


func _run() -> void:
	var vectors: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(VECTORS_PATH))
	for vector in vectors.process:
		await _run_process_vector(vector)
	for vector in vectors.iapkit:
		await _run_iapkit_vector(vector)
	for vector in vectors.sequences:
		await _run_sequence_vector(vector)
	await _test_confirm_timeout()
	await _test_confirm_timeout_ignores_time_scale()
	await _test_finish_results()
	await _test_synchronous_callbacks()
	await _test_requested_delivery_joins_run()
	await _test_joined_run_publishes_latest_delivery()
	await _test_dispose_silences_late_subscribers()
	await _test_dispose_stops_recovery()
	await _test_recover_reports_failed_reads()
	_test_confirmation_request()
	await _test_wrapper_tracks_requests()
	await _test_wrapper_binding()
	await _test_wrapper_holds_listening_flows()
	print("Results: %d passed, %d failed" % [_passed, _failed])
	quit(1 if _failed > 0 else 0)


func _run_process_vector(vector: Dictionary) -> void:
	var name := "process: %s" % vector.name
	var confirms := []
	var finishes := []
	var confirm := func(purchase: Dictionary, is_consumable: bool) -> Variant:
		confirms.append([purchase, is_consumable])
		await process_frame
		if vector.get("confirmThrows", false):
			return PurchaseFlow.Failure.new("backend down")
		# Raw JSON on purpose: the flow must reject malformed answers itself.
		return vector.get("confirmation")
	var finish := func(purchase: Dictionary, is_consumable: bool) -> Types.VoidResult:
		finishes.append([purchase, is_consumable])
		await process_frame
		return _void_result(not vector.get("finishThrows", false))
	var flow := PurchaseFlow.new({
		"confirm_with_backend": confirm,
		"finish_transaction": finish,
		"is_consumable": func(_product_id: String) -> bool: return vector.isConsumable,
		"get_available_purchases": func() -> Array: return [],
	})
	var item: Dictionary = vector.purchase

	var status: PurchaseFlow.Status = await flow.process_purchase(item)

	_check(confirms.size() == (0 if vector.get("confirms") == false else 1), name + " confirms")
	if vector.finishes:
		_check(_equal(finishes, [[item, vector.isConsumable]]), name + " finishes once")
	else:
		_check(finishes.is_empty(), name + " does not finish")
	_check(_equal(_comparable(status), vector.status), name + " status")
	_check(_equal(PurchaseFlow.describe_purchase_flow_status(status), vector.guidance), name + " guidance")


func _run_iapkit_vector(vector: Dictionary) -> void:
	var name := "iapkit: %s" % vector.name
	var item: Dictionary = vector.purchase
	var amazon = vector.get("amazon")
	var stores: Dictionary = vector.get("verifyAs", {})
	var grants := []
	var verifies := []
	var options := {
		"verify_as": func(purchase: Dictionary) -> Variant: return stores.get(purchase.get("storeId", "")),
	}
	if not vector.has("apiKey"):
		options["api_key"] = "pk"
	elif vector.apiKey != null:
		options["api_key"] = vector.apiKey
	if vector.has("baseUrl"):
		options["base_url"] = vector.baseUrl
	if amazon != null:
		var product_ids: Dictionary = amazon.verifiedProductIds
		options["amazon"] = {
			"sandbox": amazon.sandbox,
			"verified_product_id": func(product_id: String) -> String: return product_ids.get(product_id, product_id),
		}
	if not vector.get("noGrant", false):
		options["grant"] = func(purchase: Dictionary, _is_consumable: bool) -> void:
			grants.append(purchase)
			await process_frame
	var verify := func(props: Dictionary) -> Dictionary:
		verifies.append(props)
		await process_frame
		return vector.get("result", {})
	var confirm := PurchaseFlow.create_iapkit_confirmation(verify, options)

	var answer = await confirm.call(item, vector.isConsumable)

	if vector.get("error", false):
		_check(answer is PurchaseFlow.Failure, name + " fails")
	else:
		_check(_equal(answer, vector.confirmation), name + " confirmation")
	if vector.props == null or vector.get("verifies") == false:
		_check(verifies.is_empty(), name + " does not verify")
	else:
		_check(_equal(verifies, [vector.props]), name + " verifies once with the props")
	_check(grants.size() == (1 if vector.granted else 0), name + " grants")


func _run_sequence_vector(vector: Dictionary) -> void:
	var name := "sequence: %s" % vector.name
	var purchases: Dictionary = vector.purchases
	var answers: Dictionary = vector.answers
	var pending_ios = vector.get("pendingIOS")
	var confirms := {}
	var finishes := {}
	var published := []
	var consumables: Array = vector.get("consumables", [])
	var requested: Array = vector.get("requested", [])
	var store := {"deliver": null}
	var keyed := func(keys: Array) -> Array: return keys.map(func(key): return purchases[key])
	var options := {
		"confirm_with_backend": func(purchase: Dictionary, _is_consumable: bool) -> Variant:
			confirms[purchase.id] = confirms.get(purchase.id, 0) + 1
			var list: Array = answers.get(purchase.id, answers.get("*"))
			var answer = list[min(confirms[purchase.id], list.size()) - 1]
			await process_frame
			return PurchaseFlow.Failure.new("backend down") if answer is String and answer == "throw" else answer,
		"finish_transaction": func(purchase: Dictionary, _is_consumable: bool) -> Types.VoidResult:
			finishes[purchase.id] = finishes.get(purchase.id, 0) + 1
			await process_frame
			return _void_result(true),
		"is_consumable": func(product_id: String) -> bool: return product_id in consumables,
		"get_available_purchases": func() -> Array:
			await process_frame
			return keyed.call(vector.get("available", [])),
		"listen_for_purchases": func(on_purchase: Callable) -> Callable:
			store.deliver = on_purchase
			return func() -> void: store.deliver = null,
		"was_requested": func(purchase: Dictionary) -> bool: return purchase.id in requested,
	}
	if pending_ios != null:
		options["get_pending_transactions_ios"] = func() -> Variant:
			await process_frame
			return PurchaseFlow.Failure.new("unverified") if pending_ios is String else keyed.call(pending_ios)
	var flow := PurchaseFlow.new(options)
	flow.purchase_processed.connect(func(purchase: Dictionary, status: PurchaseFlow.Status) -> void:
		published.append({"id": purchase.id, "status": _comparable(status)}))

	for step in vector.steps:
		if step.get("dispose", false):
			flow.dispose()
		for key in step.get("listener", []):
			if store.deliver != null:
				store.deliver.call(purchases[key])
		var processed := []
		for key in step.get("process", []):
			processed.append(_start(flow.process_purchase.bind(purchases[key])))
		var recovered = _start(flow.recover_purchases.bind(step.recover.get("includeFinished", false))) if step.has("recover") else null
		for pending in processed:
			await pending.wait()
		if recovered != null:
			var outcomes = await recovered.wait()
			_check(_equal(outcomes.map(_outcome_by_id), step.outcomes), name + " recovers")
		# Listener deliveries settle without a call to await.
		await _settle(flow)

	_check(_equal(confirms, vector.confirms), name + " confirms")
	_check(_equal(finishes, vector.finishes), name + " finishes")
	if vector.has("published"):
		_check(_equal(published, vector.published), name + " publishes")


func _test_confirm_timeout() -> void:
	var hung := PurchaseFlow._Pending.new()
	var confirms := [0]
	var finishes := [0]
	var flow := PurchaseFlow.new({
		"confirm_with_backend": func(_purchase: Dictionary, _is_consumable: bool) -> Variant:
			confirms[0] += 1
			return await hung.wait(),
		"confirm_timeout_ms": 50,
		"finish_transaction": func(_purchase: Dictionary, _is_consumable: bool) -> Types.VoidResult:
			finishes[0] += 1
			return _void_result(true),
		"is_consumable": func(_product_id: String) -> bool: return false,
		"get_available_purchases": func() -> Array: return [],
	})
	var started := Time.get_ticks_msec()
	var status: PurchaseFlow.Status = await flow.process_purchase(_purchase("tx-hung"))
	_check(status.status == "failed" and str(status.error) == "confirm_with_backend did not answer within 50 ms", "A hung backend call fails after confirm_timeout_ms")
	_check(Time.get_ticks_msec() - started >= 40, "The timeout waits for the configured time")
	_check(finishes[0] == 0, "A timed-out purchase stays unfinished")
	_start(flow.process_purchase.bind(_purchase("tx-hung")))
	_check(confirms[0] == 2, "The hung call no longer holds the transaction")


func _test_confirm_timeout_ignores_time_scale() -> void:
	var hung := PurchaseFlow._Pending.new()
	var flow := PurchaseFlow.new(_options({
		"confirm_with_backend": func(_purchase: Dictionary, _is_consumable: bool) -> Variant:
			return await hung.wait(),
		"confirm_timeout_ms": 50,
	}))
	var previous_scale := Engine.time_scale
	Engine.time_scale = 0.0
	var timed_out := _start(flow.process_purchase.bind(_purchase("tx-paused")))
	for _frame in 300:
		if timed_out.is_settled:
			break
		await process_frame
	Engine.time_scale = previous_scale
	_check(timed_out.is_settled and timed_out.value.status == "failed", "The confirm timeout runs in real time while the game is paused")


func _test_finish_results() -> void:
	var confirms := [0]
	var answers := {}
	var flow := PurchaseFlow.new(_options({
		"confirm_with_backend": func(_purchase: Dictionary, _is_consumable: bool) -> Dictionary:
			confirms[0] += 1
			return {"status": "entitled", "alreadyGranted": false},
		"finish_transaction": func(purchase: Dictionary, _is_consumable: bool) -> Variant:
			return answers[purchase.id],
	}))
	answers["tx-void"] = null
	var status: PurchaseFlow.Status = await flow.process_purchase(_purchase("tx-void"))
	_check(status.status == "entitled" and status.finish_error == null, "A finish that returns nothing counts as finished")
	await flow.process_purchase(_purchase("tx-void"))
	_check(confirms[0] == 1, "A finish that returns nothing settles the purchase")
	var failure := PurchaseFlow.Failure.new("store down")
	answers["tx-failure"] = failure
	status = await flow.process_purchase(_purchase("tx-failure"))
	_check(status.status == "entitled" and status.finish_error == failure, "A finish that returns a Failure keeps it as finish_error")
	answers["tx-unsuccessful"] = {"success": false, "error": "Billing unavailable"}
	status = await flow.process_purchase(_purchase("tx-unsuccessful"))
	_check(status.finish_error is Dictionary and status.finish_error.error == "Billing unavailable", "A result whose success is false is a finish error")


func _test_synchronous_callbacks() -> void:
	var flow := PurchaseFlow.new({
		"confirm_with_backend": func(_purchase: Dictionary, _is_consumable: bool) -> Dictionary:
			return {"status": "entitled", "alreadyGranted": false},
		"finish_transaction": func(_purchase: Dictionary, _is_consumable: bool) -> Types.VoidResult:
			return _void_result(true),
		"is_consumable": func(_product_id: String) -> bool: return false,
		"get_available_purchases": func() -> Array: return [_purchase("GPA.1", {"store": "google", "isAcknowledgedAndroid": false})],
	})
	var status: PurchaseFlow.Status = await flow.process_purchase(_purchase("tx-sync"))
	_check(status.status == "entitled", "Callbacks that answer without awaiting still settle the purchase")
	var outcomes = await flow.recover_purchases()
	_check(outcomes.size() == 1 and outcomes[0].status.status == "entitled", "A recovery pass with synchronous reads completes")


func _test_requested_delivery_joins_run() -> void:
	var gate := PurchaseFlow._Pending.new()
	var published := []
	var deliver := [null]
	var flow := PurchaseFlow.new({
		"confirm_with_backend": func(_purchase: Dictionary, _is_consumable: bool) -> Variant:
			return await gate.wait(),
		"finish_transaction": func(_purchase: Dictionary, _is_consumable: bool) -> Types.VoidResult:
			return _void_result(true),
		"is_consumable": func(_product_id: String) -> bool: return false,
		"get_available_purchases": func() -> Array: return [],
		"listen_for_purchases": func(on_purchase: Callable) -> Callable:
			deliver[0] = on_purchase
			return Callable(),
		"was_requested": func(_purchase: Dictionary) -> bool: return false,
	})
	flow.purchase_processed.connect(func(_purchase: Dictionary, status: PurchaseFlow.Status) -> void: published.append(status))
	deliver[0].call(_purchase("tx-join"))
	var requested := _start(flow.process_purchase.bind(_purchase("tx-join")))
	gate.settle({"status": "invalid", "reason": "expired"})
	var status: PurchaseFlow.Status = await requested.wait()
	_check(published.size() == 1 and not published[0].recovered, "A run a requested delivery joined publishes as requested")
	_check(not status.recovered and PurchaseFlow.describe_purchase_flow_status(status).offerPurchase, "The requested delivery may offer buying again")


func _test_joined_run_publishes_latest_delivery() -> void:
	var gate := PurchaseFlow._Pending.new()
	var published := []
	var flow := PurchaseFlow.new({
		"confirm_with_backend": func(_purchase: Dictionary, _is_consumable: bool) -> Variant:
			return await gate.wait(),
		"finish_transaction": func(_purchase: Dictionary, _is_consumable: bool) -> Types.VoidResult:
			return _void_result(true),
		"is_consumable": func(_product_id: String) -> bool: return false,
		"get_available_purchases": func() -> Array: return [],
	})
	flow.purchase_processed.connect(func(purchase: Dictionary, status: PurchaseFlow.Status) -> void:
		published.append([purchase, status]))
	var first := _start(flow.process_purchase.bind(_purchase("GPA.7", {"store": "google"})))
	var changed := _purchase("GPA.7", {"store": "google", "pendingPurchaseUpdateAndroid": {"products": ["premium_yearly"]}})
	var second := _start(flow.process_purchase.bind(changed))
	gate.settle({"status": "entitled", "alreadyGranted": true})
	_check(not (await first.wait()).change_pending and (await second.wait()).change_pending, "Each joined delivery gets its own pending-change mark")
	_check(published.size() == 1 and published[0][0] == changed and published[0][1].change_pending, "A shared run publishes once, with the latest delivery")


func _test_dispose_silences_late_subscribers() -> void:
	var published := []
	var flow := PurchaseFlow.new({
		"confirm_with_backend": func(_purchase: Dictionary, _is_consumable: bool) -> Dictionary:
			return {"status": "entitled", "alreadyGranted": false},
		"finish_transaction": func(_purchase: Dictionary, _is_consumable: bool) -> Types.VoidResult:
			return _void_result(true),
		"is_consumable": func(_product_id: String) -> bool: return false,
		"get_available_purchases": func() -> Array: return [],
	})
	flow.dispose()
	flow.purchase_processed.connect(func(purchase: Dictionary, _status: PurchaseFlow.Status) -> void: published.append(purchase))
	var status: PurchaseFlow.Status = await flow.process_purchase(_purchase("tx-late"))
	_check(status.status == "entitled" and published.is_empty(), "A disposed flow publishes nothing, even to a later subscriber")


func _test_dispose_stops_recovery() -> void:
	var gate := PurchaseFlow._Pending.new()
	var confirmed := []
	var flow := PurchaseFlow.new(_options({
		"confirm_with_backend": func(purchase: Dictionary, _is_consumable: bool) -> Variant:
			confirmed.append(purchase.id)
			return await gate.wait(),
		"get_available_purchases": func() -> Array:
			return [
				_purchase("GPA.r1", {"store": "google", "isAcknowledgedAndroid": false}),
				_purchase("GPA.r2", {"store": "google", "isAcknowledgedAndroid": false}),
			],
	}))
	var recovery := _start(flow.recover_purchases)
	flow.dispose()
	gate.settle({"status": "entitled", "alreadyGranted": false})
	var outcomes = await recovery.wait()
	_check(confirmed == ["GPA.r1"] and outcomes.size() == 1, "Dispose stops a running recovery pass after the confirmation in progress")


func _test_recover_reports_failed_reads() -> void:
	var options := {
		"confirm_with_backend": func(_purchase: Dictionary, _is_consumable: bool) -> Dictionary:
			return {"status": "entitled", "alreadyGranted": false},
		"finish_transaction": func(_purchase: Dictionary, _is_consumable: bool) -> Types.VoidResult:
			return _void_result(true),
		"is_consumable": func(_product_id: String) -> bool: return false,
		"get_available_purchases": func() -> Variant: return PurchaseFlow.Failure.new("not connected"),
	}
	var failed = await PurchaseFlow.new(options).recover_purchases()
	_check(failed is PurchaseFlow.Failure and failed.message == "not connected", "A failed purchase read fails the recovery pass")
	options["get_available_purchases"] = func() -> Array: return [_purchase("tx-apple")]
	var refused = await PurchaseFlow.new(options).recover_purchases(true)
	_check(refused is PurchaseFlow.Failure and refused.message.contains("needs get_pending_transactions_ios"), "Apple purchases need get_pending_transactions_ios")


func _test_confirmation_request() -> void:
	_check(_equal(
		PurchaseFlow.to_purchase_confirmation_request(_purchase("GPA.1", {"store": "google", "purchaseToken": "play-token"})),
		{"store": "google", "purchaseToken": "play-token", "productId": "premium"}
	), "The confirmation request carries the store evidence and product")
	for item in [_purchase("r-1", {"store": "amazon"}), _purchase("tx-1", {"purchaseToken": null}), _purchase("tx-1", {"purchaseToken": ""})]:
		_check(PurchaseFlow.to_purchase_confirmation_request(item) is PurchaseFlow.Failure, "A purchase without Apple or Google evidence has no confirmation request")
	_check(PurchaseFlow.to_purchase_confirmation_request(_purchase("tx-1", {"quantity": 2})) is PurchaseFlow.Failure, "A multi-unit purchase has no confirmation request")


func _test_wrapper_tracks_requests() -> void:
	var wrapper = GodotIapWrapper.new()
	wrapper._is_initialized = true
	root.add_child(wrapper)
	var fake := EnvelopeTests.FakeAndroidJsonPlugin.new()
	wrapper._native_plugin = fake
	wrapper._platform = "Android"
	fake.responses["requestPurchase"] = JSON.stringify({"status": "pending"})
	wrapper.request_purchase(_purchase_props("premium_yearly"))
	_check(wrapper._take_requested({"productId": "premium", "pendingPurchaseUpdateAndroid": {"products": ["premium_yearly"]}}), "A plan change to the requested SKU counts as requested")
	_check(not wrapper._take_requested({"productId": "premium_yearly"}), "Taking a request clears its mark")

	var flow = wrapper.create_purchase_flow({
		"confirm_with_backend": func(_purchase: Dictionary, _is_consumable: bool) -> Dictionary:
			return {"status": "invalid", "reason": "expired"},
		"is_consumable": func(_product_id: String) -> bool: return false,
	})
	var published := []
	flow.purchase_processed.connect(func(_purchase: Dictionary, status: PurchaseFlow.Status) -> void: published.append(status))
	wrapper.request_purchase(_purchase_props("premium"))
	wrapper.purchase_error.emit({"code": "user-cancelled", "message": "Cancelled"})
	wrapper._on_android_purchase_updated(JSON.stringify(_android_purchase("GPA.cancelled", "premium")))
	await _settle(flow)
	_check(published.size() == 1 and published[0].recovered, "A purchase error clears every request mark")
	wrapper.request_purchase(_purchase_props("premium"))
	# A storefront failure is not a purchase error, so the mark stays.
	await wrapper.get_storefront()
	wrapper._on_android_purchase_updated(JSON.stringify(_android_purchase("GPA.requested", "premium")))
	await _settle(flow)
	_check(published.size() == 2 and not published[1].recovered, "A delivery of a requested SKU counts as requested, past a storefront failure")
	flow.dispose()
	wrapper._on_android_purchase_updated(JSON.stringify(_android_purchase("GPA.after", "premium")))
	await _settle(flow)
	_check(published.size() == 2 and not wrapper.purchase_updated.is_connected(flow._on_delivered), "Dispose stops listening to the wrapper")
	wrapper.queue_free()


func _test_wrapper_binding() -> void:
	var wrapper = GodotIapWrapper.new()
	wrapper._is_initialized = true
	root.add_child(wrapper)
	var android := RecordingAndroidPlugin.new()
	wrapper._native_plugin = android
	wrapper._platform = "Android"

	var dicts := []
	var typed := []
	wrapper.purchase_updated.connect(func(purchase: Dictionary) -> void: dicts.append(purchase))
	wrapper.purchase_received.connect(func(purchase) -> void: typed.append(purchase))
	var legacy := _android_purchase("GPA.legacy", "premium")
	legacy.erase("isAcknowledgedAndroid")
	legacy["isAcknowledged"] = true
	wrapper._on_android_purchase_updated(JSON.stringify(legacy))
	_check(dicts.size() == 1 and dicts[0].get("isAcknowledgedAndroid") == true, "Android listener dicts are normalized like query results")
	_check(typed.size() == 1 and typed[0] is Types.PurchaseAndroid and typed[0].is_acknowledged_android == true, "purchase_received delivers the typed purchase")

	var flow = wrapper.create_purchase_flow({
		"confirm_with_backend": wrapper.confirm_with_iapkit({"api_key": "openiap-kit_pk_fixture"}),
		"is_consumable": func(_product_id: String) -> bool: return false,
	})
	_check(flow._options.get("get_pending_transactions_ios") == null, "Off Apple platforms the flow gets no pending-transaction reader")
	android.responses["verifyPurchaseWithProvider"] = JSON.stringify({"provider": "iapkit", "iapkit": {
		"store": "google", "storeId": "play", "isValid": true, "state": "entitled", "productId": "premium",
	}})
	android.responses["finishTransaction"] = JSON.stringify({"success": false, "error": "Billing unavailable"})
	var status: PurchaseFlow.Status = await flow.process_purchase(_android_purchase("GPA.finish", "premium"))
	var props: Dictionary = JSON.parse_string(android.provider_props)
	_check(props.get("iapkit", {}).get("google", {}).get("purchaseToken") == "token-GPA.finish", "confirm_with_iapkit sends the Play token through the wrapper")
	_check(status.status == "entitled" and status.finish_error is PurchaseFlow.Failure and status.finish_error.message == "Billing unavailable", "A failed finish keeps the store's reason as finish_error")

	android.responses["getAvailablePurchasesResult"] = JSON.stringify({"success": false, "code": "service-disconnected", "error": "Billing disconnected"})
	var failed = await flow.recover_purchases()
	_check(failed is PurchaseFlow.Failure and failed.message == "Billing disconnected", "A failed store read reaches recover_purchases")
	flow.dispose()

	var apple := EnvelopeTests.FakeImmediateApplePlugin.new()
	wrapper._native_plugin = apple
	wrapper._platform = "macOS"
	var owned := _apple_purchase("tx-owned")
	apple.responses["getPendingTransactionsIOS"] = JSON.stringify({"success": false, "code": "service-error", "error": "Transaction failed StoreKit verification"})
	apple.responses["getAvailablePurchases"] = JSON.stringify({"success": true, "purchasesJson": JSON.stringify([owned])})
	var confirmed := []
	flow = wrapper.create_purchase_flow({
		"confirm_with_backend": func(purchase: Dictionary, _is_consumable: bool) -> Dictionary:
			confirmed.append(purchase.id)
			return {"status": "entitled", "alreadyGranted": true},
		"is_consumable": func(_product_id: String) -> bool: return false,
	})
	var outcomes = await flow.recover_purchases()
	_check(confirmed == ["tx-owned"] and outcomes.size() == 1, "A failed pending-transaction read falls back to every owned Apple purchase")
	_check(apple.responses.has("last_finish_args"), "The recovered Apple purchase is finished")
	flow.dispose()
	wrapper.queue_free()


# Starts a coroutine now, to await later like a TS promise.
func _test_wrapper_holds_listening_flows() -> void:
	var wrapper = GodotIapWrapper.new()
	wrapper._is_initialized = true
	root.add_child(wrapper)
	wrapper._native_plugin = EnvelopeTests.FakeAndroidJsonPlugin.new()
	wrapper._platform = "Android"
	var confirmed := []
	var flow_ref := _unreferenced_flow(wrapper, confirmed)
	wrapper._on_android_purchase_updated(JSON.stringify(_android_purchase("GPA.held", "premium")))
	_check(flow_ref.get_ref() != null and confirmed == ["GPA.held"], "A flow nobody else references still processes deliveries")
	flow_ref.get_ref().dispose()
	_check(flow_ref.get_ref() == null, "Dispose releases the flow")
	wrapper.queue_free()


func _unreferenced_flow(wrapper: Node, confirmed: Array) -> WeakRef:
	var flow = wrapper.create_purchase_flow({
		"confirm_with_backend": func(purchase: Dictionary, _is_consumable: bool) -> Dictionary:
			confirmed.append(purchase.id)
			return {"status": "verified"},
		"is_consumable": func(_product_id: String) -> bool: return false,
	})
	return weakref(flow)


# Options for a flow whose store answers at once; overrides replace them.
func _options(overrides: Dictionary) -> Dictionary:
	return {
		"confirm_with_backend": func(_purchase: Dictionary, _is_consumable: bool) -> Dictionary:
			return {"status": "entitled", "alreadyGranted": false},
		"finish_transaction": func(_purchase: Dictionary, _is_consumable: bool) -> Types.VoidResult:
			return _void_result(true),
		"is_consumable": func(_product_id: String) -> bool: return false,
		"get_available_purchases": func() -> Array: return [],
	}.merged(overrides, true)


func _start(call: Callable) -> PurchaseFlow._Pending:
	var pending := PurchaseFlow._Pending.new()
	(func() -> void: pending.settle(await call.call())).call()
	return pending


func _settle(flow: PurchaseFlow) -> void:
	for _frame in 100:
		if flow._runs.is_empty():
			return
		await process_frame
	_check(false, "Purchase runs settle within 100 frames")


func _outcome_by_id(outcome: Dictionary) -> Dictionary:
	return {"id": outcome.purchase.id, "status": _comparable(outcome.status)}


# Like the TS runner: any error or finishError counts, whatever its message.
func _comparable(status: PurchaseFlow.Status) -> Dictionary:
	var dict := status.to_dict()
	for key in ["error", "finishError"]:
		if dict.has(key):
			dict[key] = true
	return dict


# JSON numbers parse as float; compare them by value, like JavaScript.
func _equal(a: Variant, b: Variant) -> bool:
	if (a is int or a is float) and (b is int or b is float):
		return a == b
	if typeof(a) != typeof(b):
		return false
	if a is Dictionary:
		if a.size() != b.size():
			return false
		for key in a:
			if not b.has(key) or not _equal(a[key], b[key]):
				return false
		return true
	if a is Array:
		if a.size() != b.size():
			return false
		for index in a.size():
			if not _equal(a[index], b[index]):
				return false
		return true
	return a == b


func _void_result(success: bool) -> Types.VoidResult:
	var result := Types.VoidResult.new()
	result.success = success
	return result


func _purchase(id: String, overrides: Dictionary = {}) -> Dictionary:
	return {
		"id": id,
		"productId": "premium",
		"purchaseState": "purchased",
		"purchaseToken": "token-1",
		"store": "apple",
	}.merged(overrides, true)


func _android_purchase(id: String, product_id: String) -> Dictionary:
	return {
		"id": id, "productId": product_id, "purchaseToken": "token-" + id,
		"purchaseState": "purchased", "transactionDate": 1, "quantity": 1,
		"isAutoRenewing": false, "store": "google", "storeId": "play",
		"isAcknowledgedAndroid": false,
	}


func _apple_purchase(id: String) -> Dictionary:
	return {
		"id": id, "transactionId": id, "productId": "premium", "purchaseToken": "jws-" + id,
		"purchaseState": "purchased", "transactionDate": 1, "quantity": 1,
		"isAutoRenewing": false, "store": "apple", "storeId": "apple",
	}


func _purchase_props(sku: String) -> Types.RequestPurchaseProps:
	var props := Types.RequestPurchaseProps.new()
	props.request = Types.RequestPurchasePropsByPlatforms.new()
	props.request.google = Types.RequestPurchaseAndroidProps.new()
	var skus: Array[String] = [sku]
	props.request.google.skus = skus
	props.type = Types.ProductQueryType.IN_APP
	return props


func _check(condition: bool, message: String) -> void:
	print("%s %s" % ["PASS" if condition else "FAIL", message])
	if condition:
		_passed += 1
	else:
		_failed += 1
