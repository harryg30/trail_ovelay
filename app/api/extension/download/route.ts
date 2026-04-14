import fs from 'fs/promises'
import path from 'path'
import { NextResponse } from 'next/server'
import JSZip from 'jszip'

export const runtime = 'nodejs'

const ZIP_FILENAME = 'trail-overlay-strava-extension.zip'

/** True when `abs` is `root` or a path inside `root` (no traversal). */
function isUnderRoot(root: string, abs: string): boolean {
  const rel = path.relative(root, abs)
  if (rel === '') return true
  return !rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel)
}

async function collectExtensionFiles(rootResolved: string): Promise<{ rel: string; data: Buffer }[]> {
  const out: { rel: string; data: Buffer }[] = []

  async function walk(relDir: string): Promise<void> {
    const absDir = path.join(rootResolved, relDir)
    const resolvedDir = path.resolve(absDir)
    if (!isUnderRoot(rootResolved, resolvedDir)) return

    const entries = await fs.readdir(resolvedDir, { withFileTypes: true })
    for (const ent of entries) {
      if (ent.name.startsWith('.')) continue
      const relEntry = relDir ? `${relDir}/${ent.name}` : ent.name
      const absEntry = path.join(rootResolved, relEntry)
      const resolvedEntry = path.resolve(absEntry)
      if (!isUnderRoot(rootResolved, resolvedEntry)) continue

      if (ent.isDirectory()) {
        await walk(relEntry)
      } else if (ent.isFile()) {
        const data = await fs.readFile(resolvedEntry)
        out.push({ rel: relEntry.replace(/\\/g, '/'), data })
      }
    }
  }

  await walk('')
  return out
}

export async function GET() {
  const rootDir = path.join(process.cwd(), 'browser-extension')

  try {
    const rootResolved = path.resolve(rootDir)
    const stat = await fs.stat(rootResolved).catch(() => null)
    if (!stat?.isDirectory()) {
      console.error('[extension/download] missing directory:', rootResolved)
      return NextResponse.json({ error: 'Extension bundle unavailable' }, { status: 500 })
    }

    const files = await collectExtensionFiles(rootResolved)
    if (files.length === 0) {
      console.error('[extension/download] no files under', rootResolved)
      return NextResponse.json({ error: 'Extension bundle unavailable' }, { status: 500 })
    }

    const zip = new JSZip()
    for (const { rel, data } of files) {
      zip.file(rel, data)
    }

    const buf = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    })

    const body = new Blob([new Uint8Array(buf)])
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${ZIP_FILENAME}"`,
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (e) {
    console.error('[extension/download]', e)
    return NextResponse.json({ error: 'Failed to build extension zip' }, { status: 500 })
  }
}
