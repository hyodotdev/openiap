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

	func _export_begin(features: PackedStringArray, _is_debug: bool, _path: String, _flags: int) -> void:
		if not _is_ios_export(features):
			return

		for framework_path in IOS_FRAMEWORKS:
			if not DirAccess.dir_exists_absolute(framework_path):
				push_warning("[GodotIap] Missing iOS framework: %s" % framework_path)
				continue
			_add_ios_embedded_framework(framework_path)

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

	func _get_android_dependencies(platform: EditorExportPlatform, debug: bool) -> PackedStringArray:
		return _read_android_remote_dependencies()

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
