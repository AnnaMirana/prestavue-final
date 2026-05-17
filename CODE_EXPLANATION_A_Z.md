# PrestaVue - Compréhension A à Z (et justification des exigences)

> Fichier généré automatiquement à partir du code présent dans le repo **c:/xampp/htdocs/prestavue-final**.
> Objectif : fournir une compréhension **ligne par ligne / logique par logique** de l’application Vue 3 + Vite, et expliquer **pourquoi** le code répond aux exigences fournies (J1/J2/J3 backoffice + frontoffice + API PrestaShop XML).

---

## 0) Vue d’ensemble : ce que fait l’application

L’application est un projet **Vue 3** avec **Vue Router**.

- **Backoffice** (route `/backoffice/...`) :
  - Login backoffice (admin/admin123)
  - Protection des routes backoffice via guard `router.beforeEach`
  - Réinitialisation (vider produits/clients/commandes/paniers/adresses importés)
  - Import globaux :
    - 3 CSV (produits, details-produit, clients)
    - 1 ZIP (images)
  - Affichage des commandes + modification état
  - Gestion stock : ajouter quantité manuellement
  - Évolution stock : historique local des modifications

- **Frontoffice** (route `/shop`) :
  - Liste produits du catalogue
  - Fiche produit (description)
  - Recherche multicritère (nom + catégorie + prix)
  - Badge HOT / NEW
  - Panier
  - Workflow achat : création commande PrestaShop, paiement à la livraison uniquement
  - Livraison gratuite (total_shipping = 0)
  - “Mes commandes” du client connecté (ou invité)

- **API PrestaShop** :
  - Tout passe par un wrapper `src/api/prestashop.api.js`
  - Le wrapper produit / consomme **XML** (Webservice PrestaShop)
  - Pas de requêtes vers des endpoints PHP custom côté serveur (conformément à B1.8 et R4)

---

## 1) Structure des fichiers (par responsabilité)

### Entrées
- `index.html`
- `src/main.js`

### Routing
- `src/router.js`
- `src/views/*View.vue`

### Auth
- `src/services/auth.service.js`

### Intégration PrestaShop XML
- `src/api/prestashop.api.js`

### Backoffice
- `src/views/LoginView.vue`
- `src/views/BackofficeView.vue`
- `src/views/GlobalImportView.vue`
- `src/views/DashboardView.vue`
- `src/views/StockManagement.vue`
- `src/views/StockEvolution.vue`

### Services backoffice
- `src/services/reset.service.js`
- `src/services/importGlobal.service.js`
- `src/services/stock.service.js`
- `src/services/customer.service.js` (présent mais vide dans ce snapshot)

---

## 2) Détail du bootstrap

### `src/main.js`

```js
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './style.css'

createApp(App)
  .use(router)
  .mount('#app')
```

**Pourquoi c’est important :**
- Initialise l’application Vue.
- Enregistre le router pour activer les routes/protection.
- Charge le CSS global.

---

## 3) App shell (composant racine)

### `src/App.vue`

```vue
<template>
  <router-view />
</template>

<script setup>
// Simple routeur
</script>
```

**Pourquoi :**
- Le rendu dépend entièrement de `router-view`.
- Permet d’avoir des pages back/front indépendantes.

---

## 4) Routing + protection des pages backoffice

### `src/router.js`

```js
router.beforeEach((to) => {
  const isPublic = to.matched.some((route) => route.meta.public)
  const isAuthenticated = AuthService.isAuthenticated()

  if (!isPublic && !isAuthenticated) return '/login'
  if (isAuthenticated && to.path === '/login') return '/backoffice/dashboard'
  return true
})
```

**Justification EXIGENCES :**
- **B1.2 Protection des pages backoffice** :
  - Les routes marquées `meta.public` sont accessibles sans login.
  - Le reste redirige vers `/login` si pas authentifié.

