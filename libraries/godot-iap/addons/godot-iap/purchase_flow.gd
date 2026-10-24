extends RefCounted
## Purchase flow shared by every OpenIAP SDK. A confirmer (the app's backend,
## IAPKit, or any other verification service) confirms each purchase; the flow
## decides when the app may finish it, and makes no network calls of its own.
## The confirmers this SDK ships live in purchase_confirmers.gd.
##
## A port of specs/client/src/purchase-flow.ts that runs its
## purchase-flow.vectors.json. Purchases are Dictionaries in OpenIAP's JSON
## shape, as [signal GodotIapWrapper.purchase_updated] delivers them. A
## callback that fails returns a [code]GodotIapWrapper.PurchaseFlow.Failure[/code]
## where other SDKs throw.
## Create the app's flow with [method GodotIapWrapper.create_purchase_flow].
##
## See: https://kit.openiap.dev/docs/purchase-flow

## Every outcome: once per confirmation, however many deliveries shared it,
## and once per delivery of an already settled purchase.
signal purchase_processed(purchase: Dictionary, status: Status)


## Where a purchase stands after the flow ran.
class Status:
	extends RefCounted
	## store_pending, verification_delayed, ownership_conflict,
	## test_account_restricted, invalid, verified, linked, entitled, or failed.
	var status: String
	## entitled and ownership_conflict: access was granted before this answer.
	var already_granted := false
	## Earliest time to run the purchase through the flow again, in ms.
	var retry_after_ms: Variant = null
	## invalid: the backend's reason, when it gave one.
	var reason: Variant = null
	## entitled: a requested upgrade, downgrade, or prepaid top-up has not
	## applied yet, so access stays on the current plan.
	var change_pending := false
	## invalid: recovery found it; the user did not just buy it.
	var recovered := false
	## What finish_transaction returned when it failed; recovery retries it. An
	## entitled status still grants access.
	var finish_error: Variant = null
	## failed: the [code]Failure[/code].
	var error: Variant = null

	func _init(name: String) -> void:
		status = name

	## The status in OpenIAP's JSON shape, with the fields this case carries.
	func to_dict() -> Dictionary:
		var dict := {"status": status}
		if status in ["entitled", "ownership_conflict"]:
			dict["alreadyGranted"] = already_granted
		if retry_after_ms != null:
			dict["retryAfterMs"] = retry_after_ms
		if reason != null:
			dict["reason"] = reason
		if change_pending:
			dict["changePending"] = true
		if recovered:
			dict["recovered"] = true
		if finish_error != null:
			dict["finishError"] = finish_error
		if error != null:
			dict["error"] = error
		return dict

	func _with(field: StringName, value: Variant) -> Status:
		var copy := Status.new(status)
		copy.already_granted = already_granted
		copy.retry_after_ms = retry_after_ms
		copy.reason = reason
		copy.change_pending = change_pending
		copy.recovered = recovered
		copy.finish_error = finish_error
		copy.error = error
		copy.set(field, value)
		return copy


## An error a callback returns in place of its result.
class Failure:
	extends RefCounted
	var message: String

	func _init(text: String) -> void:
		message = text

	func _to_string() -> String:
		return message


# A result callers wait for; the coroutine may finish before anyone awaits it.
class _Pending:
	extends RefCounted
	signal settled(value: Variant)
	var is_settled := false
	var value: Variant = null

	func settle(result: Variant) -> void:
		if is_settled:
			return
		is_settled = true
		value = result
		settled.emit(result)

	func wait() -> Variant:
		if is_settled:
			return value
		return await settled


class _Run:
	extends _Pending
	var latest: Dictionary
	var requested: bool


var _options: Dictionary
# A listener and a recovery pass can deliver the same transaction at once.
var _runs := {}
# Finished purchases, and rejections the store settles on its own. A recovery
# pass can hold a store list read before the listener settled one.
var _settled := {}
var _recoveries := {}
var _disposed := false
var _stop_listening := Callable()


## [param options]: [code]confirm_with_backend(purchase, is_consumable)[/code]
## returns the backend's answer, after it granted access for an entitled one;
## [code]confirm_timeout_ms[/code] (default 30000) ends a hung answer as failed;
## [code]finish_transaction(purchase, is_consumable)[/code] returns a Failure,
## or a result whose [code]success[/code] is false, when finishing failed;
## [code]is_consumable(product_id)[/code];
## [code]get_available_purchases()[/code] and, on iOS only,
## [code]get_pending_transactions_ios()[/code] return purchases or a Failure;
## [code]listen_for_purchases(on_purchase)[/code] returns the Callable that
## stops it; [code]was_requested(purchase)[/code] tells whether the user's own
## request produced a delivery.
func _init(options: Dictionary) -> void:
	for key in ["confirm_with_backend", "finish_transaction", "is_consumable", "get_available_purchases"]:
		if not options.get(key) is Callable:
			push_error("PurchaseFlow needs the %s option" % key)
	_options = options
	var listen = options.get("listen_for_purchases")
	if listen != null:
		_stop_listening = listen.call(_on_delivered)


