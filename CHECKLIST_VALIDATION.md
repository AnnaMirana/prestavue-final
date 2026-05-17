# ✅ CHECKLIST DE VALIDATION - PrestaVue

## 🔍 VÉRIFICATIONS AVANT PRÉSENTATION

### 1. DATES DES COMMANDES ✅

**À tester :**
- [ ] Importer un CSV avec une colonne "date"
- [ ] Vérifier que les dates sont au format DD/MM/YYYY
- [ ] Aller au Dashboard
- [ ] Cliquer sur "Actualiser"
- [ ] **Résultat attendu:** Colonne "Date commande" affiche les dates (ex: 16/04/2026)

**Fichiers vérifiés :**
- [x] `src/services/importGlobal.service.js` ligne 459 : `note: orderDate ? \`Date commande CSV: \${orderDate}\` : ''`
- [x] `src/views/DashboardView.vue` ligne 127-128 : Extraction regex de la date
- [x] `src/views/DashboardView.vue` ligne 25 : Colonne affichée dans le tableau

---

### 2. PANIERS RÉSIDUELS ✅

**À tester :**
- [ ] Actualiser le Dashboard
- [ ] Regarder la section "Dans le panier"
- [ ] **Résultat attendu:** Les paniers 41 et 42 ne s'affichent PAS

**Fichiers vérifiés :**
- [x] `src/views/DashboardView.vue` ligne 148 : `const IGNORED_CART_IDS = [41, 42]`
- [x] `src/views/DashboardView.vue` ligne 156 : Filtre appliqué

---

### 3. MISE À JOUR DE STOCK ✅

**À tester :**
- [ ] Aller sur "Gestion du stock"
- [ ] Ajouter du stock à un produit
- [ ] Ouvrir la console (F12)
- [ ] **Résultat attendu:** 
  - L'endpoint POST `/stock_deltas` est appelé
  - Pas d'erreur 500
  - Le stock est mis à jour

**Fichiers vérifiés :**
- [x] `src/api/prestashop.api.js` ligne 147 : Fonction `updateStockDelta()` existe
- [x] `src/services/stock.service.js` ligne 51 : Appelle `updateStockDelta()`

---

### 4. CRÉATION DE COMMANDES ✅

**À tester :**
- [ ] Importer un CSV clients avec l'état "paiement accepté"
- [ ] Vérifier dans le Dashboard
- [ ] **Résultat attendu:** Les commandes apparaissent avec le bon état

**Fichiers vérifiés :**
- [x] `src/services/importGlobal.service.js` ligne 188-192 : Date passée à createOrder()
- [x] `src/services/importGlobal.service.js` ligne 425 : Date stockée dans note

---

## 🧪 TESTS DÉTAILLÉS

### Test 1: Import CSV avec dates

```csv
date,nom,email,pwd,adresse,achat,etat
16/04/2026,Rakoto,rakoto@yopmail.com,pwd123,Andoharano,"[(""T_01"";3;""ngoza"")]",paiement accepté
```

**Étapes :**
1. Aller sur "Import global"
2. Charger le fichier CSV
3. Attendre la validation
4. Vérifier le rapport : doit dire "✅ Clients: 1/1" et "Commandes: 1/1"

**Résultat attendu :**
```
✅ Produits: X/X | Détails: X/X | Clients: 1/1 | Commandes: 1/1 | Images: X
```

---

### Test 2: Dashboard affichage dates

**Étapes :**
1. Aller sur "Dashboard"
2. Cliquer "Actualiser"
3. Regarder le tableau "Commandes"

**Résultat attendu :**
```
| ID  | Date commande | Date import | Client | Total  | Etat              | Action        |
|-----|---------------|-------------|--------|--------|-------------------|---------------|
| 142 | 16/04/2026    | 17/05/2026  | 5      | 37.50€ | paiement effectué | [Dropdown]    |
```

---

