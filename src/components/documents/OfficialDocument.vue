<script setup lang="ts">
import { watch, onUnmounted } from 'vue'
import { formatDate } from '@/lib/utils'
import { registerOfficialDoc, type DocLine, type DocParty } from '@/utils/documents'

const props = defineProps<{
  title: string
  code: string
  date: string
  issuerName: string
  issuerLegal?: string
  issuerIce?: string
  issuerCity?: string
  issuerPhone?: string
  issuerEmail?: string
  parties?: DocParty[]
  lines: DocLine[]
  totalLabel?: string
  notes?: string
  signatures?: { label: string; name?: string }[]
}>()

watch(
  () => props,
  (value) => {
    registerOfficialDoc({
      ...value,
      date: value.date ? formatDate(value.date) : '',
    })
  },
  { immediate: true, deep: true },
)
onUnmounted(() => registerOfficialDoc(null))
</script>

<template>
  <article class="print-sheet official-doc overflow-hidden rounded-xl border bg-card text-sm">
    <div class="flex items-start justify-between gap-3 border-b bg-muted/40 px-4 py-3">
      <div>
        <p class="text-sm font-semibold">{{ issuerName }}</p>
        <p v-if="issuerLegal && issuerLegal !== issuerName" class="text-xs text-muted-foreground">{{ issuerLegal }}</p>
        <p class="mt-1 text-[11px] text-muted-foreground">
          <span v-if="issuerIce">ICE {{ issuerIce }}</span>
          <span v-if="issuerCity"> · {{ issuerCity }}</span>
        </p>
        <p v-if="issuerPhone || issuerEmail" class="text-[11px] text-muted-foreground">
          {{ issuerPhone }}<span v-if="issuerPhone && issuerEmail"> · </span>{{ issuerEmail }}
        </p>
      </div>
      <div class="text-right">
        <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{{ title }}</p>
        <p class="mt-0.5 text-base font-semibold">{{ code }}</p>
        <p class="mt-1 text-xs text-muted-foreground">{{ date ? formatDate(date) : '—' }}</p>
      </div>
    </div>

    <div v-if="parties?.length" class="grid gap-4 border-b px-4 py-3 sm:grid-cols-2">
      <div v-for="party in parties" :key="party.title">
        <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{{ party.title }}</p>
        <p class="mt-1 font-medium">{{ party.name }}</p>
        <p v-if="party.detail" class="text-xs text-muted-foreground">{{ party.detail }}</p>
      </div>
    </div>

    <table class="w-full">
      <thead class="bg-muted/50 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
        <tr>
          <th class="px-4 py-2 font-medium">Désignation</th>
          <th class="px-4 py-2 text-right font-medium">Qté / détail</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(line, index) in lines" :key="index" class="border-t">
          <td class="px-4 py-2">
            <p class="font-medium">{{ line.name }}</p>
            <p v-if="line.sku" class="text-[11px] text-muted-foreground">{{ line.sku }}</p>
          </td>
          <td class="px-4 py-2 text-right">
            <p class="tabular-nums">{{ line.qty }}</p>
            <p v-if="line.detail" class="text-[11px] text-muted-foreground">{{ line.detail }}</p>
          </td>
        </tr>
      </tbody>
    </table>

    <p v-if="totalLabel" class="border-t px-4 py-2.5 text-right text-sm font-semibold">{{ totalLabel }}</p>
    <p v-if="notes" class="border-t px-4 py-2.5 text-xs text-muted-foreground">{{ notes }}</p>

    <div v-if="signatures?.length" class="grid gap-3 border-t px-4 py-3 sm:grid-cols-2">
      <div v-for="item in signatures" :key="item.label" class="rounded-lg border border-dashed px-3 py-2.5">
        <p class="text-[11px] text-muted-foreground">{{ item.label }}</p>
        <p class="mt-3 min-h-6 text-sm font-medium">{{ item.name || ' ' }}</p>
      </div>
    </div>
  </article>
</template>
