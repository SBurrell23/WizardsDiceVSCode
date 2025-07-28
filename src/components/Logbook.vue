<template>
  <div class="logbook">
    <div class="logs-container" ref="logsContainer">
      <div 
        v-for="(log, index) in logs" 
        :key="log.id"
        class="log-entry"
        :class="[`log-${log.type}`, { 'recent': isRecentLog(log) }]"
      >
        <div class="log-timestamp">{{ formatTime(log.timestamp) }}</div>
        <div class="log-content">
          <div class="log-message">{{ log.message }}</div>
          <div v-if="log.details" class="log-details">{{ log.details }}</div>
        </div>
      </div>
      
      <div v-if="logs.length === 0" class="no-logs">
        No game events yet. Start playing to see the action!
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, nextTick } from 'vue'

// Component state
const logs = reactive([])
const logsContainer = ref(null)
let logIdCounter = 0

// Log types for styling and categorization
const LOG_TYPES = {
  GAME_START: 'game-start',
  TURN_START: 'turn',
  DICE_ROLL: 'dice',
  SPELL_CAST: 'spell',
  DAMAGE: 'damage',
  HEAL: 'heal',
  ARMOR: 'armor',
  DEATH: 'death',
  GAME_END: 'game-end',
  SYSTEM: 'system',
  INFO: 'info'
}

// Main logging method
const createLog = (message, options = {}) => {
  const {
    type = LOG_TYPES.INFO,
    details = null,
    playerName = null,
    data = null
  } = options

  const logEntry = {
    id: ++logIdCounter,
    message,
    details,
    type,
    playerName,
    data,
    timestamp: new Date(),
    isRecent: true
  }

  logs.push(logEntry)

  // Mark as not recent after a short time for animation
  setTimeout(() => {
    logEntry.isRecent = false
  }, 3000)

  // Auto-scroll to bottom
  nextTick(() => {
    scrollToBottom()
  })

  // Save to localStorage for persistence
  saveLogs()

  console.log(`Game Log: ${message}`, logEntry)
  return logEntry
}

// Convenience methods for common log types
const logGameStart = (playerNames) => {
  return createLog(
    `Game started with ${playerNames.length} players: ${playerNames.join(', ')}`,
    { type: LOG_TYPES.GAME_START, data: { players: playerNames } }
  )
}

const logTurnStart = (playerName) => {
  return createLog(
    `${playerName}'s turn started`,
    { type: LOG_TYPES.TURN_START, playerName }
  )
}

const logDiceRoll = (playerName, diceResults) => {
  const diceText = diceResults.map(die => `${die.element}${die.number}`).join(', ')
  return createLog(
    `${playerName} rolled dice`,
    { 
      type: LOG_TYPES.DICE_ROLL, 
      playerName,
      details: `Results: ${diceText}`,
      data: { dice: diceResults }
    }
  )
}

const logSpellCast = (playerName, spellName, targetName = null) => {
  const message = targetName 
    ? `${playerName} cast ${spellName} on ${targetName}`
    : `${playerName} cast ${spellName}`
  
  return createLog(
    message,
    { 
      type: LOG_TYPES.SPELL_CAST, 
      playerName,
      data: { spell: spellName, target: targetName }
    }
  )
}

const logDamage = (targetName, damage, sourceName = null) => {
  const message = sourceName
    ? `${targetName} took ${damage} damage from ${sourceName}`
    : `${targetName} took ${damage} damage`
  
  return createLog(
    message,
    { 
      type: LOG_TYPES.DAMAGE, 
      playerName: targetName,
      data: { damage, source: sourceName }
    }
  )
}

const logHeal = (targetName, healing, sourceName = null) => {
  const message = sourceName
    ? `${targetName} was healed for ${healing} by ${sourceName}`
    : `${targetName} was healed for ${healing}`
  
  return createLog(
    message,
    { 
      type: LOG_TYPES.HEAL, 
      playerName: targetName,
      data: { healing, source: sourceName }
    }
  )
}

const logArmor = (playerName, armor) => {
  return createLog(
    `${playerName} gained ${armor} armor`,
    { 
      type: LOG_TYPES.ARMOR, 
      playerName,
      data: { armor }
    }
  )
}

const logDeath = (playerName) => {
  return createLog(
    `${playerName} has been defeated!`,
    { type: LOG_TYPES.DEATH, playerName }
  )
}

const logGameEnd = (winnerName) => {
  return createLog(
    `Game Over! ${winnerName} wins!`,
    { type: LOG_TYPES.GAME_END, playerName: winnerName }
  )
}