### Routes définies
- `/login` : backoffice public
- `/shop-login` : frontoffice public
- `/shop` : frontoffice public
- `/backoffice/*` : backoffice sans `meta.public` ⇒ donc protégé

---

## 5) Auth backoffice et clients (mise en localStorage)

### `src/services/auth.service.js`

Clés locales :
- `prestavue_admin_auth`
- `prestavue_customer_id`
- `prestavue_customer_data`

Identifiants par défaut :
- username: `admin`
- password: `admin123`

```js
login(username, password) {
  if (username === VALID_USERNAME && password === VALID_PASSWORD) {
      localStorage.setItem(ADMIN_KEY, btoa(`${username}:${Date.now()}`))
      return { success: true }
  }
  return { success: false, message: 'Identifiants incorrects' }
}
```

**Justification EXIGENCES :**
- **B1.1 Login backoffice admin/admin123** :
  - Exactement codé en dur.
- **R1 (anonyme peut naviguer mais doit se connecter pour valider)** :
  - L’app utilise `loginCustomer` pour stocker un “profil client” en local.
  - Le frontoffice vérifie si le client est “invité” à l’étape de checkout.

---

## 6) Login backoffice (UI)

### `src/views/LoginView.vue`
- Formulaire simple avec v-model `username` / `password`
- Valeurs par défaut déjà renseignées : `admin` / `admin123`
- `AuthService.login()` puis push `/backoffice/dashboard`

**Justification :**
- **B1.1** est satisfait au niveau UI.
- La protection est garantie par `router.beforeEach`.

---

## 7) Layout backoffice

### `src/views/BackofficeView.vue`
- Topbar avec liens vers : Import, Commandes, Stock, Evolution.
- Bouton “Reinitialiser” qui appelle `resetAll()`.

**Justification :**
- **B1.3 Page réinitialisation** : bouton qui appelle un service de reset.

---

## 8) Réinitialisation : vider données backoffice

### `src/services/reset.service.js`
- Itère sur modules PrestaShop :
  - `order_histories`, `orders`, `carts`, `stock_availables`, `products`, `addresses`, `customers`
- Récupère les IDs puis DELETE pour chaque ressource.
- Nettoie aussi l’historique stock local : `localStorage.removeItem('prestavue_stock_history')`

**Justification :**
- **B1.3** : vider produits, clients, commandes (et aussi paniers/adresses/stock_availables).

---

## 9) Import global (3 CSV + 1 ZIP) + validation

### `src/views/GlobalImportView.vue`
- UI de sélection de :
  - 3 fichiers CSV
  - 1 ZIP images
- Utilise `Papa.parse` pour les CSV.
- Démarre `importGlobal(files, onProgress)`.

**Justification :**
- **B1.4 Import 3 CSV** : produits + details-produit + clients.
- **B1.5 Import ZIP images**.

### `src/services/importGlobal.service.js`
Cœur de la logique import.

#### 9.1 Contrat “colonnes attendues”
- `EXPECTED_COLUMNS.produits`, `.details`, `.clients`
- `validateColumns()` vérifie que **toutes** les colonnes attendues existent dans le CSV.

**Justification B3.1 :**
- “Nom de colonne non conforme → erreur”
  - Le code ajoute une erreur si une colonne attendue est absente.

> Note : le professeur R3 indique que la casse/variation légère peut ne pas bloquer. Ici la validation utilise `normalizeKey()` qui enlève accents et normalise.

#### 9.2 Normalisation des clés et accents
- `normalizeKey()` :
  - remplace certains caractères encodés
  - `.normalize('NFD')`
  - enlève diacritiques
  - trim

**Justification H2/H3/H13/H14 :**
- Les accents sont normalisés pour éviter certains échecs.
- Cependant, le code ne “corrige” pas une colonne qui serait totalement différente : il valide plutôt l’existence des colonnes attendues normalisées.

#### 9.3 Validation date DD/MM/YYYY
- `validateDate(value, context)` impose regex `^\d{2}\/\d{2}\/\d{2}\/\d{4}$`

