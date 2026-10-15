import { FRAME, SPRITES } from './sprites'

/**
 * One animation as an SVG: the strip of frames behind a 124x93 window, its x
 * stepped by a discrete SMIL animation that plays once and drops back to the
 * first frame, his rest pose. `id` goes in a comment so a new line restarts
 * the animation even when it is the same one. Drawn as a plain image: the
 * desktop's interactive frame blocks the embedded PNG.
 */
export function spriteSvg(anim: string, id: number): string {
  const s = SPRITES[anim] ?? SPRITES.RestPose
  const { width: w, height: h } = FRAME
  const total = s.ms.reduce((a, b) => a + b, 0)
  let animate = ''
  if (s.frames > 1) {
    let t = 0
    const keyTimes: string[] = []
    const values: number[] = []
    s.ms.forEach((ms, i) => {
      keyTimes.push((t / total).toFixed(4))
      values.push(-i * w)
      t += ms
    })
    animate = `<animate attributeName="x" calcMode="discrete" dur="${total}ms" values="${values.join(';')}" keyTimes="${keyTimes.join(';')}" fill="remove"/>`
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">` +
    `<!-- ${anim} ${id} -->` +
    `<image x="0" y="0" width="${w * s.frames}" height="${h}" href="data:image/png;base64,${s.png}">${animate}</image>` +
    `</svg>`
  )
}

export const TOMBSTONE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 124 93" width="124" height="93">' +
  '<rect x="30" y="86" width="64" height="5" rx="2" fill="#5b4a32"/>' +
  '<path d="M40 88 V38 a22 22 0 0 1 44 0 V88 Z" fill="#9aa0a6" stroke="#5f6368" stroke-width="2"/>' +
  '<text x="62" y="52" text-anchor="middle" font-family="serif" font-size="14" font-weight="bold" fill="#3c4043">RIP</text>' +
  '<text x="62" y="70" text-anchor="middle" font-family="serif" font-size="9" fill="#3c4043">Clippy</text>' +
  '</svg>'
