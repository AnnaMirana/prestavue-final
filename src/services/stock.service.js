import {
  API_KEY,
  BASE_URL,
  request,
  getProductStock,
  getText,
  listResources,
  parseXml,
  updateStockDelta,
  buildXml,
  createResource,
  updateResource
} from '../api/prestashop.api'

const STORAGE_KEY = 'prestavue_stock_history'

export async function getProductsWithStock() {
  const products = []
  const rows = await listResources('products', '[id,reference,price,id_category_default]')

  for (const row of rows) {
    const id = getText(row, 'id')
    if (!id) continue

    let name = `Produit ${id}`
    try {
      const response = await request(`${BASE_URL}/products/${id}?ws_key=${API_KEY}&display=[name]`)
      const doc = parseXml(await response.text())
      name = getText(doc, 'language', name)
    } catch {
      // The reference remains a usable label if the product detail is unavailable.
    }

    products.push({
      id: Number.parseInt(id, 10),
      name,
      reference: getText(row, 'reference'),
      stock: await getProductStock(id),
      price: Number.parseFloat(getText(row, 'price', '0')) || 0,
      categoryId: getText(row, 'id_category_default')
    })
  }

  return products
}

// 🔥 UTILISE L'ENDPOINT PERSONNALISÉ stock_deltas
export async function addStock(productId, delta, reason = 'Ajout manuel') {
  try {
    // Utiliser le nouvel endpoint stock_deltas avec delta
    await updateStockDelta(productId, delta)
    
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

// Retirer du stock (delta négatif)
export async function removeStock(productId, delta, reason = 'Vente') {
  return addStock(productId, -delta, reason)
}

export async function updateOrderState(orderId, stateId) {
  const xml = buildXml('orders', { id: orderId, current_state: stateId })
  return updateResource('orders', orderId, xml)
}

export async function createOrderHistory(orderId, stateId) {
  const xml = buildXml('order_histories', {
    id_order: orderId,
    id_order_state: stateId
  })
  return createResource('order_histories', xml)
}

function saveHistory(productId, delta, newStock, reason) {
  const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  history.unshift({
    date: new Date().toISOString(),
    productId: Number.parseInt(productId, 10),
    delta,
    newStock,
    reason
  })
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 200)))
}

export function getAllStockHistory() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
}

export function getStockHistory(productId) {
  return getAllStockHistory().filter((row) => row.productId === Number.parseInt(productId, 10))
}