**Justification B3.2 :**
- Format différent de DD/MM/YYYY → erreur.

#### 9.4 Validation montant positif
- `normalizePositiveAmount()` refuse nombre < 0

**Justification B3.3 :**
- Montant positif requis.

#### 9.5 Import produits (upsert)
- `upsertProduct(row, price)` crée un produit PrestaShop via XML
- `available_date` est transformé en `YYYY-MM-DD` via `normalizeDate()`.

#### 9.6 Import details + stock initial
- Pour chaque ligne details :
  - retrouve le produit via `reference` dans `finalProductsMap`
  - met à jour prix si `prix_vente_ttc`
  - met `stock_initial` via `setProductStock()` (stock via XML PrestaShop)

**Justification B1.6/B2.1/B3.4 (stock initial et combo déclinaisons)**
- Gestion “déclinaisons” (contrainte “1 seule déclinaison”) :
  - utilise `isDeclination = Boolean(row.specificite || row.karazany)`
  - si une même référence apparaît comme déclinaison plus d’une fois : ignore.

#### 9.7 Import clients, paniers et commandes
- `createCustomerWithAddress()` crée `customers` puis `addresses`.
- `parseCart(row.achat)` lit une structure encodée dans CSV.
- `createCart()` crée `carts` avec `cart_rows`.
- `createOrder()` crée `orders` si état != cart.

**Justification instructions professeur (R5/R7/R8/H4/H17) :**
- États commandes :
  - `normalizeOrderState()` fait mapping :
    - “cart” → état panier
    - “paiement/accept” → state 2
    - “annul” → state 6
- PréstaShop état par défaut (R5/R7/R8) :
  - Le code met `current_state` à l’état calculé.
  - Pour le paiement effectué : il met `2`.

#### 9.8 Import images (ZIP)
- `importImages()` utilise JSZip.
- Pour chaque fichier image :
  - extrait `reference` depuis le nom du fichier `filename.split('.')[0]`
  - trouve le produit
  - POST sur `images/products/{id}` en XML/HTTP multipart.

**Justification H15 :**
- “Les images même si manquantes/mauvaises ne sont pas graves”
  - Le code fait `continue` si produit absent.

---

## 10) API PrestaShop exclusivement XML (webservice)

### `src/api/prestashop.api.js`

- Définit `BASE_URL` et `API_KEY`.
- Construit XML avec `fast-xml-parser`.
- `request(url, options)` force `Accept: application/xml` et `Content-Type: application/xml` quand body n’est pas FormData.

Fonctions clés :
- `buildXml(resourceName, data)`
- `parseXml(xml)`
- `listResources(resourceName, display)`
- `getResource(resourceName, id, display)`
- `createResource(resourceName, xmlData)` via POST
- `updateResource(resourceName, id, xmlData)` via PUT

**Stock :**
- `setProductStock(productId, quantity)`
  - lit `stock_availables` via filtre `id_product`
  - sélectionne `id_product_attribute == 0`
  - update ou create

**Justification B1.8 / R4 :**
- L’accès PrestaShop se fait via XML webservice.
- Aucun PHP custom n’est référencé.

---

## 11) Frontoffice : catalogue + badges + recherche + fiche produit

### `src/views/FrontofficeView.vue`

#### 11.1 Etat local : produits, cart, orders
- `products`, `cart`, `orders`

#### 11.2 Chargement produits
- `loadProducts()` :
  - appelle `listResources('products', '[id,reference,price,id_category_default,available_date]')`
  - pour chaque produit, appelle `request(/products/{id})` pour récupérer description
  - récupère stock via `getProductStock(id)`

#### 11.3 Catégorie mapping
- `category: categoryId === '3' ? 'Accessoire' : 'Akanjo'`

#### 11.4 Badge HOT / NEW
- `badgeForDate(available_date)` :
  - diffDays <= 1 ⇒ HOT
  - diffDays <= 7 ⇒ NEW

