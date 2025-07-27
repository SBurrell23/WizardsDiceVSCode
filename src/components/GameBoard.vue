<template>
  <div class="game-container">
    <!-- Left side - Game Board -->
    <div class="game-board">
      <!-- Player 1 Area (Top) -->
      <div class="player-area top-player" :class="{ 'current-player': isHostTurn }">
        <div class="player-header">
          <div class="player-name-box">
            <h3 class="player-name">{{ topPlayerName }}</h3>
          </div>
          <!-- Spell casting indicator -->
          <div v-if="currentlyCastingSpell && currentlyCastingSpell.playerName === topPlayerName" 
               class="casting-spell-indicator">
            <span class="casting-icon">✨</span>
            <span class="casting-text">Casting <span class="spell-name">{{ currentlyCastingSpell.spellName }}</span></span>
          </div>
          <div class="player-stats">
            <div class="health-stat">
              <span class="stat-icon">❤️</span>
              <span class="stat-value">{{ playerStats.host.health }}</span>
              <!-- Floating indicators for health changes - now supports multiple -->
              <div v-for="indicator in floatingIndicators.host.health" 
                   :key="indicator.id"
                   class="floating-indicator" 
                   :class="{ 'positive': indicator.isPositive, 'negative': !indicator.isPositive }"
                   :style="{ animationDelay: indicator.delay + 'ms' }">
                {{ indicator.value }}
              </div>
            </div>
            <div class="armor-stat">
              <span class="stat-icon">🛡️</span>
              <span class="stat-value">{{ playerStats.host.armor }}</span>
              <!-- Floating indicators for armor changes - now supports multiple -->
              <div v-for="indicator in floatingIndicators.host.armor" 
                   :key="indicator.id"
                   class="floating-indicator" 
                   :class="{ 'positive': indicator.isPositive, 'negative': !indicator.isPositive }"
                   :style="{ animationDelay: indicator.delay + 'ms' }">
                {{ indicator.value }}
              </div>
            </div>
          </div>
        </div>
        
        <div class="dice-area">
          <div class="element-dice-box">
            <div class="dice-container">
              <!-- Element dice will be displayed here -->
              <!-- Show interactive dice if it's the host's turn and current player is host AND in rolling phase -->
              <div v-if="isHostTurn && props.isHost && gamePhase === 'rolling'" class="dice-grid">
                <ElementDice 
                  v-for="i in diceToRoll" 
                  :key="`top-${i}`"
                  :ref="el => { if (el) diceRefs[i-1] = el }"
                  :can-roll="canRollDice"
                  :dice-index="i-1"
                  @rolled="onDiceRolled"
                />
              </div>
              <!-- Show rolled dice results for host -->
              <div v-else class="opponent-dice">
                <!-- Show rolling animation if opponent is rolling and it's host area -->
                <div v-if="isOpponentRolling && isHostTurn" class="rolling-dice-display">
                  <div v-for="i in diceToRoll" :key="`rolling-top-${i}`" class="rolling-dice">
                    🎲
                  </div>
                </div>
                <!-- Show actual dice results when not rolling -->
                <div v-else-if="playerResources.host.length > 0" class="dice-results">
                  <div v-for="resource in playerResources.host" 
                       :key="resource.diceIndex" 
                       class="rolled-dice" 
                       :class="{ 
                         'used-dice': resource.used,
                         'rerollable-dice': elementDiceReroll && elementDiceReroll.diceFilter(resource),
                         'non-rerollable-dice': elementDiceReroll && !elementDiceReroll.diceFilter(resource)
                       }"
                       @click="elementDiceReroll && isHostTurn && props.isHost ? onElementDieRerollClick(resource.diceIndex) : null">
                    {{ resource.emoji }}
                    <div v-if="resource.used" class="dice-used-overlay">✕</div>
                  </div>
                </div>
                <!-- Show placeholder when no dice -->
                <div v-else class="dice-placeholder">
                  🎲
                </div>
              </div>
            </div>
            <div v-if="isHostTurn && props.isHost && gamePhase === 'rolling'" class="roll-action">
              <button @click="startRolling" class="roll-button" :disabled="isRolling || !canRollDice">
                {{ isRolling ? 'Rolling...' : `Roll ${diceToRoll} Dice` }}
              </button>
            </div>
            <!-- Stop Rerolling button for host -->
            <div v-if="elementDiceReroll && isHostTurn && props.isHost" class="reroll-action">
              <button @click="finishElementDiceReroll" class="stop-reroll-button">
                Stop Rerolling ({{ elementDiceReroll.remainingRerolls }} left)
              </button>
            </div>
          </div>
          
          <div class="number-dice-box">
            <div class="dice-container small">
              <!-- Show NumberDice when spell dice rolling is active AND it's the HOST's turn -->
              <NumberDice 
                v-if="spellDiceRoll && spellDiceRoll.isRolling && isHostTurn"
                :diceNotation="spellDiceRoll.notation"
                :autoRoll="true"
                :rollDelay="50"
                :forcedResult="spellDiceRoll.result"
                @rolled="onSpellDiceRolled"
                @rolling-finished="onSpellDiceFinished"
              />
              <!-- Show placeholder when no spell dice rolling -->
              <div v-else class="dice-placeholder small">🎲</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Game Center - Turn Info and Status -->
      <div class="game-center">
        <div class="turn-info">
          <div class="turn-indicator">
            <div class="chevron-up" :class="{ 'active': isHostTurn }">▲</div>
            <div class="chevron-down" :class="{ 'active': !isHostTurn }">▼</div>
          </div>
          <div class="turn-counter">
            <div class="turn-display">Turn {{ currentTurn }}</div>
          </div>
        </div>
        <div v-if="statusMessage" class="status-message" :class="statusType">
          {{ statusMessage }}
        </div>
      </div>

    <!-- Player 2 Area (Bottom) -->
    <div class="player-area bottom-player" :class="{ 'current-player': !isHostTurn }">
      <div class="dice-area">
        <div class="element-dice-box">
          <div class="dice-container">
            <!-- Element dice will be displayed here -->
            <!-- Show interactive dice if it's the guest's turn and current player is guest AND in rolling phase -->
            <div v-if="!isHostTurn && !props.isHost && gamePhase === 'rolling'" class="dice-grid">
              <ElementDice 
                v-for="i in diceToRoll" 
                :key="`bottom-${i}`"
                :ref="el => { if (el) diceRefs[i-1] = el }"
                :can-roll="canRollDice"
                :dice-index="i-1"
                @rolled="onDiceRolled"
              />
            </div>
            <!-- Show rolled dice results for guest -->
            <div v-else class="opponent-dice">
              <!-- Show rolling animation if opponent is rolling and it's guest area -->
              <div v-if="isOpponentRolling && !isHostTurn" class="rolling-dice-display">
                <div v-for="i in diceToRoll" :key="`rolling-bottom-${i}`" class="rolling-dice">
                  🎲
                </div>
              </div>
              <!-- Show actual dice results when not rolling -->
              <div v-else-if="playerResources.guest.length > 0" class="dice-results">
                <div v-for="resource in playerResources.guest" 
                     :key="resource.diceIndex" 
                     class="rolled-dice" 
                     :class="{ 
                       'used-dice': resource.used,
                       'rerollable-dice': elementDiceReroll && elementDiceReroll.diceFilter(resource),
                       'non-rerollable-dice': elementDiceReroll && !elementDiceReroll.diceFilter(resource)
                     }"
                     @click="elementDiceReroll && !isHostTurn && !props.isHost ? onElementDieRerollClick(resource.diceIndex) : null">
                  {{ resource.emoji }}
                  <div v-if="resource.used" class="dice-used-overlay">✕</div>
                </div>
              </div>
              <!-- Show placeholder when no dice -->
              <div v-else class="dice-placeholder">
                🎲
              </div>
            </div>
          </div>
          <div v-if="!isHostTurn && !props.isHost && gamePhase === 'rolling'" class="roll-action">
            <button @click="startRolling" class="roll-button" :disabled="isRolling || !canRollDice">
              {{ isRolling ? 'Rolling...' : `Roll ${diceToRoll} Dice` }}
            </button>
          </div>
          <!-- Stop Rerolling button for guest -->
          <div v-if="elementDiceReroll && !isHostTurn && !props.isHost" class="reroll-action">
            <button @click="finishElementDiceReroll" class="stop-reroll-button">
              Stop Rerolling ({{ elementDiceReroll.remainingRerolls }} left)
            </button>
          </div>
        </div>
        
        <div class="number-dice-box">
          <div class="dice-container small">
            <!-- Show NumberDice when spell dice rolling is active AND it's the GUEST's turn -->
            <NumberDice 
              v-if="spellDiceRoll && spellDiceRoll.isRolling && !isHostTurn"
              :diceNotation="spellDiceRoll.notation"
              :autoRoll="true"
              :rollDelay="50"
              :forcedResult="spellDiceRoll.result"
              @rolled="onSpellDiceRolled"
              @rolling-finished="onSpellDiceFinished"
            />
            <!-- Show placeholder when no spell dice rolling -->
            <div v-else class="dice-placeholder small">🎲</div>
          </div>
        </div>
      </div>
      
      <div class="player-header">
        <div class="player-name-box">
          <h3 class="player-name">{{ bottomPlayerName }}</h3>
        </div>
        <!-- Spell casting indicator -->
        <div v-if="currentlyCastingSpell && currentlyCastingSpell.playerName === bottomPlayerName" 
             class="casting-spell-indicator">
          <span class="casting-icon">✨</span>
          <span class="casting-text">Casting <span class="spell-name">{{ currentlyCastingSpell.spellName }}</span></span>
        </div>
        <div class="player-stats">
          <div class="health-stat">
            <span class="stat-icon">❤️</span>
            <span class="stat-value">{{ playerStats.guest.health }}</span>
            <!-- Floating indicators for health changes - now supports multiple -->
            <div v-for="indicator in floatingIndicators.guest.health" 
                 :key="indicator.id"
                 class="floating-indicator" 
                 :class="{ 'positive': indicator.isPositive, 'negative': !indicator.isPositive }"
                 :style="{ animationDelay: indicator.delay + 'ms' }">
              {{ indicator.value }}
            </div>
          </div>
          <div class="armor-stat">
            <span class="stat-icon">🛡️</span>
            <span class="stat-value">{{ playerStats.guest.armor }}</span>
            <!-- Floating indicators for armor changes - now supports multiple -->
            <div v-for="indicator in floatingIndicators.guest.armor" 
                 :key="indicator.id"
                 class="floating-indicator" 
                 :class="{ 'positive': indicator.isPositive, 'negative': !indicator.isPositive }"
                 :style="{ animationDelay: indicator.delay + 'ms' }">
              {{ indicator.value }}
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>

    <!-- Right side - Spellbook -->
    <div class="spellbook-container">
      <Spellbook 
        :availableDice="currentPlayerResources"
        :playerName="currentPlayerName"
        :gamePhase="gamePhase"
        :isCurrentPlayer="isCurrentPlayer"
        :isSpellCasting="isSpellCasting"
        @cast-spells="onCastSpells"
        @end-turn="onEndTurn"
        @close="() => {}"
      />
    </div>
    
    <!-- Spell Effects Component (invisible) -->
    <SpellEffects
      ref="spellEffectsRef"
      :playerStats="playerStats"
      :playerResources="playerResources"
      :currentPlayer="isHostTurn ? 'host' : 'guest'"
      :opponentPlayer="isHostTurn ? 'guest' : 'host'"
      :showNumericModal="showNumericModal"
      @updatePlayerStats="onUpdatePlayerStats"
      @updatePlayerResources="onUpdatePlayerResources"
      @showMessage="onShowSpellMessage"
      @requestDiceRoll="onRequestDiceRoll"
      @requestElementDiceReroll="onRequestElementDiceReroll"
      @spellCastingStarted="onSpellCastingStarted"
      @spellCastingEnded="onSpellCastingEnded"
    />
    
    <!-- Game Over Modal -->
    <div v-if="showGameOverModal" class="game-over-modal">
      <div class="modal-backdrop"></div>
      <div class="modal-content">
        <div class="game-over-header">
          <h2 v-if="winner === 'draw'">🤝 DRAW!</h2>
          <h2 v-else-if="winner === 'host' && props.isHost">🎉 YOU WIN!</h2>
          <h2 v-else-if="winner === 'guest' && !props.isHost">🎉 YOU WIN!</h2>
          <h2 v-else>💀 YOU LOSE!</h2>
        </div>
        
        <div class="game-over-details">
          <div class="final-stats">
            <div class="stat-line">
              <span class="player-label">{{ props.isHost ? 'You' : 'Enemy Wizard' }}:</span>
              <span class="health-value">❤️ {{ playerStats.host.health }}</span>
            </div>
            <div class="stat-line">
              <span class="player-label">{{ props.isHost ? 'Enemy Wizard' : 'You' }}:</span>
              <span class="health-value">❤️ {{ playerStats.guest.health }}</span>
            </div>
          </div>
        </div>
        
        <div class="game-over-actions">
          <div v-if="isNewGameStarting" class="new-game-status">
            <div class="spinner"></div>
            <p>{{ props.isHost ? 'Starting new game...' : 'The host is deciding to start a new game...' }}</p>
          </div>
          <div v-else-if="props.isHost" class="host-actions">
            <button @click="startNewGame" class="new-game-button">
              🔄 Start New Game
            </button>
            <button @click="() => emit('leave-game')" class="leave-game-button">
              🚪 Leave Game
            </button>
          </div>
          <div v-else class="guest-actions">
            <p class="waiting-message">Waiting for host to start a new game...</p>
            <button @click="() => emit('leave-game')" class="leave-game-button">
              🚪 Leave Game
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Numeric Input Modal -->
  <NumericInputModal
    :is-visible="numericModal.isVisible"
    :title="numericModal.title"
    :message="numericModal.message"
    :input-label="numericModal.inputLabel"
    :min-value="numericModal.minValue"
    :max-value="numericModal.maxValue"
    :default-value="numericModal.defaultValue"
    @confirm="onNumericModalConfirm"
  />
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import ElementDice from './ElementDice.vue'
import NumberDice from './NumberDice.vue'
import Spellbook from './Spellbook.vue'
import SpellEffects from './SpellEffects.vue'
import NumericInputModal from './NumericInputModal.vue'

