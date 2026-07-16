import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { ICONS } from './icons-data.mjs'

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)))
const publicDir = join(rootDir, 'public')

mkdirSync(publicDir, { recursive: true })

for (const [filename, base64] of Object.entries(ICONS)) {
  writeFileSync(join(publicDir, filename), Buffer.from(base64, 'base64'))
}

console.log(`PWA 아이콘 ${Object.keys(ICONS).length}개 생성 완료 (public/)`)
