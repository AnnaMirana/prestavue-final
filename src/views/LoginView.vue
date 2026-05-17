<template>
  <main class="page login-page">
    <form class="panel login-card" @submit.prevent="handleLogin">
      <h1>Backoffice</h1>
      <p class="muted">Identifiants par defaut deja renseignes.</p>
      <input v-model="username" type="text" autocomplete="username" />
      <input v-model="password" type="password" autocomplete="current-password" />
      <p v-if="error" class="error">{{ error }}</p>
      <button type="submit" :disabled="loading">{{ loading ? 'Connexion...' : 'Se connecter' }}</button>
      <router-link to="/shop-login">Retour frontoffice</router-link>
    </form>
  </main>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { AuthService } from '../services/auth.service'

const router = useRouter()
const username = ref('admin')
const password = ref('admin123')
const error = ref('')
const loading = ref(false)

function handleLogin() {
  loading.value = true
  error.value = ''
  const result = AuthService.login(username.value, password.value)
  if (result.success) router.push('/backoffice/dashboard')
  else error.value = result.message
  loading.value = false
}
</script>

<style scoped>
.login-page {
  display: grid;
  min-height: 100vh;
  place-items: center;
}

.login-card {
  display: grid;
  width: min(420px, 100%);
  gap: 12px;
}

.login-card a {
  color: var(--primary);
  text-align: center;
  text-decoration: none;
}
</style>
