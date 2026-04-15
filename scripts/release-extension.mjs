import fs from 'fs/promises'
import path from 'path'
import { createHash } from 'crypto'
import JSZip from 'jszip'

const EXTENSION_DIR = path.resolve(process.cwd(), 'browser-extension')
const RELEASES_DIR = path.resolve(process.cwd(), 'extension-releases')
const RELEASES_INDEX = path.join(RELEASES_DIR, 'releases.json')
const LATEST_ZIP = path.join(RELEASES_DIR, 'latest.zip')

function sanitizeName(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function collectFiles(rootResolved) {
  const out = []

  async function walk(relDir) {
    const absDir = path.join(rootResolved, relDir)
    const entries = (await fs.readdir(absDir, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name)
    )

    for (const ent of entries) {
      if (ent.name.startsWith('.')) continue
      const relEntry = relDir ? `${relDir}/${ent.name}` : ent.name
      const absEntry = path.join(rootResolved, relEntry)

      if (ent.isDirectory()) {
        await walk(relEntry)
      } else if (ent.isFile()) {
        const data = await fs.readFile(absEntry)
        out.push({ rel: relEntry.replace(/\\/g, '/'), data })
      }
    }
  }

  await walk('')
  out.sort((a, b) => a.rel.localeCompare(b.rel))
  return out
}

async function readReleaseIndex() {
  try {
    const raw = await fs.readFile(RELEASES_INDEX, 'utf8')
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed?.releases)) return parsed
    return { latest: null, releases: [] }
  } catch {
    return { latest: null, releases: [] }
  }
}

function upsertRelease(index, entry) {
  const releases = index.releases.filter(r => r.version !== entry.version)
  releases.push(entry)
  releases.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))

  return {
    latest: entry,
    releases,
  }
}

async function main() {
  const manifestPath = path.join(EXTENSION_DIR, 'manifest.json')
  const manifestRaw = await fs.readFile(manifestPath, 'utf8')
  const manifest = JSON.parse(manifestRaw)

  const version = String(manifest.version || '').trim()
  if (!version) {
    throw new Error('manifest.json is missing a version field')
  }

  const extensionName = sanitizeName(manifest.name || 'trail-overlay-strava-extension')
  const zipFileName = `${extensionName}-v${version}.zip`
  const versionDir = path.join(RELEASES_DIR, `v${version}`)
  const zipPath = path.join(versionDir, zipFileName)

  const extensionStat = await fs.stat(EXTENSION_DIR).catch(() => null)
  if (!extensionStat?.isDirectory()) {
    throw new Error(`Missing browser extension directory: ${EXTENSION_DIR}`)
  }

  await fs.mkdir(versionDir, { recursive: true })

  const files = await collectFiles(EXTENSION_DIR)
  if (files.length === 0) {
    throw new Error('No files found under browser-extension/')
  }

  const zip = new JSZip()
  for (const { rel, data } of files) {
    zip.file(rel, data)
  }

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  })

  await fs.writeFile(zipPath, buffer)
  await fs.copyFile(zipPath, LATEST_ZIP)

  const sha256 = createHash('sha256').update(buffer).digest('hex')
  const stats = await fs.stat(zipPath)

  const entry = {
    version,
    file: path.relative(RELEASES_DIR, zipPath).replace(/\\/g, '/'),
    sizeBytes: stats.size,
    sha256,
    createdAt: new Date().toISOString(),
  }

  const nextIndex = upsertRelease(await readReleaseIndex(), entry)
  await fs.writeFile(RELEASES_INDEX, `${JSON.stringify(nextIndex, null, 2)}\n`, 'utf8')

  console.log(`Created ${path.relative(process.cwd(), zipPath)}`)
  console.log(`Updated ${path.relative(process.cwd(), LATEST_ZIP)}`)
  console.log(`Updated ${path.relative(process.cwd(), RELEASES_INDEX)}`)
}

main().catch(err => {
  console.error('[release-extension]', err.message)
  process.exit(1)
})
