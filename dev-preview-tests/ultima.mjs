import { chromium, devices } from 'playwright'
const out = process.argv[2]
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
let pass = 0, fail = 0
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); c ? pass++ : fail++ }
// 1. trial: plan list shows ULTIMA with one price and «навсегда», no per month
{
  const ctx = await browser.newContext({ ...devices['iPhone 13'], colorScheme: 'dark', locale: 'ru-RU' })
  const page = await ctx.newPage()
  await page.goto('http://localhost:3334/trial/demo7Kx2pQ9mZ4aB', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  await page.getByRole('button', { name: /Выбрать тариф/ }).first().click()
  await page.waitForTimeout(900)
  const dlg = page.getByRole('dialog')
  await dlg.getByRole('button', { name: /Сменить/ }).click()
  await page.waitForTimeout(500)
  const ult = dlg.getByRole('radio', { name: /ULTIMA/ })
  const ultText = (await ult.innerText()).replace(/\s+/g, ' ')
  console.log('  ULTIMA row:', ultText)
  ok(/5\s?000\s?₽/.test(ultText) && /навсегда/.test(ultText), 'ULTIMA in plan list: «5 000 ₽ навсегда»')
  ok(!/мес/.test(ultText), 'ULTIMA in plan list: no price per month')
  await page.screenshot({ path: `${out}/ultima-list.png` })
  await ult.click()
  await page.waitForTimeout(600)
  const rows = dlg.getByRole('radiogroup').last()
  const rowText = (await rows.innerText()).replace(/\s+/g, ' ')
  console.log('  period rows:', rowText)
  ok(/Навсегда/.test(rowText) && !/2222/.test(rowText), 'ULTIMA period row says «Навсегда», not «2222 дня»')
  ok(!/мес|Выгода|выгод/i.test(rowText), 'ULTIMA period row: no per-month price, no saving')
  ok(/Один платёж/.test(rowText), 'ULTIMA period row: «Один платёж — продлевать не нужно»')
  await page.screenshot({ path: `${out}/ultima-rows.png` })
  await dlg.getByRole('button', { name: /Продолжить/ }).click()
  await page.waitForTimeout(600)
  const summary = (await dlg.innerText()).replace(/\s+/g, ' ')
  ok(/ULTIMA навсегда/.test(summary) && !/на Навсегда/.test(summary), 'payment step: «👑 ULTIMA навсегда»')
  await page.screenshot({ path: `${out}/ultima-pay.png` })
  await ctx.close()
}
// 2. a person who bought ULTIMA: no «Продлить», no «Оплачено до 2032»
{
  const ctx = await browser.newContext({ ...devices['iPhone 13'], colorScheme: 'dark', locale: 'ru-RU' })
  const page = await ctx.newPage()
  await page.goto('http://localhost:3334/ultima/demo7Kx2pQ9mZ4aB', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  const card = (await page.locator('main, body').first().innerText()).replace(/\s+/g, ' ')
  ok(/VPN работает/.test(card), 'ULTIMA owner: «VPN работает»')
  ok(/продлевать не нужно/.test(card), 'ULTIMA owner: «бессрочная, продлевать не нужно»')
  ok((await page.getByRole('button', { name: /^Продлить/ }).count()) === 0, 'ULTIMA owner: no «Продлить»')
  ok(!/Оплачено до/.test(card) && !/2222|2032|2033/.test(card), 'ULTIMA owner: no far-off end date')
  await page.screenshot({ path: `${out}/ultima-owner.png`, fullPage: false })
  await ctx.close()
}
// 3. regular renewal still has per month and saving
{
  const ctx = await browser.newContext({ ...devices['iPhone 13'], colorScheme: 'dark', locale: 'ru-RU' })
  const page = await ctx.newPage()
  await page.goto('http://localhost:3334/active/demo7Kx2pQ9mZ4aB', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  const card = (await page.locator('body').innerText()).replace(/\s+/g, ' ')
  ok(/Оплачено до/.test(card), 'active: «Оплачено до» still shown')
  await page.locator('ul li').getByRole('button', { name: /Продлить/ }).click()
  await page.waitForTimeout(800)
  const t = (await page.getByRole('dialog').innerText()).replace(/\s+/g, ' ')
  ok(/150 ₽\/мес/.test(t) && /выгода 1 440 ₽/i.test(t.replace(/ /g, ' ')), 'active renewal: year still «150 ₽/мес», «Выгода 1 440 ₽»')
  await ctx.close()
}
console.log(`\n${pass} PASS, ${fail} FAIL`)
await browser.close()
