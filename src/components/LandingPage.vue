<template>
  <div class="landing-page">
    <!-- Show title and container only when NOT in game -->
    <div v-if="currentView !== 'game'" class="container">
      <!-- Game Title -->
      <div class="game-title">
        <h1>🎲 Wizards Dice 🧙‍♂️</h1>
        <p class="subtitle">Cast your dice... then cast your spells!</p>
      </div>

      <!-- Main Menu -->
      <div v-if="currentView === 'menu'" class="menu-section">
        <div class="button-group">
          <button 
            class="menu-button host-button"
            @click="createRoom"
            :disabled="isCreatingRoom"
          >
            <div class="button-icon">🏰</div>
            <div class="button-text">
              <h3>Create Room</h3>
              <p>Start a new game and invite a friend</p>
            </div>
          </button>
        </div>

        <!-- Join Room Section -->
        <div class="join-section">
          <div class="join-input-group">
            <input
              v-model="joinRoomCode"
              type="text"
              placeholder="Enter room code..."
              class="room-code-input"
              @keyup.enter="joinRoom"
              maxlength="6"
            />
            <button 
              @click="joinRoom" 
              class="join-button"
              :disabled="!joinRoomCode"
            >
              ⚔️ Join Room
            </button>
          </div>
        </div>
      </div>

      <!-- Host Room View -->
      <div v-if="currentView === 'hosting'" class="menu-section">
        <div class="room-code-display">
          <h3>Room Created!</h3>
          <div class="room-code">
            <span class="code">{{ roomCode }}</span>
            <button @click="copyRoomCode" class="copy-button">📋 Copy</button>
          </div>
          <p class="waiting-text">
            <span v-if="connectedPlayers.length === 0">Waiting for a player to join...</span>
            <span v-else-if="connectedPlayers.length === 1">Ready to start! 🎲</span>
          </p>
          <div class="connected-players">
            <h4>Players ({{ connectedPlayers.length + 1 }}/2):</h4>
            <ul>
              <li>👑 You (Host)</li>
              <li v-for="player in connectedPlayers" :key="player.id">
                🧙‍♂️ {{ ENEMY_WIZARD_NAME }}
              </li>
            </ul>
          </div>
          <div class="room-buttons">
            <button 
              v-if="connectedPlayers.length === 1" 
              @click="startGame"
              class="start-game-button"
            >
              🎲 Start Game
            </button>
            <button @click="leaveRoom" class="leave-room-button">
              🚪 Close Room
            </button>
          </div>
        </div>
      </div>

      <!-- Joined Room View -->
      <div v-if="currentView === 'joined'" class="menu-section">
        <div class="room-code-display">
          <h3>Joined Room: {{ roomCode }}</h3>
          <div class="connected-players">
            <h4>Players ({{ connectedPlayers.length + 1 }}/2):</h4>
            <ul>
              <li>👑 {{ ENEMY_WIZARD_NAME }} (Host)</li>
              <li>🧙‍♂️ You (You)</li>
              <li v-for="player in connectedPlayers" :key="player.id">
                <span v-if="player.id !== peer?.id">🧙‍♂️ {{ ENEMY_WIZARD_NAME }}</span>
              </li>
            </ul>
          </div>
          <p class="waiting-text">Waiting for host to start the game...</p>
          <button @click="leaveRoom" class="leave-room-button">
            🚪 Leave Room
          </button>
        </div>
      </div>

      <!-- Status Messages -->
      <div v-if="statusMessage" class="status-message" :class="statusType">
        {{ statusMessage }}
      </div>
    </div>

    <!-- Game Board View - Full screen without title -->
    <GameBoard 
      v-if="currentView === 'game'"
      :peer-instance="peer"
      :room-code="roomCode"
      :is-host="isHost"
      :host-name="isHost ? 'You' : ENEMY_WIZARD_NAME"
      :guest-name="isHost ? ENEMY_WIZARD_NAME : 'You'"
      :connection="hostConnection"
      @leave-game="leaveRoom"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import Peer from 'peerjs'
import GameBoard from './GameBoard.vue'

// Constants
const ENEMY_WIZARD_NAME = 'Enemy'

