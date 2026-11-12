<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ChevronDown } from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import Card from '@/components/ui/Card.vue'
import { useAuth } from '@/composables/useAuth'
import { users } from '@/mocks/users'
import { companies } from '@/mocks/platform'
import type { RoleKey } from '@/types'

const ATLAS_COMPANY_ID = 'co-atlas'

const email = ref('sarah@bravo.stock')
const password = ref('demo')
const demosOpen = ref(false)
const { login, loading, error } = useAuth()

const roleLabel: Partial<Record<RoleKey, string>> = {
  SUPER_ADMIN: 'Super admin',
  TENANT_OWNER: 'Propriétaire',
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  WAREHOUSE_MANAGER: 'Magasin',
  PROCUREMENT: 'Achats',
  FINANCE: 'Finance',
  DISPATCHER: 'Dispatch',
  DRIVER: 'Chauffeur',
  AUDITOR: 'Auditeur',
}

const demos = users.filter(
  (user) => user.role === 'SUPER_ADMIN' || user.companyId === ATLAS_COMPANY_ID,
)

function companyLabel(user: (typeof users)[number]) {
  if (user.role === 'SUPER_ADMIN') return 'Plateforme BravoStock'
  return companies.find((item) => item.id === user.companyId)?.name ?? 'Sans entreprise'
}

const selectedDemo = computed(
  () => demos.find((user) => user.email === email.value) ?? demos[0],
)
</script>

<template>
  <div class="mx-auto w-full max-w-sm">
    <Card class="p-5">
      <h1 class="text-lg font-semibold tracking-tight">Connexion</h1>
      <p class="mt-1 text-[13px] text-muted-foreground">Votre journée commence ici.</p>
      <form class="mt-5 space-y-3.5" @submit.prevent="login(email, password)">
        <div class="space-y-1.5">
          <Label>Email</Label>
          <Input v-model="email" type="email" />
        </div>
        <div class="space-y-1.5">
          <Label>Mot de passe</Label>
          <Input v-model="password" type="password" />
        </div>
        <p v-if="error" class="text-[13px] text-destructive">{{ error }}</p>
        <Button type="submit" class="w-full" :loading="loading">{{ loading ? 'Connexion…' : 'Entrer' }}</Button>
      </form>
      <p class="mt-4 text-center text-[13px]">
        <RouterLink to="/forgot-password" class="text-muted-foreground hover:text-foreground">Mot de passe oublié</RouterLink>
      </p>
      <p class="mt-2 text-center text-[13px]">
        <RouterLink to="/accueil" class="text-muted-foreground hover:text-foreground">Découvrir BravoStock</RouterLink>
      </p>
    </Card>

    <section class="mt-3 overflow-hidden rounded-md border border-border/70 bg-card">
      <button
        type="button"
        class="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-muted/40"
        :aria-expanded="demosOpen"
        @click="demosOpen = !demosOpen"
      >
        <span>
          <span class="block text-[11px] font-medium text-muted-foreground">
            Comptes de démonstration
          </span>
          <span class="mt-0.5 block text-[13px] text-muted-foreground">
            {{ demosOpen ? 'Mot de passe : demo' : `${selectedDemo.firstName} ${selectedDemo.lastName} · ${roleLabel[selectedDemo.role]}` }}
          </span>
        </span>
        <ChevronDown class="size-3.5 shrink-0 text-muted-foreground transition-transform" :class="demosOpen ? 'rotate-180' : ''" />
      </button>
      <div v-show="demosOpen" class="border-t border-border/70 px-3.5 pb-3.5 pt-2.5">
        <div class="grid gap-1.5">
          <button
            v-for="user in demos"
            :key="user.id"
            type="button"
            class="rounded-md border px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-muted/50"
            :class="email === user.email ? 'border-border bg-muted/60' : 'border-border/70 bg-background'"
            @click="email = user.email"
          >
            <span class="block font-medium">{{ user.firstName }} {{ user.lastName }}</span>
            <span class="mt-0.5 block text-[11px] text-muted-foreground">{{ roleLabel[user.role] }} · {{ companyLabel(user) }}</span>
            <span class="mt-0.5 block text-[11px] text-muted-foreground">{{ user.email }}</span>
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