## Confirms one purchase the user just bought. Finishes it once access is
## granted to this or another account, and a settled rejection on iOS only:
## Google Play refunds a rejected purchase left unacknowledged, while iOS would
## redeliver it forever.
func process_purchase(purchase: Dictionary) -> Status:
	return await _deliver(purchase, true)


## Runs unfinished purchases (or every owned one, for a restore button)
## through the flow, one at a time; a call made while a pass runs shares it.
## Returns an Array of [code]{purchase, status}[/code], or a Failure when a
## store read fails or an Apple purchase turns up without
## get_pending_transactions_ios.
func recover_purchases(include_finished := false) -> Variant:
	var pass_: _Pending = _recoveries.get(include_finished)
	if pass_ == null:
		pass_ = _Pending.new()
		_recoveries[include_finished] = pass_
		_recover_into(pass_, include_finished)
	return await pass_.wait()


## Stops listening, publishing, and any recovery pass; confirmations already
## running still finish. Call it when the signed-in account changes, then create
## the next account's flow.
func dispose() -> void:
	_disposed = true
	if _stop_listening.is_valid():
		_stop_listening.call()
		_stop_listening = Callable()


func _on_delivered(purchase: Dictionary) -> void:
	var was_requested = _options.get("was_requested")
	# A pending delivery leaves the mark for the completed one that follows.
	var requested: bool = purchase.get("purchaseState") != "pending" \
		and was_requested != null and was_requested.call(purchase)
	_deliver(purchase, requested)


func _publish(purchase: Dictionary, status: Status) -> void:
	if not _disposed:
		purchase_processed.emit(purchase, status)


# Marked per delivery: a shared run may have started from an older copy of the
# purchase, before Play attached the pending change.
func _for_delivery(purchase: Dictionary, status: Status, requested: bool) -> Status:
	if status.status == "entitled" and purchase.get("pendingPurchaseUpdateAndroid") != null:
		return status._with("change_pending", true)
	# An old expired renewal must not ask a subscriber to buy again.
	if status.status == "invalid" and not requested:
		return status._with("recovered", true)
	return status


# Registers the run before any await, so deliveries in the same frame share it.
func _deliver(purchase: Dictionary, requested: bool, reconfirm := false) -> Status:
	var immediate := _immediate_status(purchase, reconfirm)
	if immediate != null:
		var answer := _for_delivery(purchase, immediate, requested)
		_publish(purchase, answer)
		return answer
	var run: _Run = _runs.get(purchase.id)
	if run != null:
		run.latest = purchase
		run.requested = run.requested or requested
	else:
		run = _Run.new()
		run.latest = purchase
		run.requested = requested
		_runs[purchase.id] = run
		_confirm_run(run, purchase)
	return _for_delivery(purchase, await run.wait(), requested)


func _confirm_run(run: _Run, purchase: Dictionary) -> void:
	var status := await _confirm_and_finish(purchase)
	_runs.erase(purchase.id)
	if _is_settled(status):
		_settled[purchase.id] = status
	_publish(run.latest, _for_delivery(run.latest, status, run.requested))
	run.settle(status)


func _immediate_status(purchase: Dictionary, reconfirm: bool) -> Status:
	var unsupported := _unsupported(purchase)
	if unsupported != null:
		return _failed(unsupported)
	# Payment is not complete; the store delivers the purchase again once it is.
	if purchase.get("purchaseState") == "pending":
		return Status.new("store_pending")
	if reconfirm or _runs.has(purchase.id):
		return null
	return _settled.get(purchase.id)


