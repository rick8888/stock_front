<script setup lang="ts">
import { Package, ShoppingCart, Truck, Activity } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'
import { useAnalytics } from '@/composables/useWork'
import PageHeader from '@/components/common/PageHeader.vue'
import PageSkeleton from '@/components/feedback/PageSkeleton.vue'
import SignalCard from '@/components/common/SignalCard.vue'

const { snapshot, loading } = useAnalytics()
</script>

<template>
  <div class="page-wide">
    <PageHeader title="Tendances" description="Quatre signaux. Le détail est dans les rapports et les prévisions." />
    <PageSkeleton v-if="loading || !snapshot" />
    <div v-else class="space-y-6">
      <div class="metric-strip sm:grid-cols-2 xl:grid-cols-4">
        <SignalCard label="Risques stock" :value="snapshot.stockRisks" :icon="Package" tone="warning" />
        <SignalCard label="Commandes en retard" :value="snapshot.delayedOrders" :icon="ShoppingCart" tone="critical" />
        <SignalCard label="Livraisons à risque" :value="snapshot.deliveryRisks" :icon="Truck" tone="warning" />
        <SignalCard label="Flux net" :value="snapshot.netFlow" :icon="Activity" tone="info" />
      </div>
      <div class="flex flex-wrap gap-2">
        <RouterLink to="/analytics/reports" class="chip border-border/70 bg-card hover:bg-muted">Rapports CSV</RouterLink>
        <RouterLink to="/analytics/forecasts" class="chip border-border/70 bg-card hover:bg-muted">Prévisions</RouterLink>
      </div>
    </div>
  </div>
</template>
