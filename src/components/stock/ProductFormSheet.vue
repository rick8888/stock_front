<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ImagePlus, X } from 'lucide-vue-next'
import Sheet from '@/components/ui/Sheet.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import Textarea from '@/components/ui/Textarea.vue'
import type { Category, Product, Supplier } from '@/types'
import type { ProductInput } from '@/repositories/interfaces'

const UNITS = ['unité', 'bidon', 'sac', 'brique', 'pack', 'flacon', 'paquet', 'boîte', 'carton', 'kg', 'L']
const MAX_IMAGES = 4
const MAX_FILE_SIZE = 2_000_000

const props = defineProps<{
  open: boolean
  product?: Product | null
  categories: Category[]
  suppliers: Supplier[]
}>()

const emit = defineEmits<{
  close: []
  submit: [payload: { id?: string; input: ProductInput }]
}>()

const name = ref('')
const sku = ref('')
const barcode = ref('')
const description = ref('')
const categoryId = ref('')
const unit = ref('unité')
const supplierId = ref('')
const price = ref('20')
const minStock = ref('50')
const maxStock = ref('200')
const dailyDemand = ref('5')
const images = ref<string[]>([])
const fileError = ref('')
const skuTouched = ref(false)

const editing = computed(() => Boolean(props.product))
const canSubmit = computed(() => name.value.trim().length > 1 && sku.value.trim().length > 1 && categoryId.value && supplierId.value)

function suggestSku(value: string) {
  const compact = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 8)
  return compact || 'SKU'
}

function reset() {
  const current = props.product
  skuTouched.value = Boolean(current?.sku)
  name.value = current?.name ?? ''
  sku.value = current?.sku ?? suggestSku(current?.name ?? '')
  barcode.value = current?.barcode ?? ''
  description.value = current?.description ?? ''
  categoryId.value = current?.categoryId ?? props.categories[0]?.id ?? ''
  unit.value = current?.unit ?? 'unité'
  supplierId.value = current?.supplierId ?? props.suppliers[0]?.id ?? ''
  price.value = String(current?.price ?? 20)
  minStock.value = String(current?.minStock ?? 50)
  maxStock.value = String(current?.maxStock ?? 200)
  dailyDemand.value = String(current?.dailyDemand ?? 5)
  images.value = current?.images?.length ? [...current.images] : current?.imageUrl ? [current.imageUrl] : []
  fileError.value = ''
  skuTouched.value = Boolean(current?.sku)
}

watch(
  () => [props.open, props.product?.id] as const,
  ([open]) => {
    if (open) reset()
  },
)

watch(name, (value) => {
  if (!skuTouched.value) sku.value = suggestSku(value)
})

function onFiles(event: Event) {
  const input = event.target as HTMLInputElement
  const files = [...(input.files ?? [])]
  input.value = ''
  fileError.value = ''
  const allowed = ['image/png', 'image/jpeg', 'image/webp']
  for (const file of files) {
    if (images.value.length >= MAX_IMAGES) {
      fileError.value = `4 images maximum.`
      break
    }
    if (file.type && !allowed.includes(file.type)) {
      fileError.value = 'PNG, JPEG ou WebP uniquement.'
      continue
    }
    if (file.size > MAX_FILE_SIZE) {
      fileError.value = 'Chaque image doit faire moins de 2 Mo.'
      continue
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result ?? '')
      if (dataUrl) images.value = [...images.value, dataUrl].slice(0, MAX_IMAGES)
    }
    reader.readAsDataURL(file)
  }
}

function removeImage(index: number) {
  images.value = images.value.filter((_, i) => i !== index)
}

function submit() {
  if (!canSubmit.value) return
  emit('submit', {
    id: props.product?.id,
    input: {
      name: name.value.trim(),
      sku: sku.value.trim().toUpperCase(),
      categoryId: categoryId.value,
      unit: unit.value,
      minStock: Number(minStock.value) || 0,
      maxStock: Number(maxStock.value) || undefined,
      price: Number(price.value) || 0,
      supplierId: supplierId.value,
      dailyDemand: Number(dailyDemand.value) || 0,
      description: description.value.trim() || undefined,
      barcode: barcode.value.trim() || undefined,
      images: [...images.value],
      imageUrl: images.value[0] ?? '',
    },
  })
}
</script>

