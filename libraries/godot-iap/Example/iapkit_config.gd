extends RefCounted
## IAPKit settings for the example.
##
## Values come from an untracked `res://iapkit.cfg`; `iapkit.cfg.example` is the
## committed fallback so a fresh checkout still runs.

enum Method { NONE, LOCAL_DEVICE, IAPKIT_LOCAL, IAPKIT }

const CONFIG_PATH := "res://iapkit.cfg"
const EXAMPLE_CONFIG_PATH := "res://iapkit.cfg.example"

static var _loaded := false
static var _api_key := ""
static var _base_url := ""
static var _amazon_rvs_sandbox := false


static func _ensure_loaded() -> void:
	if _loaded:
		return
	_loaded = true

	var path := CONFIG_PATH if FileAccess.file_exists(CONFIG_PATH) else EXAMPLE_CONFIG_PATH
	var config := ConfigFile.new()
	if config.load(path) != OK:
		push_warning("[IapkitConfig] No IAPKit settings at %s" % path)
		return

	_api_key = str(config.get_value("iapkit", "api_key", "")).strip_edges()
	_base_url = str(config.get_value("iapkit", "base_url", "")).strip_edges()
	_amazon_rvs_sandbox = bool(config.get_value("iapkit", "amazon_rvs_sandbox", false))


## Publishable key sent as `Bearer {api_key}`; empty when unset.
static func api_key() -> String:
	_ensure_loaded()
	return _api_key


## Origin of a local IAPKit server; empty selects the hosted default.
static func local_base_url() -> String:
	_ensure_loaded()
	return _base_url


## App Tester receipts only verify against Amazon's RVS Cloud Sandbox.
static func amazon_rvs_sandbox() -> bool:
	_ensure_loaded()
	return _amazon_rvs_sandbox


## Mirrors the other examples: no key skips, a local origin prefers it.
static func default_method() -> Method:
	if api_key().is_empty():
		return Method.NONE
	return Method.IAPKIT_LOCAL if not local_base_url().is_empty() else Method.IAPKIT


static func method_label(method: Method) -> String:
	match method:
		Method.LOCAL_DEVICE:
			return "📱 Local (Device)"
		Method.IAPKIT_LOCAL:
			return "🖥️ Local (IAPKit)"
		Method.IAPKIT:
			return "☁️ IAPKit (Server)"
		_:
			return "❌ None (Skip)"


static func next_method(method: Method) -> Method:
	match method:
		Method.NONE:
			return Method.LOCAL_DEVICE
		Method.LOCAL_DEVICE:
			return Method.IAPKIT_LOCAL
		Method.IAPKIT_LOCAL:
			return Method.IAPKIT
		_:
			return Method.NONE
