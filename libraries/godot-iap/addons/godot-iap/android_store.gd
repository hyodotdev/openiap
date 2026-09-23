## Android store selection for exports. Same store names, aliases and device
## rules as packages/google/gradle/openiap-store.gradle: auto follows the one
## connected device for a debug export, and anything else is Play.
extends RefCounted

const STORES: PackedStringArray = ["auto", "play", "horizon", "amazon"]
const ALIASES := {
	"auto": "auto",
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
}


## Returns the store id, or "" when the value names no store.
static func normalize(value: Variant) -> String:
	if value == null:
		return "auto"
	var key := str(value).strip_edges().to_lower()
	if key.is_empty():
		return "auto"
	return ALIASES.get(key, "")


## Rewrites the openiap-google coordinate for the store; other coordinates pass through.
static func artifact(coordinate: String, store: String) -> String:
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
