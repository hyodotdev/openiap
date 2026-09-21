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

	print("\nAndroid store tests: %d passed, %d failed\n" % [_passed, _failed])
	quit(0 if _failed == 0 else 1)


func _check(name: String, ok: bool) -> void:
	if ok:
		_passed += 1
		print("  ✓ %s" % name)
	else:
		_failed += 1
		printerr("  ✗ %s" % name)
