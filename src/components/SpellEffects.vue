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
  'requestDiceRoll',
  'spellCastingStarted',
  'spellCastingEnded'
])

// Reactive data for tracking effects
const diceRollResult = ref(null)
const pendingDiceRoll = ref(null) // Track current dice roll promise
const isSpellCasting = ref(false) // Track if a spell is currently being cast

// Helper function to update player stats
const updateStats = (player, updates) => {
  emit('updatePlayerStats', { player, updates })
}

// Helper function to show message
const showMessage = (message, type = 'info') => {
  emit('showMessage', { message, type })
}

// Helper function to deal damage to a player (handles armor reduction first)
const dealDamage = (damage, player) => {
  const targetStats = props.playerStats[player]
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
  
  updateStats(player, { armor: newArmor, health: newHealth })
  
  // Return damage breakdown for messaging
  const armorLost = currentArmor - newArmor
  const healthLost = currentHealth - newHealth
  
  return { armorLost, healthLost, totalDamage: armorLost + healthLost }
}

// Helper function to heal a player's health (respects max health)
const healHP = (healing, player) => {
  const currentStats = props.playerStats[player]
  const currentHealth = currentStats.health || 0
  const maxHealth = currentStats.maxHealth || 25
  
  const newHealth = Math.min(maxHealth, currentHealth + healing)
  const actualHealing = newHealth - currentHealth
  
  updateStats(player, { health: newHealth })
  
  return { actualHealing, wasAtFullHealth: actualHealing === 0 }
}

// Helper function to grant armor to a player
const gainArmor = (armor, player) => {
  const currentStats = props.playerStats[player]
  const currentArmor = currentStats.armor || 0
  const newArmor = currentArmor + armor
  
  updateStats(player, { armor: newArmor })
  
  return { armorGained: armor, newTotalArmor: newArmor }
}

// Helper function to request dice roll from GameBoard
const requestDiceRoll = async (notation) => {
  console.log('SpellEffects requesting dice roll:', notation)
  return new Promise((resolve) => {
    // Store the resolver for this dice roll
    pendingDiceRoll.value = { resolve }
    
    // Request GameBoard to show NumberDice
    emit('requestDiceRoll', { notation })
  })
}

// Method to be called by GameBoard when dice roll completes
const handleDiceRollResult = (result) => {
  if (pendingDiceRoll.value) {
    diceRollResult.value = result
    pendingDiceRoll.value.result = result
  }
}

// Method to be called when spell dice display is finished (after 5-second delay)
const onSpellDiceDisplayFinished = () => {
  if (pendingDiceRoll.value && pendingDiceRoll.value.result) {
    pendingDiceRoll.value.resolve(pendingDiceRoll.value.result)
    pendingDiceRoll.value = null
  } else {
    console.log('SpellEffects: no pending dice roll to resolve')
  }
}

// ============================================================================
// SPELL IMPLEMENTATIONS
// ============================================================================

// Ember: Deal 2 damage
const ember = async () => {
  dealDamage(2, props.opponentPlayer)
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
  gainArmor(2, props.currentPlayer)
}

// Gust: Re-roll 1 unspent dice
const gust = async () => {
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
  healHP(2, props.currentPlayer)
}

// Blood Magic: Deal (1d4) damage, take 2 damage
const bloodMagic = async () => {
  // Roll damage dealt to opponent
  const damageRoll = await requestDiceRoll('1d4')
  const damageDealt = damageRoll.value
  const selfDamage = 2
  
  // Apply damage to opponent
  const opponentDamage = dealDamage(damageDealt, props.opponentPlayer)
  
  // Apply self damage
  const selfDamageResult = dealDamage(selfDamage, props.currentPlayer)
  
  // Show appropriate messages for opponent damage
  if (opponentDamage.armorLost > 0 && opponentDamage.healthLost > 0) {
    showMessage(`💀 Blood Magic removes ${opponentDamage.armorLost} armor and deals ${opponentDamage.healthLost} damage to opponent!`, 'damage')
  } else if (opponentDamage.armorLost > 0) {
    showMessage(`💀 Blood Magic removes ${opponentDamage.armorLost} armor from opponent!`, 'damage')
  } else if (opponentDamage.healthLost > 0) {
    showMessage(`💀 Blood Magic deals ${opponentDamage.healthLost} damage to opponent!`, 'damage')
  }
}

// ============================================================================
// MAIN SPELL EXECUTION METHOD
// ============================================================================

const executeSpell = async (spellName) => {
  console.log(`Executing spell: ${spellName}`)
  
  // Set spell casting state and notify parent
  isSpellCasting.value = true
  emit('spellCastingStarted')
  
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
  } finally {
    // Clear spell casting state and notify parent
    isSpellCasting.value = false
    emit('spellCastingEnded')
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
