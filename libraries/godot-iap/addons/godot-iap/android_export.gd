@tool
extends RefCounted

# AndroidX Core's consumer floor, independent of the plugin's build toolchain.
const MIN_AGP := "8.9.1"
const MIN_GRADLE := "8.11.1"
const MIN_COMPILE_SDK := 36
# https://developer.android.com/build/releases/about-agp#updating-gradle
const GRADLE_REQUIREMENTS := [
	["9.4.0", "9.6.0"],
	["9.3.0", "9.5.0"],
	["9.2.0", "9.4.1"],
	["9.1.0", "9.3.1"],
	["9.0.0", "9.1.0"],
	["8.11.0", "8.13.0"],
]


static func resolve_build_directory(preset_directory: Variant) -> String:
	var directory := "" if preset_directory == null else str(preset_directory)
	if directory.is_empty():
		directory = "res://android"
	elif not directory.is_absolute_path():
		directory = "res://".path_join(directory)
	return directory.path_join("build")


static func prepare(build_directory: String) -> Dictionary:
	var config_path := build_directory.path_join("config.gradle")
	var wrapper_path := build_directory.path_join("gradle/wrapper/gradle-wrapper.properties")
	if not FileAccess.file_exists(config_path) or not FileAccess.file_exists(wrapper_path):
		return {"error": "Install the Android Gradle build template before exporting."}
	var config := FileAccess.get_file_as_string(config_path)
	var agp := RegEx.create_from_string("(?m)^\\s*androidGradlePlugin\\s*:\\s*['\"]([0-9]+\\.[0-9]+\\.[0-9]+(?:-[A-Za-z0-9.-]+)?)['\"]").search(config)
	if agp == null:
		return {"error": "Cannot read Android Gradle Plugin version in %s; configure AGP %s+ and Gradle %s+." % [config_path, MIN_AGP, MIN_GRADLE]}
	var sdk_pattern := RegEx.create_from_string("(?m)^\\s*compileSdk\\s*:\\s*([0-9]+)")
	var sdk := sdk_pattern.search(config)
	if sdk == null:
		return {"error": "Cannot read compileSdk in %s; configure Android SDK %d or later." % [config_path, MIN_COMPILE_SDK]}
	var wrapper := FileAccess.get_file_as_string(wrapper_path)
	var distributions := RegEx.create_from_string("(?m)^[\\t ]*distributionUrl[\\t ]*[=:][\\t ]*([^\\r\\n]+)").search_all(wrapper)
	var distribution: String = "" if distributions.is_empty() else distributions.back().get_string(1)
	var gradle := RegEx.create_from_string("gradle-([0-9]+\\.[0-9]+(?:\\.[0-9]+)?(?:-[A-Za-z0-9.-]+)?)-(?:bin|all)\\.zip").search(distribution)
	var selected_agp := agp.get_string(1) if _at_least(agp.get_string(1), MIN_AGP) else MIN_AGP
	var required_gradle := _required_gradle(selected_agp)
	if gradle == null or not _at_least(gradle.get_string(1), required_gradle):
		return {"error": "AGP %s requires Gradle %s+. Update the Gradle wrapper in %s first." % [selected_agp, required_gradle, build_directory]}
	var updated := config
	if not _at_least(agp.get_string(1), MIN_AGP):
		updated = config.substr(0, agp.get_start(1)) + MIN_AGP + config.substr(agp.get_end(1))
	if int(sdk.get_string(1)) < MIN_COMPILE_SDK:
		sdk = sdk_pattern.search(updated)
		updated = updated.substr(0, sdk.get_start(1)) + str(MIN_COMPILE_SDK) + updated.substr(sdk.get_end(1))
	if updated == config:
		return {"changed": false}
	var file := FileAccess.open(config_path, FileAccess.WRITE)
	if file == null:
		return {"error": "Cannot update %s; set androidGradlePlugin to %s+ and compileSdk to %d+." % [config_path, MIN_AGP, MIN_COMPILE_SDK]}
	file.store_string(updated)
	file.close()
	return {"changed": true}


static func _required_gradle(agp: String) -> String:
	for requirement in GRADLE_REQUIREMENTS:
		if _at_least(agp.get_slice("-", 0), requirement[0]):
			return requirement[1]
	return MIN_GRADLE


static func _at_least(version: String, minimum: String) -> bool:
	var parts := version.get_slice("-", 0).split(".")
	var required := minimum.split(".")
	for index in range(3):
		var actual := int(parts[index]) if index < parts.size() else 0
		var floor_value := int(required[index])
		if actual != floor_value:
			return actual > floor_value
	return not version.contains("-")
