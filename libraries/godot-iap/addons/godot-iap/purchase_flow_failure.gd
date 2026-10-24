extends RefCounted
## Shared without loading the flow, so its compatibility delegates can preload confirmers.

var message: String


func _init(text: String) -> void:
	message = text


func _to_string() -> String:
	return message