### Test 3: Filtrage paniers 41 et 42

**Étapes :**
1. Aller sur "Dashboard"
2. Regarder la section "Dans le panier"
3. Lister tous les paniers

**Résultat attendu :**
- Panier 41 : ❌ Ne s'affiche PAS
- Panier 42 : ❌ Ne s'affiche PAS
- Autres paniers : ✅ S'affichent

---

### Test 4: Endpoint stock_deltas

**Étapes :**
1. Aller sur "Gestion du stock"
2. Ouvrir la console (F12)
3. Cliquer sur le bouton "Ajouter du stock"
4. Entrer une quantité (ex: 5)
5. Cliquer "Ajouter"

**Résultat attendu - Console :**
```
POST http://localhost/orig/api/stock_deltas?ws_key=...
Status: 201 Created (ou 200 OK)
```

**Résultat attendu - Interface :**
```
✅ 5 unité(s) ajoutée(s). Nouveau stock: 15
```

---

## 📊 STATISTIQUES "PAR JOUR"

**À tester :**
- [ ] Dans le Dashboard, regarder la section "Par jour"
- [ ] **Résultat attendu:** 
  - Les dates utilisées sont celles du CSV
  - Pas de dates vides
  - Les totaux sont corrects

**Exemple attendu :**
```
| Jour      | Nb commande | Montant |
|-----------|-------------|---------|
| 16/04/2026| 1           | 37.50€  |
| 06/05/2026| 1           | 12.50€  |
```

---

## 🚨 EN CAS DE PROBLÈME

### Dates toujours vides ❌
```bash
# Vérifier :
grep -n "note" src/views/DashboardView.vue
grep -n "Date commande CSV" src/services/importGlobal.service.js
```

**Action :** Relire les fichiers et vérifier les lignes exactes

---

### Paniers 41 et 42 encore visibles ❌
```bash
grep -n "IGNORED_CART_IDS" src/views/DashboardView.vue
```

**Action :** Vérifier que [41, 42] est dans la constante

---

### Erreur "updateStockDelta is not defined" ❌
```bash
grep -n "export async function updateStockDelta" src/api/prestashop.api.js
```

**Action :** Vérifier que la fonction existe à la fin du fichier

---

### Erreur 500 stock_deltas ❌
- [ ] Vérifier que le module ws_stock_update.zip est installé dans PrestaShop
- [ ] Vérifier les permissions GET/POST sur l'endpoint
- [ ] Vérifier la clé API

---

## ✅ AVANT LA PRÉSENTATION

- [ ] Tous les tests ci-dessus passent
- [ ] L'application se lance sans erreur : `npm run dev`
- [ ] La console du navigateur ne montre pas d'erreurs
- [ ] Les dates s'affichent correctement
- [ ] Les paniers 41 et 42 ne s'affichent pas
- [ ] Le stock peut être augmenté/réduit

---

## 🎓 POINTS DE VÉRIFICATION AVEC LE PROFESSEUR

- ✅ Dates des commandes importées depuis le CSV
- ✅ Paniers résiduels filtrés
- ✅ Endpoint stock_deltas fonctionnel
- ✅ API PrestaShop uniquement (pas de PHP)
- ✅ Tolérance sur les noms de colonnes
- ✅ Pas de combinaisons taille + couleur
- ✅ Anonymes doivent se connecter
- ✅ Statut 11 par défaut

---

## 📋 DOCUMENTS DE RÉFÉRENCE

Vous avez à disposition :
- `RESUME_FINAL.md` - Vue d'ensemble
- `CORRECTIONS_APPLIQUEES.md` - Détails techniques
- `MODIFICATIONS_LIGNE_PAR_LIGNE.md` - Code exact ligne par ligne
- `GUIDE_CORRECTIONS.md` - Dépannage

---

## 🎯 RÉSULTAT FINAL

Si tous les tests passent : **Prêt pour présentation ! 🚀**

