<template>
  <div></div>
</template>

<script setup>
import { ref } from 'vue'

// Props
const props = defineProps({
  // Game context passed from GameBoard
  playerStats: {
    type: Object,
    required: true
  },
  playerResources: {
    type: Object,
    required: true
  },
  currentPlayer: {
    type: String,
    required: true
  },
  opponentPlayer: {
    type: String,
    required: true
  }
})

// Emits
const emit = defineEmits([
  'updatePlayerStats',
  'updatePlayerResources', 
  'showMessage',
  'triggerReroll',
  'recastSpell',
  'requestDiceRoll'
])

// Reactive data for tracking effects
const diceRollResult = ref(null)
const pendingSpellExecution = ref(null) // Track spell waiting for dice result
const diceRollQueue = ref([]) // Queue for multiple dice rolls

// Helper function to update player stats
const updateStats = (player, updates) => {
  emit('updatePlayerStats', { player, updates })
}

// Helper function to show message
const showMessage = (message, type = 'info') => {
  emit('showMessage', { message, type })
}

// Helper function to request dice roll from GameBoard
const requestDiceRoll = async (notation) => {
  return new Promise((resolve) => {
    // Add this request to the queue
    diceRollQueue.value.push({
      notation,
      resolver: resolve
    })
    
    // If this is the only item in queue, start processing it
    if (diceRollQueue.value.length === 1) {
      processNextDiceRoll()
    }
  })
}

// Process the next dice roll in the queue
const processNextDiceRoll = () => {
  if (diceRollQueue.value.length === 0) return
  
  const currentRoll = diceRollQueue.value[0]
  
  // Store the current execution context
  pendingSpellExecution.value = {
    resolver: currentRoll.resolver
  }
  
  // Request GameBoard to show NumberDice
  emit('requestDiceRoll', { notation: currentRoll.notation })
}

// Helper function to roll multiple dice sequentially (e.g., "2d6" becomes two "1d6" rolls)
const requestMultipleDiceRolls = async (notation) => {
  const [count, sides] = notation.split('d').map(Number)
  const results = []
  
  for (let i = 0; i < count; i++) {
    const rollNotation = `1d${sides}`
    const result = await requestDiceRoll(rollNotation)
    results.push(result.value)
  }
  
  return {
    notation,
    count,
    sides,
    individual: results,
    total: results.reduce((sum, value) => sum + value, 0)
  }
}

// Method to be called by GameBoard when dice roll completes
const handleDiceRollResult = (result) => {
  if (pendingSpellExecution.value && pendingSpellExecution.value.resolver) {
    diceRollResult.value = result
    // DON'T resolve the promise yet - store the result and resolver for later
    pendingSpellExecution.value.result = result
    // The promise will be resolved in onSpellDiceDisplayFinished
  }
}

// Method to be called when spell dice display is finished (after 5-second delay)
const onSpellDiceDisplayFinished = () => {
  // Resolve the current pending promise with the stored result
  if (pendingSpellExecution.value && pendingSpellExecution.value.resolver && pendingSpellExecution.value.result) {
    pendingSpellExecution.value.resolver(pendingSpellExecution.value.result)
    pendingSpellExecution.value = null
    
    // Remove the completed roll from queue
    diceRollQueue.value.shift()
    
    // Process next roll in queue if any
    if (diceRollQueue.value.length > 0) {
      // Small delay to ensure clean state
      setTimeout(() => {
        processNextDiceRoll()
      }, 100)
    }
  }
}

// ============================================================================
// SPELL IMPLEMENTATIONS - First 4 one-cost spells
// ============================================================================