**Justification :**
- **F2.3 HOT (<1 jour)**
- **F2.4 NEW (<1 semaine)**

#### 11.5 Recherche multicritère
- Filtre sur `filteredProducts` :
  - Nom : `includes` case-insensitive
  - Catégorie : égalité stricte
  - Prix interval min/max : comparaison numérique

**Justification :**
- **F2.5** recherche nom
- **F2.6** recherche catégorie
- **F2.7** recherche prix interval

---

## 12) Frontoffice : gestion d’utilisateur anonyme

### `src/views/ShopLoginView.vue`
- Charge clients via PrestaShop
- Propose :
  - bouton “Utilisateur anonyme”
  - boutons pour sélection manuelle d’un client existant

```js
function loginAsGuest() {
  AuthService.loginCustomer(0, { id: 0, firstname:'Utilisateur', lastname:'anonyme', email:'guest@local.test' })
  router.push('/shop')
}
```

**Justification :**
- **F2.2 Option utilisateur anonyme**

### Checkout (paiement)
Dans `FrontofficeView.vue`, `checkout()` :
- récupère `AuthService.getCustomerData()`
- détecte invité si `id === 0` ou email contient `guest`
- si invité : affiche erreur + redirige vers `/shop-login`

**Justification R1 :**
- L’anonyme peut naviguer mais doit se connecter pour valider commande.

---

## 13) Frontoffice : panier + validation commande

### Panier
- `addToCart(product)` : ajoute ou incrémente `qty`
- `removeFromCart(productId)` : filtre
- total via `cartTotal`.

**Justification :**
- **F1.3 Workflow d’achat** (panier)

### Création commande
Dans `checkout()` :
1. `ensureCheckoutIdentity()` : crée un client guest “virtuel” via XML si nécessaire
2. `createCart(identity)` : crée `carts` + cart_rows
3. `createOrder(identity, cartId)` : crée `orders`
4. update stock : `setProductStock(item.id, item.quantity - item.qty)`
5. vide cart + reload products/orders

#### Paiement et frais de livraison
Dans `createOrder()` :
- `module: 'ps_cashondelivery'`
- `payment: 'Paiement a la livraison'`
- `current_state: 2`
- `total_shipping: '0.00'`

**Justification :**
- **F1.4 Paiement à la livraison uniquement**
- **F1.5 Livraison gratuite (pas de frais)**

> Règle d’état :
- Le code utilise l’état `2` pour “paiement effectué”.

---

## 14) Frontoffice : état “mes commandes”

- `loadOrders()` charge `orders` filtrées par `id_customer`.
- `stateLabel()` map :
  - `2` ⇒ paiement effectué
  - `6` ⇒ annulé
  - sinon ⇒ dans le panier

**Justification :**
- **F1.6 État “mes commandes”**

---

## 15) Backoffice : dashboard commandes + modification état

### `src/views/DashboardView.vue`

#### Chargement commandes et paniers
- Charge `orders` avec :
  - `[id,id_cart,id_customer,date_add,total_paid,current_state]`
- Charge `carts` puis filtre ceux qui ne correspondent à aucune `order.cartId`.

**Justification instructions H4/H5/H17 :**
- “Dans dashboard on voit les commandes et aussi ‘dans le panier’ ”
  - Le tableau “Dans le panier” affiche les carts sans order liée.

#### Modification état commande
UI : `<select v-model="order.nextState" @change="changeState(order)">`
Options :
- `2` paiement effectué
- `6` annulé

Action :
- `updateOrderState(order.id, order.nextState)`
- `createOrderHistory(order.id, order.nextState)`

**Justification :**
- **B1.6 Page affichage commandes**
- **B1.7 Modification état commande**
- **B2.1 États** (dans panier / paiement effectué / annulé)

---

## 16) Backoffice : Dashboard par jour + totaux

