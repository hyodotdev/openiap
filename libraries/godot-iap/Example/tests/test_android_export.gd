extends SceneTree

const AndroidExport = preload("res://addons/godot-iap/android_export.gd")
const Plugin = preload("res://addons/godot-iap/godot_iap_plugin.gd")
const WRAPPER := "distributionUrl=https\\://services.gradle.org/distributions/gradle-8.11.1-bin.zip\n"

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
	_write("gradle/wrapper/gradle-wrapper.properties", WRAPPER)
	var stock := "versions = [\n    androidGradlePlugin: '8.6.1',\n    compileSdk: 35,\n    targetSdk: 35,\n    kotlinVersion: '2.1.21'\n]\n"
	var upgraded := stock.replace("8.6.1", "8.9.1").replace("compileSdk: 35", "compileSdk: 36")
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
	_check("Android export hook upgrades the selected template", FileAccess.get_file_as_string(_directory.path_join("config.gradle")) == upgraded)
	export_plugin.reads.clear()
	export_plugin.options[Plugin.GodotIapExportPlugin.ANDROID_STORE_OPTION] = "acme"
	export_plugin.options[Plugin.GodotIapExportPlugin.ANDROID_PROVIDER_OPTION] = "dev.example:store:1.0.0"
	_check("community export keeps its selected store", export_plugin._android_store(true) == "acme")
	_check("community export reads both native provider options", export_plugin.reads == [&"openiap/android_store", &"openiap/android_provider"])
	export_plugin.options[Plugin.GodotIapExportPlugin.ANDROID_PROVIDER_OPTION] = ""
	_check("changing the provider invalidates cached store selection", export_plugin._android_store(true).is_empty())
	export_plugin = null
	_write("config.gradle", stock)
	var result := AndroidExport.prepare(_directory)
	_check("stock template upgraded", result.get("changed", false))
	_check("target SDK and other settings unchanged", FileAccess.get_file_as_string(_directory.path_join("config.gradle")) == upgraded)
	_check("second export makes no change", AndroidExport.prepare(_directory) == {"changed": false})
	var custom := stock.replace("8.6.1", "8.13.2").replace("compileSdk: 35", "compileSdk: 37")
	_write("config.gradle", custom)
	_check("AGP 8.13 rejects Gradle 8.11.1", AndroidExport.prepare(_directory).has("error"))
	_check("incompatible custom pair leaves config unchanged", FileAccess.get_file_as_string(_directory.path_join("config.gradle")) == custom)
	_write("gradle/wrapper/gradle-wrapper.properties", "distributionUrl=https\\://services.gradle.org/distributions/gradle-8.13-bin.zip\n")
	_check("newer AGP retained", AndroidExport.prepare(_directory) == {"changed": false})
	_check("custom template byte-for-byte preserved", FileAccess.get_file_as_string(_directory.path_join("config.gradle")) == custom)
	for pair in [["8.11.0", "8.13.0"], ["8.12.0", "8.13.0"], ["9.0.0", "9.1.0"], ["9.1.0", "9.3.1"], ["9.2.0", "9.4.1"], ["9.3.0", "9.5.0"], ["9.4.0", "9.6.0"]]:
		var selected := custom.replace("8.13.2", pair[0])
		_write("config.gradle", selected)
		_write("gradle/wrapper/gradle-wrapper.properties", WRAPPER)
		var incompatible := AndroidExport.prepare(_directory)
		_check("AGP %s reports its required Gradle %s" % pair, incompatible.get("error", "").contains("Gradle %s+" % pair[1]))
		_check("AGP %s incompatible config preserved" % pair[0], FileAccess.get_file_as_string(_directory.path_join("config.gradle")) == selected)
		_write("gradle/wrapper/gradle-wrapper.properties", "distributionUrl=https\\://services.gradle.org/distributions/gradle-%s-all.zip\n" % pair[1])
		_check("AGP %s compatible pair accepted" % pair[0], AndroidExport.prepare(_directory) == {"changed": false})
	var preview := custom.replace("8.13.2", "9.0.0-rc01")
	_write("config.gradle", preview)
	_write("gradle/wrapper/gradle-wrapper.properties", "distributionUrl=https\\://services.gradle.org/distributions/gradle-9.2.0-rc-1-bin.zip\n")
	_check("higher preview toolchain accepted", AndroidExport.prepare(_directory) == {"changed": false})
	_check("preview template byte-for-byte preserved", FileAccess.get_file_as_string(_directory.path_join("config.gradle")) == preview)
	_write("config.gradle", stock.replace("8.6.1", "8.9.1-rc01"))
	_check("preview below the stable floor upgraded", AndroidExport.prepare(_directory).get("changed", false))
	_check("preview AGP replaced by the stable floor", FileAccess.get_file_as_string(_directory.path_join("config.gradle")) == upgraded)
	_write("gradle/wrapper/gradle-wrapper.properties", "distributionUrl=https\\://services.gradle.org/distributions/gradle-8.11.1-rc-1-bin.zip\n")
	_check("wrapper preview below the stable floor rejected", AndroidExport.prepare(_directory).has("error"))
	_write("config.gradle", stock)
	_write("gradle/wrapper/gradle-wrapper.properties", "distributionUrl=https\\://services.gradle.org/distributions/gradle-8.10-bin.zip\n")
	_check("old wrapper rejected", AndroidExport.prepare(_directory).has("error"))
	_check("incompatible template not changed", FileAccess.get_file_as_string(_directory.path_join("config.gradle")) == stock)
	var old_wrapper := WRAPPER.replace("8.11.1", "8.10")
	_write("gradle/wrapper/gradle-wrapper.properties", "# " + WRAPPER + "! " + WRAPPER + old_wrapper)
	_check("commented compatible URLs cannot hide an old active wrapper", AndroidExport.prepare(_directory).has("error"))
	_check("commented URL rejection leaves config unchanged", FileAccess.get_file_as_string(_directory.path_join("config.gradle")) == stock)
	_write("gradle/wrapper/gradle-wrapper.properties", "# " + WRAPPER)
	_check("commented URL alone is not a wrapper setting", AndroidExport.prepare(_directory).has("error"))
	_write("gradle/wrapper/gradle-wrapper.properties", WRAPPER + old_wrapper)
	_check("last active distributionUrl selects the wrapper", AndroidExport.prepare(_directory).has("error"))
	_write("gradle/wrapper/gradle-wrapper.properties", old_wrapper + WRAPPER.replace("distributionUrl=", "  distributionUrl : "))
	_check("last compatible URL with property whitespace accepted", AndroidExport.prepare(_directory).get("changed", false))
	_write("gradle/wrapper/gradle-wrapper.properties", old_wrapper)
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
	_check_real_export(stock, upgraded)
	print("Results: %d passed, %d failed" % [_passed, _failed])
	quit(0 if _failed == 0 else 1)


