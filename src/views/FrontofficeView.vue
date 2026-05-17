<template>
  <main class="page shop">
    <header class="shop-header">
      <div>
        <h1>Produits</h1>
        <p class="muted">{{ customerLabel }}</p>
      </div>
      <div class="header-actions">
        <button @click="loadProducts" :disabled="loading">{{ loading ? 'Chargement...' : 'Actualiser' }}</button>
        <button @click="logout">Changer d'utilisateur</button>
      </div>
    </header>

    <section class="panel filters">
      <input v-model="search.name" placeholder="Nom du produit" />
      <select v-model="search.category">
        <option value="">Toutes les categories</option>
        <option v-for="category in categories" :key="category" :value="category">{{ category }}</option>
      </select>
      <input v-model.number="search.priceMin" type="number" min="0" placeholder="Prix min" />
      <input v-model.number="search.priceMax" type="number" min="0" placeholder="Prix max" />
      <button @click="resetSearch">Reinitialiser</button>
    </section>

    <p v-if="error" class="error">{{ error }}</p>

    <section class="products-grid">
      <article v-for="product in filteredProducts" :key="product.id" class="product-card">
        <span v-if="product.badge" class="badge" :class="product.badge.toLowerCase()">{{ product.badge }}</span>
        <h2>{{ product.name }}</h2>
        <p class="muted">{{ product.category || 'Sans categorie' }} - ref. {{ product.reference }}</p>
        <p class="price">{{ money(product.price) }}</p>
        <p>Stock disponible: <strong>{{ product.quantity }}</strong></p>
        <p v-if="selectedProduct?.id === product.id" class="description">{{ product.description || 'Aucune description.' }}</p>
        <div class="product-actions">
          <button @click="selectedProduct = selectedProduct?.id === product.id ? null : product">Fiche produit</button>
          <input v-model.number="product.qty" type="number" min="1" :max="product.quantity || 1" />
          <button @click="addToCart(product)" :disabled="product.quantity <= 0">Ajouter</button>
        </div>
      </article>
    </section>

    <section class="panel cart">
      <h2>Panier</h2>
      <p v-if="!cart.length" class="muted">Aucun produit dans le panier.</p>
      <div v-for="item in cart" :key="item.id" class="cart-row">
        <span>{{ item.name }} x{{ item.qty }}</span>
        <strong>{{ money(item.price * item.qty) }}</strong>
        <button class="danger" @click="removeFromCart(item.id)">Retirer</button>
      </div>
      <div class="cart-total">
        <strong>Total</strong>
        <strong>{{ money(cartTotal) }}</strong>
      </div>
      <button @click="checkout" :disabled="!cart.length || ordering">
        {{ ordering ? 'Validation...' : 'Valider la commande - paiement a la livraison' }}
      </button>
    </section>

    <section class="panel orders">
      <div class="section-title">
        <h2>Mes commandes</h2>
        <button @click="loadOrders">Actualiser</button>
      </div>
      <p v-if="!orders.length" class="muted">Aucune commande.</p>
      <table v-else>
        <thead>
          <tr><th>ID</th><th>Date</th><th>Total</th><th>Etat</th></tr>
        </thead>
        <tbody>
          <tr v-for="order in orders" :key="order.id">
            <td>{{ order.id }}</td>
            <td>{{ formatDate(order.date) }}</td>
            <td>{{ money(order.total) }}</td>
            <td>{{ stateLabel(order.state) }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </main>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { AuthService } from '../services/auth.service'
import {
  API_KEY,
  BASE_URL,
  buildXml,
  createResource,
  extractIdFromXml,
  getProductStock,
  getText,
  listResources,
  parseXml,
  request,
  setProductStock
} from '../api/prestashop.api'

const router = useRouter()
const products = ref([])
const cart = ref([])
const orders = ref([])
const selectedProduct = ref(null)
const loading = ref(false)
const ordering = ref(false)
const error = ref('')
const search = ref({ name: '', category: '', priceMin: null, priceMax: null })

const customer = computed(() => AuthService.getCustomerData())
const customerLabel = computed(() => {
  const c = customer.value
  return c ? `${c.firstname || ''} ${c.lastname || ''} (${c.email})` : 'Utilisateur anonyme'
})
const categories = computed(() => [...new Set(products.value.map((p) => p.category).filter(Boolean))])
const cartTotal = computed(() => cart.value.reduce((sum, item) => sum + item.price * item.qty, 0))
const filteredProducts = computed(() => {
  return products.value.filter((product) => {
    if (search.value.name && !product.name.toLowerCase().includes(search.value.name.toLowerCase())) return false
    if (search.value.category && product.category !== search.value.category) return false
    if (search.value.priceMin !== null && search.value.priceMin !== '' && product.price < search.value.priceMin) return false
    if (search.value.priceMax !== null && search.value.priceMax !== '' && product.price > search.value.priceMax) return false
    return true
  })
})

onMounted(async () => {
  if (!customer.value) AuthService.loginCustomer(0, { id: 0, firstname: 'Utilisateur', lastname: 'anonyme', email: 'guest@local.test' })
  await loadProducts()
  await loadOrders()
})

async function loadProducts() {
  loading.value = true
  error.value = ''
  try {
    const rows = await listResources('products', '[id,reference,price,id_category_default,available_date]')
    const loaded = []
    for (const row of rows) {
      const id = getText(row, 'id')
      if (!id) continue
      const detail = await request(`${BASE_URL}/products/${id}?ws_key=${API_KEY}`)
      const doc = parseXml(await detail.text())
      const categoryId = getText(doc, 'id_category_default') || getText(row, 'id_category_default')
      loaded.push({
        id: Number.parseInt(id, 10),
        name: getText(doc, 'language', `Produit ${id}`),
        reference: getText(row, 'reference'),
        price: Number.parseFloat(getText(row, 'price', '0')) || 0,
        quantity: await getProductStock(id),
        category: categoryId === '3' ? 'Accessoire' : 'Akanjo',
        description: getText(doc, 'description_short') || getText(doc, 'description'),
        badge: badgeForDate(getText(row, 'available_date') || getText(doc, 'available_date')),
        qty: 1
      })
    }
    products.value = loaded
  } catch (err) {
    error.value = `Produits indisponibles: ${err.message}`
  } finally {
    loading.value = false
  }
}

function badgeForDate(value) {
  if (!value || value === '0000-00-00') return ''
  const date = value.includes('/') ? parseFrenchDate(value) : new Date(value)
  const diffDays = Math.floor((new Date() - date) / 86400000)
  if (diffDays >= 0 && diffDays <= 1) return 'HOT'
  if (diffDays >= 0 && diffDays <= 7) return 'NEW'
  return ''
}

function parseFrenchDate(value) {
  const [day, month, year] = value.split('/')
  return new Date(year, month - 1, day)
}

function addToCart(product) {
  const qty = Math.max(1, Math.min(Number(product.qty) || 1, product.quantity))
  const existing = cart.value.find((item) => item.id === product.id)
  if (existing) existing.qty += qty
  else cart.value.push({ ...product, qty })
  product.qty = 1
}

function removeFromCart(productId) {
  cart.value = cart.value.filter((item) => item.id !== productId)
}

function resetSearch() {
  search.value = { name: '', category: '', priceMin: null, priceMax: null }
}

async function checkout() {
  ordering.value = true
  error.value = ''
  
  try {
    // 🔥 Vérifier si l'utilisateur est connecté (pas un invité anonyme)
    const customerData = AuthService.getCustomerData()
    const isGuest = !customerData || customerData.id === 0 || customerData.email?.includes('guest')
    
    if (isGuest) {
      error.value = ' Veuillez vous connecter pour passer commande'
      setTimeout(() => {
        router.push('/shop-login')
      }, 2000)
      ordering.value = false
      return
    }
    
    // Récupérer ou créer l'identité (pour les clients connectés)
    const identity = await ensureCheckoutIdentity()
    
    // Créer le panier
    const cartId = await createCart(identity)
    
    // Créer la commande
    await createOrder(identity, cartId)
    
    // Mettre à jour le stock
    for (const item of cart.value) {
      await setProductStock(item.id, Math.max(0, item.quantity - item.qty))
    }
    
    // Vider le panier et rafraîchir
    cart.value = []
    await loadProducts()
    await loadOrders()
    
    alert('Commande validée. Paiement à la livraison, sans frais de livraison.')
    
  } catch (err) {
    console.error('Erreur checkout:', err)
    error.value = ` ${err.message}`
    
    if (err.message.includes('Creation orders impossible')) {
      error.value = ' Impossible de créer la commande. Vérifiez que vous êtes connecté.'
    }
  } finally {
    ordering.value = false
  }
}

async function ensureCheckoutIdentity() {
  const c = customer.value || {}
  if (c.id && c.id !== 0) {
    const addressId = await getAddressId(c.id)
    return { id: c.id, addressId, firstname: c.firstname || 'Client', lastname: c.lastname || 'Client', email: c.email }
  }
  const stamp = Date.now()
  const customerXml = buildXml('customers', {
    firstname: 'Utilisateur',
    lastname: 'anonyme',
    email: `guest${stamp}@local.test`,
    passwd: 'guestpassword',
    active: 1,
    id_default_group: 3,
    id_lang: 1
  })
  const id = extractIdFromXml(await createResource('customers', customerXml))
  const addressId = await createAddress({ id, firstname: 'Utilisateur', lastname: 'anonyme' })
  return { id, addressId, firstname: 'Utilisateur', lastname: 'anonyme', email: `guest${stamp}@local.test` }
}

async function getAddressId(customerId) {
  const response = await request(`${BASE_URL}/addresses?filter[id_customer]=${customerId}&ws_key=${API_KEY}&display=[id]`)
  const doc = parseXml(await response.text())
  const id = getText(doc, 'id')
  if (id) return id
  const c = customer.value
  return createAddress({ id: customerId, firstname: c.firstname || 'Client', lastname: c.lastname || 'Client' })
}

async function createAddress(c) {
  const xml = buildXml('addresses', {
    id_customer: c.id,
    id_country: 8,
    alias: 'Adresse principale',
    firstname: c.firstname,
    lastname: c.lastname,
    address1: 'France',
    postcode: '75001',
    city: 'Paris',
    active: 1
  })
  return extractIdFromXml(await createResource('addresses', xml))
}

async function createCart(identity) {
  const xml = buildXml('carts', {
    id_currency: 1,
    id_lang: 1,
    id_customer: identity.id,
    id_address_delivery: identity.addressId,
    id_address_invoice: identity.addressId,
    associations: {
      cart_rows: {
        cart_row: cart.value.map((item) => ({
          id_product: item.id,
          id_product_attribute: 0,
          id_address_delivery: identity.addressId,
          quantity: item.qty
        }))
      }
    }
  })
  return extractIdFromXml(await createResource('carts', xml))
}

async function createOrder(identity, cartId) {
  const xml = buildXml('orders', {
    id_address_delivery: identity.addressId,
    id_address_invoice: identity.addressId,
    id_cart: cartId,
    id_currency: 1,
    id_lang: 1,
    id_customer: identity.id,
    id_carrier: 1,
    current_state: 2,
    module: 'ps_cashondelivery',
    payment: 'Paiement a la livraison',
    conversion_rate: '1.000000',
    total_paid: cartTotal.value.toFixed(2),
    total_paid_real: cartTotal.value.toFixed(2),
    total_products: cartTotal.value.toFixed(2),
    total_products_wt: cartTotal.value.toFixed(2),
    total_shipping: '0.00',
    associations: {
      order_rows: {
        order_row: cart.value.map((item) => ({
          product_id: item.id,
          product_attribute_id: 0,
          product_quantity: item.qty,
          product_name: item.name,
          product_reference: item.reference,
          product_price: item.price.toFixed(2)
        }))
      }
    }
  })
  return createResource('orders', xml)
}

async function loadOrders() {
  const c = customer.value
  if (!c || !c.id) {
    orders.value = []
    return
  }
  try {
    const response = await request(`${BASE_URL}/orders?filter[id_customer]=${c.id}&ws_key=${API_KEY}&display=[id,date_add,total_paid,current_state]`)
    const doc = parseXml(await response.text())
    orders.value = [...doc.getElementsByTagName('order')].map((node) => ({
      id: getText(node, 'id'),
      date: getText(node, 'date_add'),
      total: Number.parseFloat(getText(node, 'total_paid', '0')) || 0,
      state: getText(node, 'current_state')
    }))
  } catch {
    orders.value = []
  }
}

function stateLabel(state) {
  if (String(state) === '2') return 'paiement effectue'
  if (String(state) === '6') return 'annule'
  return 'dans le panier'
}

function money(value) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(value) || 0)
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('fr-FR') : '-'
}

