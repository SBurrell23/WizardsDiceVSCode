<template>
  <div class="number-dice-container">
    <div class="dice-info">
      <span class="dice-notation">{{ diceNotation }}</span>
      <span v-if="hasRolled" class="total-result">Total: {{ totalResult }}</span>
    </div>
    
    <div class="dice-grid">
      <div 
        v-for="(die, index) in diceArray" 
        :key="index"
        class="number-die"
        :class="{ 
          'rolling': die.isRolling,
          [`d${sides}`]: true
        }"
      >
        <div class="die-face">
          {{ die.currentValue || '?' }}
        </div>
      </div>
    </div>
    
    <div class="dice-actions" v-if="!autoRoll">
      <button 
        @click="rollDice" 
        :disabled="isRolling"
        class="roll-button"
      >
        {{ isRolling ? 'Rolling...' : 'Roll Dice' }}
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
      // Validate format like "2d8", "1d20", etc.
      return /^\d+d(4|6|8|10|12|20)$/.test(value)
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
  return { count, sides }
})

const count = computed(() => parsedDice.value.count)
const sides = computed(() => parsedDice.value.sides)

// Reactive data
const diceArray = ref([])
const isRolling = ref(false)
const hasRolled = ref(false)
const totalResult = ref(0)

// Initialize dice array
const initializeDice = () => {
  diceArray.value = Array(count.value).fill().map((_, index) => ({
    id: index,
    currentValue: null,
    finalValue: null,
    isRolling: false
  }))
  hasRolled.value = false
  totalResult.value = 0
}

// Roll a single die
const rollSingleDie = (dieIndex) => {
  return new Promise((resolve) => {
    const die = diceArray.value[dieIndex]
    die.isRolling = true
    
    let rollCount = 0
    const rollInterval = setInterval(() => {
      // Show random values during animation
      die.currentValue = Math.floor(Math.random() * sides.value) + 1
      rollCount++
      
      if (rollCount >= 10) { // Roll animation duration
        clearInterval(rollInterval)
        
        // Final roll result
        const finalValue = Math.floor(Math.random() * sides.value) + 1
        die.currentValue = finalValue
        die.finalValue = finalValue
        die.isRolling = false
        
        resolve(finalValue)
      }
    }, 100)
  })
}

// Roll all dice
const rollDice = async () => {
  if (isRolling.value) return
  
  isRolling.value = true
  hasRolled.value = false
  emit('rolling-started')
  
  // Reset all dice
  diceArray.value.forEach(die => {
    die.currentValue = null
    die.finalValue = null
  })
  
  // Roll each die with a slight delay between them
  const results = []
  for (let i = 0; i < count.value; i++) {
    // Stagger the dice rolls slightly
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    
    const result = await rollSingleDie(i)
    results.push(result)
  }
  
  // Calculate total
  totalResult.value = results.reduce((sum, value) => sum + value, 0)
  hasRolled.value = true
  isRolling.value = false
  
  // Emit results
  const rollResult = {
    notation: props.diceNotation,
    count: count.value,
    sides: sides.value,
    individual: results,
    total: totalResult.value
  }
  
  emit('rolled', rollResult)
  emit('rolling-finished', rollResult)
}

// Reset dice
const reset = () => {
  initializeDice()
}

// Watch for dice notation changes
watch(() => props.diceNotation, () => {
  initializeDice()
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
  totalResult: computed(() => totalResult.value),
  individualResults: computed(() => diceArray.value.map(die => die.finalValue).filter(Boolean))
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

.dice-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  font-weight: 600;
}

.dice-notation {
  font-size: 1.1rem;
  color: #ffd700;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.total-result {
  font-size: 1.2rem;
  color: #4ade80;
  background: rgba(74, 222, 128, 0.2);
  padding: 0.25rem 0.75rem;
  border-radius: 6px;
  border: 1px solid rgba(74, 222, 128, 0.3);
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
  border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%;
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
}

.number-die.d6 {
  border-radius: 8px;
  background: linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%);
}

.number-die.d8 {
  border-radius: 20px;
  background: linear-gradient(135deg, #a8e6cf 0%, #7fcdcd 100%);
  transform: rotate(45deg);
}

.number-die.d8 .die-face {
  transform: rotate(-45deg);
}

.number-die.d10 {
  border-radius: 50% 10px;
  background: linear-gradient(135deg, #ffd93d 0%, #ff9800 100%);
}

.number-die.d12 {
  border-radius: 12px;
  background: linear-gradient(135deg, #b19cd9 0%, #9b59b6 100%);
  clip-path: polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%);
}

.number-die.d20 {
  border-radius: 50%;
  background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 50%, #fecfef 100%);
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
