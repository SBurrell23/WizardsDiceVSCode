<template>
  <div class="spellbook">
    <div class="spellbook-header">
      <div class="spellbook-tabs">
        <button 
          @click="activeTab = 'spells'"
          :class="{ active: activeTab === 'spells' }"
          class="tab-button"
        >
          Spellbook
        </button>
        <button 
          @click="activeTab = 'log'"
          :class="{ active: activeTab === 'log' }"
          class="tab-button"
        >
          Game Log
        </button>
      </div>
    </div>
    
    <!-- Spells Tab Content -->
    <div v-show="activeTab === 'spells'" class="spellbook-content">
      <div class="spell-filters">
        <!-- Castability filters -->
        <button 
          v-for="type in castabilityTypes" 
          :key="type"
          @click="toggleCastability(type)"
          :class="{ active: selectedCastability === type }"
          class="filter-button"
        >
          <span v-if="type === 'all'">All</span>
          <span v-else-if="type === 'castable'">Castable</span>
        </button>
        
        <!-- Divider -->
        <span class="filter-divider">/</span>
        
        <!-- Cost filters -->
        <button 
          v-for="cost in costTypes" 
          :key="cost"
          @click="toggleCost(cost)"
          :class="{ active: selectedCosts.includes(cost) }"
          class="filter-button cost-filter"
        >
          {{ cost }}
        </button>
        
        <!-- Divider -->
        <span class="filter-divider">/</span>
        
        <!-- Search input -->
        <input 
          v-model="searchQuery"
          type="text"
          placeholder="Search spells..."
          class="search-input"
          @input="onSearchInput"
        />
      </div>
      
      <div class="spells-grid">
        <div 
          v-for="spell in filteredSpells" 
          :key="spell.name"
          class="spell-card"
          :class="{ 
            'can-cast': canCastSpell(spell) && props.isCurrentPlayer && !props.isSpellCasting,
            'not-selectable': !props.isCurrentPlayer,
            'casting-disabled': props.isSpellCasting
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
    
    <!-- Game Log Tab Content -->
    <div v-show="activeTab === 'log'" class="log-content">
      <Logbook ref="logbookRef" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import Logbook from './Logbook.vue'

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
// Component state
const activeTab = ref('spells')
const logbookRef = ref(null)
const spellbook = ref({ spells: [] })
const selectedCastability = ref('all') // 'all' or 'castable'
const selectedCosts = ref([]) // Array of selected cost filters: '1', '2', '3', '4+'
const searchQuery = ref('') // Search input string

// Element dice types for filtering
const castabilityTypes = computed(() => {
  return ['all', 'castable']
})

const costTypes = computed(() => {
  return ['1', '2', '3', '4+']
})

// Available dice count
const availableDiceCount = computed(() => {
  const count = {}
  props.availableDice.forEach(dice => {
    count[dice.emoji] = (count[dice.emoji] || 0) + 1
  })
  return count
})

