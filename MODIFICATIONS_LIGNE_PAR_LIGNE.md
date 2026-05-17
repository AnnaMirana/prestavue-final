# 🔍 MODIFICATIONS PRÉCISES - LIGNE PAR LIGNE

## FICHIER 1️⃣ : src/services/importGlobal.service.js

### CHANGEMENT 1 : Ligne 192 - Passage de la date à createOrder()

**AVANT :**
```javascript
await createOrder(customer, cartId, cartLines, finalProductsMap, state)
```

**APRÈS :**
```javascript
const orderDate = row.date || null
// ... vérifier l'état...
await createOrder(customer, cartId, cartLines, finalProductsMap, state, orderDate)
```

**Ligne exacte :** 188-192
**Pourquoi :** Pour transmettre la date du CSV à la fonction de création de commande

---

### CHANGEMENT 2 : Ligne 425 - Stockage de la date dans le champ 'note'

**AVANT :**
```javascript
note: '',  // ou pas de note
```

**APRÈS :**
```javascript
note: orderDate ? `Date commande CSV: ${orderDate}` : '',  // 🔥 Stocke la date du CSV
```

**Ligne exacte :** 425
**Pourquoi :** PrestaShop ne permet pas de modifier date_add (read-only), donc on stocke dans note

---

## FICHIER 2️⃣ : src/views/DashboardView.vue

### CHANGEMENT 1 : Ligne 68 - Ajouter 'note' au display de listResources

**AVANT :**
```javascript
const orderRows = await listResources('orders', '[id,id_cart,id_customer,date_add,total_paid,current_state]')
```

**APRÈS :**
```javascript
const orderRows = await listResources('orders', '[id,id_cart,id_customer,date_add,total_paid,current_state,note]')
```

**Ligne exacte :** 68
**Pourquoi :** Pour récupérer le champ 'note' contenant la date du CSV

---

### CHANGEMENT 2 : Ligne 70-85 - Extraction de la date du CSV depuis la note

**AVANT :**
```javascript
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
```

**APRÈS :**
```javascript
orders.value = orderRows.map((node) => {
  const state = getText(node, 'current_state', '2')
  const note = getText(node, 'note', '')
  
  // 🔥 Extraire la date du CSV depuis la note
  let csvDate = null
  if (note && note.includes('Date commande CSV:')) {
    const match = note.match(/Date commande CSV: (\d{2}\/\d{2}\/\d{4})/)
    if (match) csvDate = match[1]
  }
  
  return {
    id: getText(node, 'id'),
    cartId: getText(node, 'id_cart'),
    customerId: getText(node, 'id_customer'),
    date: getText(node, 'date_add'),      // Date PrestaShop
    csvDate: csvDate,                      // Date du CSV
    total: Number.parseFloat(getText(node, 'total_paid', '0')) || 0,
    state,
    nextState: state === '6' ? '6' : '2'
  }
})
```

**Ligne exacte :** 70-88
**Pourquoi :** Extraire avec une regex la date stockée dans le champ 'note'

---

### CHANGEMENT 3 : Ligne 25 - Afficher la date CSV dans le tableau

**AVANT :**
```javascript
<td>{{ order.csvDate || '-' }}</td>  <!-- Cette ligne n'existait pas -->
```

**APRÈS :**
```html
<tr>
  <th>ID</th>
  <th>Date commande</th>      <!-- NOUVELLE COLONNE -->
  <th>Date import</th>
  <th>Client</th>
  <!-- ... autres colonnes -->
</tr>
<!-- Dans le tbody : -->
<td>{{ order.csvDate || '-' }}</td>  <!-- AFFICHE LA DATE CSV -->
```

**Ligne exacte :** 25 et 60
**Pourquoi :** Afficher la date du CSV dans une colonne dédiée

---

### CHANGEMENT 4 : Ligne 38 - Utiliser la date CSV dans les statistiques "Par jour"

**AVANT :**
```javascript
const dailyRows = computed(() => {
  const map = new Map()
  for (const order of orders.value) {
    const day = formatDate(order.date)  // Toujours date PrestaShop
    // ...
  }
})
```

**APRÈS :**
```javascript
const dailyRows = computed(() => {
  const map = new Map()
  for (const order of orders.value) {
    // Utiliser la date du CSV si disponible, sinon la date PrestaShop
    const day = order.csvDate || formatDate(order.date)
    // ...
  }
})
```

**Ligne exacte :** 38
**Pourquoi :** Les statistiques utilisent les vraies dates du CSV, pas celles de PrestaShop

---

### CHANGEMENT 5 : Ligne 105-110 - Filtrer les paniers 41 et 42

**AVANT :**
```javascript
carts.value = cartRows
  .map((node) => ({
    id: getText(node, 'id'),
    customerId: getText(node, 'id_customer'),
    date: getText(node, 'date_add')
  }))
  .filter((cart) => !orderedCartIds.has(cart.id))
```

