<script setup lang="ts">
import { formatNumber } from '@/lib/utils'
import { SHIPPING_NOTE_LABEL } from '@/config/logistics'
import type { ShippingNote } from '@/types'

defineProps<{
  note: ShippingNote
}>()
</script>

<template>
  <article class="rounded-xl border bg-muted/30 px-3 py-2.5">
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <p class="text-sm font-semibold">{{ note.code }}</p>
        <p class="mt-0.5 text-sm">{{ note.client }}</p>
        <p class="text-xs text-muted-foreground">{{ note.address }} · {{ note.city }}</p>
      </div>
      <p class="shrink-0 text-[11px] text-muted-foreground">{{ SHIPPING_NOTE_LABEL[note.status] }}</p>
    </div>
    <ul class="mt-2 space-y-1 border-t pt-2">
      <li v-for="line in note.lines" :key="line.productId" class="flex justify-between gap-3 text-xs">
        <span class="min-w-0 truncate">{{ line.productName }}</span>
        <span class="shrink-0 tabular-nums text-muted-foreground">
          {{ formatNumber(line.quantity) }} {{ line.unit }}
        </span>
      </li>
    </ul>
  </article>
</template>
