<template>
  <div class="game-container">
    <!-- Left side - Game Board -->
    <div class="game-board">
      <!-- Game Header -->
      <div class="game-center">
        <div class="turn-info">
          <span class="turn-counter">Turn {{ currentTurn }}</span>
          <span class="current-player">{{ currentPlayerName }}'s Turn</span>
        </div>
        <div v-if="statusMessage" class="status-message" :class="statusType">
          {{ statusMessage }}
        </div>
      </div>

    <!-- Player 1 Area (Top) -->
    <div class="player-area top-player">
      <div class="player-header">
        <h3 class="player-name">{{ topPlayerName }}</h3>
        <div class="player-stats">
          <div class="health-stat">
            <span class="stat-icon">❤️</span>
            <span class="stat-value">25/25</span>
          </div>
          <div class="armor-stat">
            <span class="stat-icon">🛡️</span>
            <span class="stat-value">0</span>
          </div>
        </div>
      </div>
      
      <div class="dice-area">
        <div class="element-dice-box">
          <h4>Element Dice</h4>
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
              <div v-for="resource in playerResources.host" :key="resource.diceIndex" class="rolled-dice" :class="{ 'used-dice': resource.used }">
                {{ resource.emoji }}
                <div v-if="resource.used" class="dice-used-overlay">✕</div>
              </div>
              <div v-if="playerResources.host.length === 0" class="dice-placeholder">
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
          <h4>Number Dice</h4>
          <div class="dice-container small">
            <!-- Number dice will be displayed here -->
            <div class="dice-placeholder small">🎲</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Player 2 Area (Bottom) -->
    <div class="player-area bottom-player">
      <div class="dice-area">
        <div class="element-dice-box">
          <h4>Element Dice</h4>
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
              <div v-for="resource in playerResources.guest" :key="resource.diceIndex" class="rolled-dice" :class="{ 'used-dice': resource.used }">
                {{ resource.emoji }}
                <div v-if="resource.used" class="dice-used-overlay">✕</div>
              </div>
              <div v-if="playerResources.guest.length === 0" class="dice-placeholder">
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
          <h4>Number Dice</h4>
          <div class="dice-container small">
            <!-- Number dice will be displayed here -->
            <div class="dice-placeholder small">🎲</div>
          </div>
        </div>
      </div>
      
      <div class="player-header">
        <h3 class="player-name">{{ bottomPlayerName }}</h3>
        <div class="player-stats">
          <div class="health-stat">
            <span class="stat-icon">❤️</span>
            <span class="stat-value">25/25</span>
          </div>
          <div class="armor-stat">
            <span class="stat-icon">🛡️</span>
            <span class="stat-value">0</span>
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
        @cast-spells="onCastSpells"
        @end-turn="onEndTurn"
        @close="() => {}"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import ElementDice from './ElementDice.vue'
import Spellbook from './Spellbook.vue'

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
const currentTurn = ref(1)
const isHostTurn = ref(true) // Host always starts

// Game state
const gamePhase = ref('rolling') // 'rolling', 'casting', 'waiting'
const playerResources = ref({
  host: [],
  guest: []
})
const diceRefs = ref([])
const isRolling = ref(false)

// Computed properties for player names
const topPlayerName = computed(() => {
  return props.hostName
})

