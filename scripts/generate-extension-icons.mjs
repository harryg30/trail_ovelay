import fs from 'fs/promises'
import path from 'path'
import sharp from 'sharp'

const root = process.cwd()
const source = path.join(root, 'browser-extension', 'icons', 'icon-source.svg')
const outDir = path.join(root, 'browser-extension', 'icons')
const sizes = [16, 32, 48, 128]

async function main() {
  await fs.mkdir(outDir, { recursive: true })
  const svg = await fs.readFile(source)

  for (const size of sizes) {
    const out = path.join(outDir, `icon-${size}.png`)
    await sharp(svg)
      .resize(size, size)
      .png({ quality: 100, compressionLevel: 9 })
      .toFile(out)
    console.log(`Wrote ${path.relative(root, out)}`)
  }
}

main().catch(err => {
  console.error('[generate-extension-icons]', err.message)
  process.exit(1)
})