<template>
  <Sheet :open="open" :title="editing ? 'Modifier le produit' : 'Nouveau produit'" wide @close="emit('close')">
    <div class="space-y-5">
      <section class="space-y-3">
        <h3 class="text-sm font-semibold">Photos</h3>
        <p class="text-xs text-muted-foreground">Jusqu’à 4 images. La première sert de visuel principal.</p>
        <div class="grid grid-cols-4 gap-2">
          <div v-for="(src, index) in images" :key="src.slice(0, 24) + index" class="relative aspect-square overflow-hidden rounded-xl border bg-muted">
            <img :src="src" alt="" class="size-full object-cover" />
            <span
              v-if="index === 0"
              class="absolute left-1.5 top-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground"
            >
              Principale
            </span>
            <button
              type="button"
              class="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-md bg-destructive text-destructive-foreground"
              aria-label="Retirer"
              @click="removeImage(index)"
            >
              <X class="size-3.5" />
            </button>
          </div>
          <label
            v-if="images.length < MAX_IMAGES"
            class="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-muted-foreground hover:bg-muted/50"
          >
            <ImagePlus class="size-5" />
            <span class="text-[11px] font-medium">Ajouter</span>
            <input
              type="file"
              class="hidden"
              accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
              multiple
              @change="onFiles"
            />
          </label>
        </div>
        <p v-if="fileError" class="text-xs text-red-600">{{ fileError }}</p>
      </section>

      <section class="space-y-3">
        <h3 class="text-sm font-semibold">Identité</h3>
        <div>
          <Label>Nom</Label>
          <Input v-model="name" class="mt-1.5" placeholder="Huile végétale 5L" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <Label>SKU</Label>
            <Input v-model="sku" class="mt-1.5" placeholder="HUI-5L" @input="skuTouched = true" />
          </div>
          <div>
            <Label>Code-barres</Label>
            <Input v-model="barcode" class="mt-1.5" placeholder="6111254789012" />
          </div>
        </div>
        <div>
          <Label>Description</Label>
          <Textarea v-model="description" class="mt-1.5" placeholder="Conditionnement, usage, particularités…" />
        </div>
      </section>

      <section class="space-y-3">
        <h3 class="text-sm font-semibold">Classification</h3>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <Label>Catégorie</Label>
            <select v-model="categoryId" class="mt-1.5 h-10 w-full rounded-lg border bg-card px-3 text-sm">
              <option v-for="category in categories" :key="category.id" :value="category.id">{{ category.name }}</option>
            </select>
          </div>
          <div>
            <Label>Unité</Label>
            <select v-model="unit" class="mt-1.5 h-10 w-full rounded-lg border bg-card px-3 text-sm">
              <option v-for="item in UNITS" :key="item" :value="item">{{ item }}</option>
            </select>
          </div>
        </div>
        <div>
          <Label>Fournisseur</Label>
          <select v-model="supplierId" class="mt-1.5 h-10 w-full rounded-lg border bg-card px-3 text-sm">
            <option v-for="supplier in suppliers" :key="supplier.id" :value="supplier.id">{{ supplier.name }}</option>
          </select>
        </div>
      </section>

      <section class="space-y-3">
        <h3 class="text-sm font-semibold">Prix et stock</h3>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <Label>Prix unitaire (MAD)</Label>
            <Input v-model="price" type="number" min="0" step="0.01" class="mt-1.5" />
          </div>
          <div>
            <Label>Demande / jour</Label>
            <Input v-model="dailyDemand" type="number" min="0" class="mt-1.5" />
          </div>
          <div>
            <Label>Seuil minimum</Label>
            <Input v-model="minStock" type="number" min="0" class="mt-1.5" />
          </div>
          <div>
            <Label>Stock maximum</Label>
            <Input v-model="maxStock" type="number" min="0" class="mt-1.5" />
          </div>
        </div>
      </section>
    </div>
    <template #footer>
      <Button class="w-full" :disabled="!canSubmit" @click="submit">
        {{ editing ? 'Enregistrer' : 'Créer' }}
      </Button>
    </template>
  </Sheet>
</template>
