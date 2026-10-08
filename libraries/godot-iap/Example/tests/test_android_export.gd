extends SceneTree

const AndroidExport = preload("res://addons/godot-iap/android_export.gd")
const Plugin = preload("res://addons/godot-iap/godot_iap_plugin.gd")

class PresetExportPlugin extends Plugin.GodotIapExportPlugin:
	var options := {}
	var reads: Array[StringName] = []

	func _preset_option(name: StringName) -> Variant:
		reads.append(name)
		return options.get(name)

	func _is_ios_export(_features: PackedStringArray) -> bool:
		return false


var _failed := 0
var _passed := 0
var _directory := ""


func _init() -> void:
	_run.call_deferred()


func _run() -> void:
	await process_frame
	while EditorInterface.get_resource_filesystem().is_scanning():
		await process_frame
	var plugin = load("res://addons/godot-iap/godot_iap_plugin.gd")
	_check("export plugin parses", plugin != null and plugin.can_instantiate())
	for value in [null, ""]:
		_check("unset build directory uses stock template", AndroidExport.resolve_build_directory(value) == "res://android/build")
	_check("relative build directory resolves from project", AndroidExport.resolve_build_directory("custom/android") == "res://custom/android/build")
	_check("resource build directory preserved", AndroidExport.resolve_build_directory("res://custom/android") == "res://custom/android/build")
	_check("absolute build directory preserved", AndroidExport.resolve_build_directory("/tmp/custom/android") == "/tmp/custom/android/build")
	var template_directory := "user://android-export-%d" % Time.get_ticks_usec()
	_directory = template_directory.path_join("build")
	DirAccess.make_dir_recursive_absolute(_directory.path_join("gradle/wrapper"))
	_write("gradle/wrapper/gradle-wrapper.properties", "distributionUrl=https\\://services.gradle.org/distributions/gradle-8.11.1-bin.zip\n")
	var stock := "versions = [\n    androidGradlePlugin: '8.6.1',\n    compileSdk: 35,\n    targetSdk: 35,\n    kotlinVersion: '2.1.21'\n]\n"
	_write("config.gradle", stock)
	var export_plugin := PresetExportPlugin.new()
	export_plugin.options = {
		"gradle_build/use_gradle_build": true,
		"gradle_build/gradle_build_directory": ProjectSettings.globalize_path(template_directory),
	}
	export_plugin._export_begin(PackedStringArray(["linux"]), true, "", 0)
	_check("non-Android export does not read Android options", export_plugin.reads.is_empty())
	_check("non-Android export leaves the template unchanged", FileAccess.get_file_as_string(_directory.path_join("config.gradle")) == stock)
	export_plugin.options["gradle_build/use_gradle_build"] = false
	export_plugin._export_begin(PackedStringArray(["Android"]), true, "", 0)
	_check("non-Gradle export leaves the template unchanged", FileAccess.get_file_as_string(_directory.path_join("config.gradle")) == stock)
	_check("non-Gradle export does not read the build directory", export_plugin.reads == [&"gradle_build/use_gradle_build"])
	export_plugin.options["gradle_build/use_gradle_build"] = true
	export_plugin.reads.clear()
	export_plugin._export_begin(PackedStringArray(["android"]), true, "", 0)
	_check("Android export reads the native preset option names", export_plugin.reads == [&"gradle_build/use_gradle_build", &"gradle_build/gradle_build_directory"])
	_check("Android export hook upgrades the selected template", FileAccess.get_file_as_string(_directory.path_join("config.gradle")) == stock.replace("8.6.1", "8.9.1").replace("compileSdk: 35", "compileSdk: 36"))
	export_plugin = null
	_write("config.gradle", stock)
	var result := AndroidExport.prepare(_directory)
	_check("stock template upgraded", result.get("changed", false))
	_check("target SDK and other settings unchanged", FileAccess.get_file_as_string(_directory.path_join("config.gradle")) == stock.replace("8.6.1", "8.9.1").replace("compileSdk: 35", "compileSdk: 36"))
	_check("second export makes no change", AndroidExport.prepare(_directory) == {"changed": false})
	var custom := stock.replace("8.6.1", "8.13.2").replace("compileSdk: 35", "compileSdk: 37")
	_write("config.gradle", custom)
	_check("newer AGP retained", AndroidExport.prepare(_directory) == {"changed": false})
	_check("custom template byte-for-byte preserved", FileAccess.get_file_as_string(_directory.path_join("config.gradle")) == custom)
	var preview := custom.replace("8.13.2", "9.0.0-rc01")
	_write("config.gradle", preview)
	_write("gradle/wrapper/gradle-wrapper.properties", "distributionUrl=https\\://services.gradle.org/distributions/gradle-9.1.0-rc-1-bin.zip\n")
	_check("higher preview toolchain accepted", AndroidExport.prepare(_directory) == {"changed": false})
	_check("preview template byte-for-byte preserved", FileAccess.get_file_as_string(_directory.path_join("config.gradle")) == preview)
	_write("config.gradle", stock.replace("8.6.1", "8.9.1-rc01"))
	_check("preview below the stable floor upgraded", AndroidExport.prepare(_directory).get("changed", false))
	_check("preview AGP replaced by the stable floor", FileAccess.get_file_as_string(_directory.path_join("config.gradle")) == stock.replace("8.6.1", "8.9.1").replace("compileSdk: 35", "compileSdk: 36"))
	_write("gradle/wrapper/gradle-wrapper.properties", "distributionUrl=https\\://services.gradle.org/distributions/gradle-8.11.1-rc-1-bin.zip\n")
	_check("wrapper preview below the stable floor rejected", AndroidExport.prepare(_directory).has("error"))
	_write("config.gradle", stock)
	_write("gradle/wrapper/gradle-wrapper.properties", "distributionUrl=https\\://services.gradle.org/distributions/gradle-8.10-bin.zip\n")
	_check("old wrapper rejected", AndroidExport.prepare(_directory).has("error"))
	_check("incompatible template not changed", FileAccess.get_file_as_string(_directory.path_join("config.gradle")) == stock)
	_write("config.gradle", custom)
	_check("newer AGP still requires a compatible wrapper", AndroidExport.prepare(_directory).has("error"))
	_check("incompatible custom settings preserved", FileAccess.get_file_as_string(_directory.path_join("config.gradle")) == custom)
	_write("config.gradle", "versions = [androidGradlePlugin: customAgp]\n")
	_check("unrecognized version diagnosed", AndroidExport.prepare(_directory).has("error"))
	_check("missing template diagnosed", AndroidExport.prepare(_directory.path_join("missing")).has("error"))
	for path in ["config.gradle", "gradle/wrapper/gradle-wrapper.properties"]:
		DirAccess.remove_absolute(_directory.path_join(path))
	for path in ["gradle/wrapper", "gradle", ""]:
		DirAccess.remove_absolute(_directory.path_join(path))
	DirAccess.remove_absolute(template_directory)
	print("Results: %d passed, %d failed" % [_passed, _failed])
	quit(0 if _failed == 0 else 1)


func _write(path: String, content: String) -> void:
	var file := FileAccess.open(_directory.path_join(path), FileAccess.WRITE)
	file.store_string(content)
	file.close()


func _check(label: String, condition: bool) -> void:
	if condition:
		_passed += 1
		print("PASS: ", label)
	else:
		_failed += 1
		printerr("FAIL: ", label)
