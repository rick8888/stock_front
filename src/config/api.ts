export const apiConfig = {
  baseUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:8001/api',
  useApi: import.meta.env.VITE_USE_API === 'true',
} as const
