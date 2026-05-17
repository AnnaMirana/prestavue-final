<template>
  <main class="page import-page">
    <section class="title-row">
      <div>
        <h1>Import des fichiers</h1>
        <p class="muted">3 CSV pour les donnees et 1 ZIP pour les images. Les erreurs d'import sont controlees avant envoi XML.</p>
      </div>
    </section>

    <section class="panel upload-grid">
      <label>
        Produits CSV
        <input type="file" accept=".csv" @change="(event) => onFileSelect(event, 'produits')" />
        <span v-if="files.produits">{{ files.produits.length }} ligne(s)</span>
      </label>
      <label>
        Details produits CSV
        <input type="file" accept=".csv" @change="(event) => onFileSelect(event, 'details')" />
        <span v-if="files.details">{{ files.details.length }} ligne(s)</span>
      </label>
      <label>
        Clients et commandes CSV
        <input type="file" accept=".csv" @change="(event) => onFileSelect(event, 'clients')" />
        <span v-if="files.clients">{{ files.clients.length }} ligne(s)</span>
      </label>
      <label>
        Images ZIP
        <input type="file" accept=".zip" @change="(event) => onFileSelect(event, 'images')" />
        <span v-if="files.images">{{ files.images.name }}</span>
      </label>
    </section>

    <button @click="startImport" :disabled="loading || !files.produits" class="import-button">
      {{ loading ? 'Import en cours...' : 'Lancer importation' }}
    </button>

    <p v-if="progress" class="panel">{{ progress }}</p>

    <section v-if="report" class="panel report">
      <h2>Rapport</h2>
      <div class="report-grid">
        <div>Produits: <strong>{{ report.report.produits.success }}/{{ report.report.produits.total }}</strong></div>
        <div>Details: <strong>{{ report.report.details.success }}/{{ report.report.details.total }}</strong></div>
        <div>Clients: <strong>{{ report.report.clients.success }}/{{ report.report.clients.total }}</strong></div>
        <div>Commandes: <strong>{{ report.report.orders.success }}/{{ report.report.orders.total }}</strong></div>
        <div>Paniers: <strong>{{ report.report.orders.carts }}</strong></div>
        <div>Images: <strong>{{ report.report.images }}</strong></div>
      </div>
      <p :class="report.success ? 'success' : 'error'">{{ report.message }}</p>

      <div v-for="section in errorSections" :key="section.name" class="errors">
        <h3>{{ section.name }}</h3>
        <p v-for="error in section.errors" :key="error" class="error">{{ error }}</p>
      </div>
    </section>
  </main>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import Papa from 'papaparse'
import { importGlobal } from '../services/importGlobal.service'

const loading = ref(false)
const progress = ref('')
const report = ref(null)
const files = reactive({
  produits: null,
  details: null,
  clients: null,
  images: null
})

const errorSections = computed(() => {
  if (!report.value) return []
  const sections = report.value.report
  return [
    { name: 'Produits', errors: sections.produits.errors },
    { name: 'Details', errors: sections.details.errors },
    { name: 'Clients', errors: sections.clients.errors },
    { name: 'Commandes', errors: sections.orders.errors }
  ].filter((section) => section.errors.length)
})

function onFileSelect(event, type) {
  const file = event.target.files[0]
  if (!file) return
  report.value = null

  if (type === 'images') {
    files[type] = file
    return
  }

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      files[type] = results.data
    },
    error: (error) => {
      progress.value = `Erreur lecture ${file.name}: ${error.message}`
    }
  })
}

async function startImport() {
  loading.value = true
  progress.value = 'Preparation...'
  report.value = null
  try {
    report.value = await importGlobal(files, (message) => {
      progress.value = message
    })
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.import-page {
  display: grid;
  gap: 18px;
}

.title-row {
  display: flex;
  justify-content: space-between;
}

.upload-grid,
.report-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
}

label {
  display: grid;
  gap: 8px;
  color: var(--muted);
  font-weight: 700;
}

label span {
  color: var(--success);
  font-weight: 500;
}

.import-button {
  justify-self: start;
}

.report {
  display: grid;
  gap: 12px;
}

.errors {
  border-top: 1px solid var(--border);
  padding-top: 12px;
}
</style>
