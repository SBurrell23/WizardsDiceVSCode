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
        </div>
      </div>
      
      <div v-if="logs.length === 0" class="no-logs">
        No game logs yet. Start playing to see the action!
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, nextTick } from 'vue'

// Persistent logs storage outside component lifecycle
if (!window.gameLogsStore) {
  window.gameLogsStore = {
    logs: ref([]),
    logIdCounter: 0
  }
}

// Component state - reference the persistent store
const logs = window.gameLogsStore.logs
const logsContainer = ref(null)

// Main logging method - simplified with color-based types
const createLog = (message, colorType = 'grey') => {
  const logEntry = reactive({
    id: ++window.gameLogsStore.logIdCounter,
    message,
    type: colorType,
    timestamp: new Date(),
    isRecent: true
  })

  // Add to the beginning of the array (newest at top)
  logs.value.unshift(logEntry)

  // Mark as not recent after a short time for animation
  setTimeout(() => {
    logEntry.isRecent = false
  }, 3000)

  // Auto-scroll to top to show newest log
  nextTick(() => {
    scrollToTop()
  })

  console.log(`Game Log: ${message}`, logEntry)
  return logEntry
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

const scrollToTop = () => {
  if (logsContainer.value) {
    logsContainer.value.scrollTop = 0
  }
}

// Clear all logs
const clearLogs = () => {
  logs.value.splice(0, logs.value.length)
  window.gameLogsStore.logIdCounter = 0
  console.log('Game logs cleared')
}

// Component lifecycle - only clear logs when explicitly requested, not on mount
onMounted(() => {
  console.log('Logbook mounted - using persistent logs store')
  // Auto-scroll to top to show newest logs
  nextTick(() => {
    scrollToTop()
  })
})

onUnmounted(() => {
  console.log('Logbook unmounted - logs persist in global store')
})

// Create global API - simplified to just the main logging function
const logbook = {
  createLog,
  clearLogs,
  logs
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
}

/* Log type specific styling - color-based */
.log-red {
  border-left-color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.log-green {
  border-left-color: #10b981;
  background: rgba(16, 185, 129, 0.1);
}

.log-blue {
  border-left-color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
}

.log-yellow {
  border-left-color: #f59e0b;
  background: rgba(245, 158, 11, 0.1);
}

.log-purple {
  border-left-color: #8b5cf6;
  background: rgba(139, 92, 246, 0.1);
}

.log-grey {
  border-left-color: #6b7280;
  background: rgba(107, 114, 128, 0.1);
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
