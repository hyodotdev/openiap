## Android store selection for exports. Same store names and aliases as
## packages/google/gradle/openiap-store.gradle; an export has no task flavor or
## connected device to read, so auto means play.
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