**APRÈS :**
```javascript
const IGNORED_CART_IDS = [41, 42]

carts.value = cartRows
  .map((node) => ({
    id: getText(node, 'id'),
    customerId: getText(node, 'id_customer'),
    date: getText(node, 'date_add')
  }))
  .filter((cart) => !orderedCartIds.has(cart.id) && !IGNORED_CART_IDS.includes(parseInt(cart.id)))
```

**Ligne exacte :** 105-110
**Pourquoi :** Filtrer les paniers problématiques (erreur 500 à la suppression)

---

## FICHIER 3️⃣ : src/api/prestashop.api.js

### CHANGEMENT : Ajouter la nouvelle fonction updateStockDelta() à la FIN du fichier

**AJOUTER À LA FIN :**
```javascript
// 🔥 NOUVEAU : Endpoint personnalisé pour mettre à jour le stock avec un delta
export async function updateStockDelta(productId, delta) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop>
  <stock_delta>
    <id_product>${productId}</id_product>
    <id_product_attribute>0</id_product_attribute>
    <delta>${delta}</delta>
  </stock_delta>
</prestashop>`
  
  const response = await request(`${BASE_URL}/stock_deltas?ws_key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/xml' },
    body: xml
  })
  
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Erreur stock delta: ${error}`)
  }
  
  return response
}
```

**Ligne exacte :** Après la fonction setProductStock(), à la fin du fichier
**Pourquoi :** Utiliser l'endpoint personnalisé du module ws_stock_update

---

## FICHIER 4️⃣ : src/services/stock.service.js

### CHANGEMENT 1 : Ligne 1-10 - Ajouter les imports manquants

**AVANT :**
```javascript
import {
  API_KEY,
  BASE_URL,
  request,
  getProductStock,
  getText,
  listResources,
  parseXml,
  updateStockDelta
} from '../api/prestashop.api'
```

**APRÈS :**
```javascript
import {
  API_KEY,
  BASE_URL,
  request,
  getProductStock,
  getText,
  listResources,
  parseXml,
  updateStockDelta,
  buildXml,           // ✅ AJOUTÉ
  createResource,     // ✅ AJOUTÉ
  updateResource      // ✅ AJOUTÉ
} from '../api/prestashop.api'
```

**Ligne exacte :** 1-13
**Pourquoi :** Importer les fonctions nécessaires pour updateOrderState et createOrderHistory

---

### CHANGEMENT 2 : Ligne 45 - Utiliser updateStockDelta au lieu de setProductStock

**AVANT :**
```javascript
export async function addStock(productId, delta, reason = 'Ajout manuel') {
  try {
    const quantity = await getProductStock(productId)
    await setProductStock(productId, quantity + Number(delta))  // ❌ Mauvais
    
    const newStock = await getProductStock(productId)
    saveHistory(productId, Number(delta), newStock, reason)

    return {
      success: true,
      message: `${delta} unité(s) ajoutée(s). Nouveau stock: ${newStock}`
    }
  } catch (error) {
    return { success: false, message: `❌ ${error.message}` }
  }
}
```

**APRÈS :**
```javascript
export async function addStock(productId, delta, reason = 'Ajout manuel') {
  try {
    // Utiliser le nouvel endpoint stock_deltas avec delta
    await updateStockDelta(productId, delta)  // ✅ CHANGÉ
    
    // Récupérer le nouveau stock après mise à jour
    const newStock = await getProductStock(productId)
    
    // Sauvegarder l'historique
    saveHistory(productId, Number(delta), newStock, reason)

    return {
      success: true,
      message: `${delta} unité(s) ajoutée(s). Nouveau stock: ${newStock}`
    }
  } catch (error) {
    console.error('Erreur ajout stock:', error)
    return { success: false, message: `❌ ${error.message}` }
  }
}
```

**Ligne exacte :** 45-51
**Pourquoi :** Utiliser l'endpoint stock_deltas qui prend directement le delta

---

## 📊 RÉSUMÉ DES MODIFICATIONS

| Fichier | Changements | Lignes |
|---------|-------------|--------|
| importGlobal.service.js | 2 | 188-192, 425 |
| DashboardView.vue | 5 | 25, 38, 68, 70-88, 105-110 |
| prestashop.api.js | 1 | FIN DU FICHIER (nouvelle fonction) |
| stock.service.js | 2 | 1-13, 45-51 |

---

## ✅ VÉRIFICATION

Après les modifications, vous devez avoir :

```bash
# 1. Vérifier la syntaxe
npm run lint

# 2. Les fichiers doivent contenir exactement :
grep -n "Date commande CSV:" src/services/importGlobal.service.js
grep -n "IGNORED_CART_IDS" src/views/DashboardView.vue
grep -n "updateStockDelta" src/api/prestashop.api.js
grep -n "updateStockDelta" src/services/stock.service.js

# 3. Lancer l'app
npm run dev
```

