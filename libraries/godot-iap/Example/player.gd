extends Area2D

signal hit

@export var speed: float = 400.0

var screen_size: Vector2
var can_move: bool = true
var touch_target_x: float = -1.0
var ui_blocking: bool = false


func _ready() -> void:
	# Use the project's viewport size (720x1280)
	screen_size = Vector2(720, 1280)


func _input(event: InputEvent) -> void:
	if not can_move or ui_blocking:
		return

	# Handle touch input
	if event is InputEventScreenTouch:
		if event.pressed:
			touch_target_x = event.position.x
		else:
			touch_target_x = -1.0
	elif event is InputEventScreenDrag:
		touch_target_x = event.position.x


func _process(delta: float) -> void:
	if not can_move or ui_blocking:
		return

	var velocity := Vector2.ZERO

	# Touch/drag movement
	if touch_target_x >= 0:
		var diff = touch_target_x - position.x
		if abs(diff) > 10:
			velocity.x = sign(diff)

	# Keyboard movement (for desktop testing)
	if Input.is_action_pressed("ui_left"):
		velocity.x = -1
	if Input.is_action_pressed("ui_right"):
		velocity.x = 1

	if velocity.length() > 0:
		velocity = velocity.normalized() * speed

	position += velocity * delta

	# Clamp to screen bounds (with some padding for sprite size)
	position.x = clamp(position.x, 64, screen_size.x - 64)


func _on_area_entered(area: Area2D) -> void:
	if area.is_in_group("obstacles"):
		hit.emit()
