import { chromium, devices } from 'playwright'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
let pass = 0, fail = 0
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); c ? pass++ : fail++ }
async function run(mode) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], colorScheme: 'dark', locale: 'ru-RU', permissions: ['clipboard-read', 'clipboard-write'] })
  if (mode !== 'normal') await ctx.addInitScript(() => { Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }) })
  if (mode === 'blocked') await ctx.addInitScript(() => { document.execCommand = () => false })
  if (mode === 'legacy') await ctx.addInitScript(() => { const orig = document.execCommand.bind(document); window.__copied = null; document.execCommand = (c, ...a) => { if (c === 'copy') { window.__copied = document.getSelection()?.toString() || document.activeElement?.value || ''; } return orig(c, ...a) } })
  const page = await ctx.newPage()
  const errors = []; page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('http://localhost:3334/nodevices/demo7Kx2pQ9mZ4aB', { waitUntil: 'networkidle' }); await page.waitForTimeout(1200)
  const step2 = page.locator('#sp-connect ol > li').nth(1)
  const btn = step2.getByRole('button', { name: /Скопировать ссылку/ })
  ok(await btn.count() === 1, `${mode}: step «Добавьте подписку» has «Скопировать ссылку»`)
  await btn.tap(); await page.waitForTimeout(500)
  const ticked = (await step2.getAttribute('data-state')) === 'done'
  if (mode === 'normal') {
    const clip = await page.evaluate(() => navigator.clipboard.readText())
    ok(/demo7Kx2pQ9mZ4aB/.test(clip), 'normal: the link is in the clipboard')
    ok(await step2.getByText('Скопировано').count() === 1 || ticked, 'normal: «Скопировано» shown')
    ok(ticked, 'normal: step ticked after a real copy')
  } else if (mode === 'legacy') {
    ok(ticked, 'no Clipboard API: copied the old way, step ticked')
    ok((await page.locator('textarea').count()) === 0, 'no Clipboard API: no manual field needed')
  } else {
    ok(!ticked, 'everything blocked: step NOT ticked')
    const field = page.locator('textarea[readonly]')
    ok(await field.isVisible(), 'everything blocked: the link appears in a field')
    ok(/demo7Kx2pQ9mZ4aB/.test(await field.inputValue()), 'everything blocked: the field holds the link')
    ok(await page.getByText(/Телефон не дал скопировать/).isVisible(), 'everything blocked: explains how to copy by hand')
  }
  // bottom row
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(300)
  const row = page.getByRole('button', { name: /Скопировать ссылку на подписку/ })
  ok(await row.isVisible(), `${mode}: bottom row «Скопировать ссылку на подписку»`)
  await row.tap(); await page.waitForTimeout(500)
  if (mode === 'blocked') ok(await page.locator('textarea[readonly]').count() >= 2, 'blocked: bottom row also shows the field')
  else ok(await page.getByText('Скопировано').count() >= 1, `${mode}: bottom row says «Скопировано»`)
  ok(errors.length === 0, `${mode}: no script errors (${errors.join('; ')})`)
  await ctx.close()
}
for (const m of ['normal', 'legacy', 'blocked']) await run(m)
console.log(`${pass} PASS, ${fail} FAIL`)
await browser.close()
