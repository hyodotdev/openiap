extends Node2D

@export var obstacle_scene: PackedScene

var score: int = 0
var bulb_count: int = 0
var is_premium: bool = false
var is_premium_year: bool = false
var game_over: bool = false
var spawn_timer: float = 0.0
var spawn_interval: float = 1.0
var difficulty_timer: float = 0.0

@onready var player: Area2D = $Player
@onready var background: ColorRect = $ColorRect
@onready var bulb_label: Label = $UI/ShieldLabel
@onready var premium_label: Label = $UI/PremiumLabel
@onready var score_label: Label = $UI/ScoreLabel
@onready var game_over_label: Label = $UI/GameOverLabel
@onready var restart_button: Button = $UI/RestartButton
@onready var store_button: Button = $UI/StoreButton
@onready var store_overlay: ColorRect = $UI/StoreOverlay
@onready var store_panel: Panel = $UI/StorePanel
@onready var loading_label: Label = $UI/LoadingLabel
@onready var status_label: Label = $UI/StatusLabel

const VIEWPORT_WIDTH := 720
const VIEWPORT_HEIGHT := 1280


func _ready() -> void:
	obstacle_scene = preload("res://obstacle.tscn")

	# Ensure background covers full viewport
	background.size = Vector2(VIEWPORT_WIDTH, VIEWPORT_HEIGHT)

	player.hit.connect(_on_player_hit)
	restart_button.pressed.connect(_on_restart_pressed)
	store_button.pressed.connect(_on_store_button_pressed)

	# Store panel buttons
	_setup_store_panel()

	# Connect IAP signals (IapManager is autoload singleton)
	IapManager.purchase_completed.connect(_on_purchase_completed)
	IapManager.purchase_failed.connect(_on_purchase_failed)
	IapManager.products_loaded.connect(_on_products_loaded)
	IapManager.connection_changed.connect(_on_connection_changed)
	IapManager.loading_changed.connect(_on_loading_changed)

	# Load saved premium status
	_load_premium_status()

	game_over_label.visible = false
	restart_button.visible = false
	store_overlay.visible = false
	store_panel.visible = false
	loading_label.visible = true
	status_label.text = "Connecting..."

	update_ui()


func _setup_store_panel() -> void:
	# Connect store panel buttons
	var close_btn = store_panel.get_node_or_null("CloseButton")
	if close_btn:
		close_btn.pressed.connect(_on_store_close_pressed)

	var buy_10_btn = store_panel.get_node_or_null("VBoxContainer/Buy10BulbsButton")
	if buy_10_btn:
		buy_10_btn.pressed.connect(_on_buy_10_bulbs_pressed)

	var buy_30_btn = store_panel.get_node_or_null("VBoxContainer/Buy30BulbsButton")
	if buy_30_btn:
		buy_30_btn.pressed.connect(_on_buy_30_bulbs_pressed)

	var buy_premium_btn = store_panel.get_node_or_null("VBoxContainer/BuyPremiumButton")
	if buy_premium_btn:
		buy_premium_btn.pressed.connect(_on_buy_premium_pressed)

	var buy_premium_year_btn = store_panel.get_node_or_null("VBoxContainer/BuyPremiumYearButton")
	if buy_premium_year_btn:
		buy_premium_year_btn.pressed.connect(_on_buy_premium_year_pressed)

	var restore_btn = store_panel.get_node_or_null("VBoxContainer/RestoreButton")
	if restore_btn:
		restore_btn.pressed.connect(_on_restore_pressed)


func _process(delta: float) -> void:
	if game_over:
		return

	# Spawn obstacles
	spawn_timer += delta
	if spawn_timer >= spawn_interval:
		spawn_timer = 0.0
		spawn_obstacle()

	# Increase difficulty over time
	difficulty_timer += delta
	if difficulty_timer >= 10.0:
		difficulty_timer = 0.0
		spawn_interval = max(0.3, spawn_interval - 0.1)

	# Increase score
	score += 1
	update_ui()


func spawn_obstacle() -> void:
	var obstacle = obstacle_scene.instantiate()
	obstacle.position = Vector2(randf_range(50, VIEWPORT_WIDTH - 50), -50)
	obstacle.fall_speed = randf_range(200, 400)
	add_child(obstacle)


func _on_player_hit() -> void:
	if is_premium or is_premium_year:
		# Premium users always have bulbs (shield)
		show_bulb_effect()
		return

	if bulb_count > 0:
		bulb_count -= 1
		show_bulb_effect()
		update_ui()
		return

	# Game Over
	game_over = true
	player.can_move = false
	game_over_label.visible = true
	restart_button.visible = true

	# Stop all obstacles
	get_tree().call_group("obstacles", "queue_free")


func show_bulb_effect() -> void:
	# Flash player to indicate bulb (shield) used
	var tween = create_tween()
	tween.tween_property(player, "modulate", Color(1, 1, 0, 1), 0.1)  # Yellow flash
	tween.tween_property(player, "modulate", Color(1, 1, 1, 1), 0.1)