// Reactive data
const isCreatingRoom = ref(false)
const roomCode = ref('')
const joinRoomCode = ref('')
const hostName = ref('') // Store the host's name when joining a room
const connectedPlayers = ref([])
const statusMessage = ref('')
const statusType = ref('info') // 'info', 'success', 'error'
const currentView = ref('menu') // 'menu', 'hosting', 'joined', 'game'
const hostConnection = ref(null) // Connection to host when joined as player
const isHost = ref(false) // Track if current player is the host

// PeerJS instances
let peer = null
let connections = []
let statusTimeout = null // Track the status message timeout

// Helper function to set status message with timeout
const setStatusMessage = (message, type, duration = 3000) => {
  // Clear any existing timeout
  if (statusTimeout) {
    clearTimeout(statusTimeout)
    statusTimeout = null
  }
  
  statusMessage.value = message
  statusType.value = type
  
  if (duration > 0) {
    statusTimeout = setTimeout(() => {
      statusMessage.value = ''
      statusTimeout = null
    }, duration)
  }
}

// Create a new room (host)
const createRoom = async () => {
  isCreatingRoom.value = true
  setStatusMessage('Creating room...', 'info', 0)

  try {
    // Generate a random 6-character room code
    const code = Math.random().toString(36).substring(2, 8).toUpperCase()
    
    // Create peer with the room code as ID
    peer = new Peer(code)
    
    peer.on('open', (id) => {
      roomCode.value = id
      isCreatingRoom.value = false
      currentView.value = 'hosting'
      isHost.value = true // Set as host when room is created
      setStatusMessage('Room created successfully!', 'success', 3000)
    })

    peer.on('connection', (conn) => {
      // Check if room is already full (max 1 other player besides host)
      if (connectedPlayers.value.length >= 1) {
        // Send room full message and close connection
        conn.on('open', () => {
          conn.send({ type: 'room_full', message: 'This room is full. Wizards Dice is a 2-player game.' })
        })
        return
      }

      connections.push(conn)
      
      conn.on('open', () => {
        const playerData = {
          id: conn.peer,
          name: conn.metadata?.name || ENEMY_WIZARD_NAME
        }
        connectedPlayers.value.push(playerData)
        
        // Send host info and updated player list to the joining player
        conn.send({ 
          type: 'host_info', 
          hostName: 'You' 
        })
        
        // Send updated player list to all connected players
        broadcastPlayerList()
        
        setStatusMessage(`${playerData.name} joined the room!`, 'success', 3000)
      })

      conn.on('close', () => {
        const leavingPlayer = connectedPlayers.value.find(p => p.id === conn.peer)
        connectedPlayers.value = connectedPlayers.value.filter(p => p.id !== conn.peer)
        connections = connections.filter(c => c.peer !== conn.peer)
        
        // Send updated player list to remaining players
        broadcastPlayerList()
        
        setStatusMessage(`${leavingPlayer?.name || 'A player'} left the room`, 'info', 3000)
      })
    })

    peer.on('error', (error) => {
      console.error('Peer error:', error)
      setStatusMessage('Error creating room. Please try again.', 'error', 5000)
      isCreatingRoom.value = false
    })

  } catch (error) {
    console.error('Error creating room:', error)
    setStatusMessage('Failed to create room. Please try again.', 'error', 5000)
    isCreatingRoom.value = false
  }
}

