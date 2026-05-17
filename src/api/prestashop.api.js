import { XMLBuilder } from 'fast-xml-parser'

export const API_KEY = import.meta.env.VITE_API_KEY || '1AKJV9RVNJ9UWST4SE4J5BC14WU93LN6'
export const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost/orig/api'

const builder = new XMLBuilder({
  format: true,
  ignoreAttributes: false,
  attributeNamePrefix: '@_'
})

function singular(resourceName) {
  const exceptions = {
    addresses: 'address',
    order_histories: 'order_history'
  }
  return exceptions[resourceName] || (resourceName.endsWith('s') ? resourceName.slice(0, -1) : resourceName)
}

export function buildXml(resourceName, data) {
  return builder.build({ prestashop: { [singular(resourceName)]: data } })
}

export function parseXml(xml) {
  return new DOMParser().parseFromString(xml, 'text/xml')
}

export function getText(parent, tagName, fallback = '') {
  return parent.getElementsByTagName(tagName)[0]?.textContent?.trim() || fallback
}

export function extractIdFromXml(xml) {
  const doc = parseXml(xml)
  return getText(doc, 'id', null)
}

export async function request(url, options = {}) {
  return fetch(url, {
    headers: {
      Accept: 'application/xml',
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/xml' }),
      ...options.headers
    },
    ...options
  })
}

export async function fetchModuleIds(moduleName) {
  const response = await request(`${BASE_URL}/${moduleName}?ws_key=${API_KEY}&display=[id]`)
  if (!response.ok) return []
  const doc = parseXml(await response.text())
  return [...doc.getElementsByTagName(singular(moduleName))]
    .map((node) => getText(node, 'id'))
    .filter(Boolean)
}

export async function listResources(resourceName, display = '[id]') {
  const response = await request(`${BASE_URL}/${resourceName}?ws_key=${API_KEY}&display=${display}`)
  if (!response.ok) throw new Error(`Lecture ${resourceName} impossible (${response.status})`)
  const doc = parseXml(await response.text())
  return [...doc.getElementsByTagName(singular(resourceName))]
}

export async function getResource(resourceName, id, display = 'full') {
  const suffix = display === 'full' ? '' : `&display=${display}`
  const response = await request(`${BASE_URL}/${resourceName}/${id}?ws_key=${API_KEY}${suffix}`)
  if (!response.ok) throw new Error(`Lecture ${resourceName}/${id} impossible (${response.status})`)
  return parseXml(await response.text())
}

export async function createResource(resourceName, xmlData) {
  const response = await request(`${BASE_URL}/${resourceName}?ws_key=${API_KEY}`, {
    method: 'POST',
    body: xmlData
  })
  const text = await response.text()
  if (!response.ok) {
    // PrestaShop renvoie souvent un XML d'erreur (ou du texte). On le remonte tel quel
    // pour permettre de diagnostiquer précisément la cause.
    throw new Error(text?.trim() ? text : `Creation ${resourceName} impossible`)
  }
  return text
}

export async function updateResource(resourceName, id, xmlData) {
  const response = await request(`${BASE_URL}/${resourceName}/${id}?ws_key=${API_KEY}`, {
    method: 'PUT',
    body: xmlData
  })
  const text = await response.text()
  if (!response.ok) throw new Error(text || `Mise a jour ${resourceName}/${id} impossible`)
  return text
}

export async function deleteResource(resourceName, id) {
  const response = await request(`${BASE_URL}/${resourceName}/${id}?ws_key=${API_KEY}`, {
    method: 'DELETE'
  })
  return response.ok
}

export async function findByFilter(resourceName, filterName, value, display = '[id]') {
  const response = await request(
    `${BASE_URL}/${resourceName}?filter[${filterName}]=${encodeURIComponent(value)}&ws_key=${API_KEY}&display=${display}`
  )
  if (!response.ok) return []
  const doc = parseXml(await response.text())
  return [...doc.getElementsByTagName(singular(resourceName))]
}

export async function getStockAvailableId(productId) {
  const rows = await findByFilter(
    'stock_availables',
    'id_product',
    productId,
    '[id,id_product,id_product_attribute,id_shop,quantity,depends_on_stock,out_of_stock]'
  )
  const row = rows.find((node) => getText(node, 'id_product_attribute', '0') === '0') || rows[0]
  return row ? getText(row, 'id') : null
}

export async function getProductStock(productId) {
  const rows = await findByFilter(
    'stock_availables',
    'id_product',
    productId,
    '[id,id_product,id_product_attribute,quantity]'
  )
  const row = rows.find((node) => getText(node, 'id_product_attribute', '0') === '0') || rows[0]
  return row ? Number.parseInt(getText(row, 'quantity', '0'), 10) || 0 : 0
}

export async function setProductStock(productId, quantity) {
  const stockId = await getStockAvailableId(productId)
  const xml = buildXml('stock_availables', {
    id: stockId || undefined,
    id_product: productId,
    id_product_attribute: 0,
    id_shop: 1,
    quantity,
    depends_on_stock: 0,
    out_of_stock: 2
  })
  if (stockId) return updateResource('stock_availables', stockId, xml)
  return createResource('stock_availables', xml)
}
