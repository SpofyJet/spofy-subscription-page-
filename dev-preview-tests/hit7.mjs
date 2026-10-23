import { chromium, devices } from 'playwright'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const SCEN = ['active', 'trial', 'expiring', 'expired', 'limited', 'bypass', 'lowtraffic', 'devicesfull', 'nodevices', 'unlimited', 'ultima', 'nocheckout']
const problems = []; let checked = 0, states = 0
async function audit(page, label) {
  states++
  const res = await page.evaluate(async () => {
    const out = []; let n = 0
    const W = innerWidth
    const root = document.querySelector('[role=dialog]') ?? document
    const els = [...root.querySelectorAll('button, a[href], [role=radio], [role=button], textarea, input')].filter((e) => {
      const r = e.getBoundingClientRect(); const cs = getComputedStyle(e)
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !e.closest('[aria-hidden=true]') && !e.disabled
    })
    for (const e of els) {
      e.scrollIntoView({ block: 'center', inline: 'nearest' })
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      const r = e.getBoundingClientRect()
      const x = r.left + r.width / 2, y = r.top + r.height / 2
      const hit = document.elementFromPoint(x, y)
      const name = (e.getAttribute('aria-label') || e.innerText || e.value || e.tagName).replace(/\s+/g, ' ').slice(0, 40)
      n++
      if (!hit || !(hit === e || e.contains(hit))) out.push(`covered: «${name}» by ${hit?.className?.toString().slice(0, 40) || hit?.tagName}`)
      if (r.height < 43.5 && !['TEXTAREA', 'INPUT'].includes(e.tagName)) out.push(`small ${Math.round(r.width)}×${Math.round(r.height)}: «${name}»`)
      if (r.right > W + 1 || r.left < -1) out.push(`off-screen x ${Math.round(r.left)}–${Math.round(r.right)}: «${name}»`)
    }
    const wide = document.documentElement.scrollWidth > W
    if (wide) out.push(`page wider than screen: ${document.documentElement.scrollWidth}`)
    return { out, n }
  })
  checked += res.n
  for (const o of res.out) problems.push(`${label}: ${o}`)
}
for (const [w, h] of [[390, 844], [360, 740], [320, 568]]) {
  for (const s of SCEN) {
    const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: w, height: h }, colorScheme: 'dark', locale: 'ru-RU' })
    const page = await ctx.newPage()
    const errors = []; page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(`http://localhost:3334/${s}/demo7Kx2pQ9mZ4aB`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1000)
    await audit(page, `${w} ${s}`)
    // expand the guide if folded
    const fold = page.locator('#sp-connect button[aria-expanded=false]')
    if (await fold.count()) { await fold.click(); await page.waitForTimeout(300); await audit(page, `${w} ${s} guide`) }
    // each purchase window from the card
    if (w !== 360) for (const name of [/^Продлить/, /^Добавить/, /^Докупить/, /Выбрать тариф/, /^Продлить .*720/]) {
      const b = page.getByRole('button', { name }).first()
      if (!(await b.count()) || !(await b.isVisible())) continue
      await b.click(); await page.waitForTimeout(900)
      if (await page.getByRole('dialog').count()) {
        await audit(page, `${w} ${s} window ${name}`)
        const cont = page.getByRole('dialog').getByRole('button', { name: /Продолжить/ })
        if (await cont.count()) { await cont.click(); await page.waitForTimeout(400); await audit(page, `${w} ${s} window ${name} → methods`) }
        await page.keyboard.press('Escape'); await page.waitForTimeout(400)
      }
    }
    if (errors.length) problems.push(`${w} ${s}: script errors ${errors.join('; ')}`)
    await ctx.close()
  }
}
console.log(`states ${states}, controls checked ${checked}, problems ${problems.length}`)
console.log([...new Set(problems)].slice(0, 60).join('\n'))
await browser.close()
