<script setup lang="ts">
import { Sparkles } from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import { formatMoney, formatNumber } from '@/lib/utils'
import type { SourcingOffer } from '@/services/sourcing.service'

defineProps<{ offers: SourcingOffer[]; canOrder: boolean; chosenId?: string; orderCount?: number }>()
const emit = defineEmits<{ order: [supplierId: string] }>()
</script>

<template>
  <section v-if="offers.length" class="space-y-3">
    <div class="rounded-xl border border-primary/20 bg-primary/5 p-4">
      <p class="flex items-center gap-2 text-sm font-semibold text-primary">
        <Sparkles class="size-4" />
        Référence interne
      </p>
      <p class="mt-2 text-sm">
        Reco :
        <span class="font-semibold">{{ offers.find((item) => item.recommended)?.supplierName }}</span>
        — prix catalogue, délai et fiabilité. Commander sans attendre un devis.
        <template v-if="(orderCount ?? 1) > 1"> {{ orderCount }} demandes dans le même OA.</template>
      </p>
    </div>
    <article
      v-for="offer in offers"
      :key="offer.supplierId"
      class="rounded-xl border px-3 py-3"
      :class="offer.recommended ? 'border-primary/40 bg-primary/5' : ''"
    >
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-sm font-medium">{{ offer.supplierName }}</p>
          <p class="text-xs text-muted-foreground">{{ offer.city }} · {{ offer.leadTimeDays }} j · fiabilité {{ offer.reliability }}%</p>
        </div>
        <div class="text-right">
          <p class="text-sm font-semibold">{{ formatMoney(offer.amount) }}</p>
          <p class="text-xs text-muted-foreground">{{ formatNumber(offer.quantity) }} à commander</p>
        </div>
      </div>
      <div class="mt-2 flex flex-wrap gap-1.5">
        <Badge v-if="offer.recommended" variant="info">Recommandé</Badge>
        <Badge v-if="offer.preferred" variant="outline">Habituel</Badge>
        <Badge v-if="chosenId === offer.supplierId" variant="success">Choisi</Badge>
      </div>
      <ul class="mt-2 space-y-0.5 text-xs text-muted-foreground">
        <li v-for="reason in offer.reasons" :key="reason">· {{ reason }}</li>
      </ul>
      <Button
        v-if="canOrder"
        class="mt-3 w-full"
        :variant="offer.recommended ? 'default' : 'outline'"
        @click="emit('order', offer.supplierId)"
      >
        Créer l’OA{{ (orderCount ?? 1) > 1 ? ` groupé (${orderCount} DA)` : '' }} sans devis — {{ offer.supplierName }}
      </Button>
    </article>
  </section>
</template>
