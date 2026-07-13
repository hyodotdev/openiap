extends SceneTree
## Verifies that the tracked macOS framework pair can be loaded by Godot.
## Run with: godot --headless --script tests/test_native_extension.gd


func _init() -> void:
	if OS.get_name() != "macOS":
		print("SKIP: Native GDExtension load check is macOS-only")
		quit(0)
		return

	if not ClassDB.class_exists("GodotIap"):
		_fail("GodotIap GDExtension class was not registered")
		return

	if not ClassDB.can_instantiate("GodotIap"):
		_fail("GodotIap GDExtension class cannot be instantiated")
		return

	var native_plugin = ClassDB.instantiate("GodotIap")
	if native_plugin == null:
		_fail("GodotIap GDExtension instantiation returned null")
		return

	native_plugin = null
	print("PASS: GodotIap GDExtension loaded and instantiated")
	quit(0)


func _fail(message: String) -> void:
	push_error(message)
	quit(1)