// Filtered spells based on selected filters
const filteredSpells = computed(() => {
  let spells = spellbook.value.spells

  // First filter by search query if provided
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase().trim()
    spells = spells.filter(spell => 
      spell.name.toLowerCase().includes(query) || 
      spell.effect.toLowerCase().includes(query)
    )
  }

  // Then filter by castability
  if (selectedCastability.value === 'castable') {
    spells = spells.filter(spell => canCastSpell(spell))
  }

  // Then filter by cost if any cost filters are selected (only if no search query)
  if (selectedCosts.value.length > 0 && !searchQuery.value.trim()) {
    spells = spells.filter(spell => {
      return selectedCosts.value.some(costFilter => {
        if (costFilter === '1') return spell.cost.length === 1
        if (costFilter === '2') return spell.cost.length === 2
        if (costFilter === '3') return spell.cost.length === 3
        if (costFilter === '4+') return spell.cost.length >= 4
        return false
      })
    })
  }

  return spells
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

// Toggle castability filter (all or castable)
const toggleCastability = (type) => {
  selectedCastability.value = type
}

// Toggle cost filter (can select multiple)
const toggleCost = (cost) => {
  const index = selectedCosts.value.indexOf(cost)
  if (index > -1) {
    // Remove if already selected
    selectedCosts.value.splice(index, 1)
  } else {
    // Add if not selected
    selectedCosts.value.push(cost)
  }
}

// Handle search input changes
const onSearchInput = () => {
  if (searchQuery.value.trim()) {
    // When searching, set castability to 'all' and clear cost filters
    selectedCastability.value = 'all'
    selectedCosts.value = []
  }
}

// Toggle spell selection - now immediately casts spells
const toggleSpell = (spell) => {
  // Only allow spell casting if it's the current player's turn and no spell is currently being cast
  if (!props.isCurrentPlayer || !canCastSpell(spell) || props.isSpellCasting) {
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
    // Add cache-busting parameter to prevent browser caching
    const cacheBuster = new Date().getTime()
    const response = await fetch(`./Spellbook.json?v=${cacheBuster}`, {
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
    const data = await response.json()
    spellbook.value = parseSpellbook(data)
  } catch (error) {
    console.error('Failed to load spellbook:', error)
  }
}

const parseSpellbook = (data) => {
  const flattenedSpells = []
  const costOrder = ['1-cost', '2-cost', '3-cost', '4-cost', '5-cost', '6-cost']
  
  // Iterate through each cost category in order
  costOrder.forEach(costKey => {
    if (data[costKey] && Array.isArray(data[costKey])) {
      // Add all spells from this cost category to the flattened array
      flattenedSpells.push(...data[costKey])
    }
  })
  
  return { spells: flattenedSpells }
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
  justify-content: center;
  align-items: center;
  padding: 1rem 2rem;
  background: rgba(255, 255, 255, 0.1);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.spellbook-tabs {
  display: flex;
  gap: 2px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 4px;
}

.tab-button {
  padding: 14px 28px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  font-size: 1.2rem;
  font-weight: 600;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0s ease-in;
  min-width: 140px;
  outline: none;
}

.tab-button:focus {
  outline: none;
  box-shadow: none;
}

.tab-button:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
}

.tab-button.active {
  background: linear-gradient(135deg, rgba(79, 70, 229, 0.4) 0%, rgba(139, 92, 246, 0.4) 100%);
  color: white;
  box-shadow: 0 2px 12px rgba(79, 70, 229, 0.3);
  border: 1px solid rgba(79, 70, 229, 0.4);
}

/* Responsive tab styling */
@media (max-width: 900px) {
  .tab-button {
    padding: 12px 20px;
    font-size: 1.1rem;
    min-width: 120px;
  }
}

@media (max-width: 600px) {
  .spellbook-tabs {
    padding: 3px;
  }
  
  .tab-button {
    padding: 10px 16px;
    font-size: 1rem;
    min-width: 100px;
  }
}

@media (max-width: 400px) {
  .spellbook-tabs {
    padding: 2px;
  }
  
  .tab-button {
    padding: 8px 12px;
    font-size: 0.9rem;
    min-width: 80px;
  }
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

.log-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 1rem;
  overflow: hidden;
}

.spell-filters {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  align-items: center;
}

.filter-divider {
  color: rgba(255, 255, 255, 0.5);
  font-size: 1.2rem;
  font-weight: bold;
  margin: 0 0.25rem;
  user-select: none;
}

.filter-button {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  padding: 0.5rem .9rem;
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

.filter-button:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
}

.filter-button:focus {
  outline: none;
}

.filter-button.active {
  background: rgba(34, 197, 94, 0.2);
  border-color: rgba(34, 197, 94, 0.6);
  color: #22c55e;
  box-shadow: 0 0 15px rgba(34, 197, 94, 0.4);
}

.cost-filter {
  min-width: 45px;
}

.search-input {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 400;
  flex: 1;
  min-width: 0;
  transition: all 0.3s ease;
}

.search-input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.search-input:focus {
  outline: none;
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(102, 126, 234, 0.6);
  box-shadow: 0 0 10px rgba(102, 126, 234, 0.3);
}

.spells-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 0.75rem;
  overflow-y: scroll;
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

.spell-card.casting-disabled {
  opacity: 0.3;
  cursor: not-allowed;
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
}

.spell-card.casting-disabled:hover {
  transform: none;
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow: none;
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

.spells-grid {
  /* Force scrollbar to always be visible */
  overflow-y: scroll;
  scrollbar-gutter: stable;
}

@media (max-width: 1200px) {
  .spellbook-header {
    padding: 1rem;
  }
  
  .spellbook-content {
    padding: 1rem;
  }
  
  .spells-grid {
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
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

/* Hide cost filters and search on mobile */
@media (max-width: 935px) {
  .spellbook-header,
  .cost-filter,
  .search-input,
  .filter-divider {
    display: none;
  }
  
  .spell-filters {
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .spells-grid {
     grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }
  .spell-name{
    font-size: 0.8rem;
    margin-right:.10rem;
  }
  .spell-cost{
    font-size: 0.8rem;
    gap:0px;
  }
}
</style>
