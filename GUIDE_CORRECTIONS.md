# 🔧 FICHIERS CORRIGÉS - COPIER/COLLER DIRECT

## ⚠️ IMPORTANT
Chaque fichier ci-dessous doit **remplacer** la version existante dans votre projet.

---

## 📄 FICHIER 1: src/services/importGlobal.service.js

Les points clés des corrections :
1. **Ligne 192** : La date du CSV est passée à `createOrder()`
2. **Ligne 425** : La date est stockée dans le champ `note` 

Voici le fichier complet : [voir en bas du document]

**CHANGES CLÉS :**
```javascript
// ✅ Ligne 190-192 : passage de orderDate à createOrder()
const orderDate = row.date || null
if (state === 'cart') {
  report.orders.carts++
  continue
}
await createOrder(customer, cartId, cartLines, finalProductsMap, state, orderDate)  // ✅ orderDate passé


// ✅ Ligne 425 : stockage de la date dans 'note'
note: orderDate ? \`Date commande CSV: \${orderDate}\` : '',  // 🔥 Stocke la date du CSV
```

---

## 📄 FICHIER 2: src/views/DashboardView.vue

**CHANGES CLÉS :**
```javascript
// ✅ Ligne 75-80 : extraction de la date du champ 'note'
const note = getText(node, 'note', '')

// 🔥 Extraire la date du CSV depuis la note
let csvDate = null
if (note && note.includes('Date commande CSV:')) {
  const match = note.match(/Date commande CSV: (\d{2}\/\d{2}\/\d{4})/)
  if (match) csvDate = match[1]
}

// ✅ Ligne 88 : affichage de la date CSV
csvDate: csvDate,  // Date du CSV


// ✅ Ligne 105-110 : filtrage des paniers 41 et 42
const IGNORED_CART_IDS = [41, 42]

carts.value = cartRows
  .map((node) => ({
    id: getText(node, 'id'),
    customerId: getText(node, 'id_customer'),
    date: getText(node, 'date_add')
  }))
  .filter((cart) => !orderedCartIds.has(cart.id) && !IGNORED_CART_IDS.includes(parseInt(cart.id)))
```

---

## 📄 FICHIER 3: src/api/prestashop.api.js

**CHANGES CLÉS :**
```javascript
// ✅ NOUVEAU : Endpoint stock_deltas (ajouter à la fin du fichier)
export async function updateStockDelta(productId, delta) {
  const xml = \`<?xml version="1.0" encoding="UTF-8"?>
<prestashop>
  <stock_delta>
    <id_product>\${productId}</id_product>
    <id_product_attribute>0</id_product_attribute>
    <delta>\${delta}</delta>
  </stock_delta>
</prestashop>\`
  
  const response = await request(\`\${BASE_URL}/stock_deltas?ws_key=\${API_KEY}\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/xml' },
    body: xml
  })
  
  if (!response.ok) {
    const error = await response.text()
    throw new Error(\`Erreur stock delta: \${error}\`)
  }
  
  return response
}
```

---

## 📄 FICHIER 4: src/services/stock.service.js

**CHANGES CLÉS :**
```javascript
// ✅ Ligne 1-10 : import updateStockDelta et buildXml
import {
  API_KEY,
  BASE_URL,
  request,
  getProductStock,
  getText,
  listResources,
  parseXml,
  updateStockDelta,  // ✅ AJOUTÉ
  buildXml,          // ✅ AJOUTÉ
  createResource,    // ✅ AJOUTÉ
  updateResource     // ✅ AJOUTÉ
} from '../api/prestashop.api'

// ✅ Ligne 45-48 : utiliser updateStockDelta au lieu de setProductStock
export async function addStock(productId, delta, reason = 'Ajout manuel') {
  try {
    // Utiliser le nouvel endpoint stock_deltas avec delta
    await updateStockDelta(productId, delta)  // ✅ CHANGÉ
    
    // Récupérer le nouveau stock après mise à jour
    const newStock = await getProductStock(productId)
    // ... reste du code
```

---

## 📊 RÉSUMÉ DES CORRECTIONS

| Fichier | Correction | Ligne(s) |
|---------|-----------|---------|
| importGlobal.service.js | Date CSV passée à createOrder() | 192 |
| importGlobal.service.js | Date stockée dans note | 425 |
| DashboardView.vue | Extraction date du champ note | 75-80 |
| DashboardView.vue | Affichage csvDate | 88 |
| DashboardView.vue | Filtrage paniers 41/42 | 105-110 |
| prestashop.api.js | Nouveau endpoint updateStockDelta | FIN |
| stock.service.js | Imports mises à jour | 1-10 |
| stock.service.js | Utilise updateStockDelta | 45 |

---

## ✅ VÉRIFICATION AVANT DÉPLOIEMENT

```bash
# 1. Vérifier la syntaxe JavaScript
npm run lint

# 2. Tester l'import avec le CSV
# Aller sur GlobalImportView.vue et tester avec vos fichiers CSV

# 3. Vérifier le dashboard
# Vérifier que les dates s'affichent dans "Date commande"

# 4. Vérifier les paniers
# Vérifier que paniers 41 et 42 ne s'affichent plus

# 5. Tester stock_deltas
# Aller sur StockManagement.vue et ajouter/retirer du stock
```

---

## 🆘 EN CAS D'ERREUR

### Erreur : "updateStockDelta is not defined"
→ Vérifier que prestashop.api.js a la fonction `updateStockDelta` à la fin

### Erreur : "csvDate undefined"
→ Vérifier que DashboardView.vue récupère le champ `note` avec getText()

### Erreur : "Paniers 41 et 42 apparaissent toujours"
→ Vérifier la constante IGNORED_CART_IDS = [41, 42] dans loadData()

### Erreur : "Stock delta endpoint not found"
→ Vérifier que le module ws_stock_update.zip est installé dans PrestaShop

---

## 📋 FICHIERS À NE PAS MODIFIER

❌ Ne pas toucher à :
- `src/router.js`
- `src/App.vue`
- `src/main.js`
- `src/components/`
- `public/`
- `package.json`

✅ Les seuls fichiers à modifier sont :
- `src/services/importGlobal.service.js`
- `src/views/DashboardView.vue`
- `src/api/prestashop.api.js`
- `src/services/stock.service.js`

