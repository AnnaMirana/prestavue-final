<template>
  <main class="page evolution-page">
    <section class="panel">
      <div class="title-row">
        <div>
          <h1>Evolution du stock journalier</h1>
          <p class="muted">Historique local des ajouts effectues depuis NewApp.</p>
        </div>
        <button @click="loadHistory">Actualiser</button>
      </div>

      <label>
        Produit
        <select v-model="productId" @change="loadHistory">
          <option value="">Tous</option>
          <option v-for="product in products" :key="product.id" :value="product.id">{{ product.name }}</option>
        </select>
      </label>

      <table>
        <thead>
          <tr><th>Date</th><th>Produit</th><th>Delta</th><th>Stock apres</th><th>Raison</th></tr>
        </thead>
        <tbody>
          <tr v-for="row in evolution" :key="`${row.date}-${row.productId}-${row.newStock}`">
            <td>{{ formatDate(row.date) }}</td>
            <td>{{ productName(row.productId) }}</td>
            <td>{{ row.delta }}</td>
            <td>{{ row.newStock }}</td>
            <td>{{ row.reason }}</td>
          </tr>
        </tbody>
      </table>
      <p v-if="!evolution.length" class="muted">Aucune evolution enregistree.</p>
    </section>
  </main>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { getAllStockHistory, getProductsWithStock } from '../services/stock.service'

const products = ref([])
const productId = ref('')
const evolution = ref([])

onMounted(async () => {
  products.value = await getProductsWithStock()
  loadHistory()
})

function loadHistory() {
  let history = getAllStockHistory()
  if (productId.value) history = history.filter((row) => row.productId === Number(productId.value))
  evolution.value = history.sort((a, b) => new Date(b.date) - new Date(a.date))
}

function productName(id) {
  return products.value.find((product) => product.id === Number(id))?.name || `Produit ${id}`
}

function formatDate(value) {
  return new Date(value).toLocaleDateString('fr-FR')
}
</script>

<style scoped>
.evolution-page {
  display: grid;
  gap: 18px;
}

.title-row {
  display: flex;
  justify-content: space-between;
  gap: 14px;
}

label {
  display: grid;
  max-width: 360px;
  gap: 8px;
  margin: 16px 0;
  color: var(--muted);
  font-weight: 700;
}
</style>