// Props passed from parent component
const props = defineProps({
  roomCode: {
    type: String,
    required: true
  },
  isHost: {
    type: Boolean,
    required: true
  },
  hostName: {
    type: String,
    default: 'Host'
  },
  guestName: {
    type: String,
    default: 'Player 2'
  },
  peerInstance: {
    type: Object,
    required: true
  },
  connection: {
    type: Object,
    default: null
  }
})

// Emit events to parent
const emit = defineEmits(['leave-game'])

// Reactive data
const statusMessage = ref('')
const statusType = ref('info')
const currentTurn = ref(6)
const isHostTurn = ref(true) // Host always starts
let statusMessageTimeoutId = null // Track the current timeout

// Game over state
const gameOver = ref(false)
const winner = ref('')
const showGameOverModal = ref(false)
const isNewGameStarting = ref(false)

// Game state
const gamePhase = ref('rolling') // 'rolling', 'casting', 'waiting'
const playerResources = ref({
  host: [],
  guest: []
})
const playerStats = ref({
  host: { health: 25, armor: 0, maxHealth: 25 },
  guest: { health: 25, armor: 0, maxHealth: 25 }
})
const diceRefs = ref([])
const spellEffectsRef = ref(null)
const isRolling = ref(false)
const isOpponentRolling = ref(false)
const isSpellCasting = ref(false)
const currentlyCastingSpell = ref(null) // { spellName, playerName }

