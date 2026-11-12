<script setup lang="ts">
import { computed } from 'vue'
import { formatDate, formatNumber } from '@/lib/utils'
import type { DeliveryNoteLine } from '@/types'

const props = defineProps<{
  title?: string
  code: string
  date: string
  originName: string
  originAddress?: string
  destName: string
  destAddress?: string
  driverName: string
  vehicleLabel: string
  lines: DeliveryNoteLine[]
  signedAt?: string
  signedBy?: string
  notes?: string
}>()

const totalQty = computed(() => props.lines.reduce((sum, line) => sum + line.quantity, 0))
</script>

<template>
  <section class="overflow-hidden rounded-xl border bg-card">
    <header class="flex items-start justify-between gap-3 border-b bg-muted/40 px-4 py-3">
      <div>
        <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {{ title ?? 'Bon de livraison' }}
        </p>
        <p class="mt-0.5 text-base font-semibold">{{ code }}</p>
      </div>
      <p class="text-xs text-muted-foreground">{{ formatDate(date) }}</p>
    </header>
    <div class="grid gap-4 px-4 py-3 text-sm sm:grid-cols-2">
      <div>
        <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Expéditeur</p>
        <p class="mt-1 font-medium">BravoStock · {{ originName }}</p>
        <p v-if="originAddress" class="text-xs text-muted-foreground">{{ originAddress }}</p>
      </div>
      <div>
        <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Destinataire</p>
        <p class="mt-1 font-medium">{{ destName }}</p>
        <p v-if="destAddress" class="text-xs text-muted-foreground">{{ destAddress }}</p>
      </div>
      <div>
        <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Chauffeur</p>
        <p class="mt-1 font-medium">{{ driverName }}</p>
      </div>
      <div>
        <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Véhicule</p>
        <p class="mt-1 font-medium">{{ vehicleLabel }}</p>
      </div>
    </div>
    <div class="border-t">
      <table class="w-full text-sm">
        <thead class="bg-muted/50 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th class="px-4 py-2 font-medium">Article</th>
            <th class="px-4 py-2 text-right font-medium">Qté</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="line in lines" :key="line.productId" class="border-t">
            <td class="px-4 py-2">
              <p class="font-medium">{{ line.productName }}</p>
              <p v-if="line.sku" class="text-[11px] text-muted-foreground">{{ line.sku }}</p>
            </td>
            <td class="px-4 py-2 text-right tabular-nums">
              {{ formatNumber(line.quantity) }}
              <span class="text-xs text-muted-foreground">{{ line.unit }}</span>
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="border-t bg-muted/30">
            <td class="px-4 py-2 text-xs text-muted-foreground">{{ lines.length }} lignes</td>
            <td class="px-4 py-2 text-right text-sm font-semibold tabular-nums">{{ formatNumber(totalQty) }}</td>
          </tr>
        </tfoot>
      </table>
    </div>
    <p v-if="notes" class="border-t px-4 py-2.5 text-xs text-amber-800">{{ notes }}</p>
    <div class="grid grid-cols-2 gap-3 border-t px-4 py-3">
      <div class="rounded-lg border border-dashed px-3 py-2.5">
        <p class="text-[11px] text-muted-foreground">Signature chauffeur</p>
        <p class="mt-3 text-sm font-medium">{{ driverName }}</p>
      </div>
      <div class="rounded-lg border border-dashed px-3 py-2.5">
        <p class="text-[11px] text-muted-foreground">Signature destinataire</p>
        <p v-if="signedAt" class="mt-3 text-sm font-medium">{{ signedBy ?? 'Réceptionnée' }}</p>
        <p v-else class="mt-3 text-xs text-muted-foreground">En attente</p>
      </div>
    </div>
  </section>
</template>
