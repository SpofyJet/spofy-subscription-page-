import { chromium, devices } from 'playwright'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
let pass = 0, fail = 0
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); c ? pass++ : fail++ }
const ctx = await browser.newContext({ ...devices['iPhone 13'], colorScheme: 'dark', locale: 'ru-RU', permissions: ['clipboard-read', 'clipboard-write'] })
// the real panel: no copy buttons in the steps
await ctx.route('**/assets/.app-config-v2.json*', async (route) => {
  const res = await route.fetch(); const cfg = await res.json()
  let removed = 0
  for (const p of Object.values(cfg.platforms ?? {})) for (const app of p.apps ?? []) for (const b of app.blocks ?? []) { const n = b.buttons.length; b.buttons = b.buttons.filter((x) => x.type !== 'copyButton'); removed += n - b.buttons.length }
  console.log('copy buttons removed from config:', removed)
  await route.fulfill({ response: res, json: cfg })
})
const page = await ctx.newPage()
await page.goto('http://localhost:3334/nodevices/demo7Kx2pQ9mZ4aB', { waitUntil: 'networkidle' }); await page.waitForTimeout(1200)
const step2 = page.locator('#sp-connect ol > li').nth(1)
const btn = step2.getByRole('button', { name: /Скопировать ссылку/ })
ok(await btn.count() === 1, 'panel without copy button: the page adds «Скопировать ссылку» to the step')
await btn.tap(); await page.waitForTimeout(400)
ok(/demo7Kx2pQ9mZ4aB/.test(await page.evaluate(() => navigator.clipboard.readText())), '…and it copies the link')
ok(await step2.getByText(/никому его не пересылайте/).count() === 1, '…with «никому не пересылайте» under it')
await step2.screenshot({ path: '/home/claude/shots/v7/step2-own-copy.png' })
console.log(`${pass} PASS, ${fail} FAIL`)
await browser.close()