# A child editor's pack export reads the real preset and calls the hook first, as an APK export does.
func _check_real_export(stock: String, upgraded: String) -> void:
	var failed := _failed
	var project := ProjectSettings.globalize_path("user://android-export-project-%d" % Time.get_ticks_usec())
	var selected := project.path_join("custom/android/build")
	var unselected := project.path_join("android/build")
	for template in [selected, unselected]:
		DirAccess.make_dir_recursive_absolute(template.path_join("gradle/wrapper"))
		_store(template.get_base_dir().path_join(".gdignore"), "")
		_store(template.path_join("config.gradle"), stock)
		_store(template.path_join("gradle/wrapper/gradle-wrapper.properties"), WRAPPER)
	var addon := project.path_join("addons/godot-iap")
	DirAccess.make_dir_recursive_absolute(addon)
	for file in DirAccess.get_files_at("res://addons/godot-iap"):
		if file.get_extension() == "gd" or file == "plugin.cfg":
			DirAccess.copy_absolute("res://addons/godot-iap".path_join(file), addon.path_join(file))
	_store(project.path_join("project.godot"), "config_version=5\n\n[editor_plugins]\n\nenabled=PackedStringArray(\"res://addons/godot-iap/plugin.cfg\")\n")
	_store(project.path_join("export_presets.cfg"), _android_preset(0, "Android", true) + _android_preset(1, "Android Without Gradle", false))
	var output := []
	_check("real export without Gradle succeeds", _export_pack(project, "Android Without Gradle", output))
	_check("real export without Gradle leaves the template unchanged", FileAccess.get_file_as_string(selected.path_join("config.gradle")) == stock)
	_check("real Gradle export succeeds", _export_pack(project, "Android", output))
	_check("real Gradle export upgrades the preset's template", FileAccess.get_file_as_string(selected.path_join("config.gradle")) == upgraded)
	_check("real Gradle export leaves other templates unchanged", FileAccess.get_file_as_string(unselected.path_join("config.gradle")) == stock)
	if _failed > failed:
		print("\n".join(output))
	_remove_tree(project)


func _export_pack(project: String, preset: String, output: Array) -> bool:
	var lines := []
	var status := OS.execute(OS.get_executable_path(), ["--headless", "--path", project, "--export-pack", preset, project.path_join("export.pck")], lines, true)
	output.append_array(lines)
	return status == 0 and not "\n".join(lines).contains("SCRIPT ERROR")


func _android_preset(index: int, name: String, gradle_build: bool) -> String:
	return """[preset.%d]

name="%s"
platform="Android"
runnable=false
export_filter="all_resources"
include_filter=""
exclude_filter=""
export_path=""

[preset.%d.options]

gradle_build/use_gradle_build=%s
gradle_build/gradle_build_directory="custom/android"
openiap/android_store="play"

""" % [index, name, index, gradle_build]


func _remove_tree(path: String) -> void:
	var directory := DirAccess.open(path)
	if directory == null:
		return
	directory.include_hidden = true
	for child in directory.get_directories():
		_remove_tree(path.path_join(child))
	for file in directory.get_files():
		DirAccess.remove_absolute(path.path_join(file))
	DirAccess.remove_absolute(path)


func _write(path: String, content: String) -> void:
	_store(_directory.path_join(path), content)


func _store(path: String, content: String) -> void:
	var file := FileAccess.open(path, FileAccess.WRITE)
	file.store_string(content)
	file.close()


func _check(label: String, condition: bool) -> void:
	if condition:
		_passed += 1
		print("PASS: ", label)
	else:
		_failed += 1
		printerr("FAIL: ", label)
