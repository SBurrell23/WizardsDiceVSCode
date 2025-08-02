<template>
  <div class="sound-controller">
    <!-- Volume Control Icon -->
    <div class="volume-icon" @click="toggleVolumePanel" :class="{ 'muted': isMuted }">
      <span v-if="isMuted" class="volume-emoji">🔇</span>
      <span v-else-if="volume === 0" class="volume-emoji">🔇</span>
      <span v-else-if="volume < 0.3" class="volume-emoji">🔈</span>
      <span v-else-if="volume < 0.7" class="volume-emoji">🔉</span>
      <span v-else class="volume-emoji">🔊</span>
    </div>

    <!-- Volume Control Panel -->
    <div v-if="showVolumePanel" class="volume-panel">
      <div class="volume-controls">
        <div class="volume-label">Game Effects</div>
        <div class="volume-slider-container">
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.05" 
            v-model="volume"
            @input="updateVolume"
            class="volume-slider"
          />
          <div class="volume-percentage">{{ Math.round(volume * 100) }}%</div>
        </div>
        
        <div class="volume-buttons">
          <button @click="muteToggle" class="volume-btn">
            {{ isMuted ? 'Unmute' : 'Mute' }}
          </button>
          <button @click="setVolume(0.25)" class="volume-btn">25%</button>
          <button @click="setVolume(0.5)" class="volume-btn">50%</button>
        </div>
        
        <!-- Background Music Controls -->
        <div class="volume-separator"></div>
        
        <div class="volume-label">Background Music</div>
        <div class="volume-slider-container">
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.05" 
            v-model="bgMusicVolume"
            @input="updateBgMusicVolume"
            class="volume-slider bg-music-slider"
          />
          <div class="volume-percentage">{{ Math.round(bgMusicVolume * 100) }}%</div>
        </div>
        
        <div class="volume-buttons">
          <button @click="bgMusicMuteToggle" class="volume-btn">
            {{ isBgMusicMuted ? 'Unmute' : 'Mute' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'

// Sound state
const volume = ref(0.5) // Default volume 50%
const isMuted = ref(false)
const bgMusicVolume = ref(0.25) // Default background music volume 25%
const isBgMusicMuted = ref(false)
const showVolumePanel = ref(false)
const previousVolume = ref(0.5) // Store volume before muting
const previousBgMusicVolume = ref(0.25) // Store background music volume before muting
const audioUnlocked = ref(false) // Track if audio context is unlocked

// Sound instances storage
const sounds = reactive({})
const soundCategories = {
  dice: {},
  spells: {},
  ui: {},
  ambient: {},
  effects: {},
  background: {}
}

// Volume control methods
const toggleVolumePanel = () => {
  showVolumePanel.value = !showVolumePanel.value
}

const updateVolume = (event) => {
  const newVolume = parseFloat(event.target.value)
  volume.value = newVolume
  if (newVolume > 0) {
    isMuted.value = false
  }
  updateAllSoundsVolume()
  saveVolumeToStorage()
}

const setVolume = (newVolume) => {
  volume.value = newVolume
  isMuted.value = false
  updateAllSoundsVolume()
  saveVolumeToStorage()
}

const muteToggle = () => {
  if (isMuted.value) {
    // Unmute
    isMuted.value = false
    volume.value = previousVolume.value
  } else {
    // Mute
    previousVolume.value = volume.value
    isMuted.value = true
    volume.value = 0
  }
  updateAllSoundsVolume()
  saveVolumeToStorage()
}

const updateAllSoundsVolume = () => {
  const actualVolume = isMuted.value ? 0 : volume.value
  Object.values(sounds).forEach(sound => {
    if (sound.audio && sound.category !== 'background') {
      sound.audio.volume = actualVolume * (sound.baseVolume || 1)
    }
  })
  updateBackgroundMusicVolume()
}

// Background music control methods
const updateBgMusicVolume = (event) => {
  const newVolume = parseFloat(event.target.value)
  bgMusicVolume.value = newVolume
  if (newVolume > 0) {
    isBgMusicMuted.value = false
  }
  updateBackgroundMusicVolume()
  saveVolumeToStorage()
}

const setBgMusicVolume = (newVolume) => {
  bgMusicVolume.value = newVolume
  isBgMusicMuted.value = false
  updateBackgroundMusicVolume()
  saveVolumeToStorage()
}

const bgMusicMuteToggle = () => {
  if (isBgMusicMuted.value) {
    // Unmute
    isBgMusicMuted.value = false
    bgMusicVolume.value = previousBgMusicVolume.value
  } else {
    // Mute
    previousBgMusicVolume.value = bgMusicVolume.value
    isBgMusicMuted.value = true
    bgMusicVolume.value = 0
  }
  updateBackgroundMusicVolume()
  saveVolumeToStorage()
}

const updateBackgroundMusicVolume = () => {
  const actualVolume = isBgMusicMuted.value ? 0 : bgMusicVolume.value
  Object.values(sounds).forEach(sound => {
    if (sound.audio && sound.category === 'background') {
      sound.audio.volume = actualVolume * (sound.baseVolume || 1)
    }
  })
}

// Audio unlock for autoplay policy compliance
const unlockAudio = async () => {
  if (audioUnlocked.value) return true
  
  try {
    // Create a silent audio context to unlock audio
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    
    // Create and play a silent buffer
    const buffer = audioContext.createBuffer(1, 1, 22050)
    const source = audioContext.createBufferSource()
    source.buffer = buffer
    source.connect(audioContext.destination)
    source.start(0)
    
    // Resume audio context if suspended
    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }
    
    audioUnlocked.value = true
    console.log('Audio context unlocked')
    
    // Only start background music if it's not muted and volume > 0
    if (!isBgMusicMuted.value && bgMusicVolume.value > 0) {
      startBackgroundMusic()
    }
    
    return true
  } catch (error) {
    console.warn('Failed to unlock audio context:', error)
    return false
  }
}

// Sound management methods
const loadSound = (soundId, soundPath, category = 'effects', baseVolume = 1) => {
  try {
    const audio = new Audio(soundPath)
    
    // Set initial volume based on category
    if (category === 'background') {
      audio.volume = (isBgMusicMuted.value ? 0 : bgMusicVolume.value) * baseVolume
    } else {
      audio.volume = (isMuted.value ? 0 : volume.value) * baseVolume
    }
    
    audio.preload = 'auto'
    
    const soundObj = {
      audio,
      baseVolume,
      category,
      isPlaying: false,
      loop: false
    }
    
    sounds[soundId] = soundObj
    
    // Add to category
    if (soundCategories[category]) {
      soundCategories[category][soundId] = soundObj
    }
    
    // Audio event listeners
    audio.addEventListener('ended', () => {
      soundObj.isPlaying = false
    })
    
    audio.addEventListener('error', (e) => {
      console.error(`Failed to load sound: ${soundId}`, e)
    })
    
    console.log(`Sound loaded: ${soundId} (${category})`)
    return soundObj
  } catch (error) {
    console.error(`Error loading sound ${soundId}:`, error)
    return null
  }
}

const playSound = (soundId, options = {}) => {
  const sound = sounds[soundId]
  if (!sound || !sound.audio) {
    console.warn(`Sound not found: ${soundId}`)
    return false
  }

  try {
    const { 
      loop = false, 
      volume: customVolume = null, 
      restart = true,
      fadeIn = false,
      fadeDuration = 500
    } = options

    // Stop current playback if restart is true
    if (restart && sound.isPlaying) {
      sound.audio.pause()
      sound.audio.currentTime = 0
    }

    // Set volume based on category
    let targetVolume
    if (sound.category === 'background') {
      targetVolume = customVolume !== null ? 
        customVolume * (isBgMusicMuted.value ? 0 : bgMusicVolume.value) : 
        (isBgMusicMuted.value ? 0 : bgMusicVolume.value) * sound.baseVolume
    } else {
      targetVolume = customVolume !== null ? 
        customVolume * (isMuted.value ? 0 : volume.value) : 
        (isMuted.value ? 0 : volume.value) * sound.baseVolume
    }

    if (fadeIn) {
      sound.audio.volume = 0
      sound.audio.play()
      fadeVolume(sound.audio, targetVolume, fadeDuration)
    } else {
      sound.audio.volume = targetVolume
      sound.audio.play()
    }

    sound.audio.loop = loop
    sound.isPlaying = true
    
    console.log(`Playing sound: ${soundId}`)
    return true
  } catch (error) {
    console.error(`Error playing sound ${soundId}:`, error)
    return false
  }
}

const stopSound = (soundId, options = {}) => {
  const sound = sounds[soundId]
  if (!sound || !sound.audio) {
    console.warn(`Sound not found: ${soundId}`)
    return false
  }

  try {
    const { fadeOut = false, fadeDuration = 500 } = options

    if (fadeOut) {
      fadeVolume(sound.audio, 0, fadeDuration, () => {
        sound.audio.pause()
        sound.audio.currentTime = 0
        sound.isPlaying = false
      })
    } else {
      sound.audio.pause()
      sound.audio.currentTime = 0
      sound.isPlaying = false
    }
    
    console.log(`Stopped sound: ${soundId}`)
    return true
  } catch (error) {
    console.error(`Error stopping sound ${soundId}:`, error)
    return false
  }
}

const pauseSound = (soundId) => {
  const sound = sounds[soundId]
  if (!sound || !sound.audio) {
    console.warn(`Sound not found: ${soundId}`)
    return false
  }

  try {
    sound.audio.pause()
    sound.isPlaying = false
    console.log(`Paused sound: ${soundId}`)
    return true
  } catch (error) {
    console.error(`Error pausing sound ${soundId}:`, error)
    return false
  }
}

const resumeSound = (soundId) => {
  const sound = sounds[soundId]
  if (!sound || !sound.audio) {
    console.warn(`Sound not found: ${soundId}`)
    return false
  }

  try {
    sound.audio.play()
    sound.isPlaying = true
    console.log(`Resumed sound: ${soundId}`)
    return true
  } catch (error) {
    console.error(`Error resuming sound ${soundId}:`, error)
    return false
  }
}

// Utility methods
const fadeVolume = (audio, targetVolume, duration, callback = null) => {
  const startVolume = audio.volume
  const volumeDiff = targetVolume - startVolume
  const steps = 20
  const stepDuration = duration / steps
  const stepSize = volumeDiff / steps
  
  let currentStep = 0
  
  const fadeInterval = setInterval(() => {
    currentStep++
    audio.volume = Math.max(0, Math.min(1, startVolume + (stepSize * currentStep)))
    
    if (currentStep >= steps) {
      clearInterval(fadeInterval)
      audio.volume = targetVolume
      if (callback) callback()
    }
  }, stepDuration)
}

const stopAllSounds = (category = null) => {
  const soundsToStop = category ? 
    Object.values(soundCategories[category] || {}) : 
    Object.values(sounds)
    
  soundsToStop.forEach(sound => {
    if (sound.audio && sound.isPlaying) {
      sound.audio.pause()
      sound.audio.currentTime = 0
      sound.isPlaying = false
    }
  })
}

const isSoundPlaying = (soundId) => {
  const sound = sounds[soundId]
  return sound ? sound.isPlaying : false
}

// Storage methods
const saveVolumeToStorage = () => {
  try {
    localStorage.setItem('wizardsDice_volume', volume.value.toString())
    localStorage.setItem('wizardsDice_muted', isMuted.value.toString())
    localStorage.setItem('wizardsDice_bgMusicVolume', bgMusicVolume.value.toString())
    localStorage.setItem('wizardsDice_bgMusicMuted', isBgMusicMuted.value.toString())
  } catch (error) {
    console.error('Failed to save volume settings:', error)
  }
}

const loadVolumeFromStorage = () => {
  try {
    const savedVolume = localStorage.getItem('wizardsDice_volume')
    const savedMuted = localStorage.getItem('wizardsDice_muted')
    const savedBgMusicVolume = localStorage.getItem('wizardsDice_bgMusicVolume')
    const savedBgMusicMuted = localStorage.getItem('wizardsDice_bgMusicMuted')
    
    if (savedVolume !== null) {
      volume.value = parseFloat(savedVolume)
    }
    
    if (savedMuted !== null) {
      isMuted.value = savedMuted === 'true'
    }
    
    if (savedBgMusicVolume !== null) {
      bgMusicVolume.value = parseFloat(savedBgMusicVolume)
    }
    
    if (savedBgMusicMuted !== null) {
      isBgMusicMuted.value = savedBgMusicMuted === 'true'
    }
  } catch (error) {
    console.error('Failed to load volume settings:', error)
  }
}

// Click outside to close volume panel
const handleClickOutside = (event) => {
  if (!event.target.closest('.sound-controller')) {
    showVolumePanel.value = false
  }
}

// Component lifecycle
onMounted(() => {
  loadVolumeFromStorage()
  document.addEventListener('click', handleClickOutside)
  
  // Add global click listener to unlock audio on first interaction
  const unlockOnInteraction = () => {
    unlockAudio()
    document.removeEventListener('click', unlockOnInteraction)
    document.removeEventListener('keydown', unlockOnInteraction)
    document.removeEventListener('touchstart', unlockOnInteraction)
  }
  
  document.addEventListener('click', unlockOnInteraction)
  document.addEventListener('keydown', unlockOnInteraction)
  document.addEventListener('touchstart', unlockOnInteraction)
  
  // Load game sounds (uncomment when you add sound files to public/sounds/)
  loadSound('diceRoll', '/sounds/dice-roll.wav', 'dice', 0.5)
  loadSound('turnChange', '/sounds/turn-change.mp3', 'ui', 0.5)
  loadSound('turnChangeOver', '/sounds/turn-change-over.mp3', 'ui', 0.5)
  loadSound('diceRollNumbered', '/sounds/dice-roll-number.wav', 'dice', 0.5)
  loadSound('spellCast', '/sounds/spell-cast.wav', 'spells', 0.5)
  loadSound('gameWon', '/sounds/game-won.wav', 'ui', 0.7)
  loadSound('gameLost', '/sounds/game-lost.wav', 'ui', 0.7)
  
  // Load background music
  loadSound('backgroundMusic', '/sounds/OST 1 - Poison Ivy Manor (Loopable).mp3', 'background', 1.0)
  
  //loadSound('damageHit', '/sounds/damage-hit.wav', 'effects', 0.7)
  //loadSound('heal', '/sounds/heal.wav', 'effects', 0.6)
  //loadSound('armorGain', '/sounds/armor-gain.wav', 'effects', 0.6)
  //loadSound('buttonClick', '/sounds/button-click.mp3', 'ui', 0.4)
  //loadSound('buttonHover', '/sounds/button-hover.mp3', 'ui', 0.3)
  //loadSound('spellSelect', '/sounds/spell-select.mp3', 'ui', 0.5)
  //loadSound('notification', '/sounds/notification.mp3', 'ui', 0.6)
  
  console.log('SoundController mounted and sounds loaded')
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  stopAllSounds()
})

// Background music control methods
const startBackgroundMusic = () => {
  if (!audioUnlocked.value) {
    console.log('Audio not unlocked yet, waiting for user interaction')
    return false
  }
  return playSound('backgroundMusic', { loop: true })
}

const stopBackgroundMusic = () => {
  return stopSound('backgroundMusic')
}

// Expose methods globally for easy access from other components
const soundController = {
  loadSound,
  playSound,
  stopSound,
  pauseSound,
  resumeSound,
  stopAllSounds,
  isSoundPlaying,
  setVolume,
  muteToggle,
  startBackgroundMusic,
  stopBackgroundMusic,
  setBgMusicVolume,
  bgMusicMuteToggle,
  unlockAudio,
  sounds,
  soundCategories,
  audioUnlocked
}

// Make available globally
if (typeof window !== 'undefined') {
  window.soundController = soundController
}

// Expose for parent components
defineExpose(soundController)
</script>

<style scoped>
.sound-controller {
  position: fixed;
  top: 23px;
  right: 23px;
  z-index: 1000;
}

.volume-icon {
  width: 45px;
  height: 45px;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1.2rem;
  border: 2px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
  user-select: none;
  opacity: 0.7;
}

.volume-icon:hover {
  background: rgba(0, 0, 0, 0.8);
  border-color: rgba(255, 255, 255, 0.4);
  transform: scale(1.05);
  opacity: 1;
}

.volume-icon.muted {
  background: rgba(200, 0, 0, 0.6);
  border-color: rgba(255, 100, 100, 0.3);
  opacity: 0.8;
}

.volume-icon.muted:hover {
  background: rgba(200, 0, 0, 0.8);
  border-color: rgba(255, 100, 100, 0.5);
  opacity: 1;
}

.volume-panel {
  position: absolute;
  top: 60px;
  right: 0;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border-radius: 15px;
  padding: 20px;
  min-width: 280px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(15px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  animation: slideDown 0.3s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.volume-controls {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.volume-label {
  color: white;
  font-weight: 600;
  font-size: 1rem;
  text-align: center;
  margin-bottom: 5px;
}

.volume-slider-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.volume-slider {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.3);
  outline: none;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #4f46e5;
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.bg-music-slider::-webkit-slider-thumb {
  background: #7c3aed;
}

.bg-music-slider::-moz-range-thumb {
  background: #7c3aed;
}

.volume-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #4f46e5;
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.volume-percentage {
  color: white;
  font-size: 0.9rem;
  text-align: center;
  font-weight: 500;
}

.volume-buttons {
  display: flex;
  gap: 8px;
  justify-content: space-between;
}

.volume-separator {
  height: 1px;
  background: rgba(255, 255, 255, 0.3);
  margin: 15px 0;
}

.volume-btn {
  flex: 1;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  color: white;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.volume-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.5);
  transform: translateY(-1px);
}

.volume-btn:active {
  transform: translateY(0);
}

/* Responsive adjustments */
@media (max-height: 600px) {
  .sound-controller {
    top: 10px;
    left: 10px;
  }
  
  .volume-icon {
    width: 40px;
    height: 40px;
    font-size: 1.2rem;
  }
  
  .volume-panel {
    top: 50px;
    padding: 15px;
    min-width: 220px;
  }
}

@media (max-width: 480px) {
  .sound-controller {
    top: 5px;
    left: 5px;
  }

  .volume-icon {
    width: 25px;
    height: 25px;
    font-size: 1rem;
  }

  .volume-panel {
    min-width: 200px;
    padding: 15px;
  }
  
  .volume-buttons {
    flex-direction: column;
    gap: 6px;
  }
}
</style>
