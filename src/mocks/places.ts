export interface PlaceSuggestion {
  id: string
  label: string
  secondary: string
  address: string
  city: string
  regionId: string
  lat: number
  lng: number
}

export const places: PlaceSuggestion[] = [
  {
    id: 'pl-casa-ain-sebaa',
    label: 'Zone industrielle Aïn Sebaâ',
    secondary: 'Casablanca 20250, Maroc',
    address: 'Zone industrielle Aïn Sebaâ',
    city: 'Casablanca',
    regionId: 'reg-nord',
    lat: 33.6095,
    lng: -7.5328,
  },
  {
    id: 'pl-casa-sidi-bernoussi',
    label: 'Zone industrielle Sidi Bernoussi',
    secondary: 'Casablanca 20600, Maroc',
    address: 'Zone industrielle Sidi Bernoussi',
    city: 'Casablanca',
    regionId: 'reg-nord',
    lat: 33.6152,
    lng: -7.5071,
  },
  {
    id: 'pl-casa-tit-mellil',
    label: 'Parc logistique Tit Mellil',
    secondary: 'Tit Mellil 20240, Maroc',
    address: 'Parc logistique Tit Mellil',
    city: 'Casablanca',
    regionId: 'reg-nord',
    lat: 33.5531,
    lng: -7.4856,
  },
  {
    id: 'pl-mohammedia',
    label: 'Zone portuaire Mohammedia',
    secondary: 'Mohammedia 28810, Maroc',
    address: 'Zone portuaire',
    city: 'Mohammedia',
    regionId: 'reg-nord',
    lat: 33.6866,
    lng: -7.383,
  },
  {
    id: 'pl-sale',
    label: 'Parc logistique Salé',
    secondary: 'Salé 11000, Maroc',
    address: 'Parc logistique Salé',
    city: 'Rabat',
    regionId: 'reg-nord',
    lat: 34.0384,
    lng: -6.7969,
  },
  {
    id: 'pl-rabat-tamesna',
    label: 'Zone industrielle Tamesna',
    secondary: 'Rabat 12200, Maroc',
    address: 'Zone industrielle Tamesna',
    city: 'Rabat',
    regionId: 'reg-nord',
    lat: 33.9214,
    lng: -6.9068,
  },
  {
    id: 'pl-kenitra',
    label: 'Atlantic Free Zone Kénitra',
    secondary: 'Kénitra 14000, Maroc',
    address: 'Atlantic Free Zone',
    city: 'Kénitra',
    regionId: 'reg-nord',
    lat: 34.2541,
    lng: -6.589,
  },
  {
    id: 'pl-tanger-tfz',
    label: 'Tanger Free Zone',
    secondary: 'Tanger 90000, Maroc',
    address: 'Zone franche',
    city: 'Tanger',
    regionId: 'reg-nord',
    lat: 35.7479,
    lng: -5.8339,
  },
  {
    id: 'pl-tanger-med',
    label: 'Tanger Med Logistics',
    secondary: 'Ksar Sghir 90050, Maroc',
    address: 'Complexe logistique Tanger Med',
    city: 'Tanger',
    regionId: 'reg-nord',
    lat: 35.89,
    lng: -5.5,
  },
  {
    id: 'pl-marrakech-sidi-ghanem',
    label: 'Sidi Ghanem',
    secondary: 'Marrakech 40000, Maroc',
    address: 'Sidi Ghanem',
    city: 'Marrakech',
    regionId: 'reg-centre',
    lat: 31.6469,
    lng: -8.0106,
  },
  {
    id: 'pl-marrakech-tassila',
    label: 'Zone industrielle Tassila',
    secondary: 'Marrakech 40160, Maroc',
    address: 'Zone industrielle Tassila',
    city: 'Marrakech',
    regionId: 'reg-centre',
    lat: 31.67,
    lng: -8.03,
  },
  {
    id: 'pl-fes',
    label: 'Zone industrielle Ras El Ma',
    secondary: 'Fès 30000, Maroc',
    address: 'Zone industrielle Ras El Ma',
    city: 'Fès',
    regionId: 'reg-centre',
    lat: 34.0181,
    lng: -4.9998,
  },
  {
    id: 'pl-agadir',
    label: 'Zone industrielle Tassila Agadir',
    secondary: 'Agadir 80000, Maroc',
    address: 'Zone industrielle Tassila',
    city: 'Agadir',
    regionId: 'reg-centre',
    lat: 30.4278,
    lng: -9.5981,
  },
  {
    id: 'pl-settat',
    label: 'Parc industriel Settat',
    secondary: 'Settat 26000, Maroc',
    address: 'Parc industriel',
    city: 'Settat',
    regionId: 'reg-centre',
    lat: 33.001,
    lng: -7.6166,
  },
]

export function searchPlaces(query: string, limit = 6): PlaceSuggestion[] {
  const q = query
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
  if (q.length < 2) return []
  return places
    .filter((place) => {
      const hay = `${place.label} ${place.secondary} ${place.city}`
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
      return hay.includes(q)
    })
    .slice(0, limit)
}
