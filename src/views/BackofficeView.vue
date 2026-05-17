<template>
  <div class="backoffice">
    <header class="topbar">
      <strong>PrestaVue Backoffice</strong>
      <nav>
        <router-link to="/backoffice/import">Import</router-link>
        <router-link to="/backoffice/dashboard">Commandes</router-link>
        <router-link to="/backoffice/stock">Stock</router-link>
        <router-link to="/backoffice/stock-evolution">Evolution stock</router-link>
      </nav>
      <button class="danger" @click="handleReset" :disabled="resetting">
        {{ resetting ? 'Reinitialisation...' : 'Reinitialiser' }}
      </button>
      <button @click="handleLogout">Deconnexion</button>
    </header>

    <router-view />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { AuthService } from '../services/auth.service'
import { resetAll } from '../services/reset.service'

const router = useRouter()
const resetting = ref(false)

const handleReset = async () => {
  if (!confirm('Supprimer les produits, clients, commandes, paniers et adresses importes ?')) return
  resetting.value = true
  try {
    await resetAll()
    alert('Reinitialisation terminee')
  } catch (error) {
    alert(`Erreur reinitialisation: ${error.message}`)
  } finally {
    resetting.value = false
  }
}

const handleLogout = () => {
  AuthService.logout()
  router.push('/login')
}
</script>

<style scoped>
.backoffice {
  min-height: 100vh;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  padding: 12px 18px;
  background: #111827;
  color: #fff;
}

.topbar nav {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 8px;
}

.topbar a {
  border-radius: 6px;
  padding: 8px 10px;
  text-decoration: none;
  color: #d7dee8;
}

.topbar a.router-link-active {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}
</style>