func _on_restart_pressed() -> void:
	score = 0
	spawn_interval = 1.0
	difficulty_timer = 0.0
	game_over = false
	player.can_move = true
	game_over_label.visible = false
	restart_button.visible = false

	# Reset player position (centered horizontally, near bottom)
	player.position = Vector2(360, 1100)

	update_ui()


func _on_store_button_pressed() -> void:
	if not IapManager.store_connected:
		status_label.text = "Store not connected"
		return
	store_overlay.visible = true
	store_panel.visible = true
	player.ui_blocking = true
	player.touch_target_x = -1.0  # Reset touch target
	_update_store_panel_buttons()


func _on_store_close_pressed() -> void:
	store_overlay.visible = false
	store_panel.visible = false
	player.ui_blocking = false
	player.touch_target_x = -1.0  # Reset touch target


func _on_buy_10_bulbs_pressed() -> void:
	IapManager.purchase_10_bulbs()


func _on_buy_30_bulbs_pressed() -> void:
	IapManager.purchase_30_bulbs()


func _on_buy_premium_pressed() -> void:
	if not is_premium:
		IapManager.purchase_premium()


func _on_buy_premium_year_pressed() -> void:
	if not is_premium_year:
		IapManager.purchase_premium_year()


func _on_restore_pressed() -> void:
	IapManager.restore_purchases()


func _on_purchase_completed(product_id: String) -> void:
	print("[Main] Purchase completed callback: %s" % product_id)
	match product_id:
		"dev.hyo.martie.10bulbs":
			bulb_count += 10
			print("[Main] Bulb count: %d" % bulb_count)
		"dev.hyo.martie.30bulbs":
			bulb_count += 30
			print("[Main] Bulb count: %d" % bulb_count)
		"dev.hyo.martie.certified":
			print("[Main] Certified purchased!")
		"dev.hyo.martie.premium":
			is_premium = true
			_save_premium_status()
		"dev.hyo.martie.premium_year":
			is_premium_year = true
			_save_premium_status()
	update_ui()
	_update_store_panel_buttons()


func _on_purchase_failed(product_id: String, error: String) -> void:
	print("Purchase failed: %s - %s" % [product_id, error])
	status_label.text = "Purchase failed: %s" % error


func _on_products_loaded() -> void:
	print("[Main] Products loaded, updating button texts")
	_update_store_panel_buttons()
	update_ui()


func _on_connection_changed(connected: bool) -> void:
	if connected:
		status_label.text = "Connected"
		store_button.disabled = false
	else:
		status_label.text = "Not connected"
		store_button.disabled = true


func _on_loading_changed(loading: bool) -> void:
	loading_label.visible = loading
	if loading:
		status_label.text = "Loading..."
	elif IapManager.store_connected:
		status_label.text = "Ready"
	else:
		status_label.text = "Not connected"


func _save_premium_status() -> void:
	var config := ConfigFile.new()
	config.set_value("iap", "premium", is_premium)
	config.set_value("iap", "premium_year", is_premium_year)
	config.save("user://iap_data.cfg")


func _load_premium_status() -> void:
	var config := ConfigFile.new()
	if config.load("user://iap_data.cfg") == OK:
		is_premium = config.get_value("iap", "premium", false)
		is_premium_year = config.get_value("iap", "premium_year", false)


func update_ui() -> void:
	score_label.text = "Score: %d" % score
	bulb_label.text = "Bulbs: %d" % bulb_count

	if is_premium or is_premium_year:
		var premium_type = "Year" if is_premium_year else "Lifetime"
		premium_label.text = "Premium: %s" % premium_type
		premium_label.modulate = Color(1, 0.8, 0, 1)
	else:
		premium_label.text = "Premium: OFF"
		premium_label.modulate = Color(1, 1, 1, 1)


func _update_store_panel_buttons() -> void:
	_update_button_text("VBoxContainer/Buy10BulbsButton", IapManager.PRODUCT_10_BULBS, "10 Bulbs")
	_update_button_text("VBoxContainer/Buy30BulbsButton", IapManager.PRODUCT_30_BULBS, "30 Bulbs")
	_update_button_text("VBoxContainer/BuyPremiumButton", IapManager.PRODUCT_PREMIUM, "Premium")
	_update_button_text("VBoxContainer/BuyPremiumYearButton", IapManager.PRODUCT_PREMIUM_YEAR, "Premium Year")


func _update_button_text(button_path: String, product_id: String, fallback: String) -> void:
	var button = store_panel.get_node_or_null(button_path)
	if button == null:
		return
	if IapManager.products.has(product_id):
		var product = IapManager.products[product_id]
		var title = product.get("title", fallback) if product is Dictionary else product.title
		var price = product.get("displayPrice", "") if product is Dictionary else product.display_price
		if price != "":
			button.text = "%s - %s" % [title, price]
		else:
			button.text = title
	else:
		button.text = fallback
