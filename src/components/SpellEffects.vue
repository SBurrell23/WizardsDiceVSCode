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
  },
  showNumericModal: {
    type: Function,
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

// Configuration
const DEFAULT_SPELL_CAST_DELAY = 2000 // Default delay for instant spells to show casting indicator

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

// Helper function to deal damage directly to HP (ignores armor)
const dealDamageToHP = (damage, player) => {
  const targetStats = props.playerStats[player]
  const currentHealth = targetStats.health || 0
  
  const newHealth = Math.max(0, currentHealth - damage)
  const healthLost = currentHealth - newHealth
  
  updateStats(player, { health: newHealth })
  
  // Return damage breakdown for messaging
  return { healthLost, totalDamage: healthLost }
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
  showMessage(`🔥 Ember deals 2 damage!`, 'damage')
  await new Promise(resolve => setTimeout(resolve, DEFAULT_SPELL_CAST_DELAY))
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
  
  // Add a brief delay so the casting indicator is visible
  await new Promise(resolve => setTimeout(resolve, DEFAULT_SPELL_CAST_DELAY))
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
  
  // Add a brief delay so the casting indicator is visible
  await new Promise(resolve => setTimeout(resolve, DEFAULT_SPELL_CAST_DELAY))
}

// Heal: Heal 2 HP
const heal = async () => {
  healHP(2, props.currentPlayer)
  
  // Add a brief delay so the casting indicator is visible
  await new Promise(resolve => setTimeout(resolve, DEFAULT_SPELL_CAST_DELAY))
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
  
  // Add a brief delay so the casting indicator is visible
  await new Promise(resolve => setTimeout(resolve, DEFAULT_SPELL_CAST_DELAY))
}

// Unfair Duel: Roll (1d4), your opponent rolls (1d8), whoever rolls higher takes that amount as damage
const unfairDuel = async () => {
  const playerRoll = await requestDiceRoll('1d4')
  const opponentRoll = await requestDiceRoll('1d8')
  
  if (playerRoll.value > opponentRoll.value) {
    dealDamage(playerRoll.value, props.opponentPlayer)
    showMessage(`💀 Unfair Duel: Player wins! Opponent takes ${playerRoll.value} damage!`, 'damage')
  } else if (opponentRoll.value > playerRoll.value) {
    dealDamage(opponentRoll.value, props.currentPlayer)
    showMessage(`💀 Unfair Duel: Opponent wins! Player takes ${opponentRoll.value} damage!`, 'damage')
  }else{
    showMessage(`💀 Unfair Duel: It's a tie! No damage dealt.`, 'info')
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
  
  // Add a brief delay so the casting indicator is visible
  await new Promise(resolve => setTimeout(resolve, DEFAULT_SPELL_CAST_DELAY))
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
  
  // Add a brief delay so the casting indicator is visible
  await new Promise(resolve => setTimeout(resolve, DEFAULT_SPELL_CAST_DELAY))
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

// Bloody Sacrifice: Sacrifice as much HP as you can without dying, then deal half that rounded down to your opponent as damage
const bloodySacrifice = async () => {
  const currentHealth = props.playerStats[props.currentPlayer].health || 0
  

  // Show modal to get sacrifice amount (max is current health - 1, so player doesn't die)
  const sacrificeAmount = await props.showNumericModal(
    '🩸Bloody Sacrifice',
    `Sacrifice HP (ignoring armour) and deal half that rounded down as damage to your opponent. You currently have ${currentHealth} HP.`,
    'HP To Sacrifice',
    0,                    // Min: 0 HP
    currentHealth - 1,    // Max: current HP - 1 (can't sacrifice all HP)
    0                     // Default: 0 HP
  )
  
  // Apply self damage directly to HP (ignoring armor)
  if (sacrificeAmount > 0) {
    dealDamageToHP(sacrificeAmount, props.currentPlayer)
  }
  
  // Calculate and deal damage to opponent (half sacrifice amount, rounded down)
  const damageToOpponent = Math.floor(sacrificeAmount / 2)
  
  if (damageToOpponent > 0) {
    dealDamage(damageToOpponent, props.opponentPlayer)
    showMessage(`💀 Bloody Sacrifice: sacrificed ${sacrificeAmount} HP, dealt ${damageToOpponent} damage!`, 'damage')
  } else {
    showMessage(`💀 Bloody Sacrifice: sacrificed ${sacrificeAmount} HP, and dealt no damage!`, 'warning')
  }
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
  
  // Add a brief delay so the casting indicator is visible
  await new Promise(resolve => setTimeout(resolve, DEFAULT_SPELL_CAST_DELAY))
}

// Lucky Ritual: Take 7 damage, gain 7 armour, deal 7 damage
const luckyRitual = async () => {
  dealDamage(7, props.currentPlayer)
  gainArmor(7, props.currentPlayer)
  dealDamage(7, props.opponentPlayer)
  
  showMessage(`🎲 Lucky Ritual: 7 damage taken, 7 armor gained, 7 damage dealt!`, 'hybrid')
  
  // Add a brief delay so the casting indicator is visible
  await new Promise(resolve => setTimeout(resolve, DEFAULT_SPELL_CAST_DELAY))
}

// High Stakes: Roll (3d6) heal any 3 or higher rolls, take damage on any 2 or less rolls
const highStakes = async () => {
  const roll1 = await requestDiceRoll('1d6')
  if (roll1.value >= 3) {
    healHP(roll1.value, props.currentPlayer)
    showMessage(`🎰 High Stakes roll #1: Healed ${roll1.value} HP!`, 'healing')
  } else {
    dealDamage(roll1.value, props.currentPlayer)
    showMessage(`🎰 High Stakes roll #1: Inflicted ${roll1.value} damage!`, 'damage')
  }
  
  const roll2 = await requestDiceRoll('1d6')
  if (roll2.value >= 3) {
    healHP(roll2.value, props.currentPlayer)
    showMessage(`🎰 High Stakes roll #2: Healed ${roll2.value} HP!`, 'healing')
  } else {
    dealDamage(roll2.value, props.currentPlayer)
    showMessage(`🎰 High Stakes roll #2: Inflicted ${roll2.value} damage!`, 'damage')
  }
  
  const roll3 = await requestDiceRoll('1d6')
  if (roll3.value >= 3) {
    healHP(roll3.value, props.currentPlayer)
    showMessage(`🎰 High Stakes roll #3: Healed ${roll3.value} HP!`, 'healing')
  } else {
    dealDamage(roll3.value, props.currentPlayer)
    showMessage(`🎰 High Stakes roll #3: Inflicted ${roll3.value} damage!`, 'damage')
  }
}

// ============================================================================
// 4-COST SPELLS
// ============================================================================

// Thick Armour: Take (1d6) damage, if this did not reduce your HP deal (1d12) + 6 damage
const thickArmour = async () => {
  const damageRoll = await requestDiceRoll('1d6')
  const damage = damageRoll.value

  // Apply damage and check if HP was reduced
  const damageResult = dealDamage(damage, props.currentPlayer)
  
  if (damageResult.healthLost === 0) {
    // HP was not reduced (armor absorbed all damage)
    const attackRoll = await requestDiceRoll('1d12')
    const attackDamage = attackRoll.value + 6
    dealDamage(attackDamage, props.opponentPlayer)
    showMessage(`🛡️ Thick Armour: Dealt ${attackDamage} damage!`, 'damage')
  } else {
    showMessage(`🛡️ Thick Armour: HP was reduced, no attack triggered!`, 'info')
  }
}

// Rejuvinating Waters: Heal for (3d8)
const rejuvinatingWaters = async () => {
  const roll1 = await requestDiceRoll('1d8')
  const roll2 = await requestDiceRoll('1d8')
  const roll3 = await requestDiceRoll('1d8')
  const totalHealing = roll1.value + roll2.value + roll3.value
  
  healHP(totalHealing, props.currentPlayer)
  showMessage(`💧 Rejuvinating Waters heals ${totalHealing} HP!`, 'healing')
}

// Fiery Passion: Deal (1d12) damage. If your HP is still lower then your opponent's re-activate both fires
const fieryPassion = async () => {
  // Deal damage first
  const damageRoll = await requestDiceRoll('1d12')
  dealDamage(damageRoll.value, props.opponentPlayer)
  showMessage(`🔥 Fiery Passion deals ${damageRoll.value} damage!`, 'damage')
  
  // Check HP comparison after damage
  const currentPlayerHP = props.playerStats[props.currentPlayer].health || 0
  const opponentHP = props.playerStats[props.opponentPlayer].health || 0
  
  if (currentPlayerHP < opponentHP) {
    // Find all spent fire dice (🔥) and reactivate exactly 2 of them
    const currentPlayerResources = props.playerResources[props.currentPlayer]
    const spentFireDice = currentPlayerResources.filter(dice => dice.used && dice.emoji === '🔥')
    
    if (spentFireDice.length >= 2) {
      // Reactivate exactly 2 fire dice
      let reactivatedCount = 0
      const updatedResources = currentPlayerResources.map(dice => {
        if (dice.used && dice.emoji === '🔥' && reactivatedCount < 2) {
          reactivatedCount++
          return { ...dice, used: false }
        }
        return dice
      })
      
      updateResources(props.currentPlayer, updatedResources)
      showMessage(`🔥 Fiery Passion reactivates 2 🔥 dice!`, 'utility')
    } else {
      showMessage(`🔥 Fiery Passion found insufficient spent fire dice to reactivate!`, 'info')
    }
  } else {
    showMessage(`🔥 Fiery Passion: HP not lower than opponent's, no dice reactivated!`, 'info')
  }
}

// Deadlier Curse: Roll (2d6), deal as damage to you and 2x that to your opponent
const deadlierCurse = async () => {
  const roll1 = await requestDiceRoll('1d6')
  const roll2 = await requestDiceRoll('1d6')
  const totalRoll = roll1.value + roll2.value
  const opponentDamage = totalRoll * 2
  
  dealDamage(totalRoll, props.currentPlayer)
  dealDamage(opponentDamage, props.opponentPlayer)
  
  showMessage(`💀 Deadlier Curse: Takes ${totalRoll} damage & inflicts ${opponentDamage} damage!`, 'damage')
}

// Fire Flower: Deal your opponents armour as direct damage to their HP, max of 13 damage
const fireFlower = async () => {
  const opponentArmor = props.playerStats[props.opponentPlayer].armor || 0
  const damageToDealt = Math.min(opponentArmor, 13)
  
  if (damageToDealt > 0) {
    dealDamageToHP(damageToDealt, props.opponentPlayer)
    showMessage(`🌸 Fire Flower deals ${damageToDealt} direct HP damage!`, 'damage')
  } else {
    showMessage(`🌸 Fire Flower has no armor to convert to damage!`, 'info')
  }
  
  // Add a brief delay so the casting indicator is visible
  await new Promise(resolve => setTimeout(resolve, DEFAULT_SPELL_CAST_DELAY))
}

// Nullify: Gain (1d10) + 6 armour, if you gained 12 or more armour lose (1d6) HP
const nullify = async () => {
  const armorRoll = await requestDiceRoll('1d10')
  const armorGained = armorRoll.value + 6
  
  gainArmor(armorGained, props.currentPlayer)
  
  if (armorGained >= 12) {
    const hpLossRoll = await requestDiceRoll('1d6')
    dealDamageToHP(hpLossRoll.value, props.currentPlayer)
    showMessage(`🛡️ Nullify: ${armorGained} armor gained, ${hpLossRoll.value} HP lost!`, 'hybrid')
  } else {
    showMessage(`🛡️ Nullify gains ${armorGained} armor!`, 'defense')
  }
}

// Fertile Soil: Sacrifice as much armor as you choose. Deal that as damage to your opponent and gain half that rounded down as HP
const fertileSoil = async () => {
  const currentArmor = props.playerStats[props.currentPlayer].armor || 0
  
  if (currentArmor === 0) {
    showMessage(`🌱 Fertile Soil has no armor to sacrifice!`, 'warning')
    return
  }
  
  // Show modal to get sacrifice amount
  const sacrificeAmount = await props.showNumericModal(
    '🌱 Fertile Soil',
    `Sacrifice armor to deal as damage and gain half that rounded down as HP. You currently have ${currentArmor} armor.`,
    'Armor To Sacrifice',
    0,                    // Min: 0 armor
    currentArmor,         // Max: current armor
    0                     // Default: 0 armor
  )
  
  if (sacrificeAmount > 0) {
    // Remove armor from player
    updateStats(props.currentPlayer, { armor: Math.max(0, currentArmor - sacrificeAmount) })
    
    // Deal damage to opponent
    dealDamage(sacrificeAmount, props.opponentPlayer)
    
    // Heal player for half (rounded down)
    const healingAmount = Math.floor(sacrificeAmount / 2)
    if (healingAmount > 0) {
      healHP(healingAmount, props.currentPlayer)
    }
    
    showMessage(`🌱 Fertile Soil: ${sacrificeAmount} armor sacrificed, ${healingAmount} HP gained!`, 'hybrid')
  } else {
    showMessage(`🌱 Fertile Soil: No armor sacrificed!`, 'info')
  }
}

// Even The Odds: Roll (3d10), deal 2 damage for each even roll and 5 for each odd roll
const evenTheOdds = async () => {
  const roll1 = await requestDiceRoll('1d10')
  if (roll1.value % 2 === 0) {
    dealDamage(2, props.opponentPlayer)
    showMessage(`⚖️ Even The Odds dealt 2 damage!`, 'damage')
  } else {
    dealDamage(5, props.opponentPlayer)
    showMessage(`⚖️ Even The Odds dealt 5 damage!`, 'damage')
  }
  
  const roll2 = await requestDiceRoll('1d10')
  if (roll2.value % 2 === 0) {
    dealDamage(2, props.opponentPlayer)
    showMessage(`⚖️ Even The Odds dealt 2 damage!`, 'damage')
  } else {
    dealDamage(5, props.opponentPlayer)
    showMessage(`⚖️ Even The Odds dealt 5 damage!`, 'damage')
  }
  
  const roll3 = await requestDiceRoll('1d10')
  if (roll3.value % 2 === 0) {
    dealDamage(2, props.opponentPlayer)
    showMessage(`⚖️ Even The Odds dealt 2 damage!`, 'damage')
  } else {
    dealDamage(5, props.opponentPlayer)
    showMessage(`⚖️ Even The Odds dealt 5 damage!`, 'damage')
  }
}

// ============================================================================
// 5-COST SPELLS
// ============================================================================

// Chain-Lightning: Deal (1d4) damage, if roll was not a 4 deal (1d6) damage, if roll was not a 6 deal (1d10) damage
const chainLightning = async () => {
  const d4Roll = await requestDiceRoll('1d4')
  dealDamage(d4Roll.value, props.opponentPlayer)
  showMessage(`⚡ Chain-Lightning deals ${d4Roll.value} damage!`, 'damage')
  
  if (d4Roll.value !== 4) {
    const d6Roll = await requestDiceRoll('1d6')
    dealDamage(d6Roll.value, props.opponentPlayer)
    showMessage(`⚡ Chain-Lightning chains for ${d6Roll.value} more damage!`, 'damage')
    
    if (d6Roll.value !== 6) {
      const d10Roll = await requestDiceRoll('1d10')
      dealDamage(d10Roll.value, props.opponentPlayer)
      showMessage(`⚡ Chain-Lightning chains again for ${d10Roll.value} more damage!`, 'damage')
    }
  }
}

// Revive: Roll (3d6) 5s or higher are gained as HP, rolls 4 or lower are gained as armour
const revive = async () => {
  const roll1 = await requestDiceRoll('1d6')
  if (roll1.value >= 5) {
    healHP(roll1.value, props.currentPlayer)
    showMessage(`🔄 Revive gives ${roll1.value} HP!`, 'healing')
  } else {
    gainArmor(roll1.value, props.currentPlayer)
    showMessage(`🔄 Revive gives ${roll1.value} armor!`, 'defense')
  }
  
  const roll2 = await requestDiceRoll('1d6')
  if (roll2.value >= 5) {
    healHP(roll2.value, props.currentPlayer)
    showMessage(`🔄 Revive gives ${roll2.value} HP!`, 'healing')
  } else {
    gainArmor(roll2.value, props.currentPlayer)
    showMessage(`🔄 Revive gives ${roll2.value} armor!`, 'defense')
  }
  
  const roll3 = await requestDiceRoll('1d6')
  if (roll3.value >= 5) {
    healHP(roll3.value, props.currentPlayer)
    showMessage(`🔄 Revive gives ${roll3.value} HP!`, 'healing')
  } else {
    gainArmor(roll3.value, props.currentPlayer)
    showMessage(`🔄 Revive gives ${roll3.value} armor!`, 'defense')
  }
}

// Death & Taxes: Swap you and your opponents HP, if your opponent now has 5 HP or less they gain 7 armour
const deathTaxes = async () => {
  const currentPlayerHP = props.playerStats[props.currentPlayer].health || 0
  const opponentHP = props.playerStats[props.opponentPlayer].health || 0
  
  // Swap HP values
  updateStats(props.currentPlayer, { health: opponentHP })
  updateStats(props.opponentPlayer, { health: currentPlayerHP })
  
  showMessage(`💀 Death & Taxes swaps HP!`, 'utility')
  
  // Check if opponent now has 5 HP or less
  if (currentPlayerHP <= 5) {
    gainArmor(7, props.opponentPlayer)
  }
  
  // Add a brief delay so the casting indicator is visible
  await new Promise(resolve => setTimeout(resolve, DEFAULT_SPELL_CAST_DELAY))
}

// Mudslide: Roll (1d4, 1d6, 1d8, 1d10, 1d12, 1d20) and deal the highest 3 rolls as damage, max of 25 damage
const mudslide = async () => {
  const roll1 = await requestDiceRoll('1d4')
  const roll2 = await requestDiceRoll('1d6')
  const roll3 = await requestDiceRoll('1d8')
  const roll4 = await requestDiceRoll('1d10')
  const roll5 = await requestDiceRoll('1d12')
  const roll6 = await requestDiceRoll('1d20')
  
  const allRolls = [roll1.value, roll2.value, roll3.value, roll4.value, roll5.value, roll6.value]
  
  // Sort rolls in descending order and take the highest 3
  const highest3 = allRolls.sort((a, b) => b - a).slice(0, 3)
  const totalDamage = Math.min(highest3.reduce((sum, roll) => sum + roll, 0), 25)
  
  dealDamage(totalDamage, props.opponentPlayer)
  showMessage(`🌊 Mudslide: Highest 3 rolls (${highest3.join(', ')}) = ${totalDamage} damage!`, 'damage')
}

// Self Destruct: First take (1d20) damage then deal (3d10) damage to your opponent
const selfDestruct = async () => {
  const selfDamageRoll = await requestDiceRoll('1d20')
  const selfDamageResult = dealDamage(selfDamageRoll.value, props.currentPlayer)
  
  showMessage(`💥 Self Destruct: Inflicts ${selfDamageRoll.value} self-damage!`, 'damage')
  
  // Check if the caster is still alive after self-damage
  const currentPlayerHP = props.playerStats[props.currentPlayer].health || 0
  
  if (currentPlayerHP > 0) {
    // Caster survived, deal damage to opponent
    const opponentRoll1 = await requestDiceRoll('1d10')
    const opponentRoll2 = await requestDiceRoll('1d10')
    const opponentRoll3 = await requestDiceRoll('1d10')
    const totalOpponentDamage = opponentRoll1.value + opponentRoll2.value + opponentRoll3.value
    
    dealDamage(totalOpponentDamage, props.opponentPlayer)
    showMessage(`💥 Self Destruct: Deals ${totalOpponentDamage} damage!`, 'damage')
  } else {
    // Caster died from self-damage, no damage to opponent
    showMessage(`💥 Self Destruct: Caster died from self-damage! No damage dealt to opponent!`, 'warning')
  }
}


// ============================================================================
// MAIN SPELL EXECUTION METHOD
// ============================================================================

const executeSpell = async (spellName) => {
  console.log(`Executing spell: ${spellName}`)
  
  // Set spell casting state and notify parent with spell name
  isSpellCasting.value = true
  emit('spellCastingStarted', { spellName })
  
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
    emit('spellCastingEnded', { spellName })
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
