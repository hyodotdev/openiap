extends RefCounted
## The confirmers behind [method GodotIapWrapper.confirm_with_iapkit] and
## [method GodotIapWrapper.confirm_on_device_ios]; a port of
## specs/client/src/purchase-flow-confirmers.ts. They use only the purchase
## flow's public contract, as any other verification service's confirmer would.

const Failure = preload("purchase_flow_failure.gd")
const IAPKIT_UNKNOWN_RETRY_MS := 30000

# Unix time in ms that tests set; null reads the system clock.
static var _clock_ms: Variant = null


## Confirms purchases with IAPKit, given the SDK's verify_purchase_with_provider
## that takes the request Dictionary and returns IAPKit's answer in JSON shape.
## Options as in [method GodotIapWrapper.confirm_with_iapkit].
static func create_iapkit_confirmation(verify: Callable, options: Dictionary) -> Callable:
	return func(purchase: Dictionary, is_consumable: bool) -> Variant:
		var missing_grant := _missing_grant("confirm_with_iapkit", purchase, is_consumable, options)
		if missing_grant != null:
			return missing_grant
		var props = to_iapkit_verification_props(purchase, options)
		if props is Failure:
			return props
		var result = await verify.call(props)
		if result is Failure:
			return result
		var confirmation = read_iapkit_verification(result, purchase, is_consumable, options)
		if confirmation is Dictionary and confirmation.status == "entitled" and not confirmation.alreadyGranted:
			var failed_grant := await _grant(purchase, is_consumable, options)
			if failed_grant != null:
				return failed_grant
		return confirmation


## Confirms App Store purchases on the device, for an app with neither a backend
## nor IAPKit, given the SDK's get_pending_transactions_ios. StoreKit verified
## the transaction if it still lists it unfinished, unrevoked, not upgraded,
## unexpired, and from the purchase's environment; [code]grant[/code] then runs
## as in [method create_iapkit_confirmation].
static func create_device_confirmation_ios(get_pending_transactions_ios: Callable, options := {}) -> Callable:
	return func(purchase: Dictionary, is_consumable: bool) -> Variant:
		var missing_grant := _missing_grant("confirm_on_device_ios", purchase, is_consumable, options)
		if missing_grant != null:
			return missing_grant
		# A community provider may report store "apple" under its own storeId.
		var store_id = purchase.get("storeId")
		if purchase.get("store") != "apple" or (store_id != null and store_id != "apple"):
			return Failure.new("Device confirmation covers App Store purchases, not %s" % (purchase.get("store") if store_id == null else store_id))
		var pending = await get_pending_transactions_ios.call()
		if pending is Failure:
			return pending
		# After the query: a transaction can expire while StoreKit answers.
		var now := _now_ms()
		var verified: bool = pending.any(func(candidate: Dictionary) -> bool:
			var expiration = candidate.get("expirationDateIOS")
			var environment = purchase.get("environmentIOS")
			return candidate.get("store") == "apple" \
				and not String(purchase.id).is_empty() \
				and candidate.get("id") == purchase.id \
				and candidate.get("productId") == purchase.productId \
				and candidate.get("revocationDateIOS") == null \
				and candidate.get("isUpgradedIOS") != true \
				and (expiration == null or expiration > now) \
				and (environment == null or candidate.get("environmentIOS") == environment))
		if not verified:
			return Failure.new("StoreKit lists no valid unfinished transaction for %s" % purchase.productId)
		var failed_grant := await _grant(purchase, is_consumable, options)
		if failed_grant != null:
			return failed_grant
		return {"status": "entitled", "alreadyGranted": false}


static func _now_ms() -> float:
	return Time.get_unix_time_from_system() * 1000.0 if _clock_ms == null else float(_clock_ms)


# Checked before verifying: a consumable must never pass without a way to credit it.
static func _missing_grant(name: String, purchase: Dictionary, is_consumable: bool, options: Dictionary) -> Failure:
	if is_consumable and options.get("grant") == null:
		return Failure.new("%s needs grant to credit consumable %s before it is consumed" % [name, purchase.productId])
	return null


# A grant that hit a script error answers null, so only true counts as credited.
static func _grant(purchase: Dictionary, is_consumable: bool, options: Dictionary) -> Failure:
	var grant = options.get("grant")
	if grant == null:
		return null
	var granted = await grant.call(purchase, is_consumable)
	if granted is Failure:
		return granted
	if not _same(granted, true):
		return Failure.new("grant did not return true for %s" % purchase.productId)
	return null


## Builds the IAPKit request for a purchase; returns a Failure for a store
## IAPKit cannot verify.
static func to_iapkit_verification_props(purchase: Dictionary, options: Dictionary) -> Variant:
	var iapkit := {}
	var api_key = options.get("api_key")
	if api_key != null:
		# A blank key is a missing setting, not a choice to leave the key out.
		api_key = String(api_key).strip_edges()
		if api_key.is_empty():
			return Failure.new("IAPKit api_key is empty")
		iapkit["apiKey"] = api_key
	var base_url = options.get("base_url")
	base_url = "" if base_url == null else String(base_url).strip_edges()
	if not base_url.is_empty():
		iapkit["baseUrl"] = base_url
	var store := _verifying_store(purchase, options)
	if store == "horizon":
		iapkit["horizon"] = {"sku": purchase.productId}
		return {"provider": "iapkit", "iapkit": iapkit}
	if store not in ["apple", "google", "amazon"]:
		return Failure.new("IAPKit cannot verify store %s" % purchase.get("store"))
	var token = purchase.get("purchaseToken")
	if not token is String or token.is_empty():
		return Failure.new("Purchase %s has no purchase token to verify" % purchase.productId)
	match store:
		"apple":
			iapkit["apple"] = {"jws": token}
		"google":
			iapkit["google"] = {"purchaseToken": token}
		"amazon":
			var expected = _amazon_expected_environment(options)
			if expected is Failure:
				return expected
			iapkit["amazon"] = {
				"receiptId": token,
				"expectedProductId": _amazon_product_id(purchase, options),
				"sandbox": options.get("amazon", {}).get("sandbox", false),
			}
			var user_id = purchase.get("userIdAmazon")
			if user_id is String and not user_id.is_empty():
				iapkit.amazon["userId"] = user_id
	return {"provider": "iapkit", "iapkit": iapkit}


