<template>
  <div class="spellbook">
    <div class="spellbook-header">
      <h2>Spellbook</h2>
    </div>
    
    <div class="spellbook-content">
      <div class="spell-filters">
        <button 
          v-for="element in elementTypes" 
          :key="element"
          @click="selectedElement = element"
          :class="{ active: selectedElement === element }"
          class="filter-button"
        >
          <span v-if="element === 'all'">All</span>
          <span v-else-if="element === 'castable'">Castable</span>
          <span v-else class="element-icon">{{ element }}</span>
        </button>
      </div>
      
      <div class="spells-grid">
        <div 
          v-for="spell in filteredSpells" 
          :key="spell.name"
          class="spell-card"
          :class="{ 
            'can-cast': canCastSpell(spell) && props.isCurrentPlayer,
            'not-selectable': !props.isCurrentPlayer
          }"
          @click="toggleSpell(spell)"
        >
          <div class="spell-header">
            <h3 class="spell-name">{{ spell.name }}</h3>
            <div class="spell-cost">
              <span v-for="(dice, index) in spell.cost" :key="index" class="dice-icon">
                {{ dice }}
              </span>
            </div>
          </div>
          <div class="spell-divider"></div>
          <p class="spell-effect">{{ spell.effect }}</p>
        </div>
      </div>
      
      <div class="spellbook-footer">
        <div class="cast-actions">
          <button 
            v-if="showEndTurnButton"
            @click="endTurn" 
            :disabled="!canEndTurn"
            class="end-turn-button full-width"
            :class="{ 'active': canEndTurn }"
          >
            End Turn
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

// Props
const props = defineProps({
  availableDice: {
    type: Array,
    required: true,
    default: () => []
  },
  playerName: {
    type: String,
    default: 'Player'
  },
  gamePhase: {
    type: String,
    default: 'rolling'
  },
  isCurrentPlayer: {
    type: Boolean,
    default: false
  },
  isSpellCasting: {
    type: Boolean,
    default: false
  }
})

// Emits
const emit = defineEmits(['cast-spells', 'end-turn', 'close'])

// Reactive data
const spellbook = ref({ spells: [] })
const selectedElement = ref('all')

// Element dice types for filtering
const elementTypes = computed(() => {
  return ['all', 'castable', '🔥', '💧', '🌍', '💨', '💖', '💀']
})

// Available dice count
const availableDiceCount = computed(() => {
  const count = {}
  props.availableDice.forEach(dice => {
    count[dice.emoji] = (count[dice.emoji] || 0) + 1
  })
  return count
})

// Filtered spells based on selected element
const filteredSpells = computed(() => {
  if (selectedElement.value === 'all') {
    return spellbook.value.spells
  }
  if (selectedElement.value === 'castable') {
    // Show only spells the player can currently cast
    return spellbook.value.spells.filter(spell => canCastSpell(spell))
  }
  // Show spells that require at least one of the selected element
  return spellbook.value.spells.filter(spell => 
    spell.cost.includes(selectedElement.value)
  )
})

// Show end turn button only if it's the current player's turn
const showEndTurnButton = computed(() => {
  return props.isCurrentPlayer
})

// Enable end turn button only if dice have been rolled (casting phase) and no spell is being cast
const canEndTurn = computed(() => {
  return props.isCurrentPlayer && props.gamePhase === 'casting' && !props.isSpellCasting
})

// Check if player can cast a spell
const canCastSpell = (spell) => {
  const requiredDice = {}
  spell.cost.forEach(dice => {
    requiredDice[dice] = (requiredDice[dice] || 0) + 1
  })
  
  // Check if we have enough of each required dice type
  for (const [diceType, needed] of Object.entries(requiredDice)) {
    const available = availableDiceCount.value[diceType] || 0
    if (available < needed) {
      return false
    }
  }
  
  return true
}

// Toggle spell selection - now immediately casts spells
const toggleSpell = (spell) => {
  // Only allow spell casting if it's the current player's turn
  if (!props.isCurrentPlayer || !canCastSpell(spell)) {
    return
  }
  
  // Immediately cast the spell instead of selecting it
  castSpell(spell)
}

