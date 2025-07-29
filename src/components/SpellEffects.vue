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
  },
  showUserChoiceModal: {
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

// Helper function to get all spell names for a specific cost tier
const getSpellsByCost = async (costTier, excludeSpells = []) => {
  try {
    // Fetch the spellbook data
    const cacheBuster = new Date().getTime()
    const response = await fetch(`./Spellbook.json?v=${cacheBuster}`, {
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
    const spellbookData = await response.json()
    
    // Extract spell names for the specified cost tier
    const costKey = `${costTier}-cost`
    if (!spellbookData[costKey]) {
      console.warn(`No spells found for cost tier: ${costKey}`)
      return []
    }
    
    return spellbookData[costKey]
      .map(spell => spell.name)
      .filter(name => !excludeSpells.includes(name))
  } catch (error) {
    console.error(`Failed to fetch ${costTier}-cost spells:`, error)
    return []
  }
}

// =============================================================================================================================
// SPELL IMPLEMENTATIONS
// =============================================================================================================================

// =============================================================================================================================
// 1-COST SPELLS
// =============================================================================================================================

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
    try {
      // Get all 1-cost spell names (excluding Splash to avoid infinite loops)
      const oneCostSpells = await getSpellsByCost(1, ['Splash'])

      if (oneCostSpells.length === 0) {
        showMessage(`💦 Splash: No other 1-cost spells available!`, 'warning')
        return
      }

      // Select a random 1-cost spell
      const randomSpell = oneCostSpells[Math.floor(Math.random() * oneCostSpells.length)]
      showMessage(`💦 Splash casts ${randomSpell}!`, 'utility')
      await new Promise(resolve => setTimeout(resolve, 1250))

      // Execute the random spell
      await executeSpell(randomSpell)
    } catch (error) {
      console.error('Splash failed:', error)
      showMessage(`💦 Splash failed to cast a spell!`, 'warning')
      await new Promise(resolve => setTimeout(resolve, DEFAULT_SPELL_CAST_DELAY))
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

// =============================================================================================================================
// 2-COST SPELLS
// =============================================================================================================================

// Blaze: Deal (1d10) damage
const blaze = async () => {
  const damageRoll = await requestDiceRoll('1d10')
  const damageDealt = damageRoll.value
  
  dealDamage(damageDealt, props.opponentPlayer)
  
  showMessage(`🔥 Blaze deals ${damageDealt} damage!`, 'damage')
}

//Re-roll any 5 dice
const strongGusts = async () => {
  const rerollResult = await requestElementDiceReroll(
    dice => !dice.used,  // Filter: only unspent dice
    6,                   // Max 6 dice total
    'Select up to 6 unspent dice to reroll'
  )
}

// Bigger Splash: Cast any two cost spell at random
const biggerSplash = async () => {
  try {
    // Get all 2-cost spell names (excluding Bigger Splash to avoid infinite loops)
    const twoCostSpells = await getSpellsByCost(2, ['Bigger Splash'])

    if (twoCostSpells.length === 0) {
      showMessage(`💧 Bigger Splash: No other 2-cost spells available!`, 'warning')
      return
    }

    // Select a random 2-cost spell
    const randomSpell = twoCostSpells[Math.floor(Math.random() * twoCostSpells.length)]
    showMessage(`💧 Bigger Splash casts ${randomSpell}!`, 'utility')
    await new Promise(resolve => setTimeout(resolve, 1250))

    // Execute the random spell
    await executeSpell(randomSpell)
  } catch (error) {
    console.error('Splash failed:', error)
    showMessage(`💦 Splash failed to cast a spell!`, 'warning')
    await new Promise(resolve => setTimeout(resolve, DEFAULT_SPELL_CAST_DELAY))
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
    dealDamage(playerRoll.value, props.currentPlayer)
    showMessage(`💀 Unfair Duel: Opponent wins! Roller takes ${playerRoll.value} damage!`, 'damage')
  } else if (opponentRoll.value > playerRoll.value) {
    dealDamage(opponentRoll.value, props.opponentPlayer)
    showMessage(`💀 Unfair Duel: Roller wins! Opponent takes ${opponentRoll.value} damage!`, 'damage')
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

// Risky Business: Take (1d4) damage and get triple that many re-rolls
const riskyBusiness = async () => {
  const damageRoll = await requestDiceRoll('1d4')
  const actualDamage = damageRoll.value
  
  // Apply damage to self
  dealDamage(actualDamage, props.currentPlayer)
  
  const rerollsToGain = damageRoll.value * 3
  
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

// Waterjet: Get 3 un-spent dice re-rolls and deal 4 damage
const waterjet = async () => {
  const rerollResult = await requestElementDiceReroll(
    dice => !dice.used,  // Filter: only unspent dice
    3,                   // Max 3 dice
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

// Fireballs: Deal 2 damage for every unspent non-fire dice in your hand, max of 8 damage
const fireballs = async () => {
  const currentPlayerResources = props.playerResources[props.currentPlayer]
  
  // Find all unspent non-fire dice (fire emoji is 🔥)
  const unspentNonFireDice = currentPlayerResources.filter(dice => !dice.used && dice.emoji !== '🔥')
  
  // Calculate damage: 2 damage per unspent non-fire die, max 8
  const totalDamage = Math.min(unspentNonFireDice.length * 2, 8)
  
  if (totalDamage > 0) {
    dealDamage(totalDamage, props.opponentPlayer)
    showMessage(`🔥 Fireballs deals ${totalDamage} damage (from ${unspentNonFireDice.length} unspent non-fire dice)!`, 'damage')
  } else {
    showMessage(`🔥 Fireballs missed!`, 'warning')
  }
  
  // Add a brief delay so the casting indicator is visible
  await new Promise(resolve => setTimeout(resolve, DEFAULT_SPELL_CAST_DELAY))
}

// Wavepool: Remove (2d4) + 1 only from your opponents armour
const wavepool = async () => {
  const roll1 = await requestDiceRoll('1d4')
  const roll2 = await requestDiceRoll('1d4')
  const armorReduction = roll1.value + roll2.value + 1
  
  const opponentArmor = props.playerStats[props.opponentPlayer].armor || 0
  const newArmor = Math.max(0, opponentArmor - armorReduction)
  const actualReduction = opponentArmor - newArmor
  
  updateStats(props.opponentPlayer, { armor: newArmor })
  showMessage(`💧 Wavepool removes ${actualReduction} armor!`, 'utility')
}

// Rock Armour: Gain (1d4) + 4 armour
const rockArmour = async () => {
  const armorRoll = await requestDiceRoll('1d4')
  const armorToGain = armorRoll.value + 4
  
  gainArmor(armorToGain, props.currentPlayer)
  showMessage(`🌍 Rock Armour gains ${armorToGain} armour!`, 'defense')
}

// Dust Devil: Call a number 1 through 4, roll (1d4), if the number matches deal 9 damage
const dustDevil = async () => {
  // Show modal to get the called number
  const calledNumber = await props.showNumericModal(
    '💨 Dust Devil',
    'Call a number from 1 through 4.',
    'Called Number',
    1,    // Min: 1
    4,    // Max: 4
    1     // Default: 1
  )
  showMessage(`💨 Dust Devil called a ${calledNumber}`, 'info')
  
  // Roll the d4
  const roll = await requestDiceRoll('1d4')
  
  if (roll.value === calledNumber) {
    dealDamage(9, props.opponentPlayer)
    showMessage(`💨 Dust Devil hits for 9 damage!`, 'damage')
  } else {
    showMessage(`💨 Dust Devil missed!`, 'info')
  }
}

// Shrunken Heads: Take 4 damage and return these dice to your hand, you may re-roll them
const shrunkenHeads = async () => {
  // Take 4 damage first
  dealDamage(4, props.currentPlayer)
  showMessage(`💀 Shrunken Heads inflicts 4 damage!`, 'damage')
  
  const currentPlayerResources = props.playerResources[props.currentPlayer]
  
  // Find all used death dice (death emoji is 💀)
  const usedDeathDice = currentPlayerResources.filter(dice => dice.used && dice.emoji === '💀')
  
  if (usedDeathDice.length < 2) {
    showMessage(`💀 Shrunken Heads: Not enough spent death dice to reactivate!`, 'warning')
    return
  }
  
  // Take the first 2 spent death dice (or all if there are exactly 2)
  const diceToReactivate = usedDeathDice.slice(0, 2)
  
  // Reactivate exactly 2 death dice
  const updatedResources = currentPlayerResources.map(dice => {
    // Check if this die is one of the first 2 death dice to reactivate
    const isSelected = diceToReactivate.some(selected => 
      selected.diceIndex === dice.diceIndex && 
      selected.emoji === dice.emoji && 
      dice.used
    )
    
    if (isSelected) {
      return { ...dice, used: false }
    }
    return dice
  })
  
  // Update the player's resources
  updateResources(props.currentPlayer, updatedResources)
  
  showMessage(`💀 Shrunken Heads is reactivating 2 💀 dice!`, 'utility')
  
  // Now re-roll the reactivated dice
  await requestElementDiceReroll(
    dice => !dice.used && dice.emoji === '💀',  // Filter: only unspent death dice
    2,                                           // Max 2 dice (the ones we just reactivated)
    'You may choose to re-roll your reactivated 💀 dice'
  )
}

// The Lovers: If your HP is 18 or higher heal to full
const theLovers = async () => {
  const currentHP = props.playerStats[props.currentPlayer].health || 0
  const maxHP = props.playerStats[props.currentPlayer].maxHealth || 25
  
  if (currentHP >= 18) {
    const healingAmount = maxHP - currentHP
    if (healingAmount > 0) {
      updateStats(props.currentPlayer, { health: maxHP })
      showMessage(`💖 The Lovers heals to full HP!`, 'healing')
    } else {
      showMessage(`💖 Already at full HP!`, 'info')
    }
  } else {
    showMessage(`💖 HP was too low! Healed for nothing!`, 'warning')
  }
  
  // Add a brief delay so the casting indicator is visible
  await new Promise(resolve => setTimeout(resolve, DEFAULT_SPELL_CAST_DELAY))
}

// Self-Care: Gain (1d4) as armour and (1d4) as HP
const selfCare = async () => {
  const armorRoll = await requestDiceRoll('1d4')
  const healRoll = await requestDiceRoll('1d4')
  
  gainArmor(armorRoll.value, props.currentPlayer)
  healHP(healRoll.value, props.currentPlayer)
  
  showMessage(`🌍 Self-Care gains ${armorRoll.value} armor and heals ${healRoll.value} HP!`, 'hybrid')
}

// Quid-Pro-Quo: Choose to exchange up to 10 HP for 10 armour
const quidProQuo = async () => {
  const currentHP = props.playerStats[props.currentPlayer].health || 0
  const maxExchange = Math.min(10, currentHP - 1) // Can't exchange all HP (must leave at least 1)
  
  if (maxExchange <= 0) {
    showMessage(`💀 Quid-Pro-Quo: Not enough HP to exchange!`, 'warning')
    await new Promise(resolve => setTimeout(resolve, DEFAULT_SPELL_CAST_DELAY))
    return
  }
  
  // Show modal to get the HP exchange amount
  const hpToExchange = await props.showNumericModal(
    '💀 Quid-Pro-Quo',
    `Exchange HP for an equal amount of armor. You currently have ${currentHP} HP.`,
    'HP To Exchange',
    0,              // Min: 0 HP
    maxExchange,    // Max: up to 10 HP or current HP - 1 (whichever is lower)
    0               // Default: 0 HP
  )
  
  if (hpToExchange > 0) {
    // Remove HP directly (bypassing armor)
    dealDamageToHP(hpToExchange, props.currentPlayer)
    
    // Gain equal armor
    gainArmor(hpToExchange, props.currentPlayer)
    
    showMessage(`💀 Quid-Pro-Quo: Exchanged ${hpToExchange} HP for ${hpToExchange} armor!`, 'hybrid')
  } else {
    showMessage(`💀 Quid-Pro-Quo: No HP exchanged!`, 'info')
  }
}

// Burning Love: Deal 3 damage and heal 3 HP
const burningLove = async () => {
  dealDamage(3, props.opponentPlayer)
  healHP(3, props.currentPlayer)

  showMessage(`🔥 Burning Love deals 3 damage and heals 3 HP!`, 'hybrid')

  // Add a brief delay so the casting indicator is visible
  await new Promise(resolve => setTimeout(resolve, DEFAULT_SPELL_CAST_DELAY))
}

// Even Sacrifice: Deal 3 damage, if your opponents HP is now even re-activate 1 non-death dice at random
const evenSacrifice = async () => {
  dealDamage(3, props.opponentPlayer)

  const opponentHP = props.playerStats[props.opponentPlayer].health || 0
  
  await new Promise(resolve => setTimeout(resolve, 500)) // Allow time for damage to be processed

  if (opponentHP % 2 === 0) {
    // Find all used non-death dice (death emoji is 💀)
    const currentPlayerResources = props.playerResources[props.currentPlayer]
    const usedNonDeathDice = currentPlayerResources.filter(dice => dice.used && dice.emoji !== '💀')
    
    if (usedNonDeathDice.length > 0) {
      // Pick a random used non-death die
      const randomDie = usedNonDeathDice[Math.floor(Math.random() * usedNonDeathDice.length)]
      
      // Reactivate the die
      const updatedResources = currentPlayerResources.map(dice => {
        if (dice.diceIndex === randomDie.diceIndex && dice.emoji === randomDie.emoji && dice.used) {
          return { ...dice, used: false }
        }
        return dice
      })
      
      updateResources(props.currentPlayer, updatedResources)
      showMessage(`💀 HP is now even, reactivated a ${randomDie.emoji} die!`, 'hybrid')
    } else {
      showMessage(`💀 HP is now even but found no non-death dice to reactivate!`, 'damage')
    }
  } else {
    showMessage(`💀 Even Sacrifice: Dealt 3 damage, opponent HP was odd!`, 'damage')
  }
  
  // Add a brief delay so the casting indicator is visible
  await new Promise(resolve => setTimeout(resolve, DEFAULT_SPELL_CAST_DELAY))
}

// Scald: Deal (1d4) damage for each spent wind or death die, max of 10 damage
const scald = async () => {
  const currentPlayerResources = props.playerResources[props.currentPlayer]
  
  // Find all spent wind (💨) and death (💀) dice
  const spentWindAndDeathDice = currentPlayerResources.filter(dice => 
    dice.used && (dice.emoji === '💨' || dice.emoji === '💀')
  )
  
  if (spentWindAndDeathDice.length === 0) {
    showMessage(`🔥 Scald found no spent wind or death dice!`, 'warning')
    await new Promise(resolve => setTimeout(resolve, DEFAULT_SPELL_CAST_DELAY))
    return
  }else{
    showMessage(`🔥 Scald found ${spentWindAndDeathDice.length} spent dice!`, 'utility')
  }

  let totalDamage = 0
  for (let i = 0; i < spentWindAndDeathDice.length; i++) {
    const roll = await requestDiceRoll('1d4')
    totalDamage += roll.value
  }
  
  // Apply max damage cap of 10
  const finalDamage = Math.min(totalDamage, 10)
  
  dealDamage(finalDamage, props.opponentPlayer)
  showMessage(`🔥 Scald deals ${finalDamage} damage (from ${spentWindAndDeathDice.length} spent 💨/💀 dice)!`, 'damage')
}

// =============================================================================================================================
// 3-COST SPELLS
// =============================================================================================================================

// Explosion: Take 3 damage, then deal (1d4) + (2d6) as damage to your opponent
const explosion = async () => {
  dealDamage(3, props.currentPlayer)
  showMessage(`💥 Explosion self-inflicts 3 damage!`, 'damage')
  
  const d4Roll = await requestDiceRoll('1d4')
  const d6Roll1 = await requestDiceRoll('1d6')
  const d6Roll2 = await requestDiceRoll('1d6')
  const totalDamage = d4Roll.value + d6Roll1.value + d6Roll2.value
  
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

// Troubled Waters: Deal (1d6) + (1d12)  damage
const troubledWaters = async () => {
  const roll1 = await requestDiceRoll('1d6')
  const roll2 = await requestDiceRoll('1d12')

  const damage = Math.max(0, roll1.value + roll2.value)

  dealDamage(damage, props.opponentPlayer)
  showMessage(`🌊 Troubled Waters deals ${damage} damage!`, 'damage')

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

// Washed Ashore: Re-activate 4 random non-water dice
const washedAshore = async () => {
  const currentPlayerResources = props.playerResources[props.currentPlayer]
  
  // Find all used non-water dice (water emoji is 💧)
  const usedNonWaterDice = currentPlayerResources.filter(dice => dice.used && dice.emoji !== '💧')
  
  if (usedNonWaterDice.length === 0) {
    showMessage('🌊 Washed Ashore found no spent non-water dice to reactivate!', 'warning')
    return
  }
  
  // Determine how many dice to reactivate (max 4, but limited by available dice)
  const diceToReactivate = Math.min(4, usedNonWaterDice.length)
  
  // Randomly select dice to reactivate
  const shuffledDice = [...usedNonWaterDice].sort(() => Math.random() - 0.5)
  const selectedDice = shuffledDice.slice(0, diceToReactivate)
  
  // Update resources to mark selected dice as unused
  const updatedResources = currentPlayerResources.map(dice => {
    // Check if this die is one of the selected dice to reactivate
    const isSelected = selectedDice.some(selected => 
      selected.diceIndex === dice.diceIndex && 
      selected.emoji === dice.emoji && 
      dice.used
    )
    
    if (isSelected) {
      return { ...dice, used: false }
    }
    return dice
  })
  
  // Update the player's resources
  updateResources(props.currentPlayer, updatedResources)
  
  // Show message with the reactivated dice
  const diceEmojis = selectedDice.map(dice => dice.emoji).join(' ')
  showMessage(`🌊 Washed Ashore reactivates ${diceToReactivate} dice: ${diceEmojis}!`, 'utility')
  
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

// Deadly Curse: Roll (1d8), deal as damage to you and 2x that to your opponent
const deadlyCurse = async () => {
  const roll = await requestDiceRoll('1d8')
  const selfDamage = roll.value
  const opponentDamage = roll.value * 2
  
  dealDamage(selfDamage, props.currentPlayer)
  dealDamage(opponentDamage, props.opponentPlayer)
  
  showMessage(`💀 Deadly Curse: Self-inflicts ${selfDamage} damage & causes ${opponentDamage} damage!`, 'damage')
}

// Healing Burst: Heal (1d6) + 7 HP
const healingBurst = async () => {
  const healRoll = await requestDiceRoll('1d6')
  const totalHealing = healRoll.value + 7
  
  healHP(totalHealing, props.currentPlayer)
  showMessage(`💖 Healing Burst heals ${totalHealing} HP!`, 'healing')
}

// Scorching Wind: Roll (2d12) and deal the highest roll as damage, minimum of 3 damage
const scorchingWind = async () => {
  const roll1 = await requestDiceRoll('1d12')
  const roll2 = await requestDiceRoll('1d12')
  
  const highestRoll = Math.max(roll1.value, roll2.value)
  const finalDamage = Math.max(highestRoll, 3)
  
  dealDamage(finalDamage, props.opponentPlayer)
  showMessage(`🔥 Scorching Wind deals ${finalDamage} damage!`, 'damage')
}

// Back From The Dead: Re-activate 4 random non-death dice
const backFromTheDead = async () => {
  const currentPlayerResources = props.playerResources[props.currentPlayer]
  
  // Find all used non-death dice (death emoji is 💀)
  const usedNonDeathDice = currentPlayerResources.filter(dice => dice.used && dice.emoji !== '💀')
  
  if (usedNonDeathDice.length === 0) {
    showMessage('💧 Back From The Dead found no spent non-death dice to reactivate!', 'warning')
    await new Promise(resolve => setTimeout(resolve, DEFAULT_SPELL_CAST_DELAY))
    return
  }
  
  // Determine how many dice to reactivate (max 4, but limited by available dice)
  const diceToReactivate = Math.min(4, usedNonDeathDice.length)
  
  // Randomly select dice to reactivate
  const shuffledDice = [...usedNonDeathDice].sort(() => Math.random() - 0.5)
  const selectedDice = shuffledDice.slice(0, diceToReactivate)
  
  // Update resources to mark selected dice as unused
  const updatedResources = currentPlayerResources.map(dice => {
    // Check if this die is one of the selected dice to reactivate
    const isSelected = selectedDice.some(selected => 
      selected.diceIndex === dice.diceIndex && 
      selected.emoji === dice.emoji && 
      dice.used
    )
    
    if (isSelected) {
      return { ...dice, used: false }
    }
    return dice
  })
  
  // Update the player's resources
  updateResources(props.currentPlayer, updatedResources)
  
  // Show message with the reactivated dice
  const diceEmojis = selectedDice.map(dice => dice.emoji).join(' ')
  showMessage(`💧 Back From The Dead reactivates ${diceToReactivate} dice: ${diceEmojis}!`, 'utility')
  
  // Add a brief delay so the casting indicator is visible
  await new Promise(resolve => setTimeout(resolve, DEFAULT_SPELL_CAST_DELAY))
}

// Balancing Act: If your HP is evenly divisible by your armour gain 5 for both
const balancingAct = async () => {
  const currentHP = props.playerStats[props.currentPlayer].health || 0
  const currentArmor = props.playerStats[props.currentPlayer].armor || 0
  
  if (currentArmor === 0) {
    showMessage(`🌍 Balancing Act: Cannot divide by zero armor!`, 'warning')
    await new Promise(resolve => setTimeout(resolve, DEFAULT_SPELL_CAST_DELAY))
    return
  }
  
  if (currentHP % currentArmor === 0) {
    healHP(5, props.currentPlayer)
    gainArmor(5, props.currentPlayer)
    showMessage(`🌍 Balancing Act: HP (${currentHP}) is divisible by armor (${currentArmor})! Gained 5 HP and 5 armor!`, 'hybrid')
  } else {
    showMessage(`🌍 Balancing Act: HP (${currentHP}) is not divisible by armor (${currentArmor}). No effect!`, 'info')
  }
  
  // Add a brief delay so the casting indicator is visible
  await new Promise(resolve => setTimeout(resolve, DEFAULT_SPELL_CAST_DELAY))
}

// Updraft: Take (1d6) damage, if damage was 3 or less deal (1d8) + 2 damage, else deal (1d12) + 3 damage
const updraft = async () => {
  const damageRoll = await requestDiceRoll('1d6')
  const selfDamage = damageRoll.value
  
  dealDamage(selfDamage, props.currentPlayer)
  showMessage(`💀 Updraft: Inflicts ${selfDamage} self-damage!`, 'damage')
  
  if (selfDamage <= 3) {
    const attackRoll = await requestDiceRoll('1d8')
    const opponentDamage = attackRoll.value + 2
    dealDamage(opponentDamage, props.opponentPlayer)
    showMessage(`💀 Updraft: Deals ${opponentDamage} damage!`, 'damage')
  } else {
    const attackRoll = await requestDiceRoll('1d12')
    const opponentDamage = attackRoll.value + 3
    dealDamage(opponentDamage, props.opponentPlayer)
    showMessage(`💀 Updraft: Deals ${opponentDamage} damage!`, 'damage')
  }
}

// Blood For Steel: Lose (1d4) HP, Gain 9 armour
const bloodForSteel = async () => {
  const hpLossRoll = await requestDiceRoll('1d4')
  const hpLoss = hpLossRoll.value
  
  dealDamageToHP(hpLoss, props.currentPlayer)
  gainArmor(9, props.currentPlayer)
  
  showMessage(`🌍 Blood For Steel: Loses ${hpLoss} HP and gains 9 armor!`, 'hybrid')
}

// Steel Hearted: Gain HP equal to that of you or your opponents armour, max of 12 HP
const steelHearted = async () => {
  const playerArmor = props.playerStats[props.currentPlayer].armor || 0
  const opponentArmor = props.playerStats[props.opponentPlayer].armor || 0
  
  // Choose the higher armor value
  const armorToUse = Math.max(playerArmor, opponentArmor)
  const healingAmount = Math.min(armorToUse, 12)
  
  if (healingAmount > 0) {
    healHP(healingAmount, props.currentPlayer)
    showMessage(`🌍 Steel Hearted: Heals ${healingAmount} HP!`, 'healing')
  } else {
    showMessage(`🌍 Steel Hearted: No armor found to convert to healing!`, 'warning')
    await new Promise(resolve => setTimeout(resolve, DEFAULT_SPELL_CAST_DELAY))
  }
}

// Undertow: Take 2 damage, then deal (2d6) damage
const undertow = async () => {
  dealDamage(2, props.currentPlayer)
  showMessage(`💧 Undertow: Inflicts 2 self-damage!`, 'damage')
  
  const roll1 = await requestDiceRoll('1d6')
  const roll2 = await requestDiceRoll('1d6')
  const totalDamage = roll1.value + roll2.value
  
  dealDamage(totalDamage, props.opponentPlayer)
  showMessage(`💧 Undertow: Deals ${totalDamage} damage!`, 'damage')
}

// Hot Steel: Gain (1d4) + 1 armour and deal double that as damage to your opponent
const hotSteel = async () => {
  const armorRoll = await requestDiceRoll('1d4')
  const armorGained = armorRoll.value + 1
  const damageToOpponent = armorGained * 2
  
  gainArmor(armorGained, props.currentPlayer)
  dealDamage(damageToOpponent, props.opponentPlayer)
  
  showMessage(`🌍 Hot Steel: Gains ${armorGained} armor and deals ${damageToOpponent} damage!`, 'hybrid')
}

// Bay Of Leaves: Gain 3 armour and HP, gain 3 additional armour for each unspent water
const bayOfLeaves = async () => {
  const currentPlayerResources = props.playerResources[props.currentPlayer]
  const unspentWaterDice = currentPlayerResources.filter(dice => !dice.used && dice.emoji === '💧')
  
  const baseHealing = 3
  const baseArmor = 3
  const bonusArmor = unspentWaterDice.length * 3
  const totalArmor = baseArmor + bonusArmor
  
  healHP(baseHealing, props.currentPlayer)
  gainArmor(totalArmor, props.currentPlayer)
  
  showMessage(`🌍 Bay Of Leaves: Heals ${baseHealing} HP and gains ${totalArmor} armor (${bonusArmor} bonus from ${unspentWaterDice.length} water dice)!`, 'hybrid')
  
  // Add a brief delay so the casting indicator is visible
  await new Promise(resolve => setTimeout(resolve, DEFAULT_SPELL_CAST_DELAY))
}

// Firenado: Set your opponents armour to (1d4)
const firenado = async () => {
  const roll = await requestDiceRoll('1d4')
  const newArmor = roll.value
  
  updateStats(props.opponentPlayer, { armor: newArmor })

  showMessage(`🔥 Firenado: Armor was set to ${newArmor}!`, 'info')

}

// Final Breath: Call a number 1 through 15 then roll (1d20), if your number was lower deal it as damage, else take it as damage
const finalBreath = async () => {
  // Show modal to get the called number
  const calledNumber = await props.showNumericModal(
    '💀 Final Breath',
    'Call a number from 1 through 15.',
    'Called Number',
    1,    // Min: 1
    15,   // Max: 15
    1     // Default: 1 (no risk)
  )
  showMessage(`💀 Final Breath called ${calledNumber}`, 'info')
  
  // Roll the d20
  const roll = await requestDiceRoll('1d20')
  
  if (calledNumber < roll.value) {
    // Called number was lower than roll, deal called number as damage to opponent
    dealDamage(calledNumber, props.opponentPlayer)
    showMessage(`💀 Final Breath: Called ${calledNumber} < ${roll.value}, deals ${calledNumber} damage!`, 'info')
  } else {
    // Called number was higher or equal, take calledNumber value as damage
    dealDamage(calledNumber, props.currentPlayer)
    showMessage(`💀 Final Breath: Called ${calledNumber} >= ${roll.value}, inflicts ${calledNumber} self-damage!`, 'damage')
  }
}

// =============================================================================================================================
// 4-COST SPELLS
// =============================================================================================================================

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

// Even Deadlier Curse: Roll (2d6) + 1, deal as damage to you and 2x that to your opponent
const evenDeadlierCurse = async () => {
  const roll1 = await requestDiceRoll('1d6')
  const roll2 = await requestDiceRoll('1d6')
  const totalRoll = roll1.value + roll2.value + 1
  const opponentDamage = totalRoll * 2
  
  dealDamage(totalRoll, props.currentPlayer)
  dealDamage(opponentDamage, props.opponentPlayer)
  
  showMessage(`💀 Even Deadlier Curse: Takes ${totalRoll} damage & inflicts ${opponentDamage} damage!`, 'damage')
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

// Shield Bash: Deal your current armour + 3 as damage
const shieldBash = async () => {
  const currentArmor = props.playerStats[props.currentPlayer].armor || 0
  const damage = currentArmor + 3
  
  dealDamage(damage, props.opponentPlayer)
  showMessage(`🌍 Shield Bash deals ${damage} damage (${currentArmor} armor + 3)!`, 'damage')
  
  // Add a brief delay so the casting indicator is visible
  await new Promise(resolve => setTimeout(resolve, DEFAULT_SPELL_CAST_DELAY))
}

// Undercurrent: Heal (1d10) and deal (1d12) damage
const undercurrent = async () => {
  const healRoll = await requestDiceRoll('1d10')
  const damageRoll = await requestDiceRoll('1d12')
  
  healHP(healRoll.value, props.currentPlayer)
  dealDamage(damageRoll.value, props.opponentPlayer)
  
  showMessage(`💖 Undercurrent heals ${healRoll.value} HP and deals ${damageRoll.value} damage!`, 'hybrid')
}

// Total Coverage: Gain (1d6) + 1 armour, heal (1d6) + 1 HP, and deal (1d6) + 1 damage
const totalCoverage = async () => {
  const armorRoll = await requestDiceRoll('1d6')
  const healRoll = await requestDiceRoll('1d6')
  const damageRoll = await requestDiceRoll('1d6')
  
  const armorGained = armorRoll.value + 1
  const hpHealed = healRoll.value + 1
  const damageDealt = damageRoll.value + 1
  
  gainArmor(armorGained, props.currentPlayer)
  healHP(hpHealed, props.currentPlayer)
  dealDamage(damageDealt, props.opponentPlayer)
  
  showMessage(`🌍 Total Coverage: +${armorGained} armor, +${hpHealed} HP, ${damageDealt} damage!`, 'hybrid')
}

// Earthen Rage: Deal (2d8) damage directly to HP
const earthenRage = async () => {
  const roll1 = await requestDiceRoll('1d8')
  const roll2 = await requestDiceRoll('1d8')
  const totalDamage = roll1.value + roll2.value
  
  dealDamageToHP(totalDamage, props.opponentPlayer)
  showMessage(`🌍 Earthen Rage deals ${totalDamage} direct HP damage!`, 'damage')
}

// Monster Splash: Play any 4 cost spell at random
const monsterSplash = async () => {
  try {
    // Get all 4-cost spell names (excluding Monster Splash to avoid infinite loops)
    const fourCostSpells = await getSpellsByCost(4, ['Monster Splash'])
    
    if (fourCostSpells.length === 0) {
      showMessage(`🌊 Monster Splash: No other 4-cost spells available!`, 'warning')
      return
    }
    
    // Select a random 4-cost spell
    const randomSpell = fourCostSpells[Math.floor(Math.random() * fourCostSpells.length)]
    showMessage(`🌊 Monster Splash is casting ${randomSpell}!`, 'utility')
    await new Promise(resolve => setTimeout(resolve, DEFAULT_SPELL_CAST_DELAY))

    // Execute the random spell
    await executeSpell(randomSpell)
  } catch (error) {
    console.error('Monster Splash failed:', error)
    showMessage(`🌊 Monster Splash failed to cast a spell!`, 'warning')
    await new Promise(resolve => setTimeout(resolve, DEFAULT_SPELL_CAST_DELAY))
  }
}

// Elemental Panic: Roll (1d10) + 5 and choose one: 1. deal as damage, 2. gain as armour, 3. heal as HP
const elementalPanic = async () => {
  // Roll the dice first
  const roll = await requestDiceRoll('1d10')
  const rollValue = roll.value + 5
  
  showMessage(`🌍 Elemental Panic rolled ${rollValue}!`, 'info')
  
  // Present the user with choices
  const choices = [
    `Deal ${rollValue} damage to opponent`,
    `Gain ${rollValue} armor`,
    `Heal ${rollValue} HP`
  ]
  
  try {
    const choiceIndex = await props.showUserChoiceModal(
      'Elemental Panic',
      `You rolled (${roll.value}) + 5`,
      choices
    )
    
    // Apply the chosen effect
    switch (choiceIndex) {
      case 0: // Deal damage
        dealDamage(rollValue, props.opponentPlayer)
        showMessage(`🌍 Elemental Panic deals ${rollValue} damage!`, 'damage')
        break
      case 1: // Gain armor
        gainArmor(rollValue, props.currentPlayer)
        showMessage(`🌍 Elemental Panic gains ${rollValue} armor!`, 'defense')
        break
      case 2: // Heal HP
        healHP(rollValue, props.currentPlayer)
        showMessage(`🌍 Elemental Panic heals ${rollValue} HP!`, 'healing')
        break
      default:
        showMessage(`🌍 Elemental Panic: Invalid choice!`, 'warning')
        break
    }
  } catch (error) {
    console.error('Elemental Panic choice error:', error)
    showMessage(`🌍 Elemental Panic failed to get user choice!`, 'warning')
    await new Promise(resolve => setTimeout(resolve, DEFAULT_SPELL_CAST_DELAY))
  }
}

// Lay On Hands: Roll (3d20) and heal the highest roll
const layOnHands = async () => {
  const roll1 = await requestDiceRoll('1d20')
  const roll2 = await requestDiceRoll('1d20')
  const roll3 = await requestDiceRoll('1d20')
  
  const highestRoll = Math.max(roll1.value, roll2.value, roll3.value)
  
  healHP(highestRoll, props.currentPlayer)
  showMessage(`💖 Lay On Hands: Highest roll of ${highestRoll} heals ${highestRoll} HP!`, 'healing')
}

// Soul Siphon: Roll (4d6), 1s or 2s are dealt as damage to you, 3 or higher is dealt as damage to your opponent
const soulSiphon = async () => {
  let totalSelfDamage = 0
  let totalOpponentDamage = 0
  
  for (let i = 1; i <= 4; i++) {
    const roll = await requestDiceRoll('1d6')
    
    if (roll.value <= 2) {
      dealDamage(roll.value, props.currentPlayer)
      totalSelfDamage += roll.value
      showMessage(`💨 Soul Siphon inflicts ${roll.value} self-damage!`, 'damage')
    } else {
      dealDamage(roll.value, props.opponentPlayer)
      totalOpponentDamage += roll.value
      showMessage(`💨 Soul Siphon deals ${roll.value} damage!`, 'info')
    }
  }
}

// =============================================================================================================================
// 5-COST SPELLS
// =============================================================================================================================

// Chain-Lightning: Deal (1d4) damage, if roll was not a 4 deal (1d6) damage, if roll was not a 6 deal (1d12) damage
const chainLightning = async () => {
  const d4Roll = await requestDiceRoll('1d4')
  dealDamage(d4Roll.value, props.opponentPlayer)
  showMessage(`⚡ Chain Lightning deals ${d4Roll.value} damage!`, 'damage')
  
  if (d4Roll.value !== 4) {
    const d6Roll = await requestDiceRoll('1d6')
    dealDamage(d6Roll.value, props.opponentPlayer)
    showMessage(`⚡ Chain Lightning chains for ${d6Roll.value} more damage!`, 'damage')
    
    if (d6Roll.value !== 6) {
      const d12Roll = await requestDiceRoll('1d12')
      dealDamage(d12Roll.value, props.opponentPlayer)
      showMessage(`⚡ Chain Lightning chains again for ${d12Roll.value} more damage!`, 'damage')
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

// Mudslide: Roll (1d4, 1d6, 1d8, 1d10, 1d12, 1d20) and deal the highest 3 rolls as damage, max of 24 damage
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
  const totalDamage = Math.min(highest3.reduce((sum, roll) => sum + roll, 0), 24)

  dealDamage(totalDamage, props.opponentPlayer)
  showMessage(`🌊 Mudslide: Highest 3 rolls (${highest3.join(', ')}) = ${totalDamage} damage!`, 'damage')
}

// Self Destruct: First take (1d20) damage then deal (3d10) damage to your opponent
const selfDestruct = async () => {
  const selfDamageRoll = await requestDiceRoll('1d20')
  
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

// Eternal Bond: Gain your current HP as armour, max of 16 armour
const eternalBond = async () => {
  const currentHP = props.playerStats[props.currentPlayer].health || 0
  const armorToGain = Math.min(currentHP, 16)
  
  if (armorToGain > 0) {
    gainArmor(armorToGain, props.currentPlayer)
    showMessage(`🔥 Eternal Bond gains ${armorToGain} armor (from ${currentHP} HP)!`, 'defense')
  } else {
    showMessage(`🔥 Eternal Bond: No HP to convert to armor!`, 'warning')
  }
  
  // Add a brief delay so the casting indicator is visible
  await new Promise(resolve => setTimeout(resolve, DEFAULT_SPELL_CAST_DELAY))
}

// Tsunami: Set your opponents armour to 0 and deal (1d12) + 5 damage
const tsunami = async () => {
  const opponentArmor = props.playerStats[props.opponentPlayer].armor || 0
  
  // Remove all opponent armor
  updateStats(props.opponentPlayer, { armor: 0 })
  
  showMessage(`🌊 Tsunami removes all ${opponentArmor} armor!`, 'utility')
  
  // Deal (1d12) + 5 damage
  const damageRoll = await requestDiceRoll('1d12')
  const totalDamage = damageRoll.value + 5
  
  dealDamage(totalDamage, props.opponentPlayer)
  showMessage(`🌊 Tsunami deals ${totalDamage} damage!`, 'damage')
}

// Wildfire: Deal (7d4) damage to your opponent
const wildfire = async () => {
  // Roll 7d4 and deal damage after each roll
  for (let i = 1; i <= 7; i++) {
    const roll = await requestDiceRoll('1d4')
    dealDamage(roll.value, props.opponentPlayer)
    showMessage(`🔥 Wildfire roll #${i} deals ${roll.value} damage!`, 'damage')
  }
}

// Drawing Dead: Roll (4d20), the lowest roll is dealt as damage to you and the highest as damage to your opponent
const drawingDead = async () => {
  const roll1 = await requestDiceRoll('1d20')
  const roll2 = await requestDiceRoll('1d20')
  const roll3 = await requestDiceRoll('1d20')
  const roll4 = await requestDiceRoll('1d20')
  
  const allRolls = [roll1.value, roll2.value, roll3.value, roll4.value]
  const lowestRoll = Math.min(...allRolls)
  const highestRoll = Math.max(...allRolls)
  
  // Deal lowest roll as self-damage
  if (lowestRoll > 0) {
    dealDamage(lowestRoll, props.currentPlayer)
    showMessage(`💀 Drawing Dead: Lowest roll inflicts ${lowestRoll} self-damage!`, 'damage')
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  
  // Deal highest roll as damage to opponent
  if (highestRoll > 0) {
    dealDamage(highestRoll, props.opponentPlayer)
    showMessage(`💀 Drawing Dead: Highest roll deals ${highestRoll} damage!`, 'damage')
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
}


// ============================================================================
// SPELL MAP FOR PRODUCTION BUILD COMPATIBILITY
// ============================================================================

// Create a map of all spell functions for production build compatibility
const spellMap = {
  ember,
  splash,
  protect,
  gust,
  heal,
  bloodMagic,
  blaze,
  fireballs,
  biggerSplash,
  wavepool,
  wildGrowth,
  rockArmour,
  strongGusts,
  dustDevil,
  unfairDuel,
  shrunkenHeads,
  fatedHearts,
  theLovers,
  refreshingSips,
  smog,
  hotheaded,
  riskyBusiness,
  hotCoals,
  waterjet,
  aquaMortis,
  selfCare,
  quidProQuo,
  burningLove,
  evenSacrifice,
  scald,
  explosion,
  neverendingVines,
  secondChance,
  deadlySwamp,
  oddRod,
  evenSteven,
  restorativeShock,
  bloodySacrifice,
  downdraft,
  troubledWaters,
  mercifulStrike,
  washedAshore,
  luckyRitual,
  highStakes,
  deadlyCurse,
  healingBurst,
  scorchingWind,
  backFromTheDead,
  balancingAct,
  updraft,
  bloodForSteel,
  steelHearted,
  undertow,
  hotSteel,
  bayOfLeaves,
  firenado,
  finalBreath,
  thickArmour,
  rejuvinatingWaters,
  fieryPassion,
  evenDeadlierCurse,
  fireFlower,
  nullify,
  fertileSoil,
  evenTheOdds,
  shieldBash,
  undercurrent,
  totalCoverage,
  earthenRage,
  monsterSplash,
  elementalPanic,
  layOnHands,
  soulSiphon,
  chainLightning,
  revive,
  deathTaxes,
  mudslide,
  selfDestruct,
  eternalBond,
  tsunami,
  wildfire,
  drawingDead
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
    
    // Get the method from the spell map (production-safe)
    const spellFunction = spellMap[methodName]
    
    if (typeof spellFunction === 'function') {
      await spellFunction()
    } else {
      showMessage(`${spellName} is not yet implemented!`, 'warning')
      console.warn(`Spell method '${methodName}' not found in spellMap for spell '${spellName}'`)
    }
  } catch (error) {
    console.error('Error executing spell:', error)
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