// Ember: Deal 2 damage
const ember = async () => {
  const damage = 2
  const targetStats = props.playerStats[props.opponentPlayer]
  const currentArmor = targetStats.armor || 0
  const currentHealth = targetStats.health || 0
  
  let remainingDamage = damage
  let newArmor = currentArmor
  let newHealth = currentHealth
  
  // First, damage armor
  if (currentArmor > 0) {
    const armorDamage = Math.min(remainingDamage, currentArmor)
    newArmor = currentArmor - armorDamage
    remainingDamage -= armorDamage
  }
  
  // Then, damage health with any remaining damage
  if (remainingDamage > 0) {
    newHealth = Math.max(0, currentHealth - remainingDamage)
  }
  
  updateStats(props.opponentPlayer, { armor: newArmor, health: newHealth })
  
  const armorLost = currentArmor - newArmor
  const healthLost = currentHealth - newHealth
  
  if (armorLost > 0 && healthLost > 0) {
    showMessage(`🔥 Ember removes ${armorLost} armor and deals ${healthLost} damage!`, 'damage')
  } else if (armorLost > 0) {
    showMessage(`🔥 Ember removes ${armorLost} armor!`, 'damage')
  } else if (healthLost > 0) {
    showMessage(`🔥 Ember deals ${healthLost} damage!`, 'damage')
  }
}

// Splash: Roll (1d4), a 3 or 4 lets you recast a 1 cost spell at no cost
const splash = async () => {
  const roll = await requestDiceRoll('1d4')
  
  if (roll.value >= 3) {
    showMessage(`💧 Splash rolled ${roll.value}! You can recast a 1-cost spell for free!`, 'success')
    
    // Emit event to allow recasting
    emit('recastSpell', { 
      maxCost: 1, 
      message: 'Choose a 1-cost spell to recast for free' 
    })
  } else {
    showMessage(`💧 Splash rolled ${roll.value}. No effect.`, 'info')
  }
}

// Protect: Gain 2 armour
const protect = async () => {
  const armor = 2
  const currentStats = props.playerStats[props.currentPlayer]
  const newArmor = (currentStats.armor || 0) + armor
  
  updateStats(props.currentPlayer, { armor: newArmor })
  showMessage(`🌍 Protect grants ${armor} armor!`, 'buff')
}

// Gust: Re-roll 1 unspent dice
const gust = async () => {
  // Test sequential dice rolling
  const roll1 = await requestDiceRoll('1d4')
  const roll2 = await requestDiceRoll('1d6')
  const roll3 = await requestDiceRoll('1d8')
  const roll4 = await requestDiceRoll('1d10')
  const roll5 = await requestDiceRoll('1d12')
  const roll6 = await requestDiceRoll('1d20')
  
  showMessage(`💨 Gust test: d4 rolled ${roll1.value}, d6 rolled ${roll2.value}`, 'info')

  // Find unspent dice for current player
  const playerKey = props.currentPlayer
  const unspentDice = props.playerResources[playerKey]?.filter(dice => !dice.used) || []
  
  if (unspentDice.length === 0) {
    showMessage(`💨 Gust has no unspent dice to reroll!`, 'warning')
    return
  }
  
  showMessage(`💨 Gust lets you reroll 1 unspent die!`, 'utility')
  
  // Emit event to trigger reroll mechanism
  emit('triggerReroll', { 
    player: props.currentPlayer, 
    count: 1,
    message: 'Choose 1 die to reroll'
  })
}

// Heal: Heal 2 HP
const heal = async () => {
  const healing = 2
  const currentStats = props.playerStats[props.currentPlayer]
  const currentHealth = currentStats.health || 0
  const maxHealth = currentStats.maxHealth // Use actual maxHealth from playerStats only
  
  const newHealth = Math.min(maxHealth, currentHealth + healing)
  const actualHealing = newHealth - currentHealth
  
  updateStats(props.currentPlayer, { health: newHealth })
  
  if (actualHealing > 0) {
    showMessage(`💖 Heal restores ${actualHealing} HP!`, 'healing')
  } else {
    showMessage(`💖 Heal has no effect - already at full health!`, 'info')
  }
}

