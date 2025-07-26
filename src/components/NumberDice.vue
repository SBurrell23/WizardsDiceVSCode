<template>
  <div class="number-dice-container">
    <div class="dice-grid">
      <div 
        class="number-die"
        :class="{ 
          'rolling': isRolling,
          [`d${sides}`]: true
        }"
      >
        <div class="die-face">
          {{ currentValue || '?' }}
        </div>
      </div>
    </div>
    
    <div class="dice-actions" v-if="!autoRoll">
      <button 
        @click="rollDice" 
        :disabled="isRolling"
        class="roll-button"
      >
        {{ isRolling ? 'Rolling...' : 'Roll Die' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'

// Props
const props = defineProps({
  diceNotation: {
    type: String,
    required: true,
    default: '1d6',
    validator: (value) => {
      // Validate format like "1d4", "1d6", etc. - only single dice
      return /^1d(4|6|8|10|12|20)$/.test(value)
    }
  },
  autoRoll: {
    type: Boolean,
    default: false
  },
  rollDelay: {
    type: Number,
    default: 1000 // milliseconds
  }
})

// Emits
const emit = defineEmits(['rolled', 'rolling-started', 'rolling-finished'])

// Parse dice notation
const parsedDice = computed(() => {
  const [count, sides] = props.diceNotation.split('d').map(Number)
  return { count: 1, sides } // Always count = 1 for single die
})

const sides = computed(() => parsedDice.value.sides)

// Reactive data - single die only
const currentValue = ref(null)
const finalValue = ref(null)
const isRolling = ref(false)
const hasRolled = ref(false)

// Initialize single die
const initializeDie = () => {
  currentValue.value = null
  finalValue.value = null
  hasRolled.value = false
  isRolling.value = false
}

// Roll the single die
const rollDice = async () => {
  if (isRolling.value) return
  
  isRolling.value = true
  hasRolled.value = false
  emit('rolling-started')
  
  // Reset die
  currentValue.value = null
  finalValue.value = null
  
  // Roll animation
  return new Promise((resolve) => {
    let rollCount = 0
    const rollInterval = setInterval(() => {
      // Show random values during animation
      currentValue.value = Math.floor(Math.random() * sides.value) + 1
      rollCount++
      
      if (rollCount >= 10) { // Roll animation duration
        clearInterval(rollInterval)
        
        // Final roll result
        const result = Math.floor(Math.random() * sides.value) + 1
        currentValue.value = result
        finalValue.value = result
        isRolling.value = false
        hasRolled.value = true
        
        // Emit results
        const rollResult = {
          notation: props.diceNotation,
          sides: sides.value,
          value: result
        }
        
        emit('rolled', rollResult)
        emit('rolling-finished', rollResult)
        
        resolve(rollResult)
      }
    }, 100)
  })
}

// Reset dice
const reset = () => {
  initializeDie()
}

// Watch for dice notation changes
watch(() => props.diceNotation, () => {
  initializeDie()
}, { immediate: true })

// Auto-roll if enabled
onMounted(() => {
  if (props.autoRoll) {
    setTimeout(() => {
      rollDice()
    }, props.rollDelay)
  }
})

// Expose methods to parent
defineExpose({
  rollDice,
  reset,
  isRolling: computed(() => isRolling.value),
  hasRolled: computed(() => hasRolled.value),
  result: computed(() => finalValue.value)
})
</script>

<style scoped>
.number-dice-container {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  padding: 1rem;
  margin: 0.5rem 0;
  backdrop-filter: blur(10px);
}

.dice-grid {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.number-die {
  width: 50px;
  height: 50px;
  background: rgba(255, 255, 255, 0.15);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: all 0.3s ease;
  font-weight: bold;
  font-size: 1.2rem;
  color: white;
}

/* Different styles for different die types */
.number-die.d4 {
  background: #4ade80; /* Green */
  border-color: #22c55e;
  clip-path: polygon(50% 0%, 0% 100%, 100% 100%); /* Triangle */
}

.number-die.d4 .die-face {
  transform: translateY(8px); /* Move number down to visual center of triangle */
}

.number-die.d6 {
  background: #ffffff; /* White */
  border-color: #e5e7eb;
  border-radius: 8px; /* Square */
  color: #1f2937; /* Dark text for white background */
}

.number-die.d6 .die-face {
  color: #1f2937; /* Dark text for white background */
}

.number-die.d8 {
  background: #3b82f6; /* Blue */
  border-color: #2563eb;
  clip-path: polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%); /* Pentagon */
}

.number-die.d10 {
  background: #f97316; /* Orange */
  border-color: #ea580c;
  clip-path: polygon(50% 0%, 80% 10%, 100% 35%, 100% 70%, 80% 90%, 50% 100%, 20% 90%, 0% 70%, 0% 35%, 20% 10%); /* Hexagon */
}

.number-die.d12 {
  background: #ec4899; /* Pink */
  border-color: #db2777;
  clip-path: polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%); /* Octagon */
}

.number-die.d20 {
  background: #1e40af; /* Blue */
  border-color: #1d4ed8;
  border-radius: 50%; /* Circle (representing dodecagon) */
  width: 55px;
  height: 55px;
}

.number-die.rolling {
  animation: shake 0.1s infinite, glow 0.5s ease-in-out infinite alternate;
}

.die-face {
  font-size: 1.1rem;
  font-weight: bold;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
  color: white;
}

.dice-actions {
  text-align: center;
}

.roll-button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.roll-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
}

.roll-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-2px); }
  75% { transform: translateX(2px); }
}

@keyframes glow {
  from {
    box-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
  }
  to {
    box-shadow: 0 0 20px rgba(255, 255, 255, 0.6), 0 0 30px rgba(255, 255, 255, 0.4);
  }
}

/* Responsive design */
@media (max-width: 768px) {
  .dice-grid {
    gap: 0.5rem;
  }
  
  .number-die {
    width: 45px;
    height: 45px;
    font-size: 1rem;
  }
  
  .number-die.d20 {
    width: 50px;
    height: 50px;
  }
  
  .dice-info {
    flex-direction: column;
    gap: 0.5rem;
    text-align: center;
  }
}
</style>