// Floating indicator state - now supports multiple indicators per stat
const floatingIndicators = ref({
  host: { health: [], armor: [] },
  guest: { health: [], armor: [] }
})

// Spell dice rolling state
const spellDiceRoll = ref(null) // { notation, spellName, isRolling }
const elementDiceReroll = ref(null) // { diceFilter, maxRerolls, message, selectedDice, remainingRerolls }

// Numeric input modal state
const numericModal = ref({
  isVisible: false,
  title: '',
  message: '',
  inputLabel: '',
  minValue: undefined,
  maxValue: undefined,
  defaultValue: 0,
  resolve: null
})

// Computed properties for player names
const topPlayerName = computed(() => {
  // Top player is always the host
  // If current user is the host, show "You" (unless they have a custom name), otherwise show host's name or "Enemy Wizard"
  if (props.isHost) {
    // Current user is the host looking at their own area
    return props.hostName === 'Host' ? 'You' : props.hostName
  } else {
    // Current user is the guest looking at the host's area
    return props.hostName === 'Enemy Wizard' ? 'Enemy Wizard' : props.hostName
  }
})

const bottomPlayerName = computed(() => {
  // Bottom player is always the guest
  // If current user is the guest, show "You" (unless they have a custom name), otherwise show guest's name or "Enemy Wizard"
  if (!props.isHost) {
    // Current user is the guest looking at their own area
    return props.guestName === 'Guest' ? 'You' : props.guestName
  } else {
    // Current user is the host looking at the guest's area
    return props.guestName === 'Enemy Wizard' ? 'Enemy Wizard' : props.guestName
  }
})

const currentPlayerName = computed(() => {
  return isHostTurn.value ? topPlayerName.value : bottomPlayerName.value
})

// Game logic computed properties
const isCurrentPlayer = computed(() => {
  return (props.isHost && isHostTurn.value) || (!props.isHost && !isHostTurn.value)
})

const canRollDice = computed(() => {
  return isCurrentPlayer.value && gamePhase.value === 'rolling' && !isRolling.value
})

const diceToRoll = computed(() => {
  // Cap dice at 7 maximum, starting from turn 8 onwards
  return Math.min(currentTurn.value, 7)
})

// Get current player's available dice for spellcasting
const currentPlayerResources = computed(() => {
  const playerKey = isHostTurn.value ? 'host' : 'guest'
  // Only return unused dice for spellcasting
  return (playerResources.value[playerKey] || []).filter(dice => !dice.used)
})

// Unified message display function that handles both local and remote messages
const displayStatusMessage = (message, type = 'info', duration = 3000, sendToOpponent = false) => {
  // Clear any existing timeout to prevent old messages from clearing new ones
  if (statusMessageTimeoutId) {
    clearTimeout(statusMessageTimeoutId)
    statusMessageTimeoutId = null
  }
  
  // Set the new message
  statusMessage.value = message
  statusType.value = type
  
  // Send to opponent if requested
  if (sendToOpponent) {
    sendGameMessage('spell_cast_notification', {
      castMessage: message,
      statusType: type
    })
  }
  
  // Set timeout to clear message
  if (duration > 0) {
    statusMessageTimeoutId = setTimeout(() => {
      // Only clear if this is still the current message (no newer message has been set)
      if (statusMessage.value === message) {
        statusMessage.value = ''
      }
      statusMessageTimeoutId = null
    }, duration)
  }
}

// Helper function to set status message with timeout and send to other player
const setStatusMessage = (message, type, duration = 3000) => {
  displayStatusMessage(message, type, duration, true)
}

// Helper function to check for game over
const checkGameOver = () => {
  if (gameOver.value) return // Already game over
  
  const hostHealth = playerStats.value.host.health
  const guestHealth = playerStats.value.guest.health
  
  if (hostHealth <= 0 || guestHealth <= 0) {
    gameOver.value = true
    
    // Determine winner
    if (hostHealth <= 0 && guestHealth <= 0) {
      winner.value = 'draw'
    } else if (hostHealth <= 0) {
      winner.value = 'guest'
    } else {
      winner.value = 'host'
    }
    
    // Show modal
    showGameOverModal.value = true
    
    // Send game over message to opponent
    sendGameMessage('game_over', {
      winner: winner.value,
      hostHealth: hostHealth,
      guestHealth: guestHealth
    })
    
    console.log('Game Over! Winner:', winner.value)
  }
}

// Start new game (host only)
const startNewGame = () => {
  if (!props.isHost) return
  
  isNewGameStarting.value = true
  
  // Send new game message to guest
  sendGameMessage('new_game_starting', {
    message: 'Host is starting a new game...'
  })
  
  // Reset game state after short delay
  setTimeout(() => {
    resetGameState()
    isNewGameStarting.value = false
    
    // Send game state reset to guest
    sendGameMessage('new_game_reset', {
      playerStats: playerStats.value,
      currentTurn: currentTurn.value,
      isHostTurn: isHostTurn.value,
      gamePhase: gamePhase.value
    })
  }, 1500)
}

// Reset all game state to initial values
const resetGameState = () => {
  // Reset player stats
  playerStats.value = {
    host: { health: 25, armor: 0, maxHealth: 25 },
    guest: { health: 25, armor: 0, maxHealth: 25 }
  }
  
  // Reset game state
  currentTurn.value = 1
  isHostTurn.value = true
  gamePhase.value = 'rolling'
  
  // Clear resources
  playerResources.value = {
    host: [],
    guest: []
  }
  
  // Clear floating indicators
  floatingIndicators.value = {
    host: { health: [], armor: [] },
    guest: { health: [], armor: [] }
  }
  
  // Reset game over state
  gameOver.value = false
  winner.value = ''
  showGameOverModal.value = false
  
  // Clear status message
  statusMessage.value = ''
  
  console.log('Game state reset for new game')
}

