import type { GeoPoint } from '@/types'

export const WAREHOUSE_GEO: Record<string, GeoPoint> = {
  'wh-casa': { lat: 33.6095, lng: -7.5328, label: 'Entrepôt Casablanca' },
  'wh-rabat': { lat: 34.0384, lng: -6.7969, label: 'Entrepôt Rabat' },
  'wh-marrakech': { lat: 31.6469, lng: -8.0106, label: 'Entrepôt Marrakech' },
  'wh-tanger': { lat: 35.7479, lng: -5.8339, label: 'Entrepôt Tanger' },
}

export const CASA_STOPS: Record<string, GeoPoint> = {
  'dlv-481': { lat: 33.5574, lng: -7.6648, label: 'Marché Hay Hassani' },
  'dlv-482': { lat: 33.5826, lng: -7.6324, label: 'Supermarché Atlas' },
  'dlv-483': { lat: 33.5889, lng: -7.6624, label: 'Épicerie Anfa' },
  'dlv-484': { lat: 33.5956, lng: -7.6775, label: 'Carrefour Ain Diab' },
  'dlv-485': { lat: 33.5728, lng: -7.6042, label: 'Market Derb Sultan' },
  'dlv-486': { lat: 33.5542, lng: -7.6368, label: 'Mini Market Oasis' },
  'dlv-487': { lat: 33.5814, lng: -7.6288, label: 'Épicerie Maarif' },
  'dlv-488': { lat: 33.5386, lng: -7.6442, label: 'Atacadao Sidi Maârouf' },
  'dlv-489': { lat: 33.5902, lng: -7.658, label: 'Boulangerie Anfa' },
  'dlv-491': { lat: 33.5798, lng: -7.6438, label: 'Pharmacie Ghandi' },
  'dlv-492': { lat: 33.5948, lng: -7.6315, label: 'Casino Bourgogne' },
  'dlv-493': { lat: 33.595, lng: -7.6178, label: 'Marché Central' },
  'dlv-494': { lat: 33.5885, lng: -7.6388, label: 'Super Croc Racine' },
  'dlv-495': { lat: 33.5685, lng: -7.6215, label: 'Hanout Palmier' },
  'dlv-496': { lat: 33.5712, lng: -7.6498, label: 'Market Beauséjour' },
  'dlv-497': { lat: 33.5678, lng: -7.6095, label: 'Épicerie 2 Mars' },
  'dlv-498': { lat: 33.5348, lng: -7.5972, label: 'Relais Aïn Chock' },
}

export const RABAT_STOPS: Record<string, GeoPoint> = {
  'dlv-490': { lat: 33.9985, lng: -6.8512, label: 'Market Agdal' },
}

export const HIGHWAY_WAYPOINTS: GeoPoint[] = [
  { lat: 33.6095, lng: -7.5328, label: 'Casablanca' },
  { lat: 33.246, lng: -7.608, label: 'Berrechid' },
  { lat: 33.0546, lng: -7.408, label: 'Settat' },
  { lat: 32.337, lng: -7.615, label: 'Kelaa' },
  { lat: 31.6469, lng: -8.0106, label: 'Marrakech' },
]
