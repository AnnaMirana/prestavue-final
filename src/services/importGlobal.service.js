import JSZip from 'jszip'
import {
  API_KEY,
  BASE_URL,
  buildXml,
  createResource,
  extractIdFromXml,
  getText,
  listResources,
  parseXml,
  request,
  setProductStock,
  updateResource
} from '../api/prestashop.api'

const EXPECTED_COLUMNS = {
  produits: ['date_availability_produit', 'nom', 'reference', 'prix_ttc', 'Taxe', 'categorie', 'prix_achat'],
  details: ['reference', 'specificite', 'karazany', 'stock_initial', 'prix_vente_ttc'],
  clients: ['date', 'nom', 'email', 'pwd', 'adresse', 'achat', 'etat']
}

const ORDER_STATES = {
  paid: 2,
  canceled: 6
}

export async function importGlobal(files, onProgress) {
  const report = {
    produits: { success: 0, total: 0, errors: [], corrections: [] },
    details: { success: 0, total: 0, errors: [], corrections: [] },
    clients: { success: 0, total: 0, errors: [], corrections: [] },
    orders: { success: 0, total: 0, errors: [], carts: 0 },
    images: 0
  }

  try {
    const products = normalizeRows(files.produits || [])
    const details = normalizeRows(files.details || [])
    const clients = normalizeRows(files.clients || [])

    validateColumns(products, EXPECTED_COLUMNS.produits, report.produits)
    validateColumns(details, EXPECTED_COLUMNS.details, report.details)
    validateColumns(clients, EXPECTED_COLUMNS.clients, report.clients)

    onProgress?.('Import des produits...')
    const productsMap = new Map()
    for (const [index, row] of products.entries()) {
      report.produits.total++
      try {
        validateDate(row.date_availability_produit, `produits ligne ${index + 1}`)
        const price = normalizePositiveAmount(row.prix_ttc, `produits ligne ${index + 1}`)
        const id = await upsertProduct(row, price)
        productsMap.set(row.reference, {
          id,
          reference: row.reference,
          name: row.nom,
          price,
          category: row.categorie || ''
        })
        report.produits.success++
      } catch (error) {
        report.produits.errors.push(error.message)
      }
    }

    onProgress?.('Application des details et stocks...')
    const finalProductsMap = await getProductsMap(productsMap)
    const importedDeclinations = new Set()
    for (const [index, row] of details.entries()) {
      report.details.total++
      try {
        const product = finalProductsMap.get(row.reference)
        if (!product) throw new Error(`details ligne ${index + 1}: produit ${row.reference} introuvable`)

        const isDeclination = Boolean(row.specificite || row.karazany)
        if (isDeclination && importedDeclinations.has(row.reference)) {
          report.details.corrections.push(`details ligne ${index + 1}: declinaison supplementaire ignoree`)
          continue
        }
        if (isDeclination) importedDeclinations.add(row.reference)

        if (row.prix_vente_ttc) {
          const price = normalizePositiveAmount(row.prix_vente_ttc, `details ligne ${index + 1}`)
          await updateProductPrice(product.id, price)
          product.price = price
        }

        if (row.stock_initial !== '') {
          const stock = normalizePositiveInteger(row.stock_initial, `details ligne ${index + 1}`)
          await setProductStock(product.id, stock)
        }

        report.details.success++
      } catch (error) {
        report.details.errors.push(error.message)
      }
    }

    onProgress?.('Import des clients, paniers et commandes...')
    const customerByEmail = new Map()
    for (const [index, row] of clients.entries()) {
      report.clients.total++
      try {
        validateDate(row.date, `clients ligne ${index + 1}`)
        const email = String(row.email || '').trim().toLowerCase()
        if (!email) throw new Error(`clients ligne ${index + 1}: email obligatoire`)

        const customer =
          customerByEmail.get(email) || (await createCustomerWithAddress(row, email, index + 1))
        customerByEmail.set(email, customer)
        report.clients.success++

        const cartLines = parseCart(row.achat)
        if (!cartLines.length) continue
        report.orders.total++

        const cartId = await createCart(customer, cartLines, finalProductsMap)
        const state = normalizeOrderState(row.etat)
        if (state === 'cart') {
          report.orders.carts++
          continue
        }

        await createOrder(customer, cartId, cartLines, finalProductsMap, state)
        report.orders.success++
      } catch (error) {
        report.clients.errors.push(error.message)
        if (row.achat) report.orders.errors.push(error.message)
      }
    }

    if (files.images) {
      onProgress?.('Import des images...')
      report.images = await importImages(files.images, finalProductsMap)
    }

    return {
      success: report.produits.errors.length + report.details.errors.length + report.clients.errors.length === 0,
      report,
      message: `Produits ${report.produits.success}/${report.produits.total}, details ${report.details.success}/${report.details.total}, clients ${report.clients.success}/${report.clients.total}, commandes ${report.orders.success}/${report.orders.total}, images ${report.images}`
    }
  } catch (error) {
    return { success: false, report, message: `Erreur import: ${error.message}` }
  }
}