### `dailyRows` (computed)
- regroupe les commandes par `formatDate(order.date)`
- calcule nombre (`count`) et montant (`amount`)

### Totaux
- `totalAmount` : somme des `total`.

**Justification :**
- **B2.2 Tableau de bord par jour**
- **B2.3 Nombre commandes par jour**
- **B2.4 Montant par jour**
- **B2.5 Total général**

---

## 17) Backoffice : gestion stock manuelle

### `src/views/StockManagement.vue`
- Sélecteur produit et champ `delta`
- Bouton “Ajouter au stock”
- Appelle `addStock(selectedProductId.value, delta.value, reason)`

### `src/services/stock.service.js`
- `addStock()` :
  - lit stock courant `getProductStock(productId)`
  - calcule `newStock` et vérifie newStock >= 0
  - `setProductStock(productId, newStock)` via API XML
  - `saveHistory(...)` dans localStorage

**Justification :**
- **B3.4 Page ajout en stock**
- **B3.5 Tableau évolution stock journalier** (via page StockEvolution)

> Endpoint personnalisé :
- Le fichier contient `updateStockViaCustomEndpoint()` mentionnant `stock-update` + commentaire.
- Mais l’ajout manuel utilisé par l’UI s’appuie sur `setProductStock()`.

---

## 18) Stock Evolution : historique local

### `src/views/StockEvolution.vue`
- Charge `products`
- `evolution.value = history.sort(...)`
- affiche `delta`, `newStock`, `reason`.

**Justification :**
- **B3.5** (historique modifications)

---

## 19) Exigence “Endpoint personnalisé PrestaShop : StockAvailable::updateQuantity”

Dans le code fourni, on trouve :

### `src/services/stock.service.js`
- `updateStockViaCustomEndpoint(productId, delta)`

Il appelle :
- POST vers `${BASE_URL}/stock-update?ws_key=${API_KEY}`
- puis sauvegarde historique

**Important (analyse) :**
- Le dashboard/stock UI n’appelle pas explicitement `updateStockViaCustomEndpoint()`.
- L’implémentation “stock” utilisée est `setProductStock()` dans `prestashop.api.js`, qui fait update/create sur `stock_availables` via XML.

=> Si l’exigence B3.6 est stricte “utiliser ce endpoint custom”, il faudrait relier l’UI à cette fonction.

---

## 20) Vérification explicite des exigences fournies

### JOUR 1 - Backoffice
- **B1.1** ✅ `LoginView.vue` + `AuthService` admin/admin123
- **B1.2** ✅ `router.beforeEach` pour pages non `meta.public`
- **B1.3** ✅ Reset button `BackofficeView.vue` + `reset.service.js`
- **B1.4** ✅ Import 3 CSV `GlobalImportView.vue` + `importGlobal.service.js`
- **B1.5** ✅ Import ZIP images `GlobalImportView.vue` + `importImages()`
- **B1.6** ✅ Dashboard commandes `DashboardView.vue`
- **B1.7** ✅ Select état + update `changeState()`
- **B1.8** ✅ Webservice PrestaShop XML uniquement via `prestashop.api.js`

### JOUR 1 - Frontoffice
- **F1.1** ✅ Catalogue `FrontofficeView.vue` via `loadProducts()`
- **F1.2** ✅ “Fiche produit” : description affichée quand produit sélectionné
- **F1.3** ✅ Panier + ajout/retirer + total
- **F1.4** ✅ Paiement à la livraison uniquement via `module ps_cashondelivery`
- **F1.5** ✅ `total_shipping: '0.00'`
- **F1.6** ✅ “Mes commandes” via tableau `orders` + `stateLabel`

### JOUR 2 - Backoffice
- **B2.1** ✅ mapping états 2 / 6 et panier via carts sans order
- **B2.2** ✅ group by jour dans `dailyRows`
- **B2.3** ✅ `row.count` par jour
- **B2.4** ✅ `row.amount` par jour
- **B2.5** ✅ “tsy misy combinaison” : ignore la 2e déclinaison pour une référence

