<template>
  <div class="game-container">
    <!-- Left side - Game Board -->
    <div class="game-board">
      <!-- Player 1 Area (Top) -->
      <div class="player-area top-player" :class="{ 'current-player': isHostTurn }">
        <div class="player-header">
          <h3 class="player-name">{{ topPlayerName }}</h3>
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
                  <div v-for="resource in playerResources.host" :key="resource.diceIndex" class="rolled-dice" :class="{ 'used-dice': resource.used }">
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
                <div v-for="resource in playerResources.guest" :key="resource.diceIndex" class="rolled-dice" :class="{ 'used-dice': resource.used }">
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
        <h3 class="player-name">{{ bottomPlayerName }}</h3>
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
      @updatePlayerStats="onUpdatePlayerStats"
      @updatePlayerResources="onUpdatePlayerResources"
      @showMessage="onShowSpellMessage"
      @requestDiceRoll="onRequestDiceRoll"
      @spellCastingStarted="onSpellCastingStarted"
      @spellCastingEnded="onSpellCastingEnded"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import ElementDice from './ElementDice.vue'
import NumberDice from './NumberDice.vue'
import Spellbook from './Spellbook.vue'
import SpellEffects from './SpellEffects.vue'

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

// Floating indicator state - now supports multiple indicators per stat
const floatingIndicators = ref({
  host: { health: [], armor: [] },
  guest: { health: [], armor: [] }
})

// Spell dice rolling state
const spellDiceRoll = ref(null) // { notation, spellName, isRolling }

// Computed properties for player names
const topPlayerName = computed(() => {
  // Top player is always the host
  // If current user is the host, show "You", otherwise show "Opponent"
  return props.isHost ? 'You' : 'Enemy Wizard'
})

const bottomPlayerName = computed(() => {
  // Bottom player is always the guest
  // If current user is the guest, show "You", otherwise show "Opponent"
  return props.isHost ? 'Enemy Wizard' : 'You'
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
      }, 3000)
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
  
  // Create notification message with spell names
  const spellNames = spells.map(spell => spell.name).join(', ')
  const castMessage = `${spellNames} was cast!`
  
  setStatusMessage(castMessage, 'info', 3000)

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
  }
}

const onUpdatePlayerResources = ({ player, updates }) => {
  if (playerResources.value[player]) {
    Object.assign(playerResources.value[player], updates)
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
const onSpellCastingStarted = () => {
  isSpellCasting.value = true
  console.log('Spell casting started - turn ending disabled')
}

const onSpellCastingEnded = () => {
  isSpellCasting.value = false
  console.log('Spell casting ended - turn ending enabled')
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
  }, 1000)
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
</script>

<style scoped>
.game-container {
  display: flex;
  height: calc(100vh - 1rem);
  margin: 0.5rem 0;
  width: 100%;
  font-family: 'Inter', sans-serif;
  color: white;
}

.game-board {
  flex: 0 0 60%;
  height: 100%;
  background: linear-gradient(135deg, #2d1b69 0%, #11998e 100%);
  display: flex;
  flex-direction: column;
  padding: 20px;
  margin: 0 auto;
}

.spellbook-container {
  flex: 0 0 40%;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(5px);
}

.player-area {
  flex: 1;
  display: flex;
  padding: 1rem;
  margin: 0.5rem 0;
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

.bottom-player .player-header {
  margin-bottom: 0;
  margin-top: 1rem;
}

.player-name {
  font-size: 1.5rem;
  font-weight: 600;
  color: white;
  margin: 0;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
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
  gap: 2rem;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 0 1rem;
}

.element-dice-box {
  flex: 2;
  background: rgba(255,255,255,0.2);
  border-radius: 15px;
  padding: 1rem;
  text-align: center;
  border: 2px solid rgba(255,255,255,0.3);
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
  width: 60px;
  height: 60px;
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

@media (max-width: 768px) {
  .game-container {
    flex-direction: column;
  }
  
  .game-board {
    width: 100%;
    padding: 10px;
  }
  
  .spellbook-container {
    width: 100%;
  }
  
  .player-header {
    flex-direction: column;
    gap: 1rem;
    text-align: center;
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