// UI methods
const isRecentLog = (log) => {
  return log.isRecent
}

const formatTime = (timestamp) => {
  return timestamp.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit'
  })
}

const scrollToBottom = () => {
  if (logsContainer.value) {
    logsContainer.value.scrollTop = logsContainer.value.scrollHeight
  }
}

// Persistence methods
const saveLogs = () => {
  try {
    const logsData = logs.map(log => ({
      ...log,
      timestamp: log.timestamp.toISOString()
    }))
    localStorage.setItem('wizardsDice_gameLogs', JSON.stringify(logsData))
    localStorage.setItem('wizardsDice_logCounter', logIdCounter.toString())
  } catch (error) {
    console.error('Failed to save logs:', error)
  }
}

const loadLogs = () => {
  try {
    const savedLogs = localStorage.getItem('wizardsDice_gameLogs')
    const savedCounter = localStorage.getItem('wizardsDice_logCounter')
    
    if (savedLogs) {
      const logsData = JSON.parse(savedLogs)
      logs.splice(0, logs.length, ...logsData.map(log => ({
        ...log,
        timestamp: new Date(log.timestamp),
        isRecent: false
      })))
    }
    
    if (savedCounter) {
      logIdCounter = parseInt(savedCounter, 10)
    }
  } catch (error) {
    console.error('Failed to load logs:', error)
  }
}

// Component lifecycle
onMounted(() => {
  loadLogs()
  
  // Auto-scroll to bottom after loading
  nextTick(() => {
    scrollToBottom()
  })
  
  console.log('Logbook mounted')
})

// Create global API
const logbook = {
  createLog,
  logGameStart,
  logTurnStart,
  logDiceRoll,
  logSpellCast,
  logDamage,
  logHeal,
  logArmor,
  logDeath,
  logGameEnd,
  logs,
  LOG_TYPES
}

// Make available globally
if (typeof window !== 'undefined') {
  window.logbook = logbook
}

// Expose for parent components
defineExpose(logbook)
</script>

<style scoped>
.logbook {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.logs-container {
  flex: 1;
  height: 100%;
  overflow-y: auto;
  padding: 15px;
}

.log-entry {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  border-left: 4px solid rgba(255, 255, 255, 0.3);
  transition: all 0.3s ease;
}

.log-entry.recent {
  background: rgba(255, 255, 255, 0.1);
  transform: scale(1.02);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.log-timestamp {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.75rem;
  font-family: monospace;
  min-width: 70px;
  flex-shrink: 0;
}

.log-content {
  flex: 1;
}

.log-message {
  color: white;
  font-size: 0.9rem;
  font-weight: 500;
  margin-bottom: 2px;
}

.log-details {
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.8rem;
  font-style: italic;
}

/* Log type specific styling */
.log-game-start {
  border-left-color: #4ade80;
  background: rgba(74, 222, 128, 0.1);
}

.log-turn {
  border-left-color: #60a5fa;
  background: rgba(96, 165, 250, 0.1);
}

.log-dice {
  border-left-color: #a78bfa;
  background: rgba(167, 139, 250, 0.1);
}

.log-spell {
  border-left-color: #f59e0b;
  background: rgba(245, 158, 11, 0.1);
}

.log-damage {
  border-left-color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.log-heal {
  border-left-color: #10b981;
  background: rgba(16, 185, 129, 0.1);
}

.log-armor {
  border-left-color: #6b7280;
  background: rgba(107, 114, 128, 0.1);
}

.log-death {
  border-left-color: #dc2626;
  background: rgba(220, 38, 38, 0.15);
}

.log-game-end {
  border-left-color: #eab308;
  background: rgba(234, 179, 8, 0.1);
}

.log-system {
  border-left-color: #8b5cf6;
  background: rgba(139, 92, 246, 0.1);
}

.no-logs {
  text-align: center;
  color: rgba(255, 255, 255, 0.6);
  font-style: italic;
  padding: 40px 20px;
  font-size: 0.9rem;
}

/* Scrollbar styling */
.logs-container::-webkit-scrollbar {
  width: 6px;
}

.logs-container::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.logs-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}

.logs-container::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}

/* Responsive adjustments */
@media (max-width: 600px) {
  .logs-container {
    padding: 12px;
  }
  
  .log-entry {
    gap: 10px;
    padding: 6px 10px;
  }
  
  .log-timestamp {
    min-width: 60px;
    font-size: 0.7rem;
  }
  
  .log-message {
    font-size: 0.85rem;
  }
  
  .log-details {
    font-size: 0.75rem;
  }
}
</style>
