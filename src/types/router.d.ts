import type { RoleKey, PermissionKey } from '@/types'

export {}

declare module 'vue-router' {
  interface RouteMeta {
    auth?: boolean
    roles?: RoleKey[]
    permission?: PermissionKey
    title?: string
  }
}
