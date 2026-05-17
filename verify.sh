#!/bin/bash
# 🔍 SCRIPT DE VÉRIFICATION DES MODIFICATIONS
# Usage: bash verify.sh

echo "📋 VÉRIFICATION DES CORRECTIONS PRESTAVUE"
echo "=========================================="
echo ""

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Compteurs
PASS=0
FAIL=0

# Fonction de vérification
check() {
    local description=$1
    local file=$2
    local pattern=$3
    
    if grep -q "$pattern" "$file" 2>/dev/null; then
        echo -e "${GREEN}✅${NC} $description"
        ((PASS++))
    else
        echo -e "${RED}❌${NC} $description"
        echo "   Fichier: $file"
        echo "   Pattern: $pattern"
        ((FAIL++))
    fi
}

echo "1️⃣  DATES DES COMMANDES"
echo "─────────────────────"
check "Date stockée dans 'note'" \
    "src/services/importGlobal.service.js" \
    "Date commande CSV"

check "Date extraite du 'note'" \
    "src/views/DashboardView.vue" \
    "Date commande CSV:"

check "csvDate affichée dans tableau" \
    "src/views/DashboardView.vue" \
    "csvDate"

echo ""
echo "2️⃣  PANIERS RÉSIDUELS"
echo "──────────────────"
check "Constante IGNORED_CART_IDS définie" \
    "src/views/DashboardView.vue" \
    "IGNORED_CART_IDS"

check "Filtre appliqué sur paniers" \
    "src/views/DashboardView.vue" \
    "IGNORED_CART_IDS.includes"

echo ""
echo "3️⃣  ENDPOINT STOCK_DELTAS"
echo "────────────────────────"
check "Fonction updateStockDelta() créée" \
    "src/api/prestashop.api.js" \
    "export async function updateStockDelta"

check "updateStockDelta() importée dans stock.service.js" \
    "src/services/stock.service.js" \
    "updateStockDelta"

check "updateStockDelta() utilisée dans addStock()" \
    "src/services/stock.service.js" \
    "await updateStockDelta"

echo ""
echo "4️⃣  COMMANDES - DATE PASSÉE"
echo "──────────────────────────"
check "Variable orderDate récupérée" \
    "src/services/importGlobal.service.js" \
    "const orderDate = row.date"

check "orderDate passée à createOrder()" \
    "src/services/importGlobal.service.js" \
    "createOrder(customer, cartId, cartLines, finalProductsMap, state, orderDate)"

echo ""
echo "5️⃣  IMPORTS CORRECTS"
echo "──────────────────"
check "buildXml importé dans stock.service.js" \
    "src/services/stock.service.js" \
    "buildXml"

check "createResource importé dans stock.service.js" \
    "src/services/stock.service.js" \
    "createResource"

check "updateResource importé dans stock.service.js" \
    "src/services/stock.service.js" \
    "updateResource"

echo ""
echo "════════════════════════════════════════"
echo "📊 RÉSULTATS"
echo "════════════════════════════════════════"
echo -e "${GREEN}✅ Réussis  : $PASS${NC}"
echo -e "${RED}❌ Échoués  : $FAIL${NC}"
echo "────────────────────────────────────────"

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}🎉 TOUTES LES VÉRIFICATIONS PASSENT !${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  $FAIL vérification(s) échouée(s)${NC}"
    exit 1
fi