function normalizeRows(rows) {
  return rows.map((row) => {
    const next = {}
    for (const [key, value] of Object.entries(row || {})) {
      next[normalizeKey(key)] = typeof value === 'string' ? value.trim() : value
    }
    return next
  })
}

function normalizeKey(key) {
  return String(key)
    .replace('\u00c3\u00a9', '\u00e9')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function validateColumns(rows, expected, report) {
  if (!rows.length) return
  const actual = Object.keys(rows[0])
  for (const column of expected) {
    if (!actual.includes(normalizeKey(column))) {
      report.errors.push(`Nom de colonne non conforme: ${column}`)
    }
  }
}

function validateDate(value, context) {
  if (!value) return
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    throw new Error(`${context}: date ${value} differente de DD/MM/YYYY`)
  }
}

function normalizeDate(value) {
  if (!value) return undefined
  const [day, month, year] = value.split('/')
  return `${year}-${month}-${day}`
}

function normalizePositiveAmount(value, context) {
  const number = Number.parseFloat(String(value || '0').replace('\u20ac', '').replace(',', '.').replace(/\s/g, ''))
  if (!Number.isFinite(number) || number < 0) throw new Error(`${context}: montant positif attendu`)
  return number.toFixed(2)
}

function normalizePositiveInteger(value, context) {
  const number = Number.parseInt(String(value), 10)
  if (!Number.isFinite(number) || number < 0) throw new Error(`${context}: montant positif attendu`)
  return number
}

async function upsertProduct(row, price) {
  if (!row.reference) throw new Error('produits: reference obligatoire')
  const xml = buildXml('products', {
    name: { language: { '@_id': '1', '#text': row.nom || row.reference } },
    reference: row.reference,
    price,
    active: 1,
    state: 1,
    id_category_default: row.categorie === 'Accessoire' ? 3 : 2,
    id_tax_rules_group: 0,
    available_for_order: 1,
    show_price: 1,
    available_date: normalizeDate(row.date_availability_produit)
  })
  const response = await createResource('products', xml)
  const id = extractIdFromXml(response)
  if (!id) throw new Error(`produits ${row.reference}: id non retourne par PrestaShop`)
  return id
}

async function updateProductPrice(productId, price) {
  const xml = buildXml('products', { id: productId, price })
  await updateResource('products', productId, xml)
}

async function getProductsMap(seed = new Map()) {
  const map = new Map(seed)
  const rows = await listResources('products', '[id,reference,price,id_category_default]')
  for (const row of rows) {
    const reference = getText(row, 'reference')
    if (!reference) continue
    map.set(reference, {
      ...(map.get(reference) || {}),
      id: getText(row, 'id'),
      reference,
      price: Number.parseFloat(getText(row, 'price', '0')) || 0,
      categoryId: getText(row, 'id_category_default')
    })
  }
  return map
}

