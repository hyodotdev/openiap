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

	func _get_name() -> String:
		return PLUGIN_NAME

	func _supports_platform(platform: EditorExportPlatform) -> bool:
		if platform is EditorExportPlatformAndroid:
			return true
		return false

	func _get_android_libraries(platform: EditorExportPlatform, debug: bool) -> PackedStringArray:
		# Path is relative to the project root (res://)
		if debug:
			return PackedStringArray(["res://addons/godot-iap/android/GodotIap.debug.aar"])
		else:
			return PackedStringArray(["res://addons/godot-iap/android/GodotIap.release.aar"])

	func _get_android_dependencies(platform: EditorExportPlatform, debug: bool) -> PackedStringArray:
		return PackedStringArray([
			"io.github.hyochan.openiap:openiap-google:1.3.28",
			"org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3"
		])
