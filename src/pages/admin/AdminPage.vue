<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Pencil, Plus, Shield, Trash2 } from 'lucide-vue-next'
import { useAdminUsers, useRoles } from '@/composables/useWork'
import { useWarehouses } from '@/composables/useWarehouses'
import { useProducts } from '@/composables/useProducts'
import { useStock } from '@/composables/useStock'
import { useProcurement } from '@/composables/useProcurement'
import { useSuppliers } from '@/composables/useSuppliers'
import { usePermissions } from '@/composables/usePermissions'
import { useCurrentUser } from '@/composables/useAuth'
import { useActionBusy } from '@/composables/useActionBusy'
import { useDataStore } from '@/stores/data'
import PageHeader from '@/components/common/PageHeader.vue'
import EmptyState from '@/components/feedback/EmptyState.vue'
import ErrorState from '@/components/feedback/ErrorState.vue'
import Button from '@/components/ui/Button.vue'
import Sheet from '@/components/ui/Sheet.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import Badge from '@/components/ui/Badge.vue'
import Avatar from '@/components/ui/Avatar.vue'
import Switch from '@/components/ui/Switch.vue'
import ProductFormSheet from '@/components/stock/ProductFormSheet.vue'
import UserFormSheet from '@/components/admin/UserFormSheet.vue'
import WarehouseFormSheet from '@/components/admin/WarehouseFormSheet.vue'
import CustomerFormSheet from '@/components/admin/CustomerFormSheet.vue'
import LocationFormSheet from '@/components/admin/LocationFormSheet.vue'
import { useCustomers } from '@/composables/useCustomers'
import { useLocations } from '@/composables/useLocations'
import { useEntitlements } from '@/composables/useEntitlements'
import { formatDateTime, formatMoney, warehouseCode } from '@/lib/utils'
import type { Customer, Product, RoleKey, User, Warehouse, WarehouseLocation } from '@/types'
import type { CustomerInput, ProductInput, UserInput, WarehouseLocationInput } from '@/repositories/interfaces'

const route = useRoute()
const router = useRouter()
const { can } = usePermissions()
const { currentUser } = useCurrentUser()
const { busy, run, isBusy } = useActionBusy()
const { users, createUser, updateUser } = useAdminUsers()
const { roles } = useRoles()
const { allWarehouses, createWarehouse, updateWarehouse } = useWarehouses()
const { products, createProduct, updateProduct } = useProducts()
const { overview, inventories, pendingReceipts, warehouseName, toggleAssignment } = useStock()
const { orderOverviews } = useProcurement()
const { suppliers } = useSuppliers()
const store = useDataStore()
const { locations, createLocation, updateLocation } = useLocations()
const { canAddUser, canAddWarehouse, refresh: refreshEntitlements } = useEntitlements()
const store = useDataStore()
const locationWarehouseFilter = ref('all')
const locationOpen = ref(false)
const editingLocation = ref<WarehouseLocation | null>(null)

const tab = computed(() => (typeof route.query.tab === 'string' ? route.query.tab : 'today'))
const open = ref(false)
const assignOpen = ref(false)
const selectedWarehouse = ref('')
const managerId = ref('usr-warehouse')
const warehouseFilter = ref<'all' | 'active' | 'inactive'>('all')
const userFilter = ref<'all' | RoleKey>('all')
const supplierFilter = ref<'all' | 'weak' | 'solid'>('all')
const productFilter = ref('all')
const productOpen = ref(false)
const editingProduct = ref<Product | null>(null)
const userOpen = ref(false)
const editingUser = ref<User | null>(null)
const userError = ref('')
const customerOpen = ref(false)
const editingCustomer = ref<Customer | null>(null)

const titles: Record<string, { title: string; description: string }> = {
  today: { title: 'Aujourd’hui', description: 'Ce qui bloque les sites, sans quitter le référentiel.' },
  overview: { title: 'Entrepôts', description: 'Sites, responsables et affectation des produits.' },
  users: { title: 'Utilisateurs', description: 'Comptes, rôles et périmètres d’action.' },
  products: { title: 'Produits', description: 'Le catalogue utilisé par les entrepôts.' },
  suppliers: { title: 'Fournisseurs', description: 'Partenaires, délais et fiabilité.' },
  customers: { title: 'Clients', description: 'Destinataires et adresses de livraison.' },
  locations: { title: 'Emplacements', description: 'Allées, racks et bacs pour putaway et picking.' },
  categories: { title: 'Catégories', description: 'La classification du catalogue.' },
  settings: { title: 'Paramètres', description: 'Données de démonstration de cette session.' },
  roles: { title: 'Rôles', description: 'Ce que chaque profil a le droit de voir et de faire.' },
  audit: { title: 'Audit', description: 'Les actions qui ont déjà eu lieu.' },
}

const header = computed(() => titles[tab.value] ?? titles.overview)

