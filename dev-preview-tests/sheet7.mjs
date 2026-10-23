import { chromium, devices } from 'playwright'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
let pass = 0, fail = 0
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); c ? pass++ : fail++ }
const URL = 'http://localhost:3334/active/demo7Kx2pQ9mZ4aB'
let ctx = await browser.newContext({ ...devices['iPhone 13'], colorScheme: 'dark', locale: 'ru-RU' })
let page = await ctx.newPage()
await page.goto('about:blank'); await page.goto(URL, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200)
const dlg = page.getByRole('dialog')
const openRenew = async () => { await page.locator('ul li').getByRole('button', { name: /Продлить/ }).tap(); await page.waitForTimeout(800) }
await openRenew()
await page.goBack(); await page.waitForTimeout(600)
ok(page.url() === URL && (await dlg.count()) === 0, '«Назад» closes the window and stays on the page')
await openRenew()
await dlg.getByRole('button', { name: 'Закрыть' }).tap(); await page.waitForTimeout(600)
await page.goBack(); await page.waitForTimeout(800)
ok(page.url() === 'about:blank', 'closed with ✕, then «Назад» → leaves the page (no stuck extra step)')
await page.goto(URL, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200)
// swipe down by the top
await openRenew()
const box = await page.locator('.mantine-Drawer-content').boundingBox()
const cdp = await ctx.newCDPSession(page)
const x = Math.round(box.x + box.width / 2), y0 = Math.round(box.y + 30)
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] })
for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 + i * 20 }] }); await page.waitForTimeout(16) }
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
await page.waitForTimeout(700)
ok((await dlg.count()) === 0, 'pulling the window down by its top closes it')
// a small pull springs back
await openRenew()
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] })
await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 + 30 }] }); await page.waitForTimeout(300)
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(500)
ok((await dlg.count()) === 1, 'a small pull springs back (window stays)')
// scrolling the list inside does not close it
await dlg.getByRole('button', { name: /Продолжить/ }).tap(); await page.waitForTimeout(500)
const backH = await dlg.getByRole('button', { name: /Назад/ }).boundingBox()
const moreH = await dlg.getByRole('button', { name: /Другой способ оплаты/ }).boundingBox()
ok(backH.height >= 44 && moreH.height >= 44, `«Назад» ${backH.height}px, «Другой способ оплаты» ${moreH.height}px (≥ 44)`)
await ctx.close()
// small phone: chosen row visible above the footer
for (const s of ['trial', 'expiring']) {
  ctx = await browser.newContext({ ...devices['iPhone SE'], viewport: { width: 320, height: 568 }, colorScheme: 'dark', locale: 'ru-RU' })
  page = await ctx.newPage()
  await page.goto(`http://localhost:3334/${s}/demo7Kx2pQ9mZ4aB`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200)
  await page.getByRole('button', { name: /720/ }).first().tap(); await page.waitForTimeout(1200)
  const r = await page.evaluate(() => {
    const radios = [...document.querySelectorAll('[role=dialog] [role=radio][aria-checked=true]')]
    const chosen = radios[radios.length - 1].getBoundingClientRect()
    const footer = document.querySelector('[role=dialog] [class*=coFooter]')?.getBoundingClientRect()
    return { top: Math.round(chosen.top), bottom: Math.round(chosen.bottom), footerTop: Math.round(footer?.top ?? 9999) }
  })
  ok(r.top >= 0 && r.bottom <= r.footerTop, `${s} 320×568: chosen period visible above the button (row ${r.top}–${r.bottom}, button from ${r.footerTop})`)
  await page.screenshot({ path: `/home/claude/shots/v7/sheet-320-${s}.png` })
  await ctx.close()
}
console.log(`${pass} PASS, ${fail} FAIL`)
await browser.close()