// Numeric modal helper functions
const showNumericModal = (title, message, inputLabel, minValue, maxValue, defaultValue = 0) => {
  return new Promise((resolve) => {
    numericModal.value = {
      isVisible: true,
      title,
      message,
      inputLabel,
      minValue,
      maxValue,
      defaultValue,
      resolve
    }
  })
}

const onNumericModalConfirm = (value) => {
  if (numericModal.value.resolve) {
    numericModal.value.resolve(value)
  }
  numericModal.value.isVisible = false
  numericModal.value.resolve = null
}

// Handle game-related messages
const handleGameMessage = (data) => {
  switch (data.type) {
    case 'dice_rolling_start':
      // Show rolling animation for other player
      isOpponentRolling.value = true
      console.log('Other player started rolling dice')
      break
    case 'dice_rolled':
      // Update other player's resources and stop rolling animation
      isOpponentRolling.value = false
      playerResources.value[data.data.player] = data.data.resources
      break
    case 'spells_cast':
      // Update other player's resources after spell casting
      playerResources.value[data.data.player] = data.data.playerResources
      // Update player stats if provided
      if (data.data.playerStats) {
        playerStats.value = data.data.playerStats
      }
      break
    case 'spell_cast_notification':
      // Show spell casting message to other player (without sending back)
      displayStatusMessage(data.data.castMessage, data.data.statusType || 'info', 3000, false)
      break
    case 'floating_indicator':
      // Show floating indicator from other player's stat changes
      const { player, statType, indicatorData } = data.data
      
      // Add to the array of indicators
      floatingIndicators.value[player][statType].push(indicatorData)
      
      // Clear the specific indicator after animation
      setTimeout(() => {
        const indicatorArray = floatingIndicators.value[player][statType]
        const index = indicatorArray.findIndex(ind => ind.id === indicatorData.id)
        if (index > -1) {
          indicatorArray.splice(index, 1)
        }
      }, 2000)
      break
    case 'dice_used_update':
      // Update dice state immediately when other player casts spells
      playerResources.value[data.data.player] = data.data.playerResources
      console.log('Updated dice state - spells being cast by other player')
      break
    case 'spell_dice_start':
      // Show spell dice rolling for other player
      console.log('Received spell_dice_start:', data.data.notation, 'result:', data.data.result)
      
      // Clear any previous dice display and start new roll immediately
      spellDiceRoll.value = {
        notation: data.data.notation,
        isRolling: true,
        result: data.data.result // Pre-determined result from casting player
      }

      console.log('Started spell dice rolling for remote player with result:', data.data.result)
      break
    case 'element_dice_reroll':
      // Handle element dice reroll from other player
      console.log('Received element_dice_reroll:', data.data)
      const otherPlayerKey = isHostTurn.value ? 'guest' : 'host'
      const updatedDice = [...playerResources.value[otherPlayerKey]]
      updatedDice[data.data.diceIndex] = { 
        ...updatedDice[data.data.diceIndex], 
        value: data.data.newValue,
        emoji: data.data.newEmoji,
        element: data.data.newElement
      }
      playerResources.value[otherPlayerKey] = updatedDice
      console.log(`Updated other player's die ${data.data.diceIndex} to ${data.data.newValue} (${data.data.newEmoji})`)
      break
    case 'turn_change':
      // Update turn state from other player
      currentTurn.value = data.data.turn
      isHostTurn.value = data.data.isHostTurn
      gamePhase.value = 'rolling'
      // Update player resources if provided (includes dice marked as used)
      if (data.data.playerResources) {
        playerResources.value = data.data.playerResources
      }
      break
    case 'game_state_sync':
      // Sync complete game state
      currentTurn.value = data.data.currentTurn
      isHostTurn.value = data.data.isHostTurn
      gamePhase.value = data.data.gamePhase
      playerResources.value = data.data.playerResources
      if (data.data.playerStats) {
        playerStats.value = data.data.playerStats
      }
      console.log('Game state synced:', data.data)
      break
    case 'request_game_state':
      // Host responds with current game state
      if (props.isHost) {
        sendGameMessage('game_state_sync', {
          currentTurn: currentTurn.value,
          isHostTurn: isHostTurn.value,
          gamePhase: gamePhase.value,
          playerResources: playerResources.value,
          playerStats: playerStats.value
        })
      }
      break
    case 'game_over':
      // Handle game over message from other player
      gameOver.value = true
      winner.value = data.data.winner
      showGameOverModal.value = true
      console.log('Received game over, winner:', winner.value)
      break
    case 'new_game_starting':
      // Show that host is starting new game
      isNewGameStarting.value = true
      break
    case 'new_game_reset':
      // Reset game state from host
      playerStats.value = data.data.playerStats
      currentTurn.value = data.data.currentTurn
      isHostTurn.value = data.data.isHostTurn
      gamePhase.value = data.data.gamePhase
      playerResources.value = { host: [], guest: [] }
      floatingIndicators.value = { host: { health: [], armor: [] }, guest: { health: [], armor: [] } }
      gameOver.value = false
      winner.value = ''
      showGameOverModal.value = false
      isNewGameStarting.value = false
      statusMessage.value = ''
      console.log('Game reset by host')
      break
    case 'game_event':
      console.log('Game event received:', data)
      break
    case 'player_action':
      console.log('Player action received:', data)
      break
    case 'game_state_update':
      console.log('Game state update received:', data)
      break
    case 'player_disconnect':
      // Handle when the other player disconnects
      setTimeout(() => {
        emit('leave-game')
      }, 500)
      break
    case 'spell_casting_started':
      // Convert player role to appropriate display name for this client
      const castingPlayerName = data.data.playerRole === 'host' ? topPlayerName.value : bottomPlayerName.value
      currentlyCastingSpell.value = {
        spellName: data.data.spellName,
        playerName: castingPlayerName
      }
      console.log('Received spell casting started:', data.data.spellName, 'by', data.data.playerRole, 'displaying as', castingPlayerName)
      break
    case 'spell_casting_ended':
      currentlyCastingSpell.value = null
      console.log('Received spell casting ended')
      break
    default:
      console.log('Unknown game message:', data)
  }
}

// Handle dice rolling
const onDiceRolled = (result) => {
  console.log('Dice rolled:', result)
  
  // Add to current player's resources
  const playerKey = isHostTurn.value ? 'host' : 'guest'
  playerResources.value[playerKey].push(result)
  
  // Check if all dice have been rolled
  if (playerResources.value[playerKey].length >= diceToRoll.value) {
    // Send dice results to other player
    sendGameMessage('dice_rolled', {
      player: playerKey,
      resources: playerResources.value[playerKey],
      turn: currentTurn.value
    })
    
    // Move to casting phase - don't end turn automatically
    isRolling.value = false
    gamePhase.value = 'casting'
  }
}

