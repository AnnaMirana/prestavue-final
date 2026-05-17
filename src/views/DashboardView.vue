<template>
  <main class="page dashboard">
    <section class="title-row">
      <div>
        <h1>Tableau de bord</h1>
        <p class="muted">Commandes par jour, total general et modification d'etat.</p>
      </div>
      <button @click="loadData" :disabled="loading">{{ loading ? 'Chargement...' : 'Actualiser' }}</button>
    </section>

    <section class="stats">
      <div class="panel stat"><span>Nb commandes</span><strong>{{ orders.length }}</strong></div>
      <div class="panel stat"><span>Montant total</span><strong>{{ money(totalAmount) }}</strong></div>
      <div class="panel stat"><span>Paniers</span><strong>{{ carts.length }}</strong></div>
    </section>

    <section class="panel">
      <h2>Par jour</h2>
      <table>
        <thead><tr><th>Jour</th><th>Nb commande</th><th>Montant</th></tr></thead>
        <tbody>
          <tr v-for="row in dailyRows" :key="row.day">
            <td>{{ row.day }}</td>
            <td>{{ row.count }}</td>
            <td>{{ money(row.amount) }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="panel">
      <h2>Commandes</h2>
      <table>
        <thead>
          <tr><th>ID</th><th>Date</th><th>Client</th><th>Total</th><th>Etat</th><th>Action</th></tr>
        </thead>
        <tbody>
          <tr v-for="order in orders" :key="order.id">
            <td>{{ order.id }}</td>
            <td>{{ formatDate(order.date) }}</td>
            <td>{{ order.customerId }}</td>
            <td>{{ money(order.total) }}</td>
            <td>{{ stateLabel(order.state) }}</td>
            <td>
              <select v-model="order.nextState" @change="changeState(order)">
                <option value="2">paiement effectue</option>
                <option value="6">annule</option>
              </select>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="!orders.length" class="muted">Aucune commande.</p>
    </section>

    <section class="panel">
      <h2>Dans le panier</h2>
      <table>
        <thead><tr><th>ID panier</th><th>Client</th><th>Date</th></tr></thead>
        <tbody>
          <tr v-for="cart in carts" :key="cart.id">
            <td>{{ cart.id }}</td>
            <td>{{ cart.customerId || '-' }}</td>
            <td>{{ formatDate(cart.date) }}</td>
          </tr>
        </tbody>
      </table>
      <p v-if="!carts.length" class="muted">Aucun panier.</p>
    </section>

    <p v-if="message" :class="messageType">{{ message }}</p>
  </main>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { getText, listResources } from '../api/prestashop.api'
import { createOrderHistory, updateOrderState } from '../services/stock.service'

const orders = ref([])
const carts = ref([])
const loading = ref(false)
const message = ref('')
const messageType = ref('success')

const totalAmount = computed(() => orders.value.reduce((sum, order) => sum + order.total, 0))
const dailyRows = computed(() => {
  const map = new Map()
  for (const order of orders.value) {
    const day = formatDate(order.date)
    const row = map.get(day) || { day, count: 0, amount: 0 }
    row.count++
    row.amount += order.total
    map.set(day, row)
  }
  return [...map.values()].sort((a, b) => b.day.localeCompare(a.day))
})

onMounted(loadData)

async function loadData() {
  loading.value = true
  message.value = ''
  try {
    const orderRows = await listResources('orders', '[id,id_cart,id_customer,date_add,total_paid,current_state]')
    orders.value = orderRows.map((node) => {
      const state = getText(node, 'current_state', '2')
      return {
        id: getText(node, 'id'),
        cartId: getText(node, 'id_cart'),
        customerId: getText(node, 'id_customer'),
        date: getText(node, 'date_add'),
        total: Number.parseFloat(getText(node, 'total_paid', '0')) || 0,
        state,
        nextState: state === '6' ? '6' : '2'
      }
    })

    const cartRows = await listResources('carts', '[id,id_customer,date_add]')
    const orderedCartIds = new Set(orders.value.map((order) => order.cartId).filter(Boolean))
    carts.value = cartRows
      .map((node) => ({
        id: getText(node, 'id'),
        customerId: getText(node, 'id_customer'),
        date: getText(node, 'date_add')
      }))
      .filter((cart) => !orderedCartIds.has(cart.id))
  } catch (error) {
    message.value = `Erreur: ${error.message}`
    messageType.value = 'error'
  } finally {
    loading.value = false
  }
}

async function changeState(order) {
  try {
    await updateOrderState(order.id, order.nextState)
    await createOrderHistory(order.id, order.nextState).catch(() => {})
    order.state = order.nextState
    message.value = 'Etat de commande mis a jour'
    messageType.value = 'success'
  } catch (error) {
    message.value = `Mise a jour impossible: ${error.message}`
    messageType.value = 'error'
  }
}

function stateLabel(state) {
  if (String(state) === '6') return 'annule'
  if (String(state) === '2') return 'paiement effectue'
  return 'dans le panier'
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('fr-FR') : '-'
}

function money(value) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(value) || 0)
}
</script>

<style scoped>
.dashboard {
  display: grid;
  gap: 18px;
}

.title-row,
.stats {
  display: flex;
  gap: 14px;
  align-items: stretch;
  justify-content: space-between;
}

.stat {
  flex: 1;
}

.stat span {
  color: var(--muted);
}

.stat strong {
  display: block;
  margin-top: 8px;
  font-size: 1.8rem;
}

td select {
  min-width: 180px;
}

@media (max-width: 760px) {
  .title-row,
  .stats {
    flex-direction: column;
  }
}
</style>
