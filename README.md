# Neon Dodge

A tiny Godot 4 arcade game created as a beginner-friendly project.

## Gameplay

Move the cyan square and survive as long as possible while red hazards fly toward the arena.

- Move: `WASD` or arrow keys
- Restart after game over: `R`
- Score increases automatically while you survive
- Hazard speed and spawn rate increase over time

## Requirements

- Godot 4.x

## Run

1. Open Godot.
2. Click **Import**.
3. Select `project.godot`.
4. Open the project and press **F6/F5** to run.

No external art assets are required; all visuals are drawn in code.

## Structure

```text
neon-dodge/
├── project.godot
├── main.tscn
└── scripts/
    ├── main.gd
    ├── player.gd
    └── hazard.gd
```

## License

MIT