const startRolling = () => {
  if (!canRollDice.value) return
  
  isRolling.value = true
  
  // Reset current player's resources for this turn
  const playerKey = isHostTurn.value ? 'host' : 'guest'
  playerResources.value[playerKey] = []
  
  // Send dice rolling start message to other player
  sendGameMessage('dice_rolling_start', {
    player: playerKey,
    diceCount: diceToRoll.value,
    playerName: currentPlayerName.value
  })
  
  // Auto-roll all dice for now (can be made manual later)
  setTimeout(() => {
    for (let i = 0; i < diceToRoll.value; i++) {
      if (diceRefs.value[i]) {
        setTimeout(() => {
          diceRefs.value[i].roll()
        }, i * 200) // Stagger the rolls
      }
    }
  }, 500)
}

const endTurn = () => {
  // Mark all unused dice as used before ending turn
  const playerKey = isHostTurn.value ? 'host' : 'guest'
  if (playerResources.value[playerKey]) {
    playerResources.value[playerKey].forEach(dice => {
      if (!dice.used) {
        dice.used = true
      }
    })
  }
  
  // Switch to next player or next turn
  if (isHostTurn.value) {
    // Host finished, now guest's turn
    isHostTurn.value = false
  } else {
    // Guest finished, advance to next turn
    currentTurn.value++
    isHostTurn.value = true
  }
  
  // Reset to rolling phase for the next player
  gamePhase.value = 'rolling'
  
  // Send turn update to other player with updated dice state
  sendGameMessage('turn_change', {
    turn: currentTurn.value,
    isHostTurn: isHostTurn.value,
    playerResources: playerResources.value
  })
}

// Handle spell casting from spellbook
const onCastSpells = async (spells) => {
  console.log('Casting spells:', spells)

  // Mark used dice as consumed
  const playerKey = isHostTurn.value ? 'host' : 'guest'
  spells.forEach(spell => {
    spell.cost.forEach(requiredDice => {
      const diceIndex = playerResources.value[playerKey].findIndex(dice => dice.emoji === requiredDice && !dice.used)
      if (diceIndex > -1) {
        playerResources.value[playerKey][diceIndex].used = true
      }
    })
  })

  // Send immediate dice state update to other player so they see dice marked as used right away
  sendGameMessage('dice_used_update', {
    player: playerKey,
    playerResources: playerResources.value[playerKey]
  })

  // Execute each spell using SpellEffects component
  if (spellEffectsRef.value) {
    for (const spell of spells) {
      try {
        const result = await spellEffectsRef.value.executeSpell(spell.name)
        console.log('Spell executed:', result)
      } catch (error) {
        console.error('Error executing spell:', spell.name, error)
      }
    }
  }

  // Send updated game state
  sendGameMessage('game_state_sync', {
    currentTurn: currentTurn.value,
    isHostTurn: isHostTurn.value,
    gamePhase: gamePhase.value,
    playerResources: playerResources.value,
    playerStats: playerStats.value
  })

  sendGameMessage('spells_cast', {
    player: playerKey,
    spells: spells,
    playerResources: playerResources.value[playerKey],
    playerStats: playerStats.value
  })
}

// Handle end turn from spellbook
const onEndTurn = () => {
  endTurn()
}

// SpellEffects event handlers
const onUpdatePlayerStats = ({ player, updates }) => {
  if (playerStats.value[player]) {
    // Track changes for floating indicators
    const oldStats = { ...playerStats.value[player] }
    
    Object.assign(playerStats.value[player], updates)
    
    // Show floating indicators for changes
    if (updates.health !== undefined && updates.health !== oldStats.health) {
      const change = updates.health - oldStats.health
      showFloatingIndicator(player, 'health', change)
    }
    
    if (updates.armor !== undefined && updates.armor !== oldStats.armor) {
      const change = updates.armor - oldStats.armor
      showFloatingIndicator(player, 'armor', change)
    }
    
    // Check for game over after stat updates
    checkGameOver()
  }
}

const onUpdatePlayerResources = ({ player, updates }) => {
  if (playerResources.value[player]) {
    // If updates is an array, replace the entire resource array
    if (Array.isArray(updates)) {
      playerResources.value[player] = [...updates] // Force reactivity with spread
    } else {
      // Otherwise, do a partial update using Object.assign
      Object.assign(playerResources.value[player], updates)
    }
  }
}

// Show floating indicator for stat changes
const showFloatingIndicator = (player, statType, change) => {
  if (change === 0) return
  
  const indicatorData = {
    id: Date.now() + Math.random(), // Unique ID for each indicator
    value: change > 0 ? `+${change}` : `${change}`,
    isPositive: change > 0,
    timestamp: Date.now(),
    delay: 0 // No delay for immediate display
  }
  
  // Add to the array of indicators on current player's screen
  floatingIndicators.value[player][statType].push(indicatorData)
  
  // Send to opponent so they see it too
  sendGameMessage('floating_indicator', {
    player: player,
    statType: statType,
    indicatorData: indicatorData
  })
  
  // Clear the specific indicator after animation
  setTimeout(() => {
    const indicatorArray = floatingIndicators.value[player][statType]
    const index = indicatorArray.findIndex(ind => ind.id === indicatorData.id)
    if (index > -1) {
      indicatorArray.splice(index, 1)
    }
  }, 2000)
}

const onShowSpellMessage = ({ message, type }) => {
  const statusTypes = {
    'damage': 'error',
    'healing': 'success', 
    'buff': 'success',
    'utility': 'info',
    'warning': 'error',
    'error': 'error'
  }
  
  setStatusMessage(message, statusTypes[type] || 'info', 3000)
}

// Handle spell casting state changes
const onSpellCastingStarted = ({ spellName }) => {
  isSpellCasting.value = true
  console.log('Spell casting started:', spellName)
  
  // Update local state
  const currentPlayerName = isHostTurn.value ? topPlayerName.value : bottomPlayerName.value
  currentlyCastingSpell.value = {
    spellName,
    playerName: currentPlayerName
  }
  
  // Send spell casting notification to other player with role instead of display name
  const currentPlayerRole = isHostTurn.value ? 'host' : 'guest'
  sendGameMessage('spell_casting_started', {
    spellName,
    playerRole: currentPlayerRole
  })
}

const onSpellCastingEnded = ({ spellName }) => {
  isSpellCasting.value = false
  currentlyCastingSpell.value = null
  console.log('Spell casting ended:', spellName)
  
  // Send spell casting ended notification to other player
  sendGameMessage('spell_casting_ended', {
    spellName
  })
}

// Handle dice roll request from SpellEffects
const onRequestDiceRoll = ({ notation }) => {
  console.log('Requesting dice roll:', notation)
  
  // Generate the dice result for both players to use
  const [count, sides] = notation.split('d').map(Number)
  const result = Math.floor(Math.random() * sides) + 1
  console.log('Generated dice result for synchronization:', result)
  
  // Clear any previous dice display and start new roll
  spellDiceRoll.value = {
    notation,
    isRolling: true,
    result // Pre-determined result
  }
  
  // Send spell dice start to other player with the pre-determined result
  sendGameMessage('spell_dice_start', {
    notation,
    result
  })

  
  console.log('Sent spell_dice_start with synchronized result:', result)
}

