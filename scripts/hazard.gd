extends Area2D

@export var velocity := Vector2.ZERO
@export var radius: float = 14.0

func _ready() -> void:
	add_to_group("hazard")
	var shape := CollisionShape2D.new()
	var circle := CircleShape2D.new()
	circle.radius = radius
	shape.shape = circle
	add_child(shape)
	queue_redraw()

func _process(delta: float) -> void:
	position += velocity * delta
	if position.x < -80.0 or position.x > 1040.0 or position.y < -80.0 or position.y > 620.0:
		queue_free()

func _draw() -> void:
	draw_circle(Vector2.ZERO, radius, Color(1.0, 0.18, 0.42))
	draw_circle(Vector2.ZERO, radius * 0.45, Color(1.0, 0.75, 0.87))