// Blood Magic: Deal (1d4) damage, take 2 damage
const bloodMagic = async () => {
  // Roll damage dealt to opponent
  const damageRoll = await requestDiceRoll('1d4')
  const damageDealt = damageRoll.value
  const selfDamage = 2
  
  // Apply damage to opponent
  const targetStats = props.playerStats[props.opponentPlayer]
  const currentTargetArmor = targetStats.armor || 0
  const currentTargetHealth = targetStats.health || 0
  
  let remainingDamage = damageDealt
  let newTargetArmor = currentTargetArmor
  let newTargetHealth = currentTargetHealth
  
  // First, damage opponent's armor
  if (currentTargetArmor > 0) {
    const armorDamage = Math.min(remainingDamage, currentTargetArmor)
    newTargetArmor = currentTargetArmor - armorDamage
    remainingDamage -= armorDamage
  }
  
  // Then, damage opponent's health
  if (remainingDamage > 0) {
    newTargetHealth = Math.max(0, currentTargetHealth - remainingDamage)
  }
  
  updateStats(props.opponentPlayer, { armor: newTargetArmor, health: newTargetHealth })
  
  // Apply self damage (armor absorbs this too)
  const casterStats = props.playerStats[props.currentPlayer]
  const currentCasterArmor = casterStats.armor || 0
  const currentCasterHealth = casterStats.health || 0
  
  let remainingSelfDamage = selfDamage
  let newCasterArmor = currentCasterArmor
  let newCasterHealth = currentCasterHealth
  
  // Self damage hits armor first
  if (currentCasterArmor > 0) {
    const selfArmorDamage = Math.min(remainingSelfDamage, currentCasterArmor)
    newCasterArmor = currentCasterArmor - selfArmorDamage
    remainingSelfDamage -= selfArmorDamage
  }
  
  // Then self damage hits health
  if (remainingSelfDamage > 0) {
    newCasterHealth = Math.max(0, currentCasterHealth - remainingSelfDamage)
  }
  
  updateStats(props.currentPlayer, { armor: newCasterArmor, health: newCasterHealth })
  
  // Show appropriate messages
  const opponentArmorLost = currentTargetArmor - newTargetArmor
  const opponentHealthLost = currentTargetHealth - newTargetHealth
  const casterArmorLost = currentCasterArmor - newCasterArmor
  const casterHealthLost = currentCasterHealth - newCasterHealth
  
  if (opponentArmorLost > 0 && opponentHealthLost > 0) {
    showMessage(`💀 Blood Magic rolled ${damageDealt}! Removes ${opponentArmorLost} armor and deals ${opponentHealthLost} damage to opponent!`, 'damage')
  } else if (opponentArmorLost > 0) {
    showMessage(`💀 Blood Magic rolled ${damageDealt}! Removes ${opponentArmorLost} armor from opponent!`, 'damage')
  } else if (opponentHealthLost > 0) {
    showMessage(`💀 Blood Magic rolled ${damageDealt}! Deals ${opponentHealthLost} damage to opponent!`, 'damage')
  }
  
  if (casterArmorLost > 0 && casterHealthLost > 0) {
    showMessage(`💀 Blood Magic's cost: loses ${casterArmorLost} armor and takes ${casterHealthLost} damage!`, 'warning')
  } else if (casterArmorLost > 0) {
    showMessage(`💀 Blood Magic's cost: loses ${casterArmorLost} armor!`, 'warning')
  } else if (casterHealthLost > 0) {
    showMessage(`💀 Blood Magic's cost: takes ${casterHealthLost} damage!`, 'warning')
  }
}

// ============================================================================
// MAIN SPELL EXECUTION METHOD
// ============================================================================

const executeSpell = async (spellName) => {
  console.log(`Executing spell: ${spellName}`)
  
  try {
    switch (spellName) {
      case 'Ember':
        await ember()
        break
      case 'Splash':
        await splash()
        break
      case 'Protect':
        await protect()
        break
      case 'Gust':
        await gust()
        break
      case 'Heal':
        await heal()
        break
      case 'Blood Magic':
        await bloodMagic()
        break
      default:
        console.warn(`Spell "${spellName}" not implemented yet`)
        showMessage(`${spellName} is not implemented yet`, 'warning')
    }
  } catch (error) {
    console.error(`Error executing spell ${spellName}:`, error)
    showMessage(`Failed to cast ${spellName}`, 'error')
  }
}

// Expose the execute method to parent component
defineExpose({
  executeSpell,
  handleDiceRollResult,
  onSpellDiceDisplayFinished,
  diceRollResult
})
</script>

<style scoped>
/* No visible template, this is a logic-only component */
</style>
