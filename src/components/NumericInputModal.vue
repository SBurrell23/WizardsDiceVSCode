<template>
  <div v-if="isVisible" class="modal-overlay">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>{{ title }}</h3>
      </div>
      
      <div class="modal-body">
        <p>{{ message }}</p>
        <div class="input-group">
          <label for="numeric-select">{{ inputLabel }}</label>
          <div class="input-wrapper">
            <select 
              id="numeric-select"
              ref="numericSelect"
              v-model.number="inputValue"
              @keyup.enter="handleConfirm"
            >
              <option 
                v-for="value in availableValues" 
                :key="value" 
                :value="value"
              >
                {{ value }}
              </option>
            </select>
          </div>
          <div v-if="minValue !== undefined || maxValue !== undefined" class="input-hint">
            <span v-if="minValue !== undefined">Min: {{ minValue }}</span>
            <span v-if="maxValue !== undefined">Max: {{ maxValue }}</span>
          </div>
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="btn btn-primary" @click="handleConfirm" :disabled="!isValidInput">Confirm</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'

// Props
const props = defineProps({
  isVisible: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: 'Enter Value'
  },
  message: {
    type: String,
    default: 'Please enter a numeric value:'
  },
  inputLabel: {
    type: String,
    default: 'Value'
  },
  minValue: {
    type: Number,
    default: undefined
  },
  maxValue: {
    type: Number,
    default: undefined
  },
  defaultValue: {
    type: Number,
    default: 0
  }
})

// Emits
const emit = defineEmits(['confirm'])

// Reactive data
const inputValue = ref(props.defaultValue)
const numericSelect = ref(null)

// Computed
const availableValues = computed(() => {
  const values = []
  const min = props.minValue ?? 0
  const max = props.maxValue ?? 10
  
  for (let i = min; i <= max; i++) {
    values.push(i)
  }
  
  return values
})

const isValidInput = computed(() => {
  if (isNaN(inputValue.value) || inputValue.value === null || inputValue.value === undefined) {
    return false
  }
  
  if (props.minValue !== undefined && inputValue.value < props.minValue) {
    return false
  }
  
  if (props.maxValue !== undefined && inputValue.value > props.maxValue) {
    return false
  }
  
  return true
})

// Watch for visibility changes to focus select
watch(() => props.isVisible, async (newValue) => {
  if (newValue) {
    inputValue.value = props.defaultValue
    await nextTick()
    if (numericSelect.value) {
      numericSelect.value.focus()
    }
  }
})

// Methods
const handleConfirm = () => {
  if (isValidInput.value) {
    emit('confirm', inputValue.value)
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(10px);
}

.modal-content {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  min-width: 350px;
  max-width: 500px;
  margin: 20px;
  animation: modalSlideIn 0.3s ease-out;
  color: white;
  font-family: 'Inter', sans-serif;
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.modal-header {
  padding: 20px 24px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.1);
}

.modal-header h3 {
  margin: 0;
  color: white;
  font-size: 1.4rem;
  font-weight: 700;
  text-align: center;
}

.modal-body {
  padding: 20px 24px;
}

.modal-body p {
  margin: 0 0 16px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 1rem;
  line-height: 1.5;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
}

.input-wrapper {
  display: flex;
  justify-content: center;
  width: 100%;
}

.input-group label {
  color: white;
  font-weight: 600;
  font-size: 0.95rem;
  text-align: center;
}

.input-group select {
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: white;
  font-size: 1.1rem;
  font-weight: 600;
  font-family: 'Inter', sans-serif;
  text-align: center;
  width: 120px;
  cursor: pointer;
  transition: all 0.2s ease;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 16px;
  padding-right: 40px;
}

.input-group select:focus {
  outline: none;
  border-color: rgba(34, 197, 94, 0.6);
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.2);
  background-color: rgba(255, 255, 255, 0.15);
}

.input-group select option {
  background: #1a1a2e;
  color: white;
  padding: 8px 12px;
}

.input-hint {
  display: flex;
  gap: 16px;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.7);
  justify-content: center;
}

.modal-footer {
  padding: 16px 24px 20px;
  display: flex;
  justify-content: center;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 120px;
  font-family: 'Inter', sans-serif;
}

.btn-primary {
  background: rgba(34, 197, 94, 0.2);
  border: 1px solid rgba(34, 197, 94, 0.6);
  color: #22c55e;
}

.btn-primary:hover:not(:disabled) {
  background: rgba(34, 197, 94, 0.3);
  border-color: rgba(34, 197, 94, 0.8);
  box-shadow: 0 0 15px rgba(34, 197, 94, 0.4);
  transform: translateY(-1px);
}

.btn-primary:disabled {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.5);
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}
</style>
