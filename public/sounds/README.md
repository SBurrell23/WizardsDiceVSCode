# Sounds Directory

This directory contains all the audio files for Wizards Dice.

## Sound Categories

### Dice Sounds
- `dice-roll.mp3` - General dice rolling sound
- `dice-finish.mp3` - Sound when dice finish rolling

### Spell Sounds
- `spell-cast.mp3` - General spell casting sound
- `spell-damage.mp3` - Damage spell sound
- `spell-heal.mp3` - Healing spell sound
- `spell-utility.mp3` - Utility spell sound

### UI Sounds
- `button-click.mp3` - Button click sound
- `button-hover.mp3` - Button hover sound
- `notification.mp3` - Notification sound

### Effect Sounds
- `damage-hit.mp3` - Taking damage sound
- `heal.mp3` - Healing sound
- `armor-gain.mp3` - Gaining armor sound
- `turn-change.mp3` - Turn change sound

### Ambient Sounds
- `background-ambient.mp3` - Background ambient music
- `game-music.mp3` - Game background music

## File Formats
Recommended formats: MP3, OGG, WAV
Recommended sample rate: 44.1kHz
Recommended bit rate: 128-320 kbps for MP3

## Usage
Place audio files in this directory and reference them in the SoundController like:
```javascript
window.soundController.loadSound('diceRoll', '/sounds/dice-roll.mp3', 'dice', 0.6)
```

## License
Make sure all audio files are royalty-free or properly licensed for your use case.