// Join an existing room
const joinRoom = async () => {
  if (!joinRoomCode.value) return

  setStatusMessage('Joining room...', 'info', 0) // No timeout for joining message

  try {
    // Create peer for joining
    peer = new Peer()
    
    peer.on('open', () => {
      // Connect to the host
      const conn = peer.connect(joinRoomCode.value.toUpperCase(), {
        metadata: { name: 'You' }
      })
      
      hostConnection.value = conn
      
      conn.on('open', () => {
        setStatusMessage('Successfully joined the room!', 'success', 3000)
        currentView.value = 'joined'
        roomCode.value = joinRoomCode.value.toUpperCase()
        isHost.value = false // Set as guest when joining a room
        // Clear the join room code input after successful join
        joinRoomCode.value = ''
      })

      conn.on('data', (data) => {
        // Handle messages from host
        if (data.type === 'host_info') {
          hostName.value = data.hostName
        } else if (data.type === 'player_list') {
          connectedPlayers.value = data.players
        } else if (data.type === 'start_game') {
          setStatusMessage('Game is starting!', 'success', 1000)
          // Navigate to game board
          setTimeout(() => {
            currentView.value = 'game'
          }, 1000)
        } else if (data.type === 'room_full') {
          conn.close()
          setStatusMessage(data.message, 'error', 5000)
        }
      })

      conn.on('error', (error) => {
        console.error('Connection error:', error)
        setStatusMessage('Failed to join room. Check the room code and try again.', 'error', 5000)
      })

      conn.on('close', () => {
        // Only show connection lost message if we were actually in a room
        if (currentView.value === 'joined') {
          setStatusMessage('Connection to host lost. Returning to main menu.', 'error', 3000)
          leaveRoom()
        } else {
          // This happens when room is full - connection gets closed immediately
          setStatusMessage('This room is full. Wizards Dice is a 2-player game.', 'error', 5000)
          
          // Clean up the failed connection
          if (peer) {
            peer.destroy()
            peer = null
          }
          hostConnection.value = null
        }
      })
    })

    peer.on('error', (error) => {
      console.error('Peer error:', error)
      setStatusMessage('Room not found. Please check the room code.', 'error', 5000)
    })

  } catch (error) {
    console.error('Error joining room:', error)
    setStatusMessage('Failed to join room. Please try again.', 'error', 5000)
  }
}

// Copy room code to clipboard
const copyRoomCode = async () => {
  try {
    await navigator.clipboard.writeText(roomCode.value)
    setStatusMessage('Room code copied to clipboard!', 'success', 2000)
  } catch (error) {
    console.error('Failed to copy room code:', error)
  }
}

// Broadcast start game message to all connected players
const startGame = () => {
  connections.forEach(conn => {
    conn.send({ type: 'start_game' })
  })
  
  setStatusMessage('Starting game...', 'success', 1000)
  
  // Navigate to game board after brief delay
  setTimeout(() => {
    currentView.value = 'game'
  }, 1000)
}

// Broadcast player list to all connected players (host only)
const broadcastPlayerList = () => {
  const playerList = connectedPlayers.value.map(p => ({ id: p.id, name: p.name }))
  connections.forEach(conn => {
    if (conn.open) {
      conn.send({ type: 'player_list', players: playerList })
    }
  })
}

// Leave room and return to main menu
const leaveRoom = () => {
  // Clear any status timeout
  if (statusTimeout) {
    clearTimeout(statusTimeout)
    statusTimeout = null
  }
  
  // Close all connections
  if (hostConnection.value && hostConnection.value.open) {
    hostConnection.value.close()
  }
  
  connections.forEach(conn => {
    if (conn.open) {
      conn.close()
    }
  })
  
  // Destroy peer
  if (peer) {
    peer.destroy()
    peer = null
  }
  
  // Reset all state
  currentView.value = 'menu'
  roomCode.value = ''
  joinRoomCode.value = ''
  hostName.value = ''
  connectedPlayers.value = []
  hostConnection.value = null
  connections = []
  statusMessage.value = ''
  isHost.value = false // Reset host status
}

// Cleanup on component unmount
onUnmounted(() => {
  leaveRoom()
})
</script>

<style scoped>
.landing-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Inter', sans-serif;
}

.container {
  max-width: 600px;
  width: 100%;
  text-align: center;
}

.game-title h1 {
  font-size: 3rem;
  color: white;
  margin-bottom: 0.5rem;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
  font-weight: 700;
}

.subtitle {
  color: rgba(255,255,255,0.9);
  font-size: 1.1rem;
  margin-bottom: 3rem;
  line-height: 1.5;
}

.menu-section {
  background: rgba(255,255,255,0.05);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  padding: 2rem;
  border: 1px solid rgba(255,255,255,0.2);
  box-shadow: 0 8px 32px rgba(0,0,0,0.1);
}

.button-group {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 2rem;
}

.name-section {
  margin-bottom: 0rem;
  margin-top: 4rem;
}