const roleLabel: Record<RoleKey, string> = {
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

const managers = computed(() =>
  users.value.filter((user) => ['WAREHOUSE_MANAGER', 'ADMIN', 'MANAGER'].includes(user.role)),
)

const warehouseCounts = computed(() => ({
  all: allWarehouses.value.length,
  active: allWarehouses.value.filter((item) => item.active !== false).length,
  inactive: allWarehouses.value.filter((item) => item.active === false).length,
}))

const visibleWarehouses = computed(() => {
  if (warehouseFilter.value === 'active') return allWarehouses.value.filter((item) => item.active !== false)
  if (warehouseFilter.value === 'inactive') return allWarehouses.value.filter((item) => item.active === false)
  return allWarehouses.value
})

const userCounts = computed(() => {
  const byRole = {} as Record<RoleKey, number>
  users.value.forEach((user) => {
    byRole[user.role] = (byRole[user.role] ?? 0) + 1
  })
  return { all: users.value.length, byRole }
})

const visibleUsers = computed(() =>
  userFilter.value === 'all' ? users.value : users.value.filter((item) => item.role === userFilter.value),
)

const userChips = computed(() => [
  { id: 'all' as const, label: 'Tous', count: userCounts.value.all },
  ...roles.value
    .filter((role) => userCounts.value.byRole[role.key])
    .map((role) => ({ id: role.key, label: roleLabel[role.key], count: userCounts.value.byRole[role.key] })),
])

const formRoles = computed(() => {
  if (currentUser.value?.role === 'SUPER_ADMIN' || editingUser.value?.role === 'SUPER_ADMIN') return roles.value
  return roles.value.filter((role) => role.key !== 'SUPER_ADMIN' && role.key !== 'TENANT_OWNER')
})

const editingDriverPhone = computed(() => {
  const driverId = editingUser.value?.driverId
  if (!driverId) return ''
  return store.db.drivers.find((item) => item.id === driverId)?.phone ?? ''
})

const weakSuppliers = computed(() => suppliers.value.filter((item) => item.reliability < 80))
const visibleSuppliers = computed(() => {
  if (supplierFilter.value === 'weak') return weakSuppliers.value
  if (supplierFilter.value === 'solid') return suppliers.value.filter((item) => item.reliability >= 80)
  return suppliers.value
})

const visibleProducts = computed(() =>
  productFilter.value === 'all'
    ? products.value
    : products.value.filter((item) => item.categoryId === productFilter.value),
)

const productChips = computed(() => [
  { id: 'all', label: 'Tous', count: products.value.length },
  ...store.db.categories.map((category) => ({
    id: category.id,
    label: category.name,
    count: products.value.filter((item) => item.categoryId === category.id).length,
  })),
])

const auditLogs = computed(() =>
  [...store.db.auditLogs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
)

function managerOf(userId: string) {
  return users.value.find((user) => user.id === userId)
}

function isAssigned(productId: string, warehouseId: string) {
  const row = store.db.stock.find((item) => item.productId === productId && item.warehouseId === warehouseId)
  return row ? row.enabled !== false : false
}

function categoryName(id: string) {
  return store.db.categories.find((item) => item.id === id)?.name ?? id
}

function warehouseNames(ids: string[]) {
  return ids
    .map((id) => allWarehouses.value.find((item) => item.id === id)?.name)
    .filter(Boolean)
    .join(' · ')
}

function companyName(id?: string) {
  if (!id) return ''
  return store.db.companies.find((item) => item.id === id)?.name ?? ''
}

function usersWithRole(key: RoleKey) {
  return users.value.filter((item) => item.role === key).length
}

function actorName(userId: string) {
  const user = users.value.find((item) => item.id === userId)
  return user ? `${user.firstName} ${user.lastName}` : userId
}

function entityLabel(entity: string) {
  if (entity === 'receipt') return 'Réception'
  if (entity === 'purchase') return 'Commande'
  if (entity === 'stock') return 'Stock'
  return entity
}

function reliabilityVariant(value: number) {
  if (value < 75) return 'critical'
  if (value < 85) return 'warning'
  return 'success'
}

async function onToggleWarehouseActive(id: string, active: boolean) {
  await run(async () => {
    await updateWarehouse(id, { active })
  }, `wh-active-${id}`)
}

async function onDeactivateWarehouse(id: string) {
  await run(async () => {
    await updateWarehouse(id, { active: false })
  }, `wh-off-${id}`)
}

async function onToggleAssignment(productId: string, warehouseId: string, enabled: boolean) {
  await run(async () => {
    await toggleAssignment(productId, warehouseId, enabled)
  }, `assign-${productId}-${warehouseId}`)
}

async function onScopeUser(id: string) {
  await run(async () => {
    await updateUser(id, { warehouseIds: ['wh-casa', 'wh-rabat'] })
  }, `scope-${id}`)
}

async function addWarehouse(input: Omit<Warehouse, 'id'>) {
  await run(async () => {
    await createWarehouse(input)
    await refreshEntitlements()
    open.value = false
  })
}

async function assignManager() {
  if (!selectedWarehouse.value) return
  await run(async () => {
    await updateWarehouse(selectedWarehouse.value, { managerUserId: managerId.value })
    assignOpen.value = false
  })
}

function openAssign(warehouseId: string, currentManager: string) {
  selectedWarehouse.value = warehouseId
  managerId.value = currentManager
  assignOpen.value = true
}

function scopeLabel(user: User) {
  if (user.warehouseIds.length) return warehouseNames(user.warehouseIds)
  if (user.role === 'ADMIN') return 'Toute l’entreprise'
  if (user.role === 'TENANT_OWNER') return 'Propriétaire de l’entreprise'
  if (user.role === 'SUPER_ADMIN') return 'Plateforme Bravo.Stock'
  return 'Tous les sites'
}

function openNewUser() {
  editingUser.value = null
  userError.value = ''
  userOpen.value = true
}

function openEditUser(user: User) {
  editingUser.value = user
  userError.value = ''
  userOpen.value = true
}

async function saveUser(payload: { id?: string; input: UserInput }) {
  await run(async () => {
    userError.value = ''
    try {
      const input = { ...payload.input, createdByUserId: currentUser.value?.id }
      if (payload.id) await updateUser(payload.id, input)
      else {
        await createUser(input)
        await refreshEntitlements()
      }
    } catch (err) {
      userError.value = err instanceof Error ? err.message : 'Enregistrement impossible'
    }
  })
}

function openNewProduct() {
  editingProduct.value = null
  productOpen.value = true
}

function openEditProduct(product: Product) {
  editingProduct.value = product
  productOpen.value = true
}

async function saveProduct(payload: { id?: string; input: ProductInput }) {
  await run(async () => {
    if (payload.id) await updateProduct(payload.id, payload.input)
    else await createProduct(payload.input)
    productOpen.value = false
    editingProduct.value = null
  })
}

watch(selectedWarehouse, (id) => {
  const warehouse = allWarehouses.value.find((item) => item.id === id)
function openNewCustomer() {
  editingCustomer.value = null
  customerOpen.value = true
}

function openEditCustomer(customer: Customer) {
  editingCustomer.value = customer
  customerOpen.value = true
}

async function saveCustomer(payload: { id?: string; input: CustomerInput }) {
  await run(async () => {
    if (payload.id) await updateCustomer(payload.id, payload.input)
    else await createCustomer(payload.input)
    customerOpen.value = false
    editingCustomer.value = null
  })
}

const visibleLocations = computed(() => {
  if (locationWarehouseFilter.value === 'all') return locations.value
  return locations.value.filter((item) => item.warehouseId === locationWarehouseFilter.value)
})

function locationWarehouseName(id: string) {
  return allWarehouses.value.find((item) => item.id === id)?.name ?? id
}

function openNewLocation() {
  editingLocation.value = null
  locationOpen.value = true
}

function openEditLocation(location: WarehouseLocation) {
  editingLocation.value = location
  locationOpen.value = true
}

async function saveLocation(payload: { id?: string; input: WarehouseLocationInput }) {
  await run(async () => {
    if (payload.id) await updateLocation(payload.id, payload.input)
    else await createLocation(payload.input)
    locationOpen.value = false
    editingLocation.value = null
  })
}

  if (warehouse) managerId.value = warehouse.managerUserId
})

const opsRisks = computed(() =>
  overview.value.filter((item) => item.status === 'critical' || item.status === 'watch').slice(0, 6),
)
const opsInventories = computed(() => inventories.value.filter((item) => item.status !== 'completed'))
const opsReceipts = computed(() => pendingReceipts.value.slice(0, 6))
const opsDelayed = computed(() => orderOverviews.value.filter((item) => item.late).slice(0, 5))
</script>

<template>
  <div class="page-wide">
    <PageHeader :title="header.title" :description="header.description">
      <template #actions>
        <Button v-if="can('warehouse.create') && tab === 'overview'" size="sm" @click="open = true">
          <Plus class="size-3.5" />
        <Button v-if="can('warehouse.create') && tab === 'overview'" size="sm" :disabled="!canAddWarehouse" :title="canAddWarehouse ? undefined : 'Limite du plan atteinte'" @click="open = true">
        </Button>
        <Button v-if="can('product.create') && tab === 'products'" size="sm" @click="openNewProduct">
          <Plus class="size-3.5" />
          Nouveau produit
        </Button>
        <Button v-if="can('user.create') && tab === 'users'" size="sm" @click="openNewUser">
          <Plus class="size-3.5" />
        <Button v-if="can('user.create') && tab === 'users'" size="sm" :disabled="!canAddUser" :title="canAddUser ? undefined : 'Limite du plan atteinte'" @click="openNewUser">
        </Button>
      </template>
    </PageHeader>
        <Button
          v-if="(can('delivery.create') || can('delivery.prepare') || can('product.create')) && tab === 'customers'"
          size="sm"
          @click="openNewCustomer"
        >
          <Plus class="size-3.5" />
          Nouveau client
        </Button>
        <Button
          v-if="(can('warehouse.update') || can('warehouse.create')) && tab === 'locations'"
          size="sm"
          @click="openNewLocation"
        >
          <Plus class="size-3.5" />
          Nouvel emplacement
        </Button>
    <ErrorState v-if="!can('user.view')" message="Accès administration restreint." />

    <div v-else-if="tab === 'today'" class="space-y-4">
      <p v-if="!opsRisks.length && !opsInventories.length && !opsReceipts.length && !opsDelayed.length" class="text-sm text-muted-foreground">
        Rien de bloquant sur les sites.
      </p>
      <article
        v-for="row in opsRisks"
        :key="row.id"
        class="surface flex cursor-pointer items-center justify-between gap-3 border-l-4 px-4 py-3"
        :class="row.status === 'critical' ? 'border-l-red-500' : 'border-l-amber-500'"
        @click="router.push({ path: '/stock', query: { article: row.productId, warehouse: row.warehouseId } })"
      >
        <div>
          <p class="text-sm font-semibold">{{ row.productName }}</p>
          <p class="text-xs text-muted-foreground">{{ row.warehouseName }} · {{ row.days }} j de couverture</p>
        </div>
        <Badge :variant="row.status === 'critical' ? 'critical' : 'warning'">Rupture</Badge>
      </article>
      <article
        v-for="session in opsInventories"
        :key="session.id"
        class="surface flex cursor-pointer items-center justify-between gap-3 px-4 py-3"
        @click="router.push({ path: '/stock', query: { tab: 'inventory', session: session.id } })"
      >
        <div>
          <p class="text-sm font-semibold">Inventaire {{ warehouseName(session.warehouseId) }}</p>
          <p class="text-xs text-muted-foreground">
            {{ session.status === 'pending_review' ? 'Écarts à valider' : 'Comptage en cours' }}
          </p>
        </div>
        <Badge variant="warning">{{ session.status === 'pending_review' ? 'À valider' : 'En cours' }}</Badge>
      </article>
      <article
        v-for="receipt in opsReceipts"
        :key="receipt.id"
        class="surface flex cursor-pointer items-center justify-between gap-3 px-4 py-3"
        @click="router.push({ path: '/procurement', query: { tab: 'receipts', receipt: receipt.id } })"
      >
        <div>
          <p class="text-sm font-semibold">Réception {{ receipt.code ?? receipt.id }}</p>
          <p class="text-xs text-muted-foreground">{{ warehouseName(receipt.warehouseId) }}</p>
        </div>
        <Badge variant="info">Ouverte</Badge>
      </article>
      <article
        v-for="order in opsDelayed"
        :key="order.order.id"
        class="surface flex cursor-pointer items-center justify-between gap-3 px-4 py-3"
        @click="router.push({ path: '/procurement', query: { tab: 'orders', order: order.order.id } })"
      >
        <div>
          <p class="text-sm font-semibold">Retard {{ (order.order.code ?? order.order.id).toUpperCase() }}</p>
          <p class="text-xs text-muted-foreground">{{ order.supplierName }}</p>
        </div>
        <Badge variant="critical">Retard</Badge>
      </article>
    </div>

    <div v-else-if="tab === 'overview'" class="space-y-5">
      <div class="grid gap-3 sm:grid-cols-3">
        <button
          class="surface border-l-4 border-l-primary p-4 text-left transition-colors hover:bg-primary/5"
          :class="warehouseFilter === 'all' ? 'ring-1 ring-primary/20' : ''"
          @click="warehouseFilter = 'all'"
        >
          <p class="text-[13px] font-medium text-muted-foreground">Sites</p>
          <p class="mt-2 text-2xl font-semibold tracking-tight">{{ warehouseCounts.all }}</p>
          <p class="mt-1 text-xs text-muted-foreground">Entrepôts de l’entreprise</p>
        </button>
        <button
          class="surface border-l-4 border-l-emerald-500 p-4 text-left transition-colors hover:bg-emerald-50/60"
          :class="warehouseFilter === 'active' ? 'ring-1 ring-emerald-200' : ''"
          @click="warehouseFilter = 'active'"
        >
          <p class="text-[13px] font-medium text-emerald-800">Actifs</p>
          <p class="mt-2 text-2xl font-semibold tracking-tight text-emerald-800">{{ warehouseCounts.active }}</p>
          <p class="mt-1 text-xs text-emerald-800/70">Opérationnels aujourd’hui</p>
        </button>
        <button
          class="surface border-l-4 border-l-amber-500 p-4 text-left transition-colors hover:bg-amber-50/60"
          :class="warehouseFilter === 'inactive' ? 'ring-1 ring-amber-200' : ''"
          @click="warehouseFilter = 'inactive'"
        >
          <p class="text-[13px] font-medium text-amber-800">Inactifs</p>
          <p class="mt-2 text-2xl font-semibold tracking-tight text-amber-800">{{ warehouseCounts.inactive }}</p>
          <p class="mt-1 text-xs text-amber-800/70">Hors circuit</p>
        </button>
      </div>

      <EmptyState v-if="!visibleWarehouses.length" title="Aucun entrepôt dans ce filtre" />
      <div v-else class="grid gap-3 lg:grid-cols-2">
        <article
          v-for="warehouse in visibleWarehouses"
          :key="warehouse.id"
          class="surface border-l-4 p-4"
          :class="warehouse.active !== false ? 'border-l-emerald-500' : 'border-l-zinc-300'"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <h2 class="text-sm font-semibold">{{ warehouse.name }}</h2>
                <Badge variant="outline">{{ warehouseCode(warehouse.id) }}</Badge>
                <Badge :variant="warehouse.active !== false ? 'success' : 'outline'">
                  {{ warehouse.active !== false ? 'Actif' : 'Inactif' }}
                </Badge>
              </div>
              <p class="mt-1 text-xs text-muted-foreground">{{ warehouse.city }} · {{ warehouse.address }}</p>
            </div>
            <Switch
              :checked="warehouse.active !== false"
              :loading="isBusy(`wh-active-${warehouse.id}`)"
              :disabled="busy && !isBusy(`wh-active-${warehouse.id}`)"
              @update:checked="onToggleWarehouseActive(warehouse.id, $event)"
            />
          </div>
          <div class="mt-3 flex items-center justify-between gap-3">
            <div v-if="managerOf(warehouse.managerUserId)" class="flex items-center gap-2">
              <Avatar
                class="size-7 text-[10px]"
                :first-name="managerOf(warehouse.managerUserId)!.firstName"
                :last-name="managerOf(warehouse.managerUserId)!.lastName"
                :hue="managerOf(warehouse.managerUserId)!.avatarHue"
              />
              <span class="text-sm">
                {{ managerOf(warehouse.managerUserId)!.firstName }}
                {{ managerOf(warehouse.managerUserId)!.lastName }}
              </span>
            </div>
            <div class="flex gap-1">
              <Button
                v-if="can('warehouse.assign')"
                size="icon"
                variant="ghost"
                @click="openAssign(warehouse.id, warehouse.managerUserId)"
              >
                <Pencil class="size-4" />
              </Button>
              <Button
                v-if="can('warehouse.update') && warehouse.active !== false"
                size="icon"
                variant="destructive"
                :loading="isBusy(`wh-off-${warehouse.id}`)"
                @click="onDeactivateWarehouse(warehouse.id)"
              >
                <Trash2 class="size-4" />
              </Button>
            </div>
          </div>
        </article>
      </div>

      <section class="surface p-5">
        <h2 class="text-sm font-semibold">Affectation des produits</h2>
        <p class="mt-1 text-xs text-muted-foreground">Activez un article sur un site pour qu’il apparaisse en stock.</p>
        <div class="mt-4 overflow-x-auto">
          <table class="w-full min-w-[560px] text-sm">
            <thead>
              <tr class="border-b text-left">
                <th class="section-title pb-3">Produit</th>
                <th v-for="warehouse in allWarehouses" :key="warehouse.id" class="section-title pb-3 text-center">
                  {{ warehouse.name }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="product in products" :key="product.id" class="border-b last:border-0">
                <td class="py-3 font-medium">{{ product.name }}</td>
                <td v-for="warehouse in allWarehouses" :key="warehouse.id" class="py-3 text-center">
                  <div class="flex justify-center">
                    <Switch
                      :checked="isAssigned(product.id, warehouse.id)"
                      :loading="isBusy(`assign-${product.id}-${warehouse.id}`)"
                      :disabled="busy && !isBusy(`assign-${product.id}-${warehouse.id}`)"
                      @update:checked="onToggleAssignment(product.id, warehouse.id, $event)"
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <div v-else-if="tab === 'users'" class="space-y-5">
      <div class="grid gap-3 sm:grid-cols-3">
        <article class="surface border-l-4 border-l-primary p-4">
          <p class="text-[13px] font-medium text-muted-foreground">Comptes</p>
          <p class="mt-2 text-2xl font-semibold tracking-tight">{{ users.length }}</p>
          <p class="mt-1 text-xs text-muted-foreground">Personnes qui peuvent se connecter</p>
        </article>
        <article class="surface border-l-4 border-l-blue-500 p-4">
          <p class="text-[13px] font-medium text-blue-700">Rôles</p>
          <p class="mt-2 text-2xl font-semibold tracking-tight text-blue-700">{{ roles.length }}</p>
          <p class="mt-1 text-xs text-blue-700/70">Profils de droits</p>
        </article>
        <article class="surface border-l-4 border-l-emerald-500 p-4">
          <p class="text-[13px] font-medium text-emerald-800">Magasins</p>
          <p class="mt-2 text-2xl font-semibold tracking-tight text-emerald-800">
            {{ userCounts.byRole.WAREHOUSE_MANAGER ?? 0 }}
          </p>
          <p class="mt-1 text-xs text-emerald-800/70">Gestionnaires d’entrepôt</p>
        </article>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="item in userChips"
          :key="item.id"
          class="chip"
          :class="
            userFilter === item.id
              ? 'chip-active'
              : 'border-border bg-card text-muted-foreground hover:text-foreground'
          "
          @click="userFilter = item.id"
        >
          {{ item.label }}
          <span class="ml-1 tabular-nums">{{ item.count }}</span>
        </button>
      </div>
      <EmptyState v-if="!visibleUsers.length" title="Personne dans ce rôle" />
      <div v-else class="space-y-2">
        <article
          v-for="user in visibleUsers"
          :key="user.id"
          class="surface flex flex-wrap items-center justify-between gap-3 border-l-4 border-l-primary/40 px-4 py-3.5"
        >
          <div class="flex min-w-0 items-center gap-3">
            <Avatar :first-name="user.firstName" :last-name="user.lastName" :hue="user.avatarHue" />
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <p class="font-medium">{{ user.firstName }} {{ user.lastName }}</p>
                <Badge variant="info">{{ roleLabel[user.role] }}</Badge>
              </div>
              <p class="mt-0.5 text-xs text-muted-foreground">{{ user.email }} · {{ user.title }}</p>
              <p class="mt-0.5 text-xs text-muted-foreground">
                {{ companyName(user.companyId) || 'Sans entreprise' }} · {{ scopeLabel(user) }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <Button
              v-if="can('warehouse.assign') && user.role === 'WAREHOUSE_MANAGER'"
              size="sm"
              variant="outline"
              :loading="isBusy(`scope-${user.id}`)"
              @click="onScopeUser(user.id)"
            >
              Casa + Rabat
            </Button>
            <Button v-if="can('user.update')" size="icon" variant="ghost" @click="openEditUser(user)">
              <Pencil class="size-4" />
            </Button>
          </div>
        </article>
      </div>
    </div>

    <div v-else-if="tab === 'products'" class="space-y-5">
      <div class="grid gap-3 sm:grid-cols-3">
        <article class="surface border-l-4 border-l-primary p-4">
          <p class="text-[13px] font-medium text-muted-foreground">Catalogue</p>
          <p class="mt-2 text-2xl font-semibold tracking-tight">{{ products.length }}</p>
          <p class="mt-1 text-xs text-muted-foreground">Articles suivis</p>
        </article>
        <article class="surface border-l-4 border-l-blue-500 p-4">
          <p class="text-[13px] font-medium text-blue-700">Catégories</p>
          <p class="mt-2 text-2xl font-semibold tracking-tight text-blue-700">{{ store.db.categories.length }}</p>
          <p class="mt-1 text-xs text-blue-700/70">Familles d’articles</p>
        </article>
        <article class="surface border-l-4 border-l-amber-500 p-4">
          <p class="text-[13px] font-medium text-amber-800">Archivés</p>
          <p class="mt-2 text-2xl font-semibold tracking-tight text-amber-800">
            {{ products.filter((item) => item.archived).length }}
          </p>
          <p class="mt-1 text-xs text-amber-800/70">Hors catalogue actif</p>
        </article>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="item in productChips"
          :key="item.id"
          class="chip"
          :class="
            productFilter === item.id
              ? 'chip-active'
              : 'border-border bg-card text-muted-foreground hover:text-foreground'
          "
          @click="productFilter = item.id"
        >
          {{ item.label }}
          <span class="ml-1 tabular-nums">{{ item.count }}</span>
        </button>
      </div>
      <div class="space-y-2">
        <article
          v-for="product in visibleProducts"
          :key="product.id"
          class="surface flex flex-wrap items-center justify-between gap-3 border-l-4 border-l-primary/40 px-4 py-3.5"
        >
          <div class="flex min-w-0 items-center gap-3">
            <div class="size-12 shrink-0 overflow-hidden rounded-xl bg-muted">
              <img
                v-if="product.images?.[0] || product.imageUrl"
                :src="product.images?.[0] ?? product.imageUrl"
                :alt="product.name"
                class="size-full object-cover"
              />
            </div>
            <div>
              <p class="text-sm font-semibold">{{ product.name }}</p>
              <p class="mt-0.5 text-xs text-muted-foreground">{{ product.sku }} · {{ categoryName(product.categoryId) }}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <Badge variant="outline">{{ product.unit }}</Badge>
            <span class="text-sm font-medium">{{ formatMoney(product.price) }}</span>
            <Button
              v-if="can('product.update') || can('product.create')"
              size="icon"
              variant="ghost"
              @click="openEditProduct(product)"
            >
              <Pencil class="size-4" />
            </Button>
          </div>
        </article>
      </div>
    </div>

    <div v-else-if="tab === 'suppliers'" class="space-y-5">
      <div class="grid gap-3 sm:grid-cols-3">
    <div v-else-if="tab === 'locations'" class="space-y-5">
      <div class="flex flex-wrap gap-2">
        <button
          class="chip border-border/70 bg-card"
          :class="locationWarehouseFilter === 'all' ? 'ring-1 ring-primary/30' : ''"
          @click="locationWarehouseFilter = 'all'"
        >
          Tous · {{ locations.length }}
        </button>
        <button
          v-for="warehouse in allWarehouses"
          :key="warehouse.id"
          class="chip border-border/70 bg-card"
          :class="locationWarehouseFilter === warehouse.id ? 'ring-1 ring-primary/30' : ''"
          @click="locationWarehouseFilter = warehouse.id"
        >
          {{ warehouse.name }}
        </button>
      </div>
      <EmptyState
        v-if="!visibleLocations.length"
        title="Aucun emplacement"
        description="Créez des allées / racks / bacs pour guider putaway et picking."
      />
      <div v-else class="space-y-2">
        <article v-for="location in visibleLocations" :key="location.id" class="surface px-4 py-3.5">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="text-sm font-semibold">{{ location.code }}</p>
              <p class="mt-0.5 text-xs text-muted-foreground">
                {{ locationWarehouseName(location.warehouseId) }} · {{ location.type }}
                · {{ location.aisle }}/{{ location.rack }}/{{ location.bin }}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <Badge :variant="location.active ? 'success' : 'outline'">{{ location.active ? 'Actif' : 'Inactif' }}</Badge>
              <Button size="icon" variant="outline" @click="openEditLocation(location)">
                <Pencil class="size-4" />
              </Button>
            </div>
          </div>
        </article>
      </div>
    </div>

    <div v-else-if="tab === 'customers'" class="space-y-5">
      <article class="surface border-l-4 border-l-primary p-4">
        <p class="text-[13px] font-medium text-muted-foreground">Clients actifs</p>
        <p class="mt-2 text-2xl font-semibold tracking-tight">{{ customers.length }}</p>
      </article>
      <EmptyState v-if="!customers.length" title="Aucun client" description="Ajoutez un destinataire pour préremplir les BL." />
      <div v-else class="space-y-2">
        <article v-for="customer in customers" :key="customer.id" class="surface px-4 py-3.5">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="text-sm font-semibold">{{ customer.name }}</p>
              <p class="mt-0.5 text-xs text-muted-foreground">
                {{ customer.addresses[0]?.city ?? '—' }}
                <span v-if="customer.phone"> · {{ customer.phone }}</span>
                · {{ customer.addresses.length }} adresse(s)
              </p>
            </div>
            <Button size="icon" variant="outline" @click="openEditCustomer(customer)">
              <Pencil class="size-4" />
            </Button>
          </div>
        </article>
      </div>
    </div>

        <button
          class="surface border-l-4 border-l-primary p-4 text-left transition-colors hover:bg-primary/5"
          :class="supplierFilter === 'all' ? 'ring-1 ring-primary/20' : ''"
          @click="supplierFilter = 'all'"
        >
          <p class="text-[13px] font-medium text-muted-foreground">Partenaires</p>
          <p class="mt-2 text-2xl font-semibold tracking-tight">{{ suppliers.length }}</p>
          <p class="mt-1 text-xs text-muted-foreground">Fournisseurs suivis</p>
        </button>
        <button
          class="surface border-l-4 border-l-red-500 p-4 text-left transition-colors hover:bg-red-50/60"
          :class="supplierFilter === 'weak' ? 'ring-1 ring-red-200' : ''"
          @click="supplierFilter = 'weak'"
        >
          <p class="text-[13px] font-medium text-red-700">À surveiller</p>
          <p class="mt-2 text-2xl font-semibold tracking-tight text-red-700">{{ weakSuppliers.length }}</p>
          <p class="mt-1 text-xs text-red-700/70">Fiabilité sous 80 %</p>
        </button>
        <button
          class="surface border-l-4 border-l-emerald-500 p-4 text-left transition-colors hover:bg-emerald-50/60"
          :class="supplierFilter === 'solid' ? 'ring-1 ring-emerald-200' : ''"
          @click="supplierFilter = 'solid'"
        >
          <p class="text-[13px] font-medium text-emerald-800">Solides</p>
          <p class="mt-2 text-2xl font-semibold tracking-tight text-emerald-800">
            {{ suppliers.length - weakSuppliers.length }}
          </p>
          <p class="mt-1 text-xs text-emerald-800/70">Délais tenus</p>
        </button>
      </div>
      <EmptyState v-if="!visibleSuppliers.length" title="Aucun fournisseur dans ce filtre" />
      <div v-else class="space-y-2">
        <article
          v-for="supplier in visibleSuppliers"
          :key="supplier.id"
          class="surface border-l-4 px-4 py-3.5"
          :class="supplier.reliability < 80 ? 'border-l-red-500 bg-red-50/40' : 'border-l-emerald-500'"
        >
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="text-sm font-semibold">{{ supplier.name }}</p>
              <p class="mt-0.5 text-xs text-muted-foreground">
                {{ supplier.city }} · {{ supplier.leadTimeDays }} j · {{ supplier.contact }}
              </p>
            </div>
            <Badge :variant="reliabilityVariant(supplier.reliability)">{{ supplier.reliability }} % fiabilité</Badge>
          </div>
        </article>
      </div>
    </div>

    <div v-else-if="tab === 'categories'" class="space-y-5">
      <div class="grid gap-3 sm:grid-cols-3">
        <article class="surface border-l-4 border-l-primary p-4">
          <p class="text-[13px] font-medium text-muted-foreground">Familles</p>
          <p class="mt-2 text-2xl font-semibold tracking-tight">{{ store.db.categories.length }}</p>
          <p class="mt-1 text-xs text-muted-foreground">Catégories du catalogue</p>
        </article>
        <article class="surface border-l-4 border-l-blue-500 p-4">
          <p class="text-[13px] font-medium text-blue-700">Articles</p>
          <p class="mt-2 text-2xl font-semibold tracking-tight text-blue-700">{{ products.length }}</p>
          <p class="mt-1 text-xs text-blue-700/70">Répartis dans ces familles</p>
        </article>
        <article class="surface border-l-4 border-l-amber-500 p-4">
          <p class="text-[13px] font-medium text-amber-800">Plus fournie</p>
          <p class="mt-2 text-lg font-semibold tracking-tight text-amber-800">
            {{
              [...store.db.categories].sort(
                (a, b) =>
                  products.filter((item) => item.categoryId === b.id).length -
                  products.filter((item) => item.categoryId === a.id).length,
              )[0]?.name ?? '—'
            }}
          </p>
          <p class="mt-1 text-xs text-amber-800/70">Le plus d’articles</p>
        </article>
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <article v-for="category in store.db.categories" :key="category.id" class="surface border-l-4 border-l-primary/40 p-4">
          <p class="text-sm font-semibold">{{ category.name }}</p>
          <p class="mt-1 text-xs text-muted-foreground">
            {{ products.filter((item) => item.categoryId === category.id).length }} article{{
              products.filter((item) => item.categoryId === category.id).length > 1 ? 's' : ''
            }}
          </p>
        </article>
      </div>
    </div>

    <div v-else-if="tab === 'roles'" class="space-y-5">
      <div class="grid gap-3 sm:grid-cols-3">
        <article class="surface border-l-4 border-l-primary p-4">
          <p class="text-[13px] font-medium text-muted-foreground">Profils</p>
          <p class="mt-2 text-2xl font-semibold tracking-tight">{{ roles.length }}</p>
          <p class="mt-1 text-xs text-muted-foreground">Rôles de la plateforme</p>
        </article>
        <article class="surface border-l-4 border-l-blue-500 p-4">
          <p class="text-[13px] font-medium text-blue-700">Utilisateurs</p>
          <p class="mt-2 text-2xl font-semibold tracking-tight text-blue-700">{{ users.length }}</p>
          <p class="mt-1 text-xs text-blue-700/70">Rattachés à un profil</p>
        </article>
        <article class="surface border-l-4 border-l-emerald-500 p-4">
          <p class="text-[13px] font-medium text-emerald-800">Consultation</p>
          <p class="mt-2 text-2xl font-semibold tracking-tight text-emerald-800">{{ usersWithRole('AUDITOR') }}</p>
          <p class="mt-1 text-xs text-emerald-800/70">Sans droit de modification</p>
        </article>
      </div>
      <div class="grid gap-3 md:grid-cols-2">
        <article v-for="role in roles" :key="role.id" class="surface border-l-4 border-l-primary/40 p-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-sm font-semibold">{{ role.name }}</p>
              <p class="mt-1 text-xs text-muted-foreground">{{ role.description }}</p>
            </div>
            <span class="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Shield class="size-4" />
            </span>
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            <Badge variant="outline">{{ role.permissions.length }} droits</Badge>
            <Badge variant="info">{{ usersWithRole(role.key) }} personne{{ usersWithRole(role.key) > 1 ? 's' : '' }}</Badge>
          </div>
        </article>
      </div>
    </div>

    <div v-else-if="tab === 'audit'" class="space-y-5">
      <div class="grid gap-3 sm:grid-cols-3">
        <article class="surface border-l-4 border-l-primary p-4">
          <p class="text-[13px] font-medium text-muted-foreground">Événements</p>
          <p class="mt-2 text-2xl font-semibold tracking-tight">{{ auditLogs.length }}</p>
          <p class="mt-1 text-xs text-muted-foreground">Journal de la session</p>
        </article>
        <article class="surface border-l-4 border-l-blue-500 p-4">
          <p class="text-[13px] font-medium text-blue-700">Dernière action</p>
          <p class="mt-2 text-sm font-semibold text-blue-800">
            {{ auditLogs[0]?.action ?? '—' }}
          </p>
          <p class="mt-1 text-xs text-blue-700/70">
            {{ auditLogs[0] ? formatDateTime(auditLogs[0].createdAt) : '' }}
          </p>
        </article>
        <article class="surface border-l-4 border-l-amber-500 p-4">
          <p class="text-[13px] font-medium text-amber-800">Acteurs</p>
          <p class="mt-2 text-2xl font-semibold tracking-tight text-amber-800">
            {{ new Set(auditLogs.map((item) => item.userId)).size }}
          </p>
          <p class="mt-1 text-xs text-amber-800/70">Personnes distinctes</p>
        </article>
      </div>
      <EmptyState v-if="!auditLogs.length" title="Aucune action enregistrée" />
      <ol v-else class="relative ml-2 border-l border-border">
        <li v-for="log in auditLogs" :key="log.id" class="relative pb-5 pl-5 last:pb-0">
          <span class="absolute -left-1.5 top-1.5 size-3 rounded-full border-2 border-background bg-primary" />
          <article class="surface border-l-4 border-l-primary/40 px-4 py-3">
            <p class="text-sm font-semibold">{{ log.action }}</p>
            <p class="mt-1 text-xs text-muted-foreground">
              {{ actorName(log.userId) }} · {{ entityLabel(log.entity) }} · {{ log.entityId }}
            </p>
            <p class="mt-1 text-xs text-muted-foreground">{{ formatDateTime(log.createdAt) }}</p>
          </article>
        </li>
      </ol>
    </div>

    <div v-else class="surface border-l-4 border-l-amber-500 p-5">
      <p class="text-sm font-semibold">Données de démonstration</p>
      <p class="mt-1 text-sm text-muted-foreground">
        Réinitialise le stock, les demandes, les alertes et le planning de cette session. Les comptes de démo restent.
      </p>
      <Button class="mt-4" variant="outline" @click="store.reset()">Réinitialiser les mocks</Button>
    </div>

    <WarehouseFormSheet :open="open" :managers="managers" @close="open = false" @submit="addWarehouse" />
    <Sheet :open="assignOpen" title="Affecter un gestionnaire" @close="assignOpen = false">
      <div class="space-y-3">
        <Label>Gestionnaire</Label>
        <select v-model="managerId" class="mt-1.5 h-10 w-full rounded-lg border bg-card px-3 text-sm">
          <option v-for="manager in managers" :key="manager.id" :value="manager.id">
            {{ manager.firstName }} {{ manager.lastName }} — {{ roleLabel[manager.role] }}
          </option>
        </select>
      </div>
      <template #footer>
        <Button class="w-full" @click="assignManager">Enregistrer</Button>
      </template>
    </Sheet>
    <ProductFormSheet
      :open="productOpen"
      :product="editingProduct"
      :categories="store.db.categories"
      :suppliers="suppliers"
      @close="productOpen = false; editingProduct = null"
      @submit="saveProduct"
    />
    <UserFormSheet
      :open="userOpen"
    <CustomerFormSheet
      :open="customerOpen"
      :customer="editingCustomer"
      @close="customerOpen = false; editingCustomer = null"
      @submit="saveCustomer"
    />
    <LocationFormSheet
      :open="locationOpen"
      :location="editingLocation"
      :warehouses="allWarehouses"
      :default-warehouse-id="locationWarehouseFilter !== 'all' ? locationWarehouseFilter : undefined"
      @close="locationOpen = false; editingLocation = null"
      @submit="saveLocation"
    />
      :user="editingUser"
      :roles="formRoles"
      :warehouses="allWarehouses"
      :error="userError"
      :driver-phone="editingDriverPhone"
      :company-name="companyName(editingUser?.companyId ?? currentUser?.companyId)"
      @close="userOpen = false; editingUser = null; userError = ''"
      @submit="saveUser"
    />
  </div>
</template>