// Handle spell dice roll completion
const onSpellDiceRolled = (result) => {
  console.log('Spell dice rolled with result:', result)
  // Pass result back to SpellEffects (only on casting player)
  if (spellEffectsRef.value) {
    // Use the synchronized result if available, otherwise use the rolled result
    const finalResult = spellDiceRoll.value.result !== undefined ? 
      { ...result, value: spellDiceRoll.value.result } : result
    console.log('Passing result to SpellEffects:', finalResult)
    spellEffectsRef.value.handleDiceRollResult(finalResult)
  }
}

const onSpellDiceFinished = () => {
  console.log('Spell dice finished rolling')
  
  // Add a 5-second delay for the casting player to process the dice result and continue
  setTimeout(() => {
    console.log('Clearing spell dice display and continuing...')
    // Clear the spell dice rolling state
    spellDiceRoll.value = null

    // Notify SpellEffects that the display is finished and next action can start
    if (spellEffectsRef.value) {
      spellEffectsRef.value.onSpellDiceDisplayFinished()
    }
  }, 2750)
}

// Handle element dice reroll request from SpellEffects
const onRequestElementDiceReroll = ({ diceFilter, maxRerolls, message }) => {
  console.log('Requesting element dice reroll:', { diceFilter, maxRerolls, message })
  
  // Set up element dice reroll state
  elementDiceReroll.value = {
    diceFilter,
    maxRerolls,
    message,
    selectedDice: [],
    remainingRerolls: maxRerolls
  }
  
  // Show message to player
  statusMessage.value = message
  statusType.value = 'info'
  
  console.log('Element dice reroll mode activated')
}

// Handle element die click during reroll selection
const onElementDieRerollClick = (diceIndex) => {
  if (!elementDiceReroll.value) return
  
  const currentPlayerKey = isHostTurn.value ? 'host' : 'guest'
  const dice = playerResources.value[currentPlayerKey][diceIndex]
  
  // Check if this die can be selected (passes filter)
  const canSelect = elementDiceReroll.value.diceFilter(dice)
  if (!canSelect) {
    return
  }
  
  // Check if we have total rerolls remaining
  if (elementDiceReroll.value.remainingRerolls <= 0) {
    statusMessage.value = 'No rerolls remaining'
    statusType.value = 'warning'
    return
  }
  
  // Reroll the die
  rerollElementDie(diceIndex)
}

// Reroll a specific element die
const rerollElementDie = (diceIndex) => {
  const currentPlayerKey = isHostTurn.value ? 'host' : 'guest'
  const currentDice = [...playerResources.value[currentPlayerKey]]
  
  // Get the old die information before rerolling
  const oldDie = currentDice[diceIndex]
  const oldEmoji = oldDie.emoji
  
  // Element faces mapping (from ElementDice.vue)
  const elementFaces = ['🔥', '💧', '🌍', '💨', '💖', '💀']
  const elementNames = ['fire', 'water', 'earth', 'air', 'love', 'death']
  
  // Generate new roll for the die (0-5 for element dice)
  const newRoll = Math.floor(Math.random() * 6)
  const newEmoji = elementFaces[newRoll]
  const newElement = elementNames[newRoll]
  
  // Update the die with new value, emoji, and element
  currentDice[diceIndex] = { 
    ...currentDice[diceIndex], 
    value: newRoll,
    emoji: newEmoji,
    element: newElement
  }
  
  // Update resources
  playerResources.value[currentPlayerKey] = currentDice
  
  // Update reroll tracking
  elementDiceReroll.value.remainingRerolls--
  
  // Send reroll to other player
  sendGameMessage('element_dice_reroll', {
    diceIndex,
    newValue: newRoll,
    newEmoji: newEmoji,
    newElement: newElement
  })
  
  // status message saying old emoji and new emoji
  setStatusMessage(`Rerolled ${oldEmoji} to ${newEmoji}!`)

  // Check if we're done with rerolls
  if (elementDiceReroll.value.remainingRerolls <= 0) {
    finishElementDiceReroll()
  }
}

// Finish element dice reroll and return to SpellEffects
const finishElementDiceReroll = () => {
  console.log('Element dice reroll finished')
  
  // Get the final dice state
  const currentPlayerKey = isHostTurn.value ? 'host' : 'guest'
  const finalDice = playerResources.value[currentPlayerKey]
  
  // Clear reroll state
  const rerollResult = {
    finalDice,
    rerollsUsed: elementDiceReroll.value.maxRerolls - elementDiceReroll.value.remainingRerolls
  }
  
  elementDiceReroll.value = null
  statusMessage.value = ''
  
  // Return result to SpellEffects
  if (spellEffectsRef.value) {
    spellEffectsRef.value.handleElementDiceRerollResult(rerollResult)
  }
}

const sendGameMessage = (messageType, data) => {
  const message = {
    type: messageType,
    data: data,
    timestamp: Date.now()
  }
  
  // If this is the host, send to the peer instance's connections
  if (props.isHost && props.peerInstance) {
    // Send to all connected peers (should be just one guest in this 2-player game)
    Object.values(props.peerInstance.connections).forEach(connections => {
      connections.forEach(conn => {
        if (conn.open) {
          conn.send(message)
        }
      })
    })
  } 
  // If this is the guest, send to the host connection
  else if (props.connection && props.connection.open) {
    props.connection.send(message)
  }
}


// Leave game and return to landing page
const leaveGame = () => {
  // Send disconnect message to other player before leaving
  sendGameMessage('player_disconnect', {
    message: 'Player disconnected'
  })
  
  setTimeout(() => {
    emit('leave-game')
  }, 500)
}

// Initialize component
onMounted(() => {
  // Set up peer event listeners for game events
  if (props.isHost && props.peerInstance) {
    // For host: listen to messages from all connected peers
    Object.values(props.peerInstance.connections).forEach(connections => {
      connections.forEach(conn => {
        if (conn.open) {
          conn.on('data', handleGameMessage)
          
          // Listen for connection close (guest disconnected)
          conn.on('close', () => {
            setTimeout(() => {
              emit('leave-game')
            }, 3000)
          })
        }
      })
    })
    
    // Also listen for new connections that might be established
    props.peerInstance.on('connection', (conn) => {
      conn.on('open', () => {
        conn.on('data', handleGameMessage)
        
        // Listen for connection close on new connections
        conn.on('close', () => {
          setTimeout(() => {
            emit('leave-game')
          }, 3000)
        })
        
        // Send initial game state to newly connected player
        setTimeout(() => {
          sendGameMessage('game_state_sync', {
            currentTurn: currentTurn.value,
            isHostTurn: isHostTurn.value,
            gamePhase: gamePhase.value,
            playerResources: playerResources.value,
            playerStats: playerStats.value
          })
        }, 100)
      })
    })
    
    // Send initial game state to already connected players
    setTimeout(() => {
      sendGameMessage('game_state_sync', {
        currentTurn: currentTurn.value,
        isHostTurn: isHostTurn.value,
        gamePhase: gamePhase.value,
        playerResources: playerResources.value,
        playerStats: playerStats.value
      })
    }, 100)
    
  } else if (props.connection) {
    // For guest: listen to messages from host
    props.connection.on('data', handleGameMessage)
    
    // Listen for host connection close
    props.connection.on('close', () => {
      setTimeout(() => {
        emit('leave-game') 
      }, 3000)
    })
    
    // Request initial game state from host
    setTimeout(() => {
      sendGameMessage('request_game_state', {})
    }, 100)
  }
})