func _confirm_and_finish(purchase: Dictionary) -> Status:
	var is_consumable: bool = _options.is_consumable.call(purchase.productId)
	var answer = await _confirm(purchase, is_consumable)
	if answer is Failure:
		return _failed(answer)
	var confirmation := _read_confirmation(answer)
	if confirmation == null:
		return _failed(Failure.new("Unrecognized purchase confirmation from the backend"))
	# Finishing settles a purchase for good, so only a settled verdict does.
	var finishes := false
	match confirmation.status:
		"entitled":
			finishes = true
		"ownership_conflict":
			finishes = confirmation.already_granted
		"invalid", "test_account_restricted":
			finishes = purchase.get("store") == "apple"
	if not finishes:
		return confirmation
	# Play keeps an acknowledged purchase finished; a restore need not redo it.
	if purchase.get("isAcknowledgedAndroid") == true and not is_consumable:
		return confirmation
	var finished = await _options.finish_transaction.call(purchase, is_consumable)
	# Like a TS finish that did not throw, any other answer is a success.
	if finished is Failure or ((finished is Object or finished is Dictionary) and finished.get("success") is bool and not finished.get("success")):
		return confirmation._with("finish_error", finished)
	return confirmation


# Ends a hung confirm_with_backend call as failed, so it cannot hold the purchase.
func _confirm(purchase: Dictionary, is_consumable: bool) -> Variant:
	var timeout_ms = _options.get("confirm_timeout_ms", 30000)
	var answer := _Pending.new()
	var tree := Engine.get_main_loop() as SceneTree
	# Real time: a paused game (time_scale 0) must not hold the purchase.
	tree.create_timer(timeout_ms / 1000.0, true, false, true).timeout.connect(answer.settle.bind(
		Failure.new("confirm_with_backend did not answer within %d ms" % timeout_ms)
	))
	_ask_backend(answer, purchase, is_consumable)
	return await answer.wait()


func _ask_backend(answer: _Pending, purchase: Dictionary, is_consumable: bool) -> void:
	answer.settle(await _options.confirm_with_backend.call(purchase, is_consumable))


func _recover_into(pass_: _Pending, include_finished: bool) -> void:
	var outcomes = await _recover(include_finished)
	_recoveries.erase(include_finished)
	pass_.settle(outcomes)


func _recover(include_finished: bool) -> Variant:
	var get_pending_ios = _options.get("get_pending_transactions_ios")
	# iOS lists unfinished transactions directly; other stores list owned
	# purchases, and _is_unfinished picks the ones still to settle.
	var pending_ios = null
	var pending_ios_failed := false
	if get_pending_ios != null:
		pending_ios = await get_pending_ios.call()
		# One unverified transaction fails the whole list. Re-confirming a
		# finished purchase is safe, so every owned Apple purchase stands in.
		if pending_ios is Failure:
			pending_ios = null
			pending_ios_failed = true
	var available: Array = []
	if include_finished or pending_ios == null:
		var owned = await _options.get_available_purchases.call()
		if owned is Failure:
			return owned
		available = owned
	if get_pending_ios == null and available.any(func(purchase): return purchase.get("store") == "apple"):
		return Failure.new("recover_purchases needs get_pending_transactions_ios on iOS to find unfinished transactions")
	var unfinished := available.filter(func(purchase: Dictionary) -> bool:
		return include_finished or (
			pending_ios_failed if purchase.get("store") == "apple" else _is_unfinished(purchase)
		))
	var purchases := {}
	for purchase in (pending_ios if pending_ios != null else []) + unfinished:
		if not purchases.has(purchase.id):
			purchases[purchase.id] = purchase
	var outcomes: Array = []
	for purchase in purchases.values():
		# The next account's flow confirms the rest with its own session.
		if _disposed:
			break
		if not include_finished and _settled.has(purchase.id):
			continue
		outcomes.append({"purchase": purchase, "status": await _deliver(purchase, false, include_finished)})
	return outcomes


func _is_unfinished(purchase: Dictionary) -> bool:
	# Amazon and most community stores report no acknowledgment, and Amazon
	# approves a Kids purchase later; a listed consumable is unconsumed.
	return purchase.get("isAcknowledgedAndroid") != true or _options.is_consumable.call(purchase.productId)


static func _failed(error: Failure) -> Status:
	var status := Status.new("failed")
	status.error = error
	return status


# A settled purchase is finished, or rejected for good where the store settles
# it, so the same delivery need not be confirmed again.
static func _is_settled(status: Status) -> bool:
	if status.finish_error != null:
		return false
	match status.status:
		"entitled", "invalid", "test_account_restricted":
			return true
		"ownership_conflict":
			return status.already_granted
	return false


# Backend JSON is untrusted: anything off-contract becomes failed, so a
# malformed body can never finish a transaction.
static func _read_confirmation(value: Variant) -> Status:
	if not value is Dictionary or not value.get("status") is String:
		return null
	var confirmation := Status.new(value.status)
	var retry = value.get("retryAfterMs")
	var has_retry: bool = (retry is int or retry is float) and is_finite(retry) and retry >= 0
	match confirmation.status:
		"store_pending", "test_account_restricted":
			pass
		"invalid":
			if value.get("reason") is String:
				confirmation.reason = value.reason
		"verification_delayed", "verified", "linked":
			if has_retry:
				confirmation.retry_after_ms = retry
			elif confirmation.status == "verification_delayed":
				return null
		"ownership_conflict", "entitled":
			if not value.get("alreadyGranted") is bool:
				return null
			confirmation.already_granted = value.alreadyGranted
		_:
			return null
	return confirmation


