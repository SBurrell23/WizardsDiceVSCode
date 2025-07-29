<template>
  <div v-if="isVisible" class="modal-overlay">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>{{ title }}</h3>
      </div>
      <div class="modal-body">
        <p>{{ promptText }}</p>
        <div class="choices-container">
          <button 
            v-for="(choice, index) in choices" 
            :key="index"
            class="choice-button"
            @click="handleChoice(index)"
          >
            {{ choice }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

// Props
const props = defineProps({
  isVisible: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: 'Choose an Option'
  },
  promptText: {
    type: String,
    default: 'Please select one of the following options:'
  },
  choices: {
    type: Array,
    required: true,
    validator: (choices) => choices.length > 0 && choices.every(choice => typeof choice === 'string')
  }
})

// Emits
const emit = defineEmits(['choice-made'])

// Methods
const handleChoice = (index) => {
  emit('choice-made', index)
}

// Focus management
watch(() => props.isVisible, (newVisible) => {
  if (newVisible) {
    // Focus the first button when modal becomes visible
    setTimeout(() => {
      const firstButton = document.querySelector('.choice-button')
      if (firstButton) {
        firstButton.focus()
      }
    }, 100)
  }
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal-content {
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border: 1px solid rgba(255, 255, 255, 0.2);
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
  text-align: center;
}

.choices-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.choice-button {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: rgba(255, 255, 255, 0.8);
  border-radius: 8px;
  padding: 12px 24px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 120px;
  font-family: 'Inter', sans-serif;
  text-align: center;
}

.choice-button:hover {
  background: rgba(34, 197, 94, 0.2);
  border: 1px solid rgba(34, 197, 94, 0.6);
  color: #22c55e;
  box-shadow: 0 0 15px rgba(34, 197, 94, 0.4);
  transform: translateY(-1px);
}

.choice-button:focus {
  outline: none;
  background: rgba(34, 197, 94, 0.2);
  border: 1px solid rgba(34, 197, 94, 0.6);
  color: #22c55e;
  box-shadow: 0 0 15px rgba(34, 197, 94, 0.4);
}

.choice-button:active {
  transform: translateY(0);
  box-shadow: 0 0 10px rgba(34, 197, 94, 0.3);
}

/* Responsive design */
@media (max-width: 768px) {
  .modal-content {
    min-width: 90%;
    max-width: 90%;
    margin: 1rem;
  }
  
  .modal-header h3 {
    font-size: 1.2rem;
  }
  
  .choice-button {
    padding: 10px 20px;
    font-size: 0.95rem;
  }
}
</style>
