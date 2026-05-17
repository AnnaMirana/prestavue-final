import { API_KEY, BASE_URL, deleteResource, getText, parseXml, request } from '../api/prestashop.api'

function singular(moduleName) {
  const exceptions = {
    addresses: 'address',
    order_histories: 'order_history',
    cart_rows: 'cart_row'
  }
  return exceptions[moduleName] || moduleName.slice(0, -1)
}

async function getAllIds(moduleName) {
  try {
    const response = await request(`${BASE_URL}/${moduleName}?ws_key=${API_KEY}&display=[id]`)
    if (!response.ok) return []
    const doc = parseXml(await response.text())
    return [...doc.getElementsByTagName(singular(moduleName))]
      .map((node) => getText(node, 'id'))
      .filter(Boolean)
  } catch {
    return []
  }
}

export async function resetAll() {
  // 🔥 Ordre important : d'abord les dépendances, ensuite les parents
  const modules = ['cart_rows', 'order_histories', 'orders', 'carts', 'stock_availables', 'products', 'addresses', 'customers']
  const results = {}

  for (const moduleName of modules) {
    const ids = await getAllIds(moduleName)
    let count = 0
    for (const id of ids) {
      if (await deleteResource(moduleName, id)) {
        count++
        console.log(` Supprimé ${moduleName}/${id}`)
      } else {
        console.log(` Échec suppression ${moduleName}/${id}`)
      }
    }
    results[moduleName] = count
    console.log(` ${moduleName}: ${count} supprimé(s)`)
  }

  // 🔥 Supprimer manuellement les IDs spécifiques s'ils restent
  const forceDelete = async (moduleName, ids) => {
    for (const id of ids) {
      const response = await fetch(`${BASE_URL}/${moduleName}/${id}?ws_key=${API_KEY}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        console.log(` Force suppression ${moduleName}/${id}`)
      }
    }
  }
  
  // Forcer la suppression des paniers 41 et 42 s'ils existent
  await forceDelete('carts', [41, 42])

  localStorage.removeItem('prestavue_stock_history')
  
  return results
}