## Turns IAPKit's answer into the flow's confirmation. Anything that may be a
## configuration error rather than a rejected payment is a Failure, so the flow
## reports failed and leaves the purchase unfinished: evidence for another
## store, product, or environment, inauthentic (IAPKit's answer to a product or
## package mismatch, and to every Horizon rejection), and a valid state this
## product type cannot be granted from.
static func read_iapkit_verification(result: Dictionary, purchase: Dictionary, is_consumable: bool, options := {}) -> Variant:
	var verified = result.get("iapkit")
	if not verified is Dictionary:
		var messages := PackedStringArray()
		var errors = result.get("errors")
		for error in (errors if errors is Array else []):
			var code = error.get("code")
			messages.append("[%s] %s" % [code, error.get("message")] if code else str(error.get("message")))
		return Failure.new("\n".join(messages) if not messages.is_empty() else "IAPKit returned no verification result")
	var state = verified.get("state")
	match state:
		"pending":
			return {"status": "store_pending"}
		# The store gave no usable answer: retry instead of rejecting a payment.
		"unknown":
			return {"status": "verification_delayed", "retryAfterMs": IAPKIT_UNKNOWN_RETRY_MS}
	var store := _verifying_store(purchase, options)
	var expected_product_id = _amazon_product_id(purchase, options) if store == "amazon" else purchase.productId
	var mismatch: Variant = ""
	if not _same(verified.get("store"), purchase.get("store")):
		mismatch = "store %s, expected %s" % [verified.get("store"), purchase.get("store")]
	elif purchase.get("storeId") and not _same(verified.get("storeId"), purchase.storeId):
		mismatch = "store id %s, expected %s" % [verified.get("storeId"), purchase.storeId]
	elif not _same(verified.get("productId"), expected_product_id):
		var product_id = verified.get("productId")
		mismatch = "product %s, expected %s" % ["(none)" if product_id == null else product_id, expected_product_id]
	else:
		mismatch = _environment_mismatch(verified.get("environment"), store, purchase, options)
	if mismatch is Failure:
		return mismatch
	if mismatch is String and not mismatch.is_empty():
		return Failure.new("IAPKit verified " + mismatch)
	if not _same(verified.get("isValid"), true):
		match state:
			"canceled", "expired":
				return {"status": "invalid", "reason": state}
			# Only a granted purchase is consumed; the flow grants before finishing.
			"consumed":
				return {"status": "entitled", "alreadyGranted": true}
		return Failure.new("IAPKit rejected the purchase: %s" % state)
	if not _grants_access(store, state, is_consumable):
		return Failure.new("IAPKit state %s cannot grant this %s %s purchase" % [
			state, "consumable" if is_consumable else "non-consumable", purchase.get("store"),
		])
	return {"status": "entitled", "alreadyGranted": false}


static func _verifying_store(purchase: Dictionary, options: Dictionary) -> String:
	var verify_as = options.get("verify_as")
	var store = verify_as.call(purchase) if verify_as != null else null
	return str(purchase.get("store") if store == null else store)


static func _amazon_product_id(purchase: Dictionary, options: Dictionary) -> String:
	var verified_product_id = options.get("amazon", {}).get("verified_product_id")
	var product_id = verified_product_id.call(purchase.productId) if verified_product_id != null else null
	return purchase.productId if product_id == null else product_id


static func _amazon_expected_environment(options: Dictionary) -> Variant:
	var amazon = options.get("amazon", {})
	var expected = amazon.get("expected_environment")
	if expected == null:
		expected = "Sandbox" if amazon.get("sandbox", false) else "Production"
	if not expected is String or (expected != "Sandbox" and expected != "Production"):
		return Failure.new("Amazon expectedEnvironment must be Sandbox or Production")
	if amazon.get("sandbox", false) and expected == "Production":
		return Failure.new("Amazon Cloud Sandbox requires expectedEnvironment Sandbox")
	return expected


static func _environment_mismatch(environment: Variant, store: String, purchase: Dictionary, options: Dictionary) -> Variant:
	var expected = null
	if store == "amazon":
		expected = _amazon_expected_environment(options)
		if expected is Failure:
			return expected
	elif store == "apple":
		expected = purchase.get("environmentIOS")
	if not expected or _same(environment, expected):
		return ""
	return "environment %s, expected %s" % ["(none)" if environment == null else environment, expected]


# Apple and Amazon keep a consumable at ready-to-consume until it is finished;
# Google reports a granted purchase as pending-acknowledgment until then.
static func _grants_access(store: String, state: Variant, is_consumable: bool) -> bool:
	match store:
		"apple", "amazon":
			return _same(state, "ready-to-consume" if is_consumable else "entitled")
		"google":
			return _same(state, "entitled") or _same(state, "pending-acknowledgment") \
				or (is_consumable and _same(state, "ready-to-consume"))
		"horizon":
			return _same(state, "entitled")
	return false


# IAPKit's answer is untrusted JSON, and == between String and a number errors.
static func _same(a: Variant, b: Variant) -> bool:
	return typeof(a) == typeof(b) and a == b