static func _unsupported(purchase: Dictionary) -> Failure:
	var quantity = purchase.get("quantity", 1)
	if not (quantity is int or quantity is float) or quantity != 1:
		return Failure.new("Purchase flow supports only single-unit purchases")
	var ids = purchase.get("ids")
	var distinct := {}
	if ids is Array:
		for id in ids:
			distinct[id] = true
	if distinct.size() > 1:
		return Failure.new("Purchase flow cannot finish a multi-product purchase before every product is granted")
	return null


## Neutral guidance an app maps to its own copy: [code]key[/code],
## [code]offerPurchase[/code] (true only for an invalid purchase the user just
## made; never ask a user who may have paid to buy again), and
## [code]retryAfterMs[/code], the earliest time to run the purchase again.
static func describe_purchase_flow_status(status: Status) -> Dictionary:
	match status.status:
		"store_pending":
			return {"key": "payment_pending", "offerPurchase": false}
		"verification_delayed":
			return {"key": "verification_delayed", "offerPurchase": false, "retryAfterMs": status.retry_after_ms}
		"ownership_conflict":
			return {"key": "owned_by_another_account", "offerPurchase": false}
		"test_account_restricted":
			return {"key": "test_purchase_not_accepted", "offerPurchase": false}
		"invalid":
			return {"key": "purchase_not_valid", "offerPurchase": not status.recovered}
		"verified", "linked":
			var guidance := {"key": "access_pending", "offerPurchase": false}
			if status.retry_after_ms != null:
				guidance["retryAfterMs"] = status.retry_after_ms
			return guidance
		"entitled":
			return {"key": "change_pending" if status.change_pending else "access_granted", "offerPurchase": false}
	return {"key": "try_again_later", "offerPurchase": false}


## Builds the body an app sends its backend: [code]{store, purchaseToken, productId}[/code].
## Returns a Failure for a purchase without Apple or Google evidence.
static func to_purchase_confirmation_request(purchase: Dictionary) -> Variant:
	var store = purchase.get("store")
	var token = purchase.get("purchaseToken")
	if store not in ["apple", "google"] or not token is String or token.is_empty():
		return Failure.new("Purchase %s has no Apple or Google purchase token to confirm" % purchase.get("productId"))
	var unsupported := _unsupported(purchase)
	if unsupported != null:
		return unsupported
	return {"store": store, "purchaseToken": token, "productId": purchase.productId}


## @deprecated: Use GodotIapWrapper.confirm_with_iapkit. Removed in the next major release.
const IAPKIT_UNKNOWN_RETRY_MS = 30000


## @deprecated: Use GodotIapWrapper.confirm_with_iapkit. Removed in the next major release.
static func create_iapkit_confirmation(verify: Callable, options: Dictionary) -> Callable:
	push_warning("Use confirm_with_iapkit. Removed in the next major release.")
	return load("res://addons/godot-iap/purchase_confirmers.gd").create_iapkit_confirmation(verify, options)


## @deprecated: Use GodotIapWrapper.confirm_on_device_ios. Removed in the next major release.
static func create_device_confirmation_ios(get_pending_transactions_ios: Callable, options := {}) -> Callable:
	push_warning("Use confirm_on_device_ios. Removed in the next major release.")
	return load("res://addons/godot-iap/purchase_confirmers.gd").create_device_confirmation_ios(get_pending_transactions_ios, options)


## @deprecated: Use GodotIapWrapper.confirm_with_iapkit. Removed in the next major release.
static func to_iapkit_verification_props(purchase: Dictionary, options: Dictionary) -> Variant:
	push_warning("Use confirm_with_iapkit. Removed in the next major release.")
	return load("res://addons/godot-iap/purchase_confirmers.gd").to_iapkit_verification_props(purchase, options)


## @deprecated: Use GodotIapWrapper.confirm_with_iapkit. Removed in the next major release.
static func read_iapkit_verification(result: Dictionary, purchase: Dictionary, is_consumable: bool, options := {}) -> Variant:
	push_warning("Use confirm_with_iapkit. Removed in the next major release.")
	return load("res://addons/godot-iap/purchase_confirmers.gd").read_iapkit_verification(result, purchase, is_consumable, options)
