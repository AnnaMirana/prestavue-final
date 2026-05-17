import { API_KEY, BASE_URL, deleteResource, getText, parseXml, request } from '../api/prestashop.api'

function singular(moduleName) {
  const exceptions = {
    addresses: 'address',
    order_histories: 'order_history'
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
  const modules = ['order_histories', 'orders', 'carts', 'stock_availables', 'products', 'addresses', 'customers']
  const results = {}

  for (const moduleName of modules) {
    const ids = await getAllIds(moduleName)
    let count = 0
    for (const id of ids) {
      if (await deleteResource(moduleName, id)) count++
    }
    results[moduleName] = count
  }

  localStorage.removeItem('prestavue_stock_history')
  return results
}
