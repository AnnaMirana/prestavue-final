<template>
  <main class="page login-page">
    <section class="panel login-panel">
      <h1>Choisir un utilisateur</h1>
      <p class="muted">La page d'accueil du frontoffice liste les clients existants et propose un utilisateur anonyme.</p>

      <div class="actions">
        <button @click="loadCustomers" :disabled="loading">{{ loading ? 'Chargement...' : 'Actualiser' }}</button>
        <router-link to="/login">Backoffice</router-link>
      </div>

      <div class="user-grid">
        <button class="user-card guest" @click="loginAsGuest">
          <strong>Utilisateur anonyme</strong>
          <span>Commande sans compte</span>
        </button>

        <button v-for="c in customers" :key="c.id" class="user-card" @click="selectCustomer(c)">
          <strong>{{ c.firstname }} {{ c.lastname }}</strong>
          <span>{{ c.email }}</span>
        </button>
      </div>

      <form class="manual" @submit.prevent="handleLogin">
        <h2>Connexion manuelle</h2>
        <input v-model="email" type="email" placeholder="Email" />
        <input v-model="password" type="password" placeholder="Mot de passe" />
        <button type="submit">Se connecter</button>
        <p v-if="error" class="error">{{ error }}</p>
      </form>
    </section>
  </main>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { AuthService } from '../services/auth.service'
import { API_KEY, BASE_URL, getText, parseXml, request } from '../api/prestashop.api'

const router = useRouter()
const customers = ref([])
const loading = ref(false)
const email = ref('')
const password = ref('')
const error = ref('')

onMounted(loadCustomers)

async function loadCustomers() {
  loading.value = true
  error.value = ''
  try {
    const response = await request(`${BASE_URL}/customers?ws_key=${API_KEY}&display=[id,firstname,lastname,email]`)
    const doc = parseXml(await response.text())
    customers.value = [...doc.getElementsByTagName('customer')].map((node) => ({
      id: Number.parseInt(getText(node, 'id'), 10),
      firstname: getText(node, 'firstname', 'Client'),
      lastname: getText(node, 'lastname', ''),
      email: getText(node, 'email')
    }))
  } catch (err) {
    error.value = `Clients indisponibles: ${err.message}`
  } finally {
    loading.value = false
  }
}

function selectCustomer(customer) {
  AuthService.loginCustomer(customer.id, customer)
  router.push('/shop')
}

function loginAsGuest() {
  AuthService.loginCustomer(0, {
    id: 0,
    firstname: 'Utilisateur',
    lastname: 'anonyme',
    email: 'guest@local.test'
  })
  router.push('/shop')
}

async function handleLogin() {
  error.value = ''
  const customer = customers.value.find((item) => item.email.toLowerCase() === email.value.toLowerCase())
  if (!customer) {
    error.value = 'Client non trouve'
    return
  }
  if (!password.value) {
    error.value = 'Mot de passe obligatoire'
    return
  }
  selectCustomer(customer)
}
</script>

<style scoped>
.login-page {
  display: grid;
  min-height: 100vh;
  place-items: center;
}

.login-panel {
  width: min(920px, 100%);
}

.actions {
  display: flex;
  gap: 10px;
  margin: 18px 0;
}

.actions a {
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 10px 14px;
  text-decoration: none;
}

.user-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 12px;
}

.user-card {
  display: flex;
  min-height: 92px;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 6px;
  border: 1px solid var(--border);
  background: #fff;
  color: var(--text);
  text-align: left;
}

.user-card:hover {
  border-color: var(--primary);
  background: #f4f8ff;
}

.user-card span {
  color: var(--muted);
  font-size: 0.9rem;
}

.guest {
  background: #fff8eb;
}

.manual {
  display: grid;
  gap: 10px;
  margin-top: 24px;
  border-top: 1px solid var(--border);
  padding-top: 18px;
}
</style>
