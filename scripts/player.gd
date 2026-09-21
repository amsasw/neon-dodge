extends Area2D

signal hit

@export var speed: float = 330.0
var arena_size := Vector2(960.0, 540.0)
var player_size := Vector2(36.0, 36.0)

func _ready() -> void:
	area_entered.connect(_on_area_entered)
	queue_redraw()

func _process(delta: float) -> void:
	var input_dir := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	position += input_dir * speed * delta
	var half := player_size * 0.5
	position.x = clamp(position.x, half.x, arena_size.x - half.x)
	position.y = clamp(position.y, half.y, arena_size.y - half.y)

func _draw() -> void:
	var half := player_size * 0.5
	draw_rect(Rect2(-half, player_size), Color(0.2, 0.9, 1.0), true)
	draw_rect(Rect2(-half, player_size), Color(0.75, 1.0, 1.0), false, 2.0)

func setup_collision() -> void:
	var shape := CollisionShape2D.new()
	var rect := RectangleShape2D.new()
	rect.size = player_size
	shape.shape = rect
	add_child(shape)

func _on_area_entered(area: Area2D) -> void:
	if area.is_in_group("hazard"):
		hit.emit()
