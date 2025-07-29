<script setup>
import { onMounted } from 'vue'
import LandingPage from './components/LandingPage.vue'
import SoundController from './components/SoundController.vue'

// Note: Background music will start automatically after first user interaction
// due to browser autoplay policies
onMounted(() => {
  console.log('App mounted - background music will start after user interaction')
})
</script>

<template>
  <LandingPage />
  <SoundController />
</template>

<style>
/* Global styles */
html, body {
  margin: 0;
  padding: 0;
  height: 100vh;
  overflow: hidden;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

* {
  box-sizing: border-box;
}
</style>