.name-section h3 {
  color: rgb(244, 244, 244);
  margin-bottom: 1rem;
  font-size: 1.2rem;
}

.player-name-input {
  width: 100%;
  padding: 1rem;
  border: 2px solid rgba(255,255,255,0.3);
  border-radius: 10px;
  font-size: 1rem;
  background: rgba(255,255,255,0.9);
  color: #333;
  transition: border-color 0.3s ease;
  box-sizing: border-box;
}

.player-name-input:focus {
  outline: none;
  border-color: #667eea;
}

.join-section {
  margin-bottom: 1rem;
}

.join-section h3 {
  color: white;
  margin-bottom: 1rem;
  font-size: 1.2rem;
}

.join-input-group {
  display: flex;
  gap: 0.5rem;
  align-items: stretch;
}

.room-code-input {
  flex: 1;
  padding: 1rem;
  border: 2px solid rgba(255,255,255,0.3);
  border-radius: 10px;
  font-size: 1rem;
  background: rgba(255,255,255,0.9);
  color: #333;
  transition: border-color 0.3s ease;
}

.room-code-input:focus {
  outline: none;
  border-color: #667eea;
}

.join-button {
  background: white;
  color: #333;
  border: none;
  padding: 1rem 1.5rem;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  white-space: nowrap;
  box-shadow: 0 4px 15px rgba(0,0,0,0.1);
}

.join-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0,0,0,0.15);
  background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
}

.join-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.menu-button {
  display: flex;
  align-items: center;
  background: white;
  border: none;
  border-radius: 15px;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(0,0,0,0.1);
  text-align: left;
}

.menu-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0,0,0,0.15);
}

.menu-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.host-button:hover {
  background: linear-gradient(135deg, #ff9a9e 0%, #fad0c4 100%);
}

.join-button:hover {
  background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
}

.button-icon {
  font-size: 2.5rem;
  margin-right: 1rem;
}

.button-text h3 {
  margin: 0 0 0.5rem 0;
  color: #333;
  font-size: 1.2rem;
}

.button-text p {
  margin: 0;
  color: #666;
  font-size: 0.9rem;
}

.room-code-display {
  background: rgba(255,255,255,0.9);
  border-radius: 15px;
  padding: 1.5rem;
  margin-top: 0rem;
}

.room-code-display h3 {
  color: #333;
  margin-bottom: 1rem;
}

.room-code {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.code {
  font-family: 'Courier New', monospace;
  font-size: 1.5rem;
  font-weight: bold;
  color: #667eea;
  background: rgba(102,126,234,0.1);
  padding: 0.5rem 1rem;
  border-radius: 8px;
  letter-spacing: 2px;
}

.copy-button {
  background: #667eea;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.3s ease;
}

.copy-button:hover {
  background: #5a6fd8;
}

.waiting-text {
  color: #666;
  margin-bottom: 1rem;
}

.connected-players {
  text-align: left;
  margin-bottom: 1rem;
}

.connected-players h4 {
  color: #333;
  margin-bottom: 0.5rem;
}

.connected-players ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.connected-players li {
  padding: 0.25rem 0;
  color: #555;
}

.start-game-button {
  background: #20a037;
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 10px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-right: 1rem;
}

.start-game-button:hover {
  transform: translateY(-2px);
  background: #1c8c30;
}

.leave-room-button {
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%);
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 10px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.3s ease;
}

.leave-room-button:hover {
  transform: translateY(-2px);
  background: linear-gradient(135deg, #ee5a52 0%, #dc4c41 100%);
}

.room-buttons {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.status-message {
  margin-top: 1rem;
  padding: 1rem;
  border-radius: 10px;
  font-weight: 500;
}

.status-message.info {
  background: rgba(102,126,234,0.6);
  color: white;
  border: 1px solid rgba(102,126,234,1);
}

.status-message.success {
  background: rgba(46,160,67,0.6);
  color: white;
  border: 1px solid rgba(46,160,67,1);
}

.status-message.error {
  background: rgba(248,81,73,0.6);
  color: white;
  border: 1px solid rgba(248,81,73,1);
}

@media (min-width: 768px) {
  .join-input-group {
    max-width: 400px;
    margin: 0 auto;
  }
}
</style>