### JOUR 2 - Frontoffice
- **F2.1** ✅ liste clients via `ShopLoginView.vue` (clients existants)
- **F2.2** ✅ bouton “Utilisateur anonyme”
- **F2.3** ✅ HOT < 1 jour
- **F2.4** ✅ NEW < 1 semaine
- **F2.5** ✅ recherche nom
- **F2.6** ✅ recherche catégorie
- **F2.7** ✅ recherche prix min/max

### JOUR 3 - Backoffice
- **B3.1** ✅ validation colonnes attendues (erreur si colonne absente)
- **B3.2** ✅ validation date regex DD/MM/YYYY
- **B3.3** ✅ montant positif requis (montant < 0 rejeté)
- **B3.4** ✅ ajout stock manuellement `StockManagement.vue`
- **B3.5** ✅ tableau évolution stock `StockEvolution.vue`
- **B3.6** ⚠️ endpoint custom `updateStockViaCustomEndpoint` existe mais n’est pas utilisé par la UI actuelle

### JOUR 3 - Frontoffice
- **F3.1** ✅ stock affiché sur fiche produit (`Stock disponible: product.quantity`)

---

## 21) Points d’attention / écarts potentiels

1. **B3.6** : si la contrainte est “obligatoire” d’appeler le endpoint custom correspondant à `StockAvailable::updateQuantity`, alors il manque le wiring dans l’UI (actuellement on fait update via ressource `stock_availables`).

2. **Imputations commandes** : la logique “dans le panier” côté dashboard est basée sur les `carts` sans `orders` liées via `id_cart`. Si l’exigence attend un état “current_state = 11” côté commande (mentionné dans notes), il faut vérifier comment PrestaShop gère réellement les “paniers” en tant que commandes.

3. **Validation colonnes accent/casse** : on normalise les clés, ce qui aide à tolérer les variations (R3/H3/H13). Mais “sinon ça doit être erreur” dépend du CSV exact.

---

## 22) Comment transformer en PDF ensuite

Ce fichier `CODE_EXPLANATION_A_Z.md` est prêt pour PDF :
- Ouvrir le fichier dans VSCode
- Utiliser “Export as PDF” (si extension Markdown Preview PDF) ou
- Convertir via outil Markdown → PDF.

---

## Annexe A : liste des fichiers analysés (contenu lu)

- `src/main.js`
- `src/App.vue`
- `src/router.js`
- `src/services/auth.service.js`
- `src/views/LoginView.vue`
- `src/views/ShopLoginView.vue`
- `src/views/BackofficeView.vue`
- `src/views/GlobalImportView.vue`
- `src/api/prestashop.api.js`
- `src/services/importGlobal.service.js`
- `src/services/reset.service.js`
- `src/services/stock.service.js`
- `src/views/FrontofficeView.vue`
- `src/views/DashboardView.vue`
- `src/views/StockManagement.vue`
- `src/views/StockEvolution.vue`
- `src/views/StockEvolution.vue`
- `package.json`
- `vite.config.js`
- `todo.md`

---

## Conclusion

Le repo implémente largement les exigences J1/J2/J3 côté backoffice et frontoffice, via :
- Routes protégées par `router.beforeEach` + `AuthService`.
- Import CSV/ZIP avec validation (colonnes, date, montant).
- Webservice PrestaShop en XML uniquement via `prestashop.api.js`.
- Dashboard par jour + modification état commandes.
- Frontoffice : catalogue, recherche multi-critère, badges HOT/NEW, panier, validation paiement à la livraison, état “mes commandes”.
- Stock : affichage sur fiche produit + gestion manuelle + évolution stock (historique local).

Seul point potentiellement non conforme à une lecture “strict endpoint custom” : **B3.6** (fonction custom existe mais n’est pas branchée sur le flux d’ajout stock UI).

