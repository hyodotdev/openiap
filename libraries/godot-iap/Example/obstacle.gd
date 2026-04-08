extends Area2D

@export var fall_speed: float = 300.0

var screen_height: float


func _ready() -> void:
	screen_height = get_viewport_rect().size.y
	add_to_group("obstacles")


func _process(delta: float) -> void:
	position.y += fall_speed * delta

	# Remove when off screen
	if position.y > screen_height + 50:
		queue_free()