// Cast a single spell immediately
const castSpell = (spell) => {
  emit('cast-spells', [spell])
}

// End turn without casting
const endTurn = () => {
  emit('end-turn')
}

// Load spellbook data
const loadSpellbook = async () => {
  try {
    const response = await fetch('/spellbook1.json')
    const data = await response.json()
    spellbook.value = data
  } catch (error) {
    console.error('Failed to load spellbook:', error)
  }
}

// Initialize component
onMounted(() => {
  loadSpellbook()
})
</script>

<style scoped>
.spellbook {
  height: 100%;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
  color: white;
  font-family: 'Inter', sans-serif;
  border-left: 2px solid rgba(255, 255, 255, 0.2);
}

.spellbook-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background: rgba(255, 255, 255, 0.1);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.spellbook-header h2 {
  margin: 0;
  font-size: 1.8rem;
  font-weight: 700;
  color: white;
}

.current-phase {
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  padding: 0.4rem 0.8rem;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  text-transform: capitalize;
}

.spellbook-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 1rem 2rem;
  overflow: hidden;
}

.spell-filters {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.filter-button {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  text-transform: capitalize;
  font-weight: 500;
  min-width: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.filter-button .element-icon {
  font-size: 1.2rem;
}

.filter-button:hover, .filter-button.active {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.4);
}

.spells-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0.75rem;
  overflow-y: auto;
  padding-right: 0.5rem;
  padding-top: 5px;
  align-content: start;
  min-height: 0;
}

.spell-card {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 0.75rem;
  transition: all 0.3s ease;
  cursor: pointer;
  position: relative;
}

.spell-card:hover {
  background: rgba(255, 255, 255, 0.15);
  transform: translateY(-2px);
}

.spell-card.can-cast:hover {
  border-color: rgba(34, 197, 94, 0.7);
  background: rgba(34, 197, 94, 0.15);
  box-shadow: 0 0 20px rgba(34, 197, 94, 0.3);
  transform: translateY(-2px);
}

.spell-card.can-cast {
  border-color: rgba(102, 126, 234, 0.5);
  background: rgba(102, 126, 234, 0.1);
}

.spell-card:not(.can-cast) {
  opacity: 0.5;
  cursor: not-allowed;
}

.spell-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.3rem;
  min-height: 1.2rem;
}

.spell-name {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
  color: white;
  flex: 1;
  text-align: left;
  margin-right: 0.5rem;
  min-width: 0;
}

.spell-cost {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
  align-items: center;
}

.spell-divider {
  width: 100%;
  height: 1px;
  background: rgba(255, 255, 255, 0.2);
  margin: 0.3rem 0;
}

.dice-icon {
  font-size: 1.15rem;
}

.spell-effect {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.3;
  color: rgba(255, 255, 255, 0.9);
}

.spellbook-footer {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  display: flex;
  justify-content: center;
  align-items: center;
}

.cast-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.cast-button, .end-turn-button {
  padding: 0.8rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.cast-button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.cast-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
}

.cast-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.end-turn-button {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.5);
  transition: all 0.3s ease;
}

.end-turn-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.end-turn-button.active {
  background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
  color: white;
}

.end-turn-button.full-width {
  width: 100%;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.5);
  transition: all 0.3s ease;
}

.end-turn-button.full-width:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.end-turn-button.full-width.active {
  background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
  color: white;
}

.end-turn-button.full-width.active:hover:not(:disabled) {
  background: linear-gradient(135deg, #c82333 0%, #a71e2a 100%);
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(220, 53, 69, 0.3);
}

/* Scrollbar styling */
.spells-grid::-webkit-scrollbar {
  width: 8px;
}

.spells-grid::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

.spells-grid::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 4px;
}

.spells-grid::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}

@media (max-width: 768px) {
  .spellbook-header {
    padding: 1rem;
  }
  
  .spellbook-content {
    padding: 1rem;
  }
  
  .spells-grid {
    grid-template-columns: 1fr;
  }
  
  .spellbook-footer {
    flex-direction: column;
    gap: 1rem;
  }
  
  .cast-actions {
    width: 100%;
    justify-content: center;
  }
}
</style>
