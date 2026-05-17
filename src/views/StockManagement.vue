<template>
  <main class="page stock-page">
    <section class="panel">
      <div class="title-row">
        <div>
          <h1>Ajout de stock</h1>
          <p class="muted">Ajoute une quantite au stock disponible du produit selectionne.</p>
        </div>
        <button @click="loadProducts">Actualiser</button>
      </div>

      <div class="form-grid">
        <label>
          Produit
          <select v-model="selectedProductId">
            <option value="">Choisir un produit</option>
            <option v-for="product in products" :key="product.id" :value="product.id">
              {{ product.name }} ({{ product.reference }}) - stock {{ product.stock }}
            </option>
          </select>
        </label>
        <label>
          Quantite a ajouter
          <input v-model.number="delta" type="number" min="1" step="1" />
        </label>
        <label>
          Motif
          <input v-model="reason" placeholder="Ajout manuel" />
        </label>
      </div>

      <button @click="handleAddStock" :disabled="!selectedProductId || delta <= 0 || loading">
        {{ loading ? 'Mise a jour...' : 'Ajouter au stock' }}
      </button>

      <p v-if="message" :class="messageType">{{ message }}</p>
    </section>
  </main>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { addStock, getProductsWithStock } from '../services/stock.service'

const products = ref([])
const selectedProductId = ref('')
const delta = ref(1)
const reason = ref('Ajout manuel')
const loading = ref(false)
const message = ref('')
const messageType = ref('success')

const selectedProduct = computed(() => products.value.find((product) => product.id === Number(selectedProductId.value)))

onMounted(loadProducts)

async function loadProducts() {
  products.value = await getProductsWithStock()
}

async function handleAddStock() {
  loading.value = true
  message.value = ''
  try {
    const result = await addStock(selectedProductId.value, delta.value, reason.value || 'Ajout manuel')
    if (result.success) {
      if (selectedProduct.value) selectedProduct.value.stock += Number(delta.value)
      message.value = result.message
      messageType.value = 'success'
      delta.value = 1
      reason.value = 'Ajout manuel'
    } else {
      message.value = result.message
      messageType.value = 'error'
    }
  } catch (error) {
    message.value = error.message
    messageType.value = 'error'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.stock-page {
  display: grid;
  gap: 18px;
}

.title-row {
  display: flex;
  justify-content: space-between;
  gap: 14px;
}

.form-grid {
  display: grid;
  gap: 14px;
  margin: 18px 0;
}

label {
  display: grid;
  gap: 8px;
  color: var(--muted);
  font-weight: 700;
}
</style>