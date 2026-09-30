## Android store selection for exports, by the same rules as
## packages/google/gradle/openiap-store.gradle.
extends RefCounted

const STORES: PackedStringArray = ["auto", "play", "horizon", "amazon"]
const ALIASES := {
	"play": "play",
	"google": "play",
	"gplay": "play",
	"googleplay": "play",
	"google-play": "play",
	"gms": "play",
	"horizon": "horizon",
	"meta": "horizon",
	"quest": "horizon",
	"amazon": "amazon",
	"fire": "amazon",
	"fireos": "amazon",
	"fire-os": "amazon",
	"auto": "auto",
}


## Returns the store id, or "" when the value names no store.
static func normalize(value: Variant, provider: String = "") -> String:
	if value == null:
		return "auto"
	var key := str(value).strip_edges().to_lower()
	if key.is_empty():
		return "auto"
	if ALIASES.has(key):
		return ALIASES[key] if provider.is_empty() else ""
	if key in ["apple", "none", "unknown"] or not valid_provider(provider):
		return ""
	return key if RegEx.create_from_string("^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$").search(key) else ""


static func valid_provider(provider: String) -> bool:
	return not provider.begins_with("io.github.hyochan.openiap:openiap-") and RegEx.create_from_string("^[A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+:[0-9][A-Za-z0-9_.-]*$").search(provider) != null


const HORIZON_APP_ID_META_DATA := "com.meta.horizon.platform.HORIZON_APP_ID"

## Export feature tag for the store an Android export linked, which get_store()
## reads at runtime. Play is the untagged default.
static func store_feature(store: String) -> String:
	if store in ["horizon", "amazon"]:
		return "openiap_store_" + store
	return "openiap_store_provider" if not store in ["auto", "play", ""] else ""


## The manifest entry the Horizon SDK reads the app id from, or "" unless the
## value is the numeric id from Meta Horizon Developer Hub.
static func horizon_app_id_meta_data(app_id: Variant) -> String:
	var id := "" if app_id == null else str(app_id).strip_edges()
	if RegEx.create_from_string("^[0-9]+$").search(id) == null:
		return ""
	return '<meta-data android:name="%s" android:value="%s" />' % [HORIZON_APP_ID_META_DATA, id]


## Rewrites the openiap-google coordinate for the store; other coordinates pass through.
static func artifact(coordinate: String, store: String, provider: String = "") -> String:
	if not provider.is_empty():
		return coordinate.replace(":openiap-google:", ":openiap-core:")
	var resolved := "play" if store == "auto" else store
	var suffix := "" if resolved == "play" else "-" + resolved
	return coordinate.replace(":openiap-google:", ":openiap-google" + suffix + ":")


## The serial `adb devices` selects: ANDROID_SERIAL when it is attached,
## otherwise the only device. "" when that is absent or ambiguous.
static func pick_serial(devices_output: String, requested: String) -> String:
	var row := RegEx.create_from_string("^(\\S+)\\s+device$")
	var serials := PackedStringArray()
	for line in devices_output.split("\n"):
		# Windows adb ends lines with CR, which the serial would otherwise keep.
		var found := row.search(line.replace("\r", "").strip_edges())
		if found:
			serials.append(found.get_string(1))
	var wanted := requested.strip_edges()
	if not wanted.is_empty():
		return wanted if serials.has(wanted) else ""
	return serials[0] if serials.size() == 1 else ""


## The store a device's feature list and manufacturer point to.
static func classify(features: String, manufacturer: String) -> String:
	if features.contains("feature:horizonos.software.horizon_os") or features.contains("feature:oculus.hardware.standalone_vr"):
		return "horizon"
	if features.contains("feature:amazon.hardware.fire_tv") or manufacturer.strip_edges().to_lower() == "amazon":
		return "amazon"
	return "play"


## Resolves auto: a debug export follows the one connected device, and a
## release export never looks, so its SDK cannot depend on what is plugged in.
static func resolve_auto(debug: bool, adb: String) -> Dictionary:
	if not debug:
		return {"store": "play", "source": "default", "reason": "release export"}
	var listing := _adb_text(adb, ["devices"])
	# adb always prints a header, so no output means adb itself failed.
	if listing.is_empty():
		return {"store": "play", "source": "default", "reason": "adb did not answer"}
	var requested := OS.get_environment("ANDROID_SERIAL").strip_edges()
	var serial := pick_serial(listing, requested)
	if serial.is_empty():
		if not requested.is_empty():
			push_warning("[GodotIap] ANDROID_SERIAL=%s is not attached; not selecting a store from a device" % requested)
		return {"store": "play", "source": "default", "reason": "no single connected device"}
	var features := _adb_text(adb, ["-s", serial, "shell", "pm", "list", "features"])
	var manufacturer := _adb_text(adb, ["-s", serial, "shell", "getprop", "ro.product.manufacturer"]).strip_edges()
	# A device that dropped after the listing answers with nothing, which is
	# not a signal that it meant Play.
	if features.strip_edges().is_empty() and manufacturer.is_empty():
		return {"store": "play", "source": "default", "reason": "%s stopped responding" % serial}
	return {
		"store": classify(features, manufacturer),
		"source": "device",
		"reason": "device %s, manufacturer %s" % [serial, manufacturer if not manufacturer.is_empty() else "unknown"],
	}


static func _adb_text(adb: String, args: PackedStringArray) -> String:
	var output := []
	if OS.execute(adb, args, output) != 0 or output.is_empty():
		return ""
	return str(output[0])
