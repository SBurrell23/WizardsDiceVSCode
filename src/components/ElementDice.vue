<template>
  <div class="element-dice" :class="{ 'rolling': isRolling, 'ready-to-roll': canRoll }">
    <div class="dice-face">
      {{ currentFace }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

// Props
const props = defineProps({
  canRoll: {
    type: Boolean,
    default: false
  },
  diceIndex: {
    type: Number,
    default: 0
  }
})

// Emits
const emit = defineEmits(['rolled'])

// Element faces with emojis
const elementFaces = ['🔥', '💧', '🌍', '💨', '💖', '💀']
const elementNames = ['fire', 'water', 'earth', 'air', 'love', 'death']

// Reactive data
const currentFace = ref('🎲')
const isRolling = ref(false)
const rolledValue = ref(null)

// Computed
const rolledElement = computed(() => {
  if (rolledValue.value !== null) {
    return elementNames[rolledValue.value]
  }
  return null
})

// Methods
const roll = () => {
  if (isRolling.value) return
  
  isRolling.value = true
  
  // Animate rolling for 1 second
  let rollCount = 0
  const rollInterval = setInterval(() => {
    const randomIndex = Math.floor(Math.random() * elementFaces.length)
    currentFace.value = elementFaces[randomIndex]
    rollCount++
    
    if (rollCount >= 10) { // Roll animation for about 1 second
      clearInterval(rollInterval)
      
      // Final roll result
      const finalIndex = Math.floor(Math.random() * elementFaces.length)
      rolledValue.value = finalIndex
      currentFace.value = elementFaces[finalIndex]
      isRolling.value = false
      
      // Emit the result
      emit('rolled', {
        diceIndex: props.diceIndex,
        element: elementNames[finalIndex],
        emoji: elementFaces[finalIndex],
        value: finalIndex
      })
    }
  }, 100)
}

// Reset dice (for new turns)
const reset = () => {
  currentFace.value = '🎲'
  rolledValue.value = null
  isRolling.value = false
}

// Expose methods to parent
defineExpose({
  reset,
  roll
})
</script>

<style scoped>
.element-dice {
  width: 60px;
  height: 60px;
  background: rgba(255,255,255,0.1);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 2px solid rgba(255,255,255,0.2);
  transition: all 0.3s ease;
  position: relative;
  margin: 0.25rem;
}

.element-dice.ready-to-roll {
  border-color: #ffd700;
  box-shadow: 0 0 10px rgba(255,215,0,0.3);
}

.element-dice.rolling {
  animation: shake 0.1s infinite;
  border-color: #ff6b6b;
}

.dice-face {
  font-size: 2.2rem;
  line-height: 1;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-2px); }
  75% { transform: translateX(2px); }
}
</style>