async function createCustomerWithAddress(row, email, lineNumber) {
  const nameParts = String(row.nom || 'Client').split(/\s+/)
  const lastname = nameParts[0] || 'Client'
  const firstname = nameParts.slice(1).join(' ') || 'Client'
  const customerXml = buildXml('customers', {
    lastname,
    firstname,
    email,
    passwd: row.pwd || 'password123',
    active: 1,
    id_default_group: 3,
    id_lang: 1
  })
  const customerId = extractIdFromXml(await createResource('customers', customerXml))
  if (!customerId) throw new Error(`clients ligne ${lineNumber}: client non cree`)

  const addressXml = buildXml('addresses', {
    id_customer: customerId,
    id_country: 8,
    alias: 'Adresse principale',
    lastname,
    firstname,
    address1: row.adresse || 'France',
    postcode: '75001',
    city: 'Paris',
    active: 1
  })
  const addressId = extractIdFromXml(await createResource('addresses', addressXml))
  if (!addressId) throw new Error(`clients ligne ${lineNumber}: adresse non creee`)
  return { id: customerId, addressId, lastname, firstname, email }
}

function parseCart(value) {
  if (!value) return []
  const lines = []
  const regex = /\("([^"]+)";(\d+);"([^"]*)"\)/g
  let match
  while ((match = regex.exec(value)) !== null) {
    lines.push({ reference: match[1], quantity: Number.parseInt(match[2], 10), variant: match[3] })
  }
  return lines
}

function normalizeOrderState(value) {
  const state = String(value || '').toLowerCase()
  if (!state) return 'cart'
  if (state.includes('annul')) return ORDER_STATES.canceled
  if (state.includes('paiement') || state.includes('accept')) return ORDER_STATES.paid
  return 'cart'
}

async function createCart(customer, cartLines, productsMap) {
  const cartRows = cartLines.map((line) => {
    const product = productsMap.get(line.reference)
    if (!product) throw new Error(`panier: produit ${line.reference} introuvable`)
    return {
      id_product: product.id,
      id_product_attribute: 0,
      id_address_delivery: customer.addressId,
      quantity: line.quantity
    }
  })
  const xml = buildXml('carts', {
    id_currency: 1,
    id_lang: 1,
    id_customer: customer.id,
    id_address_delivery: customer.addressId,
    id_address_invoice: customer.addressId,
    associations: { cart_rows: { cart_row: cartRows } }
  })
  return extractIdFromXml(await createResource('carts', xml))
}

async function createOrder(customer, cartId, cartLines, productsMap, stateId) {
  const total = cartLines.reduce((sum, line) => {
    const product = productsMap.get(line.reference)
    return sum + (Number(product?.price || 0) * line.quantity)
  }, 0)
  const orderRows = cartLines.map((line) => {
    const product = productsMap.get(line.reference)
    return {
      product_id: product.id,
      product_attribute_id: 0,
      product_quantity: line.quantity,
      product_name: product.name || product.reference,
      product_reference: product.reference,
      product_price: Number(product.price || 0).toFixed(2)
    }
  })
  const xml = buildXml('orders', {
    id_address_delivery: customer.addressId,
    id_address_invoice: customer.addressId,
    id_cart: cartId,
    id_currency: 1,
    id_lang: 1,
    id_customer: customer.id,
    id_carrier: 1,
    current_state: stateId,
    module: 'ps_cashondelivery',
    payment: 'Paiement a la livraison',
    conversion_rate: '1.000000',
    total_paid: total.toFixed(2),
    total_paid_real: total.toFixed(2),
    total_products: total.toFixed(2),
    total_products_wt: total.toFixed(2),
    total_shipping: '0.00',
    associations: { order_rows: { order_row: orderRows } }
  })
  return createResource('orders', xml)
}

async function importImages(zipFile, productsMap) {
  const zip = await JSZip.loadAsync(zipFile)
  let imported = 0
  for (const [filename, file] of Object.entries(zip.files)) {
    if (file.dir) continue
    const reference = filename.split('.')[0]
    const product = productsMap.get(reference)
    if (!product) continue
    const blob = await file.async('blob')
    const formData = new FormData()
    formData.append('image', blob, filename)
    const response = await request(`${BASE_URL}/images/products/${product.id}?ws_key=${API_KEY}`, {
      method: 'POST',
      body: formData
    })
    if (response.ok) imported++
  }
  return imported
}
