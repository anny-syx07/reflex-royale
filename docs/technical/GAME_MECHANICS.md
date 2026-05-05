# Game Mechanics & Logic

Reflex Royale features two primary game modes, each with distinct interaction patterns and scoring systems.

## ⚡ Reflex Royale Mode

Reflex Royale is a speed-based competition consisting of 10 sequential rounds.

### 1. Round Types & Interactions

| Round Type | Interaction | Logic |
|------------|-------------|-------|
| **COLOR_TAP** | Tap matching color | Speed-based: Points = max(100, 1000 - reaction_time * 2) |
| **SWIPE** | Swipe specific direction | Speed-based: Points = max(100, 1000 - reaction_time * 2) |
| **SHAKE** | Vibrate phone | Quantity-based: Points = shake_count * 10 |
| **TAP_SPAM** | Rapid clicking | Quantity-based: Points = tap_count * 5 |
| **DONT_TAP** | Reaction inhibition | 70% Bomb (Don't tap) / 30% Tap. Penalty for tapping bomb (-500). |
| **QUICK_MATH** | Find min/max | Selection: Points based on speed if correct. |
| **GYRO_BALANCE**| Leveling device | Duration-based: Points accumulated while device is within 5° tolerance. |
| **ICON_HUNT** | Pattern recognition | Search: Points based on speed. Penalty/Freeze for wrong choice. |
| **SOUND_CHECK** | Audio response | Recognition: Listen to audio, select matching image. |
| **FINAL_BLITZ** | Rapid fire | Mixed: 10 quick-fire challenges with 2x point multiplier. |

### 2. Scoring & Bonuses
- **Speed Bonus**: Most rounds use a linear decay model where faster responses earn significantly more points.
- **Placement Bonus**: In SHAKE and TAP_SPAM, the top 3 players receive flat bonuses (+500, +300, +100).
- **Consistency**: The server tracks scores throughout the 10 rounds to determine the ultimate winner.

---

## ⚔️ Campus Conquest Mode

Campus Conquest is a tactical territory-capture game played on a 10x10 grid.

### 1. Core Mechanics
- **Action Points (AP)**: Each player starts every round with 3 AP.
- **Cell Capture**: 1 AP = 1 cell claim attempt.
- **Multi-Round**: Typically played over 12 rounds.

### 2. Conflict Resolution
The server resolves all player actions simultaneously at the end of the round timer:
- **Unique Claim**: If only one player claims a cell, they become the owner.
- **Contested Claim**: If 2 or more players claim the same cell, a "Conflict" occurs. The cell remains unowned (or ownership doesn't change), and no one gets points for it.
- **Host Visibility**: The host sees real-time "pending" selections from all players before the round ends.

### 3. Scoring & Special Cells
Ownership of a cell grants points based on its value:
- **Normal Cell**: 1 point.
- **x2 Multiplier Cell**: 2 points.
- **x3 Multiplier Cell**: 3 points.
Final score (Territory) is the sum of all owned cells weighted by their multipliers.
