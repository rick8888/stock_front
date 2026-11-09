import type { Product } from '@/types'
import type { ProductInput } from '@/repositories/interfaces'
import { productRepository } from '@/repositories'

export const productService = {
  list: () => productRepository.list(),
  getById: (id: string) => productRepository.getById(id),
  create: (input: ProductInput) => productRepository.create(input),
  update: (id: string, input: Partial<ProductInput>) => productRepository.update(id, input),
  archive: (id: string) => productRepository.archive(id),
  async findByName(name: string): Promise<Product | undefined> {
    const products = await productRepository.list()
    const q = name.toLowerCase()
    return products.find((item) => item.name.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q))
  },
}