// Cleanup on component unmount
onUnmounted(() => {
  console.log('GameBoard component unmounted')
  
  // Call leaveGame to properly disconnect from the game
  //leaveGame()
})

// TESTING ONLY - Remove after testing
// Global testing function for easy spell testing
if (typeof window !== 'undefined') {
  window.testSpell = (spellName) => {
    if (spellEffectsRef.value) {
      console.log(`Testing spell: ${spellName}`)
      spellEffectsRef.value.testSpell(spellName)
    } else {
      console.error('SpellEffects not available')
    }
  }
}
</script>

<style scoped>
.game-container {
  display: flex;
  height: 100vh;
  margin: 0;
  width: 100vw;
  font-family: 'Inter', sans-serif;
  color: white;
}

.game-board {
  flex: 0 0 50%;
  width: 50vw;
  height: 100vh;
  background: linear-gradient(135deg, #2d1b69 0%, #11998e 100%);
  display: flex;
  flex-direction: column;
  padding: 20px;
  box-sizing: border-box;
}

.spellbook-container {
  flex: 0 0 50%;
  width: 50vw;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(5px);
}

.player-area {
  flex: 1;
  display: flex;
  padding: 1rem;
  margin: 0.5rem 0;
  padding-top: .5rem;
  background: rgba(255,255,255,0.1);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  border: 1px solid rgba(255,255,255,0.2);
  box-shadow: 0 8px 32px rgba(0,0,0,0.1);
  min-height: 200px;
  transition: all 0.3s ease;
}

.player-area.current-player {
  border: 2px solid #fbbf24;
  box-shadow: 
    0 0 30px rgba(251, 191, 36, 0.5),
    0 8px 32px rgba(0,0,0,0.1),
    inset 0 0 25px rgba(251, 191, 36, 0.20);
  background: rgba(255,255,255,0.1);
}

.top-player {
  flex-direction: column;
  justify-content: flex-start;
  
}

.bottom-player {
  flex-direction: column-reverse;
  justify-content: flex-start;
}

.player-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}
.top-player .player-header {
  margin-top: 0;
  margin-top: .75rem;
  margin-left: .5rem;
  margin-right: .5rem;
}

.bottom-player .player-header {
  margin-bottom: 0;
  margin-top: .75rem;
  margin-left: .5rem;
  margin-right: .5rem;
}

.player-name-box {
  display: flex;
  align-items: center;
  padding: 0.4rem 0.8rem;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 12px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(15px);
  box-shadow: 0 4px 15px rgba(0,0,0,0.2);
}

.player-name {
  font-size: 1.5rem;
  font-weight: 600;
  color: white;
  margin: 0;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
}

.casting-spell-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(138, 43, 226, 0.25);
  padding: 0.4rem 0.8rem;
  border-radius: 12px;
  margin: 0.5rem 0;
  border: 2px solid rgba(138, 43, 226, 0.4);
  backdrop-filter: blur(15px);
  box-shadow: 0 4px 15px rgba(0,0,0,0.2);
  animation: pulse-spell 2s ease-in-out infinite;
}

.casting-icon {
  font-size: 1.1rem;
  animation: sparkle 1.5s ease-in-out infinite;
}

.casting-text {
  font-size: .9rem;
  margin-left: .2rem;
  font-weight: 600;
  color: #c084fc;
  text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
}

.spell-name {
  font-size: 1.1rem;
  margin-left: .4rem;
  color: white;
  font-weight: 700;
  text-shadow: 0 0 4px rgba(192, 132, 252, 0.4);
}

@keyframes pulse-spell {
  0%, 100% { 
    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    border-color: rgba(138, 43, 226, 0.4);
  }
  50% { 
    box-shadow: 0 6px 20px rgba(138, 43, 226, 0.4);
    border-color: rgba(138, 43, 226, 0.6);
  }
}

@keyframes sparkle {
  0%, 100% { transform: scale(1) rotate(0deg); }
  25% { transform: scale(1.1) rotate(90deg); }
  50% { transform: scale(1.2) rotate(180deg); }
  75% { transform: scale(1.1) rotate(270deg); }
}

.player-stats {
  display: flex;
  gap: 2rem;
  align-items: center;
}

.health-stat, .armor-stat {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: .3rem 1rem;
  border-radius: 12px;
  font-weight: 700;
  position: relative;
  border: 2px solid rgba(255,255,255,0.3);
  backdrop-filter: blur(15px);
  box-shadow: 0 4px 15px rgba(0,0,0,0.2);
}

.health-stat {
  background: rgba(220, 38, 127, 0.25);
  border-color: rgba(220, 38, 127, 0.4);
}

.armor-stat {
  background: rgba(59, 130, 246, 0.25);
  border-color: rgba(59, 130, 246, 0.4);
}

.stat-icon {
  font-size: 1.3rem;
}

.stat-value {
  font-size: 1.4rem;
  font-weight: 700;
  text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
  color: white;
}

/* Floating damage/heal indicators */
.floating-indicator {
  position: absolute;
  bottom: -25px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 1.5rem;
  font-weight: bold;
  pointer-events: none;
  z-index: 1000;
  text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
}

.floating-indicator.positive {
  color: #4ade80;
  animation: floatDown 3s ease-out forwards;
}

.floating-indicator.negative {
  color: #f87171;
  animation: floatDown 3s ease-out forwards;
}

@keyframes floatDown {
  0% {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
  100% {
    opacity: 0;
    transform: translateX(-50%) translateY(30px);
  }
}

.dice-area {
  display: flex;
  gap: 3rem;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding:3rem
}

.element-dice-box {
  flex: 2;
  background: rgba(255,255,255,0.2);
  border-radius: 15px;
  padding: 1rem 1rem;
  text-align: center;
  border: 2px solid rgba(255,255,255,0.3);
  min-height: 130px;
}

.number-dice-box {
  flex: 1;
  background: rgba(255,255,255,0.2);
  border-radius: 15px;
  padding: 1rem;
  text-align: center;
  border: 2px solid rgba(255,255,255,0.3);
  max-width: 150px;
}

.element-dice-box h4, .number-dice-box h4 {
  margin: 0 0 1rem 0;
  color: white;
  font-size: 1rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.dice-container {
  min-height: 80px;
  max-height: 275px;
  padding: .75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.2);
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.2);
}

.dice-container.small {
  min-height: 100px;
}

.dice-placeholder {
  font-size: 2.5rem;
  opacity: 0.7;
}

.dice-placeholder.small {
  font-size: 1.8rem;
}

