@tool
extends EditorPlugin

const AUTOLOAD_NAME = "GodotIapPlugin"

var _export_plugin: GodotIapExportPlugin

func _enter_tree() -> void:
	# Add autoload singleton for easy access
	add_autoload_singleton(AUTOLOAD_NAME, "res://addons/godot-iap/godot_iap.gd")

	# Add export plugin for Android
	_export_plugin = GodotIapExportPlugin.new()
	add_export_plugin(_export_plugin)

	print("[GodotIap] Plugin enabled")

func _exit_tree() -> void:
	# Remove autoload singleton
	remove_autoload_singleton(AUTOLOAD_NAME)

	# Remove export plugin
	if _export_plugin:
		remove_export_plugin(_export_plugin)
		_export_plugin = null

	print("[GodotIap] Plugin disabled")


class GodotIapExportPlugin extends EditorExportPlugin:
	const PLUGIN_NAME = "GodotIap"
	const ANDROID_GDAP_PATH = "res://addons/godot-iap/android/GodotIap.gdap"
	# Untracked developer settings. The example includes it so a debug export can
	# reach a local IAPKit server; a release export must never carry the key.
	const LOCAL_SETTINGS_PATH = "res://iapkit.cfg"
	const AndroidStore = preload("res://addons/godot-iap/android_store.gd")
	const ANDROID_STORE_OPTION = "openiap/android_store"
	const IOS_FRAMEWORKS: Array[String] = [
		"res://addons/godot-iap/bin/ios/GodotIap.framework",
		"res://addons/godot-iap/bin/ios/SwiftGodotRuntime.framework",
	]

	func _get_name() -> String:
		return PLUGIN_NAME

	func _supports_platform(platform: EditorExportPlatform) -> bool:
		if platform is EditorExportPlatformAndroid:
			return true
		if platform is EditorExportPlatformIOS:
			return true
		return false

	var _debug_export := false

	func _export_begin(features: PackedStringArray, is_debug: bool, _path: String, _flags: int) -> void:
		_debug_export = is_debug

		if not _is_ios_export(features):
			return

		for framework_path in IOS_FRAMEWORKS:
			if not DirAccess.dir_exists_absolute(framework_path):
				push_warning("[GodotIap] Missing iOS framework: %s" % framework_path)
				continue
			_add_ios_embedded_framework(framework_path)

	func _export_file(path: String, _type: String, _features: PackedStringArray) -> void:
		if path == LOCAL_SETTINGS_PATH and not _debug_export:
			push_warning("[GodotIap] Release export: leaving %s out of the bundle" % path)
			skip()

	func _is_ios_export(features: PackedStringArray) -> bool:
		var platform = get_export_platform()
		return (
			platform is EditorExportPlatformIOS
			or features.has("ios")
			or features.has("iOS")
		)

	func _add_ios_embedded_framework(path: String) -> void:
		if has_method("add_apple_embedded_platform_embedded_framework"):
			call("add_apple_embedded_platform_embedded_framework", path)
			return
		if has_method("add_apple_embedded_framework"):
			call("add_apple_embedded_framework", path)
			return

		# Godot 4.3/4.4 still expose the iOS-specific export API.
		add_ios_embedded_framework(path)

	func _get_android_libraries(platform: EditorExportPlatform, debug: bool) -> PackedStringArray:
		# Path is relative to the project root (res://)
		if debug:
			return PackedStringArray(["res://addons/godot-iap/android/GodotIap.debug.aar"])
		else:
			return PackedStringArray(["res://addons/godot-iap/android/GodotIap.release.aar"])

	func _get_export_options(platform: EditorExportPlatform) -> Array[Dictionary]:
		if not (platform is EditorExportPlatformAndroid):
			return []
		return [{
			"option": {
				"name": ANDROID_STORE_OPTION,
				"type": TYPE_STRING,
				"hint": PROPERTY_HINT_ENUM,
				"hint_string": ",".join(AndroidStore.STORES),
			},
			"default_value": "auto",
		}]

	func _get_android_dependencies(platform: EditorExportPlatform, debug: bool) -> PackedStringArray:
		var store := AndroidStore.normalize(get_option(ANDROID_STORE_OPTION))
		if store.is_empty():
			# Godot's export API cannot abort here, so drop the dependencies
			# instead: a misspelled store must not quietly ship the Play SDK.
			push_error("[GodotIap] %s must be one of: %s; exporting no OpenIAP dependency" % [ANDROID_STORE_OPTION, ", ".join(AndroidStore.STORES)])
			return PackedStringArray()
		var dependencies := PackedStringArray()
		for dependency in _read_android_remote_dependencies():
			dependencies.append(AndroidStore.artifact(dependency, store))
		return dependencies

	func _read_android_remote_dependencies() -> PackedStringArray:
		if not FileAccess.file_exists(ANDROID_GDAP_PATH):
			push_warning("[GodotIap] Missing Android dependency manifest: %s" % ANDROID_GDAP_PATH)
			return PackedStringArray()

		var gdap_content := FileAccess.get_file_as_string(ANDROID_GDAP_PATH)
		var dependency_regex := RegEx.new()
		var compile_error := dependency_regex.compile("\"([A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+:[^\"]+)\"")
		if compile_error != OK:
			push_warning("[GodotIap] Failed to compile Android dependency parser")
			return PackedStringArray()

		var dependencies := PackedStringArray()
		for match_result in dependency_regex.search_all(gdap_content):
			dependencies.append(match_result.get_string(1))

		if dependencies.is_empty():
			push_warning("[GodotIap] No remote Android dependencies found in %s" % ANDROID_GDAP_PATH)
		return dependencies
