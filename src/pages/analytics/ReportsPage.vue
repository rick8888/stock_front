<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useAnalytics, useFinance } from '@/composables/useWork'
import { useStock } from '@/composables/useStock'
import { useProcurement } from '@/composables/useProcurement'
import PageHeader from '@/components/common/PageHeader.vue'
import PageSkeleton from '@/components/feedback/PageSkeleton.vue'
import Button from '@/components/ui/Button.vue'
import { formatDateTime } from '@/lib/utils'
import { downloadCsv } from '@/utils/csv'
import { MOVEMENT_LABEL } from '@/config/stock'

const { snapshot, loading } = useAnalytics()
const { movements, productName, warehouseName, userName, overview } = useStock()
const { orderOverviews, loadBoard } = useProcurement({ autoload: false })
onMounted(() => {
  void loadBoard({ section: 'orders', filter: 'all', page: 1, pageSize: 50 }, false)
})
const { invoices, receipts } = useFinance()

const delayed = computed(() => orderOverviews.value.filter((item) => item.late))
const risks = computed(() => overview.value.filter((item) => item.status === 'critical' || item.status === 'watch'))
const withoutPiece = computed(() =>
  movements.value.filter((item) => !item.reference && (item.type === 'receive' || item.type === 'issue')),
)

function exportJournal() {
  downloadCsv(
    'journal-comptable-stock',
    ['Date', 'Pièce', 'Type', 'Article', 'Quantité', 'De', 'Vers', 'Par', 'Libellé'],
    movements.value.map((item) => [
      item.date,
      item.reference || 'SANS PIECE',
      MOVEMENT_LABEL[item.type],
      productName(item.productId),
      item.quantity,
      warehouseName(item.fromWarehouseId),
      warehouseName(item.toWarehouseId),
      userName(item.userId),
      item.note,
    ]),
  )
}

function exportInvoices() {
  downloadCsv(
    'export-factures-fournisseurs',
    ['Facture', 'Fournisseur', 'Commande', 'BR', 'Montant MAD', 'Échéance', 'Statut', 'Réception'],
    invoices.value.map((invoice) => {
      const receipt = receipts.value.find((item) => item.purchaseOrderId === invoice.purchaseOrderId)
      const order = orderOverviews.value.find((item) => item.order.id === invoice.purchaseOrderId)
      return [
        invoice.id.toUpperCase(),
        order?.supplierName ?? invoice.supplierId,
        order?.code ?? invoice.purchaseOrderId,
        receipt?.code ?? '',
        invoice.amount,
        invoice.dueDate,
        invoice.status,
        receipt?.status === 'validated' ? 'BR validé' : receipt ? receipt.status : 'Sans BR',
      ]
    }),
  )
}

function exportRisks() {
  downloadCsv(
    'rapport-ruptures',
    ['Article', 'Entrepôt', 'Disponible', 'Seuil', 'Couverture (j)'],
    risks.value.map((row) => [row.productName, row.warehouseName, row.available, row.minStock, row.days]),
  )
}

function exportDelayed() {
  downloadCsv(
    'rapport-retards-fournisseurs',
    ['Commande', 'Fournisseur', 'Entrepôt', 'Montant', 'Prévue'],
    delayed.value.map((row) => [
      row.code,
      row.supplierName,
      row.warehouseName,
      row.order.amount,
      row.order.expectedDate,
    ]),
  )
}
</script>

<template>
  <div class="page-wide">
    <PageHeader title="Rapports" description="Extraits prêts pour un contrôle ou un expert-comptable." />
    <PageSkeleton v-if="loading || !snapshot" />
    <div v-else class="space-y-3">
      <article class="surface flex flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div>
          <p class="text-sm font-semibold">Journal comptable stock</p>
          <p class="mt-0.5 text-xs text-muted-foreground">
            {{ movements.length }} lignes · pièce sur chaque mouvement
            <span v-if="withoutPiece.length"> · {{ withoutPiece.length }} anomalie(s) sans pièce</span>
          </p>
        </div>
        <Button size="sm" variant="outline" :disabled="!movements.length" @click="exportJournal">Exporter CSV</Button>
      </article>
      <article class="surface flex flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div>
          <p class="text-sm font-semibold">Factures fournisseurs</p>
          <p class="mt-0.5 text-xs text-muted-foreground">
            {{ invoices.length }} facture(s) · liées au BR de réception
          </p>
        </div>
        <Button size="sm" variant="outline" :disabled="!invoices.length" @click="exportInvoices">Exporter CSV</Button>
      </article>
      <article class="surface flex flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div>
          <p class="text-sm font-semibold">Ruptures et seuils</p>
          <p class="mt-0.5 text-xs text-muted-foreground">{{ risks.length }} article(s) critiques ou à surveiller</p>
        </div>
        <Button size="sm" variant="outline" :disabled="!risks.length" @click="exportRisks">Exporter CSV</Button>
      </article>
      <article class="surface flex flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div>
          <p class="text-sm font-semibold">Retards fournisseurs</p>
          <p class="mt-0.5 text-xs text-muted-foreground">
            {{ delayed.length }} commande(s)
            <span v-if="delayed[0]"> · dernière {{ formatDateTime(delayed[0].order.createdAt) }}</span>
          </p>
        </div>
        <Button size="sm" variant="outline" :disabled="!delayed.length" @click="exportDelayed">Exporter CSV</Button>
      </article>
      <p class="text-xs text-muted-foreground">Catalogue : {{ snapshot.catalogSize }} produits · {{ snapshot.weakSuppliers }} fournisseur(s) fragile(s).</p>
    </div>
  </div>
</template>