function logout() {
  AuthService.logoutCustomer()
  router.push('/shop-login')
}
</script>

<style scoped>
.shop {
  display: grid;
  gap: 18px;
}

.shop-header,
.section-title,
.cart-row,
.cart-total {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.header-actions,
.product-actions {
  display: flex;
  gap: 8px;
}

.filters {
  display: grid;
  grid-template-columns: 1.5fr 1fr 1fr 1fr auto;
  gap: 10px;
}

.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 14px;
}

.product-card {
  position: relative;
  display: grid;
  gap: 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
  padding: 18px;
}

.product-card h2 {
  margin: 0;
}

.price {
  font-size: 1.35rem;
  font-weight: 700;
}

.badge {
  position: absolute;
  top: 12px;
  right: 12px;
  border-radius: 999px;
  padding: 4px 10px;
  color: #fff;
  font-size: 0.78rem;
  font-weight: 700;
}

.hot {
  background: #e74c3c;
}

.new {
  background: #3498db;
}

.product-actions input {
  width: 82px;
}

.cart,
.orders {
  display: grid;
  gap: 12px;
}

@media (max-width: 780px) {
  .filters,
  .shop-header,
  .header-actions,
  .product-actions {
    grid-template-columns: 1fr;
    flex-direction: column;
    align-items: stretch;
  }
}
</style>