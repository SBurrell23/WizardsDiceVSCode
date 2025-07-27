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
  'recastSpell',
  'requestDiceRoll',
  'requestElementDiceReroll',
  'spellCastingStarted',
  'spellCastingEnded'
])

// Reactive data for tracking effects
const diceRollResult = ref(null)
const pendingDiceRoll = ref(null) // Track current dice roll promise
const pendingElementDiceReroll = ref(null) // Track current element dice reroll promise
const isSpellCasting = ref(false) // Track if a spell is currently being cast

// Helper function to update player stats
const updateStats = (player, updates) => {
  emit('updatePlayerStats', { player, updates })
}

// Helper function to show message
const showMessage = (message, type = 'info') => {
  emit('showMessage', { message, type })
}

// Helper function to update player resources
const updateResources = (player, updates) => {
  emit('updatePlayerResources', { player, updates })
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

// Helper function to request element dice reroll from GameBoard
const requestElementDiceReroll = async (diceFilter, maxRerolls = 1, message = 'Select element dice to reroll') => {
  console.log('SpellEffects requesting element dice reroll:', { diceFilter, maxRerolls, message })
  return new Promise((resolve) => {
    // Store the resolver for this element dice reroll
    pendingElementDiceReroll.value = { resolve }
    
    // Request GameBoard to enter element dice selection mode
    emit('requestElementDiceReroll', { 
      diceFilter,     // Function or criteria to filter which element dice can be selected
      maxRerolls,     // Maximum number of dice that can be rerolled
      message         // Message to show the player
    })
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

// Method to be called by GameBoard when dice reroll completes
const handleElementDiceRerollResult = (rerolledDice) => {
  if (pendingElementDiceReroll.value) {
    console.log('SpellEffects: element dice reroll completed', rerolledDice)
    pendingElementDiceReroll.value.resolve(rerolledDice)
    pendingElementDiceReroll.value = null
  } else {
    console.log('SpellEffects: no pending element dice reroll to resolve')
  }
}

// Helper function to convert spell name to method name (camelCase, no spaces)
const getMethodName = (spellName) => {
  return spellName
    .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special characters except spaces
    .split(' ')
    .map((word, index) => {
      if (index === 0) {
        return word.toLowerCase()
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join('')
}

// ============================================================================
// SPELL IMPLEMENTATIONS
// ============================================================================

// ============================================================================
// 1-COST SPELLS
// ============================================================================

// Ember: Deal 2 damage
const ember = async () => {
  dealDamage(2, props.opponentPlayer)
}

// Splash: Roll (1d4), a 3 or 4 casts another random 1 cost spell
const splash = async () => {
  const roll = await requestDiceRoll('1d4')
  
  if (roll.value > 2) {
    // List of 1-cost spells
    const oneCostSpells = ['Ember', 'Protect', 'Gust', 'Heal', 'Blood Magic']
    
    // Pick a random spell
    const randomSpell = oneCostSpells[Math.floor(Math.random() * oneCostSpells.length)]
    
    // Convert to method name and execute
    const methodName = getMethodName(randomSpell)
    
    try {
      if (typeof eval(methodName) === 'function') {
        showMessage(`💦 Splash casts ${randomSpell}!`, 'utility')
        await eval(methodName)()
      } else {
        showMessage(`💦 Splash tried to cast ${randomSpell} but it's not implemented!`, 'warning')
      }
    } catch (error) {
      showMessage(`💦 Splash failed to cast ${randomSpell}!`, 'warning')
    }
  } else {
    showMessage(`💦 Splash missed!`, 'info')
  }
}

// Protect: Gain 2 armour
const protect = async () => {
  gainArmor(2, props.currentPlayer)
}

// Gust: Re-activate an unspent non-wind die at random
const gust = async () => {
  const currentPlayerResources = props.playerResources[props.currentPlayer]
  
  // Find all used non-wind dice (wind emoji is 💨)
  const usedNonWindDice = currentPlayerResources.filter(dice => dice.used && dice.emoji !== '💨')
  
  if (usedNonWindDice.length === 0) {
    showMessage('💨 Gust found no spent non-wind dice to reactivate!', 'warning')
    return
  }
  
  // Pick a random used non-wind die
  const randomDie = usedNonWindDice[Math.floor(Math.random() * usedNonWindDice.length)]
  
  // Find the die in the current player's resources and mark it as unused
  const updatedResources = currentPlayerResources.map(dice => {
    if (dice.diceIndex === randomDie.diceIndex && dice.emoji === randomDie.emoji && dice.used) {
      return { ...dice, used: false }
    }
    return dice
  })
  
  // Update the player's resources
  updateResources(props.currentPlayer, updatedResources)
  
  showMessage(`💨 Gust reactivates a ${randomDie.emoji} die!`, 'utility')
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
    showMessage(`💀 Blood Magic removes ${opponentDamage.armorLost} armor and deals ${opponentDamage.healthLost} damage!`, 'damage')
  } else if (opponentDamage.armorLost > 0) {
    showMessage(`💀 Blood Magic removes ${opponentDamage.armorLost} armor!`, 'damage')
  } else if (opponentDamage.healthLost > 0) {
    showMessage(`💀 Blood Magic deals ${opponentDamage.healthLost} damage!`, 'damage')
  }
}

// ============================================================================
// 2-COST SPELLS
// ============================================================================

// Blaze: Deal (1d10) damage
const blaze = async () => {
  const damageRoll = await requestDiceRoll('1d10')
  const damageDealt = damageRoll.value
  
  dealDamage(damageDealt, props.opponentPlayer)
  
  showMessage(`🔥 Blaze deals ${damageDealt} damage!`, 'damage')
}

//Re-roll any 4 dice
const strongGusts = async () => {
  const rerollResult = await requestElementDiceReroll(
    dice => !dice.used,  // Filter: only unspent dice
    4,                   // Max 4 dice total
    'Select up to 4 unspent dice to reroll'
  )
}

// Wavepool: Cast any two cost spell at random
const wavepool = async () => {
  // List of 2-cost spells (excluding Wavepool to avoid infinite loops)
  const twoCostSpells = [
    'Blaze', 'Wild Growth', 'Strong Gusts', 'Unfair Duel', 'Fated Hearts',
    'Refreshing Sips', 'Smog', 'Hotheaded', 'Risky Business', 'Hot Coals',
    'Waterjet', 'Aqua Mortis'
  ]
  
  // Pick a random spell
  const randomSpell = twoCostSpells[Math.floor(Math.random() * twoCostSpells.length)]
  
  // Convert to method name and execute
  const methodName = getMethodName(randomSpell)
  
  try {
    if (typeof eval(methodName) === 'function') {
      showMessage(`💧 Wavepool casts ${randomSpell}!`, 'utility')
      await eval(methodName)()
    } else {
      showMessage(`💧 Wavepool tried to cast ${randomSpell} but it's not implemented!`, 'warning')
    }
  } catch (error) {
    showMessage(`💧 Wavepool failed to cast ${randomSpell}!`, 'warning')
  }
}

// Wild Growth: Gain 2 armour for each previously spent dice, max of 8
const wildGrowth = async () => {
  const currentPlayerResources = props.playerResources[props.currentPlayer]
  const spentDiceCount = currentPlayerResources.filter(dice => dice.used).length
  const armorToGain = Math.min(spentDiceCount * 2, 8)
  
  if (armorToGain > 0) {
    gainArmor(armorToGain, props.currentPlayer)
  }
  showMessage(`🌱 Wild Growth gains ${armorToGain} armor!`, 'utility')
}

// Unfair Duel: Roll (1d4), your opponent rolls (1d8), whoever rolls higher takes that amount as damage
const unfairDuel = async () => {
  const playerRoll = await requestDiceRoll('1d4')
  const opponentRoll = await requestDiceRoll('1d8')
  
  if (playerRoll.value > opponentRoll.value) {
    dealDamage(playerRoll.value, props.opponentPlayer)
    showMessage(`💀 Unfair Duel self-inflicts ${playerRoll.value} damage!`, 'damage')
  } else if (opponentRoll.value > playerRoll.value) {
    dealDamage(opponentRoll.value, props.currentPlayer)
    showMessage(`💀 Unfair Duel causes ${opponentRoll.value} damage!`, 'damage')
  }else{
    showMessage(`It's a tie! No damage dealt.`, 'info')
  }
}

// Fated Hearts: Heal (1d6) + 2
const fatedHearts = async () => {
  const healRoll = await requestDiceRoll('1d6')
  const totalHealing = healRoll.value + 2
  healHP(totalHealing, props.currentPlayer)
  showMessage(`❤️ Fated Hearts heals ${totalHealing} HP!`, 'healing')
}

// Refreshing Sips: Gain (1d4) HP for each unspent dice in your hand, max of 10 HP
const refreshingSips = async () => {
  const currentPlayerResources = props.playerResources[props.currentPlayer]
  const unspentDiceCount = currentPlayerResources.filter(dice => !dice.used).length
  const healRoll = await requestDiceRoll('1d4')
  const totalHealing = Math.min(healRoll.value * unspentDiceCount, 10)
  
  healHP(totalHealing, props.currentPlayer)
  showMessage(`💧 Refreshing Sips heals ${totalHealing} HP!`, 'healing')
}

// Smog: Gain 3 armour and deal (1d4) damage
const smog = async () => {
  gainArmor(3, props.currentPlayer)
  const damageRoll = await requestDiceRoll('1d4')
  dealDamage(damageRoll.value, props.opponentPlayer)
  showMessage(`💨 Smog gains 3 armor and deals ${damageRoll.value} damage!`, 'utility')
}

// Hotheaded: Roll (1d10), a 1 or 10 is taken as damage to you, anything else is damage to your opponent
const hotheaded = async () => {
  const roll = await requestDiceRoll('1d10')
  
  if (roll.value === 1 || roll.value === 10) {
    dealDamage(roll.value, props.currentPlayer)
    showMessage(`🔥 Hotheaded self-inflicts ${roll.value} damage! Ouch!`, 'damage')
  } else {
    dealDamage(roll.value, props.opponentPlayer)
    showMessage(`🔥 Hotheaded deals ${roll.value} damage to the opponent!`, 'damage')
  }
}

// Risky Business: Take (1d8) damage, get as many re-rolls as the amount of damage you did NOT take
const riskyBusiness = async () => {
  const damageRoll = await requestDiceRoll('1d8')
  const actualDamage = damageRoll.value
  
  // Apply damage to self
  dealDamage(actualDamage, props.currentPlayer)
  
  // Calculate rerolls: damage NOT taken = 8 (max possible) - actual roll
  const rerollsToGain = 8 - actualDamage
  
  if (rerollsToGain > 0) {
    // Allow rerolling any unspent dice, up to the number of rerolls gained
    await requestElementDiceReroll(
      dice => !dice.used,  // Filter: only unspent dice
      rerollsToGain,       // Max rerolls based on damage not taken
      `Select up to ${rerollsToGain} unspent dice to reroll`
    )
  }
}

// Hot Coals: Deal your current armour as damage, max of 8
const hotCoals = async () => {
  const currentArmor = props.playerStats[props.currentPlayer].armor || 0
  const damageToDeal = Math.min(currentArmor, 8)
  
  if (damageToDeal > 0) {
    dealDamage(damageToDeal, props.opponentPlayer)
    showMessage(`🔥 Hot Coals deals ${damageToDeal} damage!`, 'damage')
  }else
  {
    showMessage(`🔥 Hot Coals has no armor to deal damage!`, 'warning')
  }
}

// Waterjet: Re-roll any unspent dice and deal 4 damage
const waterjet = async () => {
  const rerollResult = await requestElementDiceReroll(
    dice => !dice.used,  // Filter: only unspent dice
    1,                   // Max all dice
    'Select unspent dice to reroll'
  )
  
  dealDamage(4, props.opponentPlayer)
  showMessage(`💧 Waterjet deals 4 damage!`, 'damage')
}

// Aqua Mortis: Take (1d4) damage and deal (1d6) + 3 damage
const aquaMortis = async () => {
  const damageRoll = await requestDiceRoll('1d4')
  dealDamage(damageRoll.value, props.currentPlayer)
  showMessage(`💧 Aqua Mortis self-inflicts ${damageRoll.value} damage!`, 'damage')

  const attackRoll = await requestDiceRoll('1d6')
  dealDamage(attackRoll.value + 3, props.opponentPlayer)
  showMessage(`💧 Aqua Mortis deals ${attackRoll.value + 3} damage!`, 'damage')
}

// ============================================================================
// 3-COST SPELLS
// ============================================================================

// Explosion: Take 3 damage, then deal (1d4) + (2d6) as damage to your opponent
const explosion = async () => {
  dealDamage(3, props.currentPlayer)
  showMessage(`💥 Explosion self-inflicts 3 damage!`, 'damage')
  
  const d4Roll = await requestDiceRoll('1d4')
  const d6Roll1 = await requestDiceRoll('2d6')
  const totalDamage = d4Roll.value + d6Roll1.value
  
  dealDamage(totalDamage, props.opponentPlayer)
  showMessage(`💥 Explosion deals ${totalDamage} damage!`, 'damage')
}

// Neverending Vines: Roll (1d8) repeatedly until a 1 is rolled, gain armour equal to the number of rolls, max of 12 armour
const neverendingVines = async () => {
  let rollCount = 0
  let keepRolling = true
  
  while (keepRolling) {
    const roll = await requestDiceRoll('1d8')
    rollCount++
    
    if (roll.value === 1 || rollCount >= 12) {
      keepRolling = false
    }else{
      showMessage(`🌿 Total vines so far... ${rollCount}`, 'utility')
      await new Promise(resolve => setTimeout(resolve, 25))
    }
  }
  
  const armorToGain = Math.min(rollCount, 12)
  gainArmor(armorToGain, props.currentPlayer)
  showMessage(`🌿 Neverending Vines gains ${armorToGain} armor after ${rollCount} rolls!`, 'defense')
}

// Second Chance: Roll (1d6) to be gained as HP and armour, if you roll a 1 or 2 re-roll a (1d6) + 2 and use that value instead
const secondChance = async () => {
  let roll = await requestDiceRoll('1d6')
  let finalValue = roll.value
  
  if (roll.value <= 2) {
    const reroll = await requestDiceRoll('1d6')
    finalValue = reroll.value + 2
    showMessage(`🔄 Second Chance rerolls and gets ${finalValue}!`, 'utility')
  }
  
  healHP(finalValue, props.currentPlayer)
  gainArmor(finalValue, props.currentPlayer)
  showMessage(`🔄 Second Chance grants ${finalValue} HP and ${finalValue} armor!`, 'hybrid')
}

// Deadly Swamp: If your opponent has 9 or more armour, remove all of it
const deadlySwamp = async () => {
  const opponentArmor = props.playerStats[props.opponentPlayer].armor || 0
  
  if (opponentArmor >= 9) {
    updateStats(props.opponentPlayer, { armor: 0 })
    showMessage(`🐊 Deadly Swamp removes all ${opponentArmor} armor!`, 'utility')
  } else {
    showMessage(`🐊 Deadly Swamp has no effect - opponent has ${opponentArmor} armor!`, 'info')
  }
}

// Odd Rod: Roll (1d8) as damage, if the roll was an odd number roll an additional (1d6) as damage
const oddRod = async () => {
  const initialRoll = await requestDiceRoll('1d8')
  let totalDamage = initialRoll.value
  
  if (initialRoll.value % 2 === 1) { // Odd number
    showMessage(`⚡ Odd Rod rolls odd, rolling bonus damage!`, 'utility')
    const bonusRoll = await requestDiceRoll('1d6')
    totalDamage += bonusRoll.value
  }
  
  dealDamage(totalDamage, props.opponentPlayer)
  showMessage(`⚡ Odd Rod deals ${totalDamage} damage!`, 'damage')
}

// Even Steven: Roll (1d6) + 4 as damage, if the roll was an even number gain a re-roll
const evenSteven = async () => {
  const roll = await requestDiceRoll('1d6')
  const damage = roll.value + 4
  
  dealDamage(damage, props.opponentPlayer)
  showMessage(`🎯 Even Steven deals ${damage} damage!`, 'damage')
  
  if (roll.value % 2 === 0) { // Even number
    // Trigger a re-roll for any unspent dice
    await requestElementDiceReroll(
      dice => !dice.used,  // Filter: only unspent dice
      1,                   // Max 1 reroll
      'Even Steven grants a re-roll! Select an unspent die'
    )
  }
}

// Restorative Shock: Heal (1d8) + 2 and deal (1d6) damage
const restorativeShock = async () => {
  const healRoll = await requestDiceRoll('1d8')
  const totalHealing = healRoll.value + 2
  healHP(totalHealing, props.currentPlayer)
  showMessage(`⚡ Restorative Shock heals ${totalHealing} HP!`, 'healing')
  
  const damageRoll = await requestDiceRoll('1d6')
  dealDamage(damageRoll.value, props.opponentPlayer)
  
  showMessage(`⚡ Restorative Shock deals ${damageRoll.value} damage!`, 'damage')
}

// Bloody Sacrifice: Sacrifice as much HP as you want, then deal half that rounded down to your opponent as damage
const bloodySacrifice = async () => {
  // This requires a player choice dialog for HP sacrifice amount
  // Cannot be implemented with current helper functions
  showMessage(`💀 Bloody Sacrifice requires player choice dialog - not yet implemented!`, 'warning')
}

// Downdraft: Roll (2d20), gain the lowest roll as armour, minimum of 5 armour
const downdraft = async () => {
  const roll1 = await requestDiceRoll('1d20')
  const roll2 = await requestDiceRoll('1d20')
  
  const lowestRoll = Math.min(roll1.value, roll2.value)
  const armorToGain = Math.max(lowestRoll, 5)
  if(roll1.value === roll2.value) {
    armorToGain =  roll1.value
  }
  
  gainArmor(armorToGain, props.currentPlayer)
  showMessage(`💨 Downdraft gains ${armorToGain} armor!`, 'defense')
}

// Troubled Waters: Deal (3d6) - 3 damage
const troubledWaters = async () => {
  const roll1 = await requestDiceRoll('1d6')
  const roll2 = await requestDiceRoll('1d6')
  const roll3 = await requestDiceRoll('1d6')
  const damage = Math.max(0, roll1.value + roll2.value + roll3.value - 3)

  if (damage > 0) {
    dealDamage(damage, props.opponentPlayer)
    showMessage(`🌊 Troubled Waters deals ${damage} damage!`, 'damage')
  } else {
    showMessage(`🌊 Troubled Waters deals no damage!`, 'info')
  }
}

// Merciful Strike: Deal (1d10) + 5 damage, your opponent then gains half your dice roll rounded down as armour
const mercifulStrike = async () => {
  const roll = await requestDiceRoll('1d10')
  const damage = roll.value + 5
  const armorForOpponent = Math.floor(roll.value / 2)
  
  dealDamage(damage, props.opponentPlayer)
  gainArmor(armorForOpponent, props.opponentPlayer)
  
  showMessage(`⚔️ Merciful Strike deals ${damage} damage and gives ${armorForOpponent} armor!`, 'damage')
}

// Washed Ashore: Return any spent fire, death, or wind dice to your hand
const washedAshore = async () => {
  const currentPlayerResources = props.playerResources[props.currentPlayer]
  
  // Find all spent fire (🔥), death (💀), or wind (💨) dice
  const targetEmojis = ['🔥', '💀', '💨']
  const spentTargetDice = currentPlayerResources.filter(dice => dice.used && targetEmojis.includes(dice.emoji))
  
  if (spentTargetDice.length === 0) {
    showMessage('🌊 Washed Ashore found no spent fire, death, or wind dice to restore!', 'warning')
    return
  }
  
  // Restore ALL spent target dice at once (like gust but for multiple dice)
  const updatedResources = currentPlayerResources.map(dice => {
    if (dice.used && targetEmojis.includes(dice.emoji)) {
      return { ...dice, used: false }
    }
    return dice
  })
  
  // Update the player's resources
  updateResources(props.currentPlayer, updatedResources)
  
  showMessage(`🌊 Washed Ashore restores ${spentTargetDice.length} spent dice!`, 'utility')
}

// Lucky Ritual: Take 7 damage, gain 7 armour, deal 7 damage
const luckyRitual = async () => {
  dealDamage(7, props.currentPlayer)
  gainArmor(7, props.currentPlayer)
  dealDamage(7, props.opponentPlayer)
  
  showMessage(`🎲 Lucky Ritual: 7 damage taken, 7 armor gained, 7 damage dealt!`, 'hybrid')
}

// High Stakes: Roll (3d6) heal any 3 or higher rolls, take damage on any 2 or less rolls
const highStakes = async () => {
  const roll1 = await requestDiceRoll('1d6')
  const roll2 = await requestDiceRoll('1d6')
  const roll3 = await requestDiceRoll('1d6')
  
  const rolls = [roll1.value, roll2.value, roll3.value]
  let totalHealing = 0
  let totalDamage = 0
  
  rolls.forEach(roll => {
    if (roll >= 3) {
      totalHealing += roll
    } else {
      totalDamage += roll
    }
  })
  
  if (totalHealing > 0) {
    healHP(totalHealing, props.currentPlayer)
  }
  if (totalDamage > 0) {
    dealDamage(totalDamage, props.currentPlayer)
  }
  
  showMessage(`🎰 High Stakes: ${totalHealing} healing, ${totalDamage} damage taken!`, 'utility')
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
    // Convert spell name to method name (camelCase) Rushing Waters -> rushingWaters
    const methodName = getMethodName(spellName)
    console.log(`Looking for method: ${methodName}`)
    
    // Get the method dynamically from the current context
    // This way the spellbook is the source of truth - if a method exists, it can be called
    try {
      if (typeof eval(methodName) === 'function') {
        await eval(methodName)()
      } else {
        showMessage(`${spellName} is not a function`, 'warning')
      }
    } catch (evalError) {
      showMessage(`${spellName} is not yet implemented!`, 'warning')
    }
  } catch (error) {
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
  handleElementDiceRerollResult,
  onSpellDiceDisplayFinished,
  diceRollResult,
  // TESTING ONLY - Remove after testing
  testSpell: (spellName) => executeSpell(spellName)
})
</script>

<style scoped>
/* No visible template, this is a logic-only component */
</style>
