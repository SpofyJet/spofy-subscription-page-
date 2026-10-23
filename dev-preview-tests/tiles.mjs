import { chromium, devices } from 'playwright'
const out = process.argv[2]
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
for (const [w, h] of [[390, 844], [320, 568]]) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: w, height: h }, deviceScaleFactor: 2, colorScheme: 'dark', locale: 'ru-RU' })
  const page = await ctx.newPage()
  await page.goto('http://localhost:3334/nodevices/demo7Kx2pQ9mZ4aB', { waitUntil: 'networkidle' }); await page.waitForTimeout(1200)
  await page.locator('#sp-connect').evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 8)); await page.waitForTimeout(400)
  await page.screenshot({ path: `${out}/tiles-${w}.png` })
  // swipe sideways on the systems: the page must not move
  const box = await page.getByRole('radiogroup').first().boundingBox()
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Input.synthesizeScrollGesture', { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2), xDistance: -300, yDistance: 0, gestureSourceType: 'touch', speed: 1200 })
  await page.waitForTimeout(500)
  console.log(w, 'after sideways swipe: scrollX', await page.evaluate(() => [window.scrollX, window.visualViewport.offsetLeft, document.documentElement.scrollWidth]))
  await ctx.close()
}
await browser.close()
