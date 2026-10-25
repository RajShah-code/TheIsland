// Draws the Microsoft Store (MSIX) tile images into build/appx: the white pill on dark, like the app
// icon. electron-builder copies everything in build/appx into the package's assets; Windows picks the
// scale-200 / targetsize files on high-DPI screens. Run: node scripts/make-appx-assets.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import zlib from 'node:zlib'

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'build', 'appx')
const BG = [17, 17, 17]
const PILL = [245, 245, 245]

// Inside a rounded rectangle centred at (cx, cy) with half sizes hw, hh and corner radius r.
const inRect = (x, y, cx, cy, hw, hh, r) => {
  const dx = Math.max(Math.abs(x - cx) - (hw - r), 0)
  const dy = Math.max(Math.abs(y - cy) - (hh - r), 0)
  return Math.hypot(dx, dy) <= r
}

// `tile`: a full rectangle (Start tiles); otherwise a rounded square on transparent (icons).
function draw(w, h, { tile }) {
  const px = Buffer.alloc(w * h * 4)
  const s = Math.min(w, h)
  const bg = tile ? { hw: w / 2, hh: h / 2, r: 0 } : { hw: s * 0.47, hh: s * 0.47, r: s * 0.22 }
  const pill = { hw: s * 0.31, hh: s * 0.117, r: s * 0.117 }
  const N = 4
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let cover = 0
      let white = 0
      for (let sy = 0; sy < N; sy++) {
        for (let sx = 0; sx < N; sx++) {
          const X = x + (sx + 0.5) / N
          const Y = y + (sy + 0.5) / N
          if (!inRect(X, Y, w / 2, h / 2, bg.hw, bg.hh, bg.r)) continue
          cover++
          if (inRect(X, Y, w / 2, h / 2, pill.hw, pill.hh, pill.r)) white++
        }
      }
      const i = (y * w + x) * 4
      const t = cover ? white / cover : 0
      for (let c = 0; c < 3; c++) px[i + c] = Math.round(BG[c] + (PILL[c] - BG[c]) * t)
      px[i + 3] = Math.round((255 * cover) / (N * N))
    }
  }
  return png(w, h, px)
}

function png(w, h, rgba) {
  const raw = Buffer.alloc(h * (w * 4 + 1))
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4)
  const table = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (b) => {
    let r = 0xffffffff
    for (const x of b) r = table[(r ^ x) & 255] ^ (r >>> 8)
    return (r ^ 0xffffffff) >>> 0
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type), data])
    const sum = Buffer.alloc(4)
    sum.writeUInt32BE(crc(body))
    return Buffer.concat([len, body, sum])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// [file, width, height, tile]
const files = [
  ['StoreLogo.png', 50, 50, false],
  ['StoreLogo.scale-200.png', 100, 100, false],
  ['Square44x44Logo.png', 44, 44, false],
  ['Square44x44Logo.scale-200.png', 88, 88, false],
  ['Square44x44Logo.targetsize-48.png', 48, 48, false],
  ['Square44x44Logo.targetsize-256.png', 256, 256, false],
  ['Square44x44Logo.altform-unplated_targetsize-48.png', 48, 48, false],
  ['Square44x44Logo.altform-unplated_targetsize-256.png', 256, 256, false],
  ['Square150x150Logo.png', 150, 150, true],
  ['Square150x150Logo.scale-200.png', 300, 300, true],
  ['Wide310x150Logo.png', 310, 150, true],
  ['Wide310x150Logo.scale-200.png', 620, 300, true],
]

mkdirSync(out, { recursive: true })
for (const [name, w, h, tile] of files) writeFileSync(join(out, name), draw(w, h, { tile }))
console.log(`wrote ${files.length} images to ${out}`)
