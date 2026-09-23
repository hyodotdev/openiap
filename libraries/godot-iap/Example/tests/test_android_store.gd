extends SceneTree
## Export store mapping tests for addons/godot-iap/android_store.gd.
## Run with: godot --headless --path Example --script res://tests/test_android_store.gd

const AndroidStore = preload("res://addons/godot-iap/android_store.gd")

var _passed := 0
var _failed := 0


func _init() -> void:
	_run.call_deferred()


func _run() -> void:
	print("\nRunning Android store mapping tests...\n")
	_check("auto normalizes to auto", AndroidStore.normalize("auto") == "auto")
	_check("blank normalizes to auto", AndroidStore.normalize("  ") == "auto")
	_check("null normalizes to auto", AndroidStore.normalize(null) == "auto")
	_check("quest is a Horizon alias", AndroidStore.normalize("Quest") == "horizon")
	_check("fire-os is an Amazon alias", AndroidStore.normalize("fire-os") == "amazon")
	_check("gms is a Play alias", AndroidStore.normalize("gms") == "play")
	_check("unknown values name no store", AndroidStore.normalize("bogus") == "")

	var play := "io.github.hyochan.openiap:openiap-google:3.5.2"
	_check("auto exports the Play artifact", AndroidStore.artifact(play, "auto") == play)
	_check(
		"horizon swaps the artifact",
		AndroidStore.artifact(play, "horizon") == "io.github.hyochan.openiap:openiap-google-horizon:3.5.2"
	)
	_check(
		"amazon swaps the artifact",
		AndroidStore.artifact(play, "amazon") == "io.github.hyochan.openiap:openiap-google-amazon:3.5.2"
	)
	var other := "org.jetbrains.kotlinx:kotlinx-coroutines-android:1.11.0"
	_check("other dependencies pass through", AndroidStore.artifact(other, "horizon") == other)

	_check(
		"a Horizon app id becomes manifest meta-data",
		AndroidStore.horizon_app_id_meta_data(" 31705015229097839 ")
			== '<meta-data android:name="com.meta.horizon.platform.HORIZON_APP_ID" android:value="31705015229097839" />'
	)
	_check("a blank Horizon app id adds nothing", AndroidStore.horizon_app_id_meta_data("") == "")
	_check("a null Horizon app id adds nothing", AndroidStore.horizon_app_id_meta_data(null) == "")
	_check(
		"a non-numeric Horizon app id adds nothing",
		AndroidStore.horizon_app_id_meta_data('1" android:exported="true') == ""
	)

	var one := "List of devices attached\r\nAAA\tdevice\r\nCCC\tunauthorized\r\nDDD\toffline\r\n"
	var two := "List of devices attached\nAAA\tdevice\nBBB\tdevice\n"
	_check("the one ready device is selected", AndroidStore.pick_serial(one, "") == "AAA")
	_check("two devices select nothing", AndroidStore.pick_serial(two, "") == "")
	_check("ANDROID_SERIAL picks among several", AndroidStore.pick_serial(two, "BBB") == "BBB")
	_check("an unattached ANDROID_SERIAL selects nothing", AndroidStore.pick_serial(two, "ZZZ") == "")
	_check("no device selects nothing", AndroidStore.pick_serial("List of devices attached\n", "") == "")

	_check(
		"a Horizon OS feature is Horizon",
		AndroidStore.classify("feature:android.hardware.wifi\nfeature:horizonos.software.horizon_os\n", "Oculus") == "horizon"
	)
	_check("a standalone VR feature is Horizon", AndroidStore.classify("feature:oculus.hardware.standalone_vr", "") == "horizon")
	_check("a Fire TV feature is Amazon", AndroidStore.classify("feature:amazon.hardware.fire_tv", "") == "amazon")
	_check("an Amazon manufacturer is Amazon", AndroidStore.classify("feature:android.hardware.wifi", " Amazon ") == "amazon")
	_check("anything else is Play", AndroidStore.classify("feature:android.hardware.wifi", "Google") == "play")

	OS.set_environment("ANDROID_SERIAL", "ABSENT")
	var no_adb := AndroidStore.resolve_auto(true, "/nonexistent/adb")
	_check(
		"a debug export with no adb is Play, without blaming ANDROID_SERIAL",
		no_adb.store == "play" and no_adb.source == "default" and no_adb.reason == "adb did not answer"
	)
	OS.unset_environment("ANDROID_SERIAL")
	if OS.get_name() == "Windows":
		print("  - skipped the connected-device cases: fake-adb is a POSIX shell script")
	else:
		_run_device_cases()

	print("\nAndroid store tests: %d passed, %d failed\n" % [_passed, _failed])
	quit(0 if _failed == 0 else 1)


# The Gradle resolver's own fixture, so both resolvers read the same adb answers.
func _run_device_cases() -> void:
	var adb := ProjectSettings.globalize_path("res://").path_join(
		"../../../packages/google/compatibility/store-resolver/fake-adb"
	).simplify_path()
	_device("QUEST1", "feature:oculus.hardware.standalone_vr", "Oculus")
	_resolves("a Quest selects horizon", true, adb, "horizon/device")
	_resolves("a release export ignores the device", false, adb, "play/default")
	_device("GHOST1", "", "")
	_resolves("a device that stops answering", true, adb, "play/default")
	_device("FIRE1", "feature:amazon.hardware.fire_tv", "Amazon")
	_resolves("a Fire device selects amazon", true, adb, "amazon/device")
	_device("FIRE2", "", "Amazon")
	_resolves("Amazon without the TV feature", true, adb, "amazon/device")
	_device("PIXEL1", "feature:android.hardware.nfc", "Google")
	_resolves("anything else is play", true, adb, "play/device")

	_device("QUEST1", "feature:oculus.hardware.standalone_vr", "Oculus")
	OS.set_environment("FAKE_ADB_DEVICES", "QUEST1 PIXEL1")
	_resolves("two devices select nothing", true, adb, "play/default")
	OS.set_environment("ANDROID_SERIAL", "QUEST1")
	_resolves("ANDROID_SERIAL picks one of them", true, adb, "horizon/device")
	OS.set_environment("ANDROID_SERIAL", "ABSENT")
	_resolves("an absent serial selects nothing", true, adb, "play/default")
	OS.unset_environment("ANDROID_SERIAL")


func _device(serial: String, features: String, manufacturer: String) -> void:
	OS.set_environment("FAKE_ADB_DEVICES", serial)
	OS.set_environment("FAKE_ADB_%s_FEATURES" % serial, features)
	OS.set_environment("FAKE_ADB_%s_MANUFACTURER" % serial, manufacturer)


func _resolves(name: String, debug: bool, adb: String, expected: String) -> void:
	var resolution := AndroidStore.resolve_auto(debug, adb)
	var actual := "%s/%s" % [resolution.store, resolution.source]
	_check("%s (%s)" % [name, actual], actual == expected)


func _check(name: String, ok: bool) -> void:
	if ok:
		_passed += 1
		print("  ✓ %s" % name)
	else:
		_failed += 1
		printerr("  ✗ %s" % name)
