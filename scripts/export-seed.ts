import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createSeed } from '../src/mocks/index.ts'

const root = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(root, '../../bravo-api/database/data')
mkdirSync(outDir, { recursive: true })
const seed = createSeed()
writeFileSync(resolve(outDir, 'mock.json'), JSON.stringify(seed, null, 2))
console.log(`Wrote mock.json (${Object.keys(seed).length} collections)`)
