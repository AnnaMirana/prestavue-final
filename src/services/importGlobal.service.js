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

const REQUIRED_COLUMNS = {
  produits: ['nom', 'reference', 'prix_ttc'],
  details: ['reference'],
  clients: ['nom', 'email']
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
    images: 0,
    criticalErrors: []
  }

  try {
    const products = normalizeRows(files.produits || [])
    const details = normalizeRows(files.details || [])
    const clients = normalizeRows(files.clients || [])

    // ========== ÉTAPE 1 : VALIDATION AVANT IMPORT ==========
    onProgress?.('🔍 Validation des fichiers...')
    
    let hasCriticalError = false
    const criticalErrors = []
    
    const validationProduits = validateColumnsCritical(products, EXPECTED_COLUMNS.produits, REQUIRED_COLUMNS.produits, report.produits)
    const validationDetails = validateColumnsCritical(details, EXPECTED_COLUMNS.details, REQUIRED_COLUMNS.details, report.details)
    const validationClients = validateColumnsCritical(clients, EXPECTED_COLUMNS.clients, REQUIRED_COLUMNS.clients, report.clients)
    
    const validationErrors = []
    
    for (const [index, row] of products.entries()) {
      try {
        if (row.date_availability_produit) {
          validateDate(row.date_availability_produit, `produits ligne ${index + 1}`)
        }
        normalizePositiveAmount(row.prix_ttc, `produits ligne ${index + 1}`)
      } catch (error) {
        validationErrors.push(error.message)
        hasCriticalError = true
      }
    }
    
    for (const [index, row] of clients.entries()) {
      try {
        if (row.date) {
          validateDate(row.date, `clients ligne ${index + 1}`)
        }
        if (!row.email || !row.email.trim()) {
          throw new Error(`clients ligne ${index + 1}: email obligatoire`)
        }
        if (!row.email.includes('@')) {
          throw new Error(`clients ligne ${index + 1}: email invalide (${row.email})`)
        }
      } catch (error) {
        validationErrors.push(error.message)
        hasCriticalError = true
      }
    }
    
    // Vérifier les combinaisons interdites
    const declinationTypesByProduct = new Map()
    for (const row of details) {
      const reference = row.reference
      const currentType = row.specificite || row.karazany || null
      
      if (currentType) {
        const existingType = declinationTypesByProduct.get(reference)
        if (existingType && existingType !== currentType) {
          validationErrors.push(`Combinaison interdite: produit ${reference} a ${existingType} et ${currentType} (taille + couleur ensemble)`)
          hasCriticalError = true
        }
        if (!existingType) {
          declinationTypesByProduct.set(reference, currentType)
        }
      }
    }
    
    if (hasCriticalError || validationProduits === false || validationDetails === false || validationClients === false) {
      report.criticalErrors = [...criticalErrors, ...validationErrors]
      return {
        success: false,
        report,
        message: `❌ Import annulé: ${[...criticalErrors, ...validationErrors].join(', ')}`
      }
    }

    // ========== ÉTAPE 2 : IMPORT DES PRODUITS ==========
    onProgress?.('📦 Import des produits...')
    const productsMap = new Map()
    
    for (const [index, row] of products.entries()) {
      report.produits.total++
      try {
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
        report.produits.corrections.push(`Ligne ${index + 1}: ${row.nom} (${row.reference}) créé - ${price}€`)
      } catch (error) {
        report.produits.errors.push(error.message)
        throw new Error(`Import arrêté: ${error.message}`)
      }
    }

    // ========== ÉTAPE 3 : MISE À JOUR DES DÉTAILS ==========
    onProgress?.('⚙️ Application des details et stocks...')
    const finalProductsMap = await getProductsMap(productsMap)
    
    for (const [index, row] of details.entries()) {
      report.details.total++
      try {
        const product = finalProductsMap.get(row.reference)
        if (!product) {
          report.details.errors.push(`details ligne ${index + 1}: produit ${row.reference} introuvable`)
          continue
        }

        if (row.prix_vente_ttc && row.prix_vente_ttc.trim() !== '') {
          const price = normalizePositiveAmount(row.prix_vente_ttc, `details ligne ${index + 1}`)
          await updateProductPrice(product.id, price)
          product.price = price
          report.details.corrections.push(`details ligne ${index + 1}: ${row.reference} - prix mis à jour: ${price}€`)
        }

        if (row.stock_initial !== '' && row.stock_initial !== null) {
          const stock = normalizePositiveInteger(row.stock_initial, `details ligne ${index + 1}`)
          await setProductStock(product.id, stock)
          report.details.corrections.push(`details ligne ${index + 1}: ${row.reference} - stock mis à jour: ${stock}`)
        }

        report.details.success++
      } catch (error) {
        report.details.errors.push(error.message)
      }
    }

    // ========== ÉTAPE 4 : IMPORT DES CLIENTS ET COMMANDES (AVEC DATES) ==========
    onProgress?.('👥 Import des clients et commandes...')
    const customerByEmail = new Map()
    
    for (const [index, row] of clients.entries()) {
      report.clients.total++
      try {
        const email = String(row.email || '').trim().toLowerCase()
        
        let finalEmail = email
        if (customerByEmail.has(email)) {
          const timestamp = Date.now()
          finalEmail = email.replace('@', `.dup${timestamp}@`)
          report.clients.corrections.push(`Ligne ${index + 1}: email dupliqué corrigé (${email} → ${finalEmail})`)
        }

        const customer = customerByEmail.get(finalEmail) || (await createCustomerWithAddress(row, finalEmail, index + 1))
        customerByEmail.set(finalEmail, customer)
        report.clients.success++

        const cartLines = parseCart(row.achat)
        if (!cartLines.length) continue
        report.orders.total++

        const cartId = await createCart(customer, cartLines, finalProductsMap)
        const state = normalizeOrderState(row.etat)
        
        // 🔥 Récupérer la date du CSV
        const orderDate = row.date || null
        
        if (state === 'cart') {
          report.orders.carts++
          continue
        }

        // 🔥 Passer la date à createOrder
        await createOrder(customer, cartId, cartLines, finalProductsMap, state, orderDate)
        report.orders.success++
      } catch (error) {
        report.clients.errors.push(error.message)
        if (row.achat) report.orders.errors.push(error.message)
      }
    }

    // ========== ÉTAPE 5 : IMPORT DES IMAGES ==========
    if (files.images) {
      onProgress?.('🖼️ Import des images...')
      report.images = await importImages(files.images, finalProductsMap)
    }

    const hasErrors = report.produits.errors.length > 0 || report.details.errors.length > 0 || report.clients.errors.length > 0
    const successMessage = `✅ Produits: ${report.produits.success}/${report.produits.total} | Détails: ${report.details.success}/${report.details.total} | Clients: ${report.clients.success}/${report.clients.total} | Commandes: ${report.orders.success}/${report.orders.total} | Images: ${report.images}`

    return {
      success: report.produits.errors.length + report.details.errors.length + report.clients.errors.length === 0,
      report,
      message: successMessage
    }
  } catch (error) {
    return {
      success: false,
      report,
      message: `❌ Erreur fatale: ${error.message}`
    }
  }
}

// ========== FONCTIONS DE VALIDATION CRITIQUE ==========

function validateColumnsCritical(rows, expected, required, report) {
  if (!rows.length) return true
  const actual = Object.keys(rows[0]).map(k => normalizeKey(k))
  let hasError = false
  
  for (const column of required) {
    const normalizedCol = normalizeKey(column)
    if (!actual.includes(normalizedCol)) {
      report.criticalErrors = report.criticalErrors || []
      report.criticalErrors.push(`Colonne obligatoire manquante: ${column}`)
      hasError = true
    }
  }
  
  for (const column of expected) {
    if (!actual.includes(normalizeKey(column))) {
      report.errors.push(`Nom de colonne non conforme: ${column}`)
    }
  }
  
  return !hasError
}

function validateDate(value, context) {
  if (!value) return
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    throw new Error(`${context}: date ${value} differente de DD/MM/YYYY`)
  }
}

// ========== FONCTIONS UTILITAIRES ==========

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

// 🔥 FONCTION CORRIGÉE avec stockage de la date dans note
async function createOrder(customer, cartId, cartLines, productsMap, stateId, orderDate) {
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
    note: orderDate ? `Date commande CSV: ${orderDate}` : '',  // 🔥 Stocke la date du CSV
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