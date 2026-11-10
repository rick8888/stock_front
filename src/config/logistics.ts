import type { DeliveryStatus, RouteStatus, ShipmentStatus, VehicleStatus } from '@/types'

export const DELIVERY_LABEL: Record<DeliveryStatus, string> = {
  prepared: 'Préparée',
  in_transit: 'En tournée',
  delivered: 'Livrée',
  failed: 'Échec',
  at_risk: 'À risque',
}

export const SHIPMENT_LABEL: Record<ShipmentStatus, string> = {
  preparing: 'Préparation',
  in_transit: 'En transit',
  done: 'Terminée',
  delayed: 'Retard',
}

export const ROUTE_LABEL: Record<RouteStatus, string> = {
  planned: 'Planifiée',
  in_progress: 'En cours',
  done: 'Terminée',
}

export const VEHICLE_LABEL: Record<VehicleStatus, string> = {
  available: 'Disponible',
  on_mission: 'En mission',
  maintenance: 'Maintenance',
}

export const DRIVER_LABEL = {
  available: 'Disponible',
  on_route: 'En tournée',
  off: 'Repos',
} as const

export const SHIPPING_NOTE_LABEL = {
  ready: 'Disponible',
  picking: 'En préparation',
  loaded: 'Chargé',
  assigned: 'Affecté',
  delivered: 'Livré',
} as const
