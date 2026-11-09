import type { RoleKey } from '@/types'

export const ALERT_ROLES = {
  stockWatch: ['WAREHOUSE_MANAGER', 'PROCUREMENT', 'MANAGER', 'DISPATCHER'] as RoleKey[],
  purchase: ['PROCUREMENT', 'WAREHOUSE_MANAGER', 'MANAGER'] as RoleKey[],
  daSubmitted: ['MANAGER'] as RoleKey[],
  daToBuyer: ['PROCUREMENT'] as RoleKey[],
  daToStore: ['WAREHOUSE_MANAGER'] as RoleKey[],
  receipt: ['WAREHOUSE_MANAGER'] as RoleKey[],
  receiptDone: ['WAREHOUSE_MANAGER', 'PROCUREMENT'] as RoleKey[],
  logistics: ['DISPATCHER', 'WAREHOUSE_MANAGER', 'MANAGER'] as RoleKey[],
  shippingNote: ['DISPATCHER'] as RoleKey[],
  finance: ['FINANCE', 'MANAGER'] as RoleKey[],
}
