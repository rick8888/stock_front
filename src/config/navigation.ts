import type { PermissionKey, PlanModule, RoleKey } from '@/types'
import {
  Sparkles,
  Sun,
  CheckSquare,
  Calendar,
  Bell,
  Package,
  ShoppingCart,
  Truck,
  TrendingUp,
  FileText,
  Settings,
  Wallet,
  Users,
  Warehouse,
  Tags,
  Building2,
  Receipt,
  CreditCard,
  Shield,
  ScrollText,
  LayoutDashboard,
  type LucideIcon,
} from 'lucide-vue-next'

export interface NavItem {
  to: string
  query?: Record<string, string>
  label: string
  icon: LucideIcon
  permission?: PermissionKey
  module?: PlanModule
  badge?: 'tasks' | 'alerts'
}

export interface NavSection {
  id: string
  label?: string
  items: NavItem[]
}

const opsNav: NavSection[] = [
  {
    id: 'main',
    items: [
      { to: '/today', label: 'Aujourd’hui', icon: Sun },
      { to: '/tasks', label: 'Mes tâches', icon: CheckSquare, permission: 'task.view', badge: 'tasks' },
      { to: '/alerts', label: 'Alertes', icon: Bell, permission: 'task.view', badge: 'alerts' },
      { to: '/planning', label: 'Planning', icon: Calendar, permission: 'task.view' },
    ],
  },
  {
    id: 'operations',
    label: 'Opérations',
    items: [
      { to: '/stock', label: 'Magasin', icon: Package, permission: 'stock.view', module: 'stock' },
      { to: '/procurement', label: 'Achats', icon: ShoppingCart, permission: 'procurement.view', module: 'procurement' },
      { to: '/logistics', label: 'Logistique', icon: Truck, permission: 'delivery.view', module: 'logistics' },
    ],
  },
  {
    id: 'analyse',
    label: 'Analyse',
    items: [
      { to: '/analytics', label: 'Tableaux de bord', icon: TrendingUp, permission: 'analytics.view', module: 'analytics' },
      { to: '/analytics/forecasts', label: 'Réapprovisionnement', icon: TrendingUp, permission: 'analytics.view', module: 'analytics' },
      { to: '/analytics/reports', label: 'Rapports', icon: FileText, permission: 'analytics.view', module: 'analytics' },
      { to: '/assistant', label: 'Assistant', icon: Sparkles, module: 'assistant' },
    ],
  },
]

const superAdminNav: NavSection[] = [
  {
    id: 'platform',
    label: 'BravoStock',
    items: [
      { to: '/platform', label: 'Vue d’ensemble', icon: LayoutDashboard, permission: 'platform.view' },
      { to: '/platform', query: { tab: 'companies' }, label: 'Entreprises', icon: Building2, permission: 'platform.companies' },
      { to: '/platform', query: { tab: 'plans' }, label: 'Plans', icon: Tags, permission: 'platform.plans' },
      { to: '/platform', query: { tab: 'subscriptions' }, label: 'Abonnements', icon: CreditCard, permission: 'platform.billing' },
      { to: '/platform', query: { tab: 'billing' }, label: 'Facturation', icon: Receipt, permission: 'platform.billing' },
    ],
  },
]

const adminNav: NavSection[] = [
  {
    id: 'ops',
    items: [{ to: '/admin', label: 'Aujourd’hui', icon: Sun, permission: 'user.view' }],
  },
  {
    id: 'admin',
    label: 'Référentiel',
    items: [
      { to: '/admin', query: { tab: 'users' }, label: 'Utilisateurs', icon: Users, permission: 'user.view' },
      { to: '/admin', query: { tab: 'overview' }, label: 'Entrepôts', icon: Warehouse, permission: 'warehouse.view' },
      { to: '/admin', query: { tab: 'locations' }, label: 'Emplacements', icon: Warehouse, permission: 'warehouse.view' },
      { to: '/admin', query: { tab: 'products' }, label: 'Produits', icon: Package, permission: 'product.view' },
      { to: '/admin', query: { tab: 'suppliers' }, label: 'Fournisseurs', icon: Building2, permission: 'product.view' },
      { to: '/admin', query: { tab: 'customers' }, label: 'Clients', icon: Users, permission: 'delivery.view' },
      { to: '/admin', query: { tab: 'categories' }, label: 'Catégories', icon: Tags, permission: 'product.view' },
    ],
  },
  {
    id: 'system',
    label: 'Système',
    items: [
      { to: '/admin', query: { tab: 'roles' }, label: 'Rôles', icon: Shield, permission: 'user.view' },
      { to: '/admin', query: { tab: 'audit' }, label: 'Audit', icon: ScrollText, permission: 'user.view' },
      { to: '/admin', query: { tab: 'settings' }, label: 'Paramètres', icon: Settings, permission: 'user.view' },
    ],
  },
]

const financeNav: NavSection[] = [
  {
    id: 'finance',
    items: [
      { to: '/today', label: 'Aujourd’hui', icon: Sun },
      { to: '/finance', label: 'Finance', icon: Wallet, permission: 'finance.view', module: 'finance' },
      { to: '/procurement', query: { tab: 'orders' }, label: 'Achats', icon: ShoppingCart, permission: 'purchase.view', module: 'purchasing' },
      { to: '/analytics', label: 'Tableaux de bord', icon: TrendingUp, permission: 'analytics.view', module: 'analytics' },
    ],
  },
]

const tenantNav: NavSection[] = [
  {
    id: 'account',
    label: 'Mon entreprise',
    items: [
      { to: '/account', label: 'Vue d’ensemble', icon: LayoutDashboard, permission: 'account.view' },
      { to: '/account', query: { tab: 'company' }, label: 'Entreprise', icon: Building2, permission: 'account.company' },
      { to: '/account', query: { tab: 'admins' }, label: 'Administrateurs', icon: Users, permission: 'account.admins' },
      { to: '/account', query: { tab: 'subscription' }, label: 'Abonnement', icon: CreditCard, permission: 'account.billing' },
      { to: '/account', query: { tab: 'billing' }, label: 'Factures', icon: Receipt, permission: 'account.billing' },
    ],
  },
]

export const navSections = opsNav

export function navSectionsFor(role?: RoleKey): NavSection[] {
  if (role === 'SUPER_ADMIN') return superAdminNav
  if (role === 'TENANT_OWNER') return tenantNav
  if (role === 'ADMIN') return adminNav
  if (role === 'FINANCE') return financeNav
  return opsNav
}