const bottomPlayerName = computed(() => {
  return props.guestName
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

// Helper function to set status message with timeout
const setStatusMessage = (message, type, duration = 3000) => {
  statusMessage.value = message
  statusType.value = type
  
  if (duration > 0) {
    setTimeout(() => {
      statusMessage.value = ''
    }, duration)
  }
}

// Handle game-related messages
const handleGameMessage = (data) => {
  switch (data.type) {
    case 'dice_rolled':
      // Update other player's resources
      playerResources.value[data.data.player] = data.data.resources
      setStatusMessage(`${data.data.player === 'host' ? topPlayerName.value : bottomPlayerName.value} rolled their dice!`, 'info', 2000)
      break
    case 'spells_cast':
      // Update other player's resources after spell casting
      playerResources.value[data.data.player] = data.data.playerResources
      const playerName = data.data.player === 'host' ? topPlayerName.value : bottomPlayerName.value
      setStatusMessage(`${playerName} cast ${data.data.spells.length} spell(s)!`, 'info', 3000)
      break
    case 'turn_change':
      // Update turn state from other player
      currentTurn.value = data.data.turn
      isHostTurn.value = data.data.isHostTurn
      gamePhase.value = 'rolling'
      setStatusMessage(`${isHostTurn.value ? topPlayerName.value : bottomPlayerName.value}'s turn to roll!`, 'info', 3000)
      break
    case 'game_state_sync':
      // Sync complete game state
      currentTurn.value = data.data.currentTurn
      isHostTurn.value = data.data.isHostTurn
      gamePhase.value = data.data.gamePhase
      playerResources.value = data.data.playerResources
      console.log('Game state synced:', data.data)
      break
    case 'request_game_state':
      // Host responds with current game state
      if (props.isHost) {
        sendGameMessage('game_state_sync', {
          currentTurn: currentTurn.value,
          isHostTurn: isHostTurn.value,
          gamePhase: gamePhase.value,
          playerResources: playerResources.value
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
    setStatusMessage(`${currentPlayerName.value} rolled ${diceToRoll.value} dice! Choose spells to cast or end turn.`, 'success', 5000)
    
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
  setStatusMessage(`${currentPlayerName.value} is rolling ${diceToRoll.value} dice...`, 'info', 0)
  
  // Reset current player's resources for this turn
  const playerKey = isHostTurn.value ? 'host' : 'guest'
  playerResources.value[playerKey] = []
  
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
  // Switch to next player or next turn
  if (isHostTurn.value) {
    // Host finished, now guest's turn
    isHostTurn.value = false
    setStatusMessage(`${bottomPlayerName.value}'s turn to roll!`, 'info', 3000)
  } else {
    // Guest finished, advance to next turn
    currentTurn.value++
    isHostTurn.value = true
    setStatusMessage(`Turn ${currentTurn.value} - ${topPlayerName.value}'s turn!`, 'info', 3000)
  }
  
  // Reset to rolling phase for the next player
  gamePhase.value = 'rolling'
  
  // Send turn update to other player
  sendGameMessage('turn_change', {
    turn: currentTurn.value,
    isHostTurn: isHostTurn.value
  })
}

// Handle spell casting from spellbook
const onCastSpells = (spells) => {
  console.log('Casting spells:', spells)
  
  // TODO: Implement spell effects
  // For now, just show a message and consume the dice
  const totalDiceUsed = spells.reduce((total, spell) => total + spell.cost.length, 0)
  setStatusMessage(`${currentPlayerName.value} cast ${spells.length} spell(s) using ${totalDiceUsed} dice!`, 'success', 3000)
  
  // Mark used dice as consumed instead of removing them
  const playerKey = isHostTurn.value ? 'host' : 'guest'
  spells.forEach(spell => {
    spell.cost.forEach(requiredDice => {
      const diceIndex = playerResources.value[playerKey].findIndex(dice => dice.emoji === requiredDice && !dice.used)
      if (diceIndex > -1) {
        // Mark dice as used instead of removing it
        playerResources.value[playerKey][diceIndex].used = true
      }
    })
  })

  sendGameMessage('game_state_sync', {
    currentTurn: currentTurn.value,
    isHostTurn: isHostTurn.value,
    gamePhase: gamePhase.value,
    playerResources: playerResources.value
  })
  
  // Send spell casting info to other player
  sendGameMessage('spells_cast', {
    player: playerKey,
    spells: spells,
    playerResources: playerResources.value[playerKey]
  })
}

// Handle end turn from spellbook
const onEndTurn = () => {
  endTurn()
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

// Switch to next turn
const nextTurn = () => {
  currentTurn.value++
  isHostTurn.value = !isHostTurn.value
  
  // Send turn update to other player
  sendGameMessage('turn_change', {
    turn: currentTurn.value,
    isHostTurn: isHostTurn.value
  })
}

// Leave game and return to landing page
const leaveGame = () => {
  setStatusMessage('Leaving game...', 'info', 1000)
  
  setTimeout(() => {
    emit('leave-game')
  }, 1000)
}

// Initialize component
onMounted(() => {
  setStatusMessage('Game ready!', 'success', 3000)
  
  // Set up peer event listeners for game events
  if (props.isHost && props.peerInstance) {
    // For host: listen to messages from all connected peers
    Object.values(props.peerInstance.connections).forEach(connections => {
      connections.forEach(conn => {
        if (conn.open) {
          conn.on('data', handleGameMessage)
        }
      })
    })
    
    // Also listen for new connections that might be established
    props.peerInstance.on('connection', (conn) => {
      conn.on('open', () => {
        conn.on('data', handleGameMessage)
        
        // Send initial game state to newly connected player
        setTimeout(() => {
          sendGameMessage('game_state_sync', {
            currentTurn: currentTurn.value,
            isHostTurn: isHostTurn.value,
            gamePhase: gamePhase.value,
            playerResources: playerResources.value
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
        playerResources: playerResources.value
      })
    }, 100)
    
  } else if (props.connection) {
    // For guest: listen to messages from host
    props.connection.on('data', handleGameMessage)
    
    // Request initial game state from host
    setTimeout(() => {
      sendGameMessage('request_game_state', {})
    }, 100)
  }
})

// Cleanup on component unmount
onUnmounted(() => {
  console.log('GameBoard component unmounted')
})
</script>

<style scoped>
.game-container {
  display: flex;
  min-height: 100vh;
  width: 100%;
  font-family: 'Inter', sans-serif;
  color: white;
}

.game-board {
  flex: 1;
  min-height: 100vh;
  background: linear-gradient(135deg, #2d1b69 0%, #11998e 100%);
  display: flex;
  flex-direction: column;
  padding: 20px;
  margin: 0 auto;
  width: 50%;
}

.spellbook-container {
  flex: 1;
  width: 50%;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(5px);
}

.player-area {
  flex: 1;
  display: flex;
  padding: 1rem 2rem;
  margin: 0.5rem 0;
  background: rgba(255,255,255,0.1);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  border: 1px solid rgba(255,255,255,0.2);
  box-shadow: 0 8px 32px rgba(0,0,0,0.1);
  min-height: 200px;
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
  gap: 0.5rem;
  background: rgba(255,255,255,0.2);
  padding: 0.5rem 1rem;
  border-radius: 10px;
  font-weight: 600;
}

.stat-icon {
  font-size: 1.2rem;
}

.stat-value {
  font-size: 1.1rem;
  color: white;
}

.dice-area {
  display: flex;
  gap: 4rem;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 0 4rem;
}

.element-dice-box {
  flex: 2;
  background: rgba(255,255,255,0.2);
  border-radius: 15px;
  padding: 1.5rem;
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
  min-height: 50px;
}

.dice-placeholder {
  font-size: 2.5rem;
  opacity: 0.7;
}

.dice-placeholder.small {
  font-size: 1.8rem;
}

.game-center {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 2rem;
  background: rgba(255,255,255,0.1);
  backdrop-filter: blur(10px);
  border-radius: 15px;
  margin: 0 0 1rem 0;
  border: 1px solid rgba(255,255,255,0.2);
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
  gap: 1.5rem;
}

.turn-counter {
  font-size: 1.1rem;
  font-weight: 600;
  color: white;
  background: rgba(255,255,255,0.2);
  padding: 0.4rem 0.8rem;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.3);
}

.current-player {
  font-size: 1.1rem;
  font-weight: 600;
  color: #ffd700;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
  background: rgba(255,215,0,0.2);
  padding: 0.4rem 0.8rem;
  border-radius: 8px;
  border: 1px solid rgba(255,215,0,0.3);
}

.status-message {
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-weight: 500;
  backdrop-filter: blur(10px);
  text-align: center;
  background: rgba(0,0,0,0.6);
  border: 1px solid rgba(255,255,255,0.2);
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
  min-height: 60px;
}

.rolled-dice {
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
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
