import { computed } from 'vue'
import { productService } from '@/services/product.service'
import { useAsyncList } from './useAsyncList'
import type { ProductInput } from '@/repositories/interfaces'

export function useProducts() {
  const { data: products, loading, error, refresh } = useAsyncList(() => productService.list())

  async function createProduct(input: ProductInput) {
    await productService.create(input)
    await refresh(true)
  }

  async function updateProduct(id: string, input: Partial<ProductInput>) {
    await productService.update(id, input)
    await refresh(true)
  }

  async function archiveProduct(id: string) {
    await productService.archive(id)
    await refresh(true)
  }

  const active = computed(() => products.value.filter((item) => !item.archived))

  return {
    products: active,
    loading,
    error,
    createProduct,
    updateProduct,
    archiveProduct,
    refresh,
  }
}