.spell-dice-rolling {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.spell-dice-label {
  font-size: 0.9rem;
  font-weight: 600;
  color: #ffd700;
  text-align: center;
  background: rgba(255, 215, 0, 0.2);
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  border: 1px solid rgba(255, 215, 0, 0.3);
}

.game-center {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  background: rgba(255,255,255,0.1);
  backdrop-filter: blur(10px);
  border-radius: 10px;
  margin: 0.3rem 0;
  border: 1px solid rgba(255,255,255,0.2);
  flex-shrink: 0;
  min-height: auto;
}

.game-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: white;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
}

.turn-info {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  background: rgba(255, 255, 255, 0.15);
  padding: 0.35rem 0.7rem;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(15px);
  margin-top: 0;
}

.turn-counter {
  display: flex;
  align-items: center;
  text-align: center;
}

.turn-display {
  font-size: 1.3rem;
  font-weight: 700;
  /* color: #ffffff; */
  color: #ffd700;
  text-shadow: 0 0 8px rgba(255, 215, 0, 0.4);
  letter-spacing: 0.5px;
}

.turn-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  color: #ffd700;
}

.chevron-up, .chevron-down {
  font-size: 1rem;
  font-weight: bold;
  color: rgba(255,255,255,0.3);
  transition: all 0.3s ease;
  text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 1rem;
  width: 1rem;
}

.chevron-up.active, .chevron-down.active {
  color: #ffd700;
  text-shadow: 0 0 10px rgba(255,215,0,0.5), 2px 2px 4px rgba(0,0,0,0.8);
  font-size: 1.25rem;
  font-weight: 900;
}

.status-message {
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-weight: 500;
  backdrop-filter: blur(10px);
  text-align: center;
  background: rgba(0,0,0,0.6);
  border: 1px solid rgba(255,255,255,0.2);
  font-size: 1rem;
  align-self: center;
  animation: statusGlow 4s ease-out;
}

@keyframes statusGlow {
  0% {
    box-shadow: 0 0 20px rgba(255, 251, 30, 0.6);
  }
  100% {
    box-shadow: 0 0 0 rgba(187, 187, 27, 0);
  }
}

.status-message.info {
  color: #a8c8ff;
}

/* Dice Grid Styles */
.dice-grid {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
}

.opponent-dice {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  min-height: 70px;
}

.rolled-dice {
  width: 60px;/* 60px */
  height: 60px; /* 60px */
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.2rem;
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 8px;
  backdrop-filter: blur(10px);
  position: relative;
  transition: all 0.3s ease;
}

.rolled-dice.used-dice {
  opacity: 0.5;
  background: rgba(255,0,0,0.1);
  border-color: rgba(255,0,0,0.3);
}

.rolled-dice.rerollable-dice {
  cursor: pointer;
  background: rgba(0,255,0,0.1);
  border-color: rgba(0,255,0,0.5);
  box-shadow: 0 0 10px rgba(0,255,0,0.3);
}

.rolled-dice.rerollable-dice:hover {
  background: rgba(0,255,0,0.2);
  border-color: rgba(0,255,0,0.7);
  box-shadow: 0 0 15px rgba(0,255,0,0.5);
  transform: scale(1.05);
}

.rolled-dice.non-rerollable-dice {
  opacity: 0.6;
  background: rgba(128,128,128,0.1);
  border-color: rgba(128,128,128,0.3);
}

.dice-used-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  color: #ff4444;
  font-weight: bold;
  text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
  background: rgba(0,0,0,0.3);
  border-radius: 8px;
  backdrop-filter: blur(2px);
}

.roll-action {
  margin-top: 15px;
  text-align: center;
}

.roll-button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.2);
}

.roll-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(102,126,234,0.3);
}

.roll-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* Reroll action styles */
.reroll-action {
  margin-top: 15px;
  text-align: center;
}

.stop-reroll-button {
  background: linear-gradient(135deg, #ff4444 0%, #cc0000 100%);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.2);
}

.stop-reroll-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(255,68,68,0.4);
}

.status-message.success {
  color: #7dd87d;
}

.status-message.error {
  color: #ff9999;
}

/* Rolling dice animation styles */
.rolling-dice-display {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  min-height: 70px;
}

.rolling-dice {
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.2rem;
  background: rgba(255,255,255,0.1);
  border: 2px solid #ff6b6b;
  border-radius: 8px;
  backdrop-filter: blur(10px);
  animation: shake 0.1s infinite;
  box-shadow: 0 0 10px rgba(255,107,107,0.3);
}

.dice-results {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  min-height: 70px;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-2px); }
  75% { transform: translateX(2px); }
}

/* Game Over Modal Styles */
.game-over-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(10px);
}

.modal-content {
  position: relative;
  background: linear-gradient(135deg, #2d1b69 0%, #11998e 100%);
  border-radius: 20px;
  padding: 3rem;
  max-width: 500px;
  width: 90%;
  text-align: center;
  border: 2px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  animation: modalSlideIn 0.5s ease-out;
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: translateY(-50px) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.game-over-header h2 {
  font-size: 3rem;
  margin: 0 0 2rem 0;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  color: white;
}

.game-over-details {
  margin: 2rem 0;
}

.final-stats {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 15px;
  padding: 1.5rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.stat-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 0.75rem 0;
  font-size: 1.2rem;
  font-weight: 600;
}

.player-label {
  color: #ffd700;
  text-shadow: 0 0 8px rgba(255, 215, 0, 0.4);
}

.health-value {
  color: white;
  font-weight: 700;
}

.game-over-actions {
  margin-top: 2rem;
}

.new-game-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  color: #ffd700;
  font-weight: 600;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(255, 215, 0, 0.3);
  border-top: 4px solid #ffd700;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.host-actions, .guest-actions {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
}

.new-game-button, .leave-game-button {
  padding: 1rem 2rem;
  border: none;
  border-radius: 10px;
  font-size: 1.1rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 200px;
}

.new-game-button {
  background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(74, 222, 128, 0.3);
}

.new-game-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(74, 222, 128, 0.4);
}

.leave-game-button {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);
}

.leave-game-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(239, 68, 68, 0.4);
}

.waiting-message {
  color: #a8c8ff;
  font-size: 1.1rem;
  margin: 1rem 0;
  font-style: italic;
}

@media (max-width: 768px) {
  .game-container {
    flex-direction: column;
    height: 100vh;
    width: 100vw;
  }
  
  .game-board {
    width: 100vw;
    height: auto;
    flex: 1;
    padding: 0;
  }
  
  .spellbook-container {
    width: 100vw;
    height: 400px;
    flex: 0 0 400px;
  }

  .player-header {
    flex-direction: column;
    gap: 1rem;
    text-align: center;
  }
  
  .casting-spell-indicator {
    padding: 0.3rem 0.6rem;
    margin: 0.3rem 0;
  }
  
  .casting-text {
    font-size: 0.8rem;
  }
  
  .player-stats {
    justify-content: center;
  }
  
  .dice-area {
    flex-direction: column;
    gap: 1rem;
  }
  
  .number-dice-box {
    max-width: none;
  }
  
  .game-center {
    flex-direction: column;
    gap: 1rem;
    text-align: center;
  }
}
</style>
