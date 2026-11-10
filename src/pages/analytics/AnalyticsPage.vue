<script setup lang="ts">
import { Package, ShoppingCart, Truck, Activity, Target, Wallet } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'
import { useAnalytics } from '@/composables/useWork'
import PageHeader from '@/components/common/PageHeader.vue'
import PageSkeleton from '@/components/feedback/PageSkeleton.vue'
import SignalCard from '@/components/common/SignalCard.vue'
import { formatMoney } from '@/lib/utils'

const { snapshot, loading } = useAnalytics()
</script>

<template>
  <div class="page-wide">
    <PageHeader title="Tendances" description="OTIF, ruptures et coût de livraison sur 30 jours." />
    <PageSkeleton v-if="loading || !snapshot" />
    <div v-else class="space-y-6">
      <div class="metric-strip sm:grid-cols-2 xl:grid-cols-3">
        <SignalCard
          label="OTIF"
          :value="`${snapshot.otifRate}%`"
          :icon="Target"
          tone="success"
          :trend="`${snapshot.otifOnTime}/${snapshot.otifDelivered} à l’heure`"
        />
        <SignalCard label="Ruptures" :value="snapshot.stockouts" :icon="Package" tone="critical" :trend="`${snapshot.stockWatch} à surveiller`" />
        <SignalCard
          label="Coût livraison"
          :value="formatMoney(snapshot.deliveryCostMad)"
          :icon="Wallet"
          tone="info"
          :trend="snapshot.costPerDelivery ? `${formatMoney(snapshot.costPerDelivery)} / livraison` : 'Aucune livraison'"
        />
        <SignalCard label="Commandes en retard" :value="snapshot.delayedOrders" :icon="ShoppingCart" tone="critical" />
        <SignalCard label="Échecs livraison" :value="snapshot.failedDeliveries" :icon="Truck" tone="warning" />
        <SignalCard label="Flux net" :value="snapshot.netFlow" :icon="Activity" tone="info" :trend="`${snapshot.received} in · ${snapshot.issued} out`" />
      </div>
      <div class="flex flex-wrap gap-2">
        <RouterLink to="/analytics/reports" class="chip border-border/70 bg-card hover:bg-muted">Rapports CSV</RouterLink>
        <RouterLink to="/analytics/forecasts" class="chip border-border/70 bg-card hover:bg-muted">Prévisions</RouterLink>
      </div>
    </div>
  </div>
</template>
