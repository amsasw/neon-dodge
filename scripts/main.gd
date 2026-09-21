extends Node2D

const PlayerScript = preload("res://scripts/player.gd")
const HazardScript = preload("res://scripts/hazard.gd")

@onready var spawn_timer: Timer = $SpawnTimer
@onready var score_timer: Timer = $ScoreTimer
@onready var score_label: Label = $UI/ScoreLabel
@onready var game_over_label: Label = $UI/GameOverLabel

var player: Area2D
var score := 0
var game_over := false
var rng := RandomNumberGenerator.new()

func _ready() -> void:
	rng.randomize()
	spawn_timer.timeout.connect(_spawn_hazard)
	score_timer.timeout.connect(_add_score)
	_start_game()
	queue_redraw()

func _process(_delta: float) -> void:
	if game_over and Input.is_action_just_pressed("restart"):
		_start_game()

func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, Vector2(960, 540)), Color(0.035, 0.045, 0.09), true)
	for x in range(0, 961, 48):
		draw_line(Vector2(x, 0), Vector2(x, 540), Color(0.08, 0.12, 0.22), 1.0)
	for y in range(0, 541, 48):
		draw_line(Vector2(0, y), Vector2(960, y), Color(0.08, 0.12, 0.22), 1.0)

func _start_game() -> void:
	for node in get_tree().get_nodes_in_group("hazard"):
		node.queue_free()
	if is_instance_valid(player):
		player.queue_free()

	player = Area2D.new()
	player.set_script(PlayerScript)
	player.position = Vector2(480, 270)
	add_child(player)
	player.setup_collision()
	player.hit.connect(_on_player_hit)

	score = 0
	game_over = false
	score_label.text = "Score: 0"
	game_over_label.visible = false
	spawn_timer.wait_time = 0.75
	spawn_timer.start()
	score_timer.start()

func _spawn_hazard() -> void:
	if game_over:
		return

	var hazard := Area2D.new()
	hazard.set_script(HazardScript)

	var side := rng.randi_range(0, 3)
	var target := Vector2(rng.randf_range(150.0, 810.0), rng.randf_range(100.0, 440.0))
	match side:
		0:
			hazard.position = Vector2(rng.randf_range(0.0, 960.0), -30.0)
		1:
			hazard.position = Vector2(990.0, rng.randf_range(0.0, 540.0))
		2:
			hazard.position = Vector2(rng.randf_range(0.0, 960.0), 570.0)
		3:
			hazard.position = Vector2(-30.0, rng.randf_range(0.0, 540.0))

	var speed := rng.randf_range(150.0, 240.0) + min(score * 0.35, 140.0)
	hazard.velocity = hazard.position.direction_to(target) * speed
	add_child(hazard)

	spawn_timer.wait_time = max(0.22, 0.75 - score * 0.002)

func _add_score() -> void:
	if game_over:
		return
	score += 1
	score_label.text = "Score: %d" % score

func _on_player_hit() -> void:
	if game_over:
		return
	game_over = true
	spawn_timer.stop()
	score_timer.stop()
	game_over_label.visible = true
	if is_instance_valid(player):
		player.set_process(false)
