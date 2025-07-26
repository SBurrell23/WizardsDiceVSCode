<template>
  <div class="game-container">
    <!-- Left side - Game Board -->
    <div class="game-board">
      <!-- Player 1 Area (Top) -->
      <div class="player-area top-player">
        <div class="player-header">
          <h3 class="player-name">{{ topPlayerName }}</h3>
          <div class="player-stats">
            <div class="health-stat">
              <span class="stat-icon">❤️</span>
              <span class="stat-value">{{ playerStats.host.health }}/{{ playerStats.host.maxHealth }}</span>
            </div>
            <div class="armor-stat">
              <span class="stat-icon">🛡️</span>
              <span class="stat-value">{{ playerStats.host.armor }}</span>
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
            <div class="dice-container small">
              <!-- Show NumberDice when spell dice rolling is active AND it's the HOST's turn -->
              <div v-if="spellDiceRoll && spellDiceRoll.isRolling && isHostTurn" class="spell-dice-rolling">
                <NumberDice 
                  :diceNotation="spellDiceRoll.notation"
                  :autoRoll="true"
                  :rollDelay="50"
                  :forcedResult="spellDiceRoll.result"
                  @rolled="onSpellDiceRolled"
                  @rolling-finished="onSpellDiceFinished"
                />
              </div>
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
          <span class="turn-counter">Turn {{ currentTurn }}</span>
        </div>
        <div v-if="statusMessage" class="status-message" :class="statusType">
          {{ statusMessage }}
        </div>
      </div>

    <!-- Player 2 Area (Bottom) -->
    <div class="player-area bottom-player">
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
          <div class="dice-container small">
            <!-- Show NumberDice when spell dice rolling is active AND it's the GUEST's turn -->
            <div v-if="spellDiceRoll && spellDiceRoll.isRolling && !isHostTurn" class="spell-dice-rolling">
              <NumberDice 
                :diceNotation="spellDiceRoll.notation"
                :autoRoll="true"
                :rollDelay="50"
                :forcedResult="spellDiceRoll.result"
                @rolled="onSpellDiceRolled"
                @rolling-finished="onSpellDiceFinished"
              />
            </div>
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
            <span class="stat-value">{{ playerStats.guest.health }}/{{ playerStats.guest.maxHealth }}</span>
          </div>
          <div class="armor-stat">
            <span class="stat-icon">🛡️</span>
            <span class="stat-value">{{ playerStats.guest.armor }}</span>
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
      @triggerReroll="onTriggerReroll"
      @recastSpell="onRecastSpell"
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
const currentTurn = ref(1)
const isHostTurn = ref(true) // Host always starts

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
const isSpellCasting = ref(false)

// Spell dice rolling state
const spellDiceRoll = ref(null) // { notation, spellName, isRolling }

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
      // Update player stats if provided
      if (data.data.playerStats) {
        playerStats.value = data.data.playerStats
      }
      // Use the same message that was sent from the casting player
      setStatusMessage(data.data.castMessage, 'info', 3000)
      break
    case 'dice_used_update':
      // Update dice state immediately when other player casts spells
      playerResources.value[data.data.player] = data.data.playerResources
      setStatusMessage(data.data.castMessage, 'info', 3000)
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
      setStatusMessage(`Rolling ${data.data.notation}...`, 'info', 0)
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
      setStatusMessage(`${isHostTurn.value ? topPlayerName.value : bottomPlayerName.value}'s turn to roll!`, 'info', 3000)
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
    setStatusMessage(`Choose spells to cast or end turn.`, 'success', 5000)
    
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
    setStatusMessage(`${bottomPlayerName.value}'s turn to roll!`, 'info', 3000)
  } else {
    // Guest finished, advance to next turn
    currentTurn.value++
    isHostTurn.value = true
    setStatusMessage(`Turn ${currentTurn.value} - ${topPlayerName.value}'s turn!`, 'info', 3000)
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
  const totalDiceUsed = spells.reduce((total, spell) => total + spell.cost.length, 0)
  const castMessage = `${currentPlayerName.value} cast ${spellNames} using ${totalDiceUsed} dice!`
  
  // Show initial message to casting player
  setStatusMessage(castMessage, 'success', 3000)
  
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
    playerResources: playerResources.value[playerKey],
    castMessage: castMessage
  })

  // Execute each spell using SpellEffects component
  if (spellEffectsRef.value) {
    for (const spell of spells) {
      try {
        const result = await spellEffectsRef.value.executeSpell(spell.name)
        console.log('Spell executed:', result)
      } catch (error) {
        console.error('Error executing spell:', spell.name, error)
        setStatusMessage(`Failed to cast ${spell.name}`, 'error', 3000)
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
  
  // Send spell casting info to other player
  sendGameMessage('spells_cast', {
    player: playerKey,
    spells: spells,
    playerResources: playerResources.value[playerKey],
    playerStats: playerStats.value,
    castMessage: castMessage
  })
}

// Handle end turn from spellbook
const onEndTurn = () => {
  endTurn()
}

// SpellEffects event handlers
const onUpdatePlayerStats = ({ player, updates }) => {
  if (playerStats.value[player]) {
    Object.assign(playerStats.value[player], updates)
  }
}

const onUpdatePlayerResources = ({ player, updates }) => {
  if (playerResources.value[player]) {
    Object.assign(playerResources.value[player], updates)
  }
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

const onTriggerReroll = ({ player, count, message }) => {
  // TODO: Implement reroll mechanism
  setStatusMessage(message, 'info', 5000)
  console.log(`Reroll triggered for ${player}: ${count} dice`)
}

const onRecastSpell = ({ maxCost, message }) => {
  // TODO: Implement recast mechanism
  setStatusMessage(message, 'success', 5000)
  console.log(`Recast available: max cost ${maxCost}`)
}

// Handle spell casting state changes
const onSpellCastingStarted = () => {
  isSpellCasting.value = true
  console.log('Spell casting started - turn ending disabled')
}

const onSpellCastingEnded = () => {
  isSpellCasting.value = false
  console.log('Spell casting ended - turn ending enabled')
  
  // Don't clear spell dice display here - let the last dice roll finish naturally
  // The display will be cleared by the last onSpellDiceFinished call
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
    setStatusMessage('', 'info', 0)
    
    // Notify SpellEffects that the display is finished and next action can start
    if (spellEffectsRef.value) {
      spellEffectsRef.value.onSpellDiceDisplayFinished()
    }
  }, 5000)
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
  min-height: 50px;
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
  padding: 0.5rem 2rem;
  background: rgba(255,255,255,0.1);
  backdrop-filter: blur(10px);
  border-radius: 15px;
  margin: 1rem 0;
  border: 1px solid rgba(255,255,255,0.2);
  flex-shrink: 0;
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

.turn-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
}

.chevron-up, .chevron-down {
  font-size: 1.5rem;
  font-weight: bold;
  color: rgba(255,255,255,0.3);
  transition: all 0.3s ease;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
}

.chevron-up.active, .chevron-down.active {
  color: #ffd700;
  text-shadow: 0 0 10px rgba(255,215,0,0.5), 2px 2px 4px rgba(0,0,0,0.8);
  transform: scale(1.2);
}

.status-message {
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-weight: 500;
  backdrop-filter: blur(10px);
  text-align: center;
  background: rgba(0,0,0,0.6);
  border: 1px solid rgba(255,255,255,0.2);
  font-size: 14px;
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
