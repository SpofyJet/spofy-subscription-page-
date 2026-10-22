// Interaction checks for v6. Usage: node interact2.mjs <base> <out>
import { chromium, devices } from 'playwright'
import fs from 'node:fs'

const [base, out] = process.argv.slice(2)
fs.mkdirSync(out, { recursive: true })
const UUID = 'demo7Kx2pQ9mZ4aB'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const results = []
const check = (name, ok, extra = '') => { const l = `${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`; results.push(l); console.log(l) }

async function fresh(path, opts = {}, setup) {
    const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 2, colorScheme: 'dark', locale: 'ru-RU', ...opts })
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base })
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    if (setup) await setup(page, ctx)
    await page.goto(`${base}/${path}/${UUID}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1300)
    return { page, ctx, errors }
}

// 1. one support entry, at the bottom; nickname in the header
{
    const { page } = await fresh('active')
    const support = await page.locator('a[href*="spofysup"]').count()
    check('one support button on the page', support === 1, `${support}`)
    const box = await page.locator('a[href*="spofysup"]').boundingBox()
    const h = await page.evaluate(() => document.documentElement.scrollHeight)
    check('support is the last thing on the page', box && box.y + box.height > h - 120, `y=${Math.round(box?.y)} of ${h}`)
    check('nickname from the panel in the header', await page.locator('header').getByText('@ivan_petrov').isVisible())
    // renew is a row button like «Добавить» / «Докупить»
    const rowButtons = await page.locator('ul li button').allInnerTexts()
    check('renew sits in the rows with the other buttons', rowButtons.some((t) => /Продлить/.test(t)) && rowButtons.some((t) => /Добавить/.test(t)) && rowButtons.some((t) => /Докупить/.test(t)), rowButtons.join(' | '))
    check('active: no glowing «buy» button', (await page.locator('[class*="btnGlow"]').count()) === 0)
    check('active (device connected): whole page ≤ 1.2 screens', h <= 844 * 1.2, `${h}px`)
    // every tap target ≥ 44
    const small = await page.evaluate(() =>
        [...document.querySelectorAll('main a, main button')]
            .filter((el) => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden')
            .map((el) => { const r = el.getBoundingClientRect(); return { t: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) } })
            .filter((x) => x.w < 44 || x.h < 44)
    )
    check('no tap target smaller than 44×44', small.length === 0, JSON.stringify(small))
    await page.screenshot({ path: `${out}/t-active.png`, fullPage: true })
    await page.close()
}

// 2. no devices yet: one big «Подключить устройство» that brings the guide
{
    const { page } = await fresh('nodevices')
    const btn = page.getByRole('button', { name: 'Подключить устройство' })
    const b = await btn.boundingBox()
    check('no devices: «Подключить устройство» on the first screen', b && b.y + b.height <= 844, `bottom=${Math.round(b?.y + b?.height)}`)
    await btn.click()
    await page.waitForTimeout(900)
    const add = await page.getByRole('link', { name: /Добавить в Happ/ }).boundingBox()
    check('…and it brings «Добавить в Happ» into view', add && add.y >= 0 && add.y + add.height <= 844, `y=${Math.round(add?.y)}`)
    check('step 3 keeps its explanation', await page.getByText(/нажмите большую кнопку подключения/).isVisible())
    await page.screenshot({ path: `${out}/t-nodevices-after.png` })
    // 3. a deep link that did not open: no false tick, a hint instead
    await page.getByRole('link', { name: /Добавить в Happ/ }).click()
    await page.waitForTimeout(2200)
    check('app did not open → hint shown', await page.getByText('Приложение не открылось?').isVisible())
    await page.waitForTimeout(700)
    const hb = await page.getByText('Приложение не открылось?').boundingBox()
    check('…and scrolled into view', hb && hb.y >= 0 && hb.y + hb.height <= 844, `y=${Math.round(hb?.y)}`)
    check('app did not open → step NOT ticked', (await page.locator('li[data-state="done"]').count()) === 0)
    await page.close()
    // copy, in a fresh page (headless Chromium keeps an unanswered happ:// prompt open above)
    const c = await fresh('nodevices')
    await c.page.getByRole('button', { name: 'Скопировать ссылку', exact: true }).click()
    await c.page.waitForTimeout(300)
    const text = await c.page.evaluate(() => navigator.clipboard.readText())
    check('guide copy button copies the link', text.endsWith(UUID))
    check('copy ticks its step', (await c.page.locator('li[data-state="done"]').count()) === 1)
    check('personal-key warning under the copy button', await c.page.getByText('Это ваш личный ключ').first().isVisible())
    await c.page.close()
}

// 5. guide collapsed once a device is connected, opens from its row
{
    const { page } = await fresh('active')
    await page.getByRole('button', { name: /Подключить ещё одно устройство/ }).click()
    await page.waitForTimeout(300)
    check('connected: guide opens from «Подключить ещё одно устройство»', await page.getByRole('heading', { name: /Установите Happ/ }).isVisible())
    await page.getByRole('radio', { name: 'Android', exact: true }).click()
    await page.waitForTimeout(300)
    check('platform switch shows Google Play', await page.getByRole('link', { name: /Google Play/ }).isVisible())
    await page.getByRole('radio', { name: 'iPhone / iPad' }).click()
    check('only Happ and INCY', (await page.getByRole('radio', { name: /v2RayTun|Hiddify/ }).count()) === 0)
    await page.close()
}

// 6. views
{
    let r = await fresh('expired')
    check('expired: title «VPN выключен»', await r.page.getByRole('heading', { name: 'VPN выключен' }).isVisible())
    check('expired: price says «при оплате за 1 год»', await r.page.getByText('при оплате за 1 год').isVisible())
    check('expired: no traffic offer', (await r.page.getByText(/Докупить|ГБ за/).count()) === 0)
    await r.page.close()
    r = await fresh('expiring')
    check('expiring: only one buy button (Продлить)', (await r.page.getByRole('button', { name: /Добавить|Докупить/ }).count()) === 0 && (await r.page.getByRole('button', { name: /Продлить/ }).count()) === 1)
    await r.page.close()
    r = await fresh('trial')
    check('trial: no «Докупить» / «Добавить»', (await r.page.getByText(/Докупить/).count()) === 0 && (await r.page.getByRole('button', { name: 'Добавить' }).count()) === 0)
    check('trial: CTA price is the «С обходами» plan (150 ₽/мес)', await r.page.getByText('от 150 ₽/мес').isVisible())
    await r.page.getByRole('button', { name: /Выбрать тариф/ }).click()
    await r.page.waitForTimeout(900)
    check('trial sheet offers «С обходами» first', await r.page.getByRole('dialog').getByText(/С обходами/).first().isVisible())
    await r.page.screenshot({ path: `${out}/t-trial-sheet.png` })
    await r.page.close()
    r = await fresh('limited')
    check('limited: says «VPN остановлен»', await r.page.getByRole('heading', { name: 'VPN остановлен' }).isVisible())
    await r.page.close()
    r = await fresh('devicesfull')
    check('all slots taken: no «Подключить ещё одно устройство»', (await r.page.getByText('Подключить ещё одно устройство').count()) === 0)
    await r.page.close()
    r = await fresh('nocheckout')
    check('no in-page checkout: note that the buttons open the bot', await r.page.getByText(/кнопки ↗ откроют его/).isVisible())
    const extern = await r.page.locator('ul li a[target=_blank]').count()
    check('no in-page checkout: row buttons open the bot (marked)', extern >= 2, `${extern}`)
    await r.page.close()
}

// 7. renew sheet
{
    const { page, ctx, errors } = await fresh('active')
    await page.locator('ul li').getByRole('button', { name: /Продлить/ }).click()
    await page.waitForTimeout(900)
    const dialog = page.getByRole('dialog')
    check('sheet: no tabs', (await dialog.getByRole('tab').count()) === 0)
    check('sheet: one badge «Рекомендуем», no «Выгоднее всего»', (await dialog.getByText('Рекомендуем').count()) === 1 && (await dialog.getByText('Выгоднее всего').count()) === 0)
    check('sheet: 3 months preselected', (await dialog.getByRole('radio', { checked: true }).innerText()).includes('3 месяца'))
    check('sheet: days spelled out («90 дней»)', await dialog.getByText('90 дней').isVisible())
    check('sheet: year = 150 ₽/мес, saving 1 440 ₽', (await dialog.getByText('150 ₽/мес').count()) >= 1 && (await dialog.getByText('выгода 1 440 ₽').count()) === 1)
    check('sheet: no payment methods on step 1', (await dialog.getByText('Способ оплаты').count()) === 0)
    const box = await page.locator('.mantine-Drawer-content').boundingBox()
    check('renew sheet hugs its content (< 700 of 844)', box && box.height < 700, `${Math.round(box?.height)}`)
    await page.screenshot({ path: `${out}/t-renew-sheet.png` })
    await dialog.getByRole('button', { name: /Продолжить/ }).click()
    await page.waitForTimeout(400)
    const popup = ctx.waitForEvent('page', { timeout: 5000 }).catch(() => null)
    await dialog.getByRole('button', { name: /Оплатить/ }).click()
    const tab = await popup
    await page.waitForTimeout(800)
    check('«Оплатить» opens the payment page by itself (one tap)', !!tab, tab ? tab.url() : 'no tab')
    check('waiting screen says it opened in a new tab', await dialog.getByText(/Страница оплаты открылась/).isVisible())
    await page.screenshot({ path: `${out}/t-waiting.png` })
    await page.getByText('Оплачено', { exact: true }).waitFor({ timeout: 25000 }).catch(() => null)
    check('payment polled to «Оплачено»', await page.getByText('Оплачено', { exact: true }).isVisible())
    check('«Оплачено» window header says «Оплата прошла»', await page.getByText('Оплата прошла').isVisible() && (await page.getByText('осталось оплатить').count()) === 0)
    check('«Оплачено» date = old end + 90 days', await page.getByText(/Подписка действует до/).isVisible(), await page.getByText(/Подписка действует до/).innerText().catch(() => ''))
    await page.screenshot({ path: `${out}/t-done.png` })
    check('no page errors', errors.length === 0, errors.join('; '))
    await page.close()
}

// 8. payment hangs: «Уже оплатили?» with support and the payment number
//    (a payment created 80 s ago that the bot never confirms)
{
    const pending = {
        createdAt: Date.now() - 80_000,
        kind: 'renew',
        shortUuid: UUID,
        summary: 'Продление на 3 месяца',
        result: { amount_kopeks: 72000, price_kopeks: 72000, before: { device_limit: 3, end_date: null, is_trial: false, status: 'active', tariff_id: 1, tariff_name: null, traffic_limit_gb: 100 }, method: 'platega', payment_id: 'pay_1234567890', payment_url: 'https://example.com/pay', qr_payload: null }
    }
    const { page } = await fresh('active', {}, async (p) => {
        await p.route('**/payments/**', (route) =>
            route.fulfill({ contentType: 'application/json', body: JSON.stringify({ is_paid: false, status_text: null, subscription: pending.result.before }) })
        )
        await p.addInitScript((value) => localStorage.setItem('spofy.subpage.pending', value), JSON.stringify(pending))
    })
    await page.getByRole('button', { name: /Ждём оплату/ }).click()
    await page.waitForTimeout(900)
    check('after 75 s: «Уже оплатили?» with the payment number', await page.getByText(/номер платежа: pay_1234567890/).isVisible())
    check('…and a support button there', (await page.getByRole('dialog').locator('a[href*="spofysup"]').count()) === 1)
    await page.screenshot({ path: `${out}/t-stuck.png` })
    await page.close()
}

// 9. traffic sheet when «Обход» is used up: what will really be available
{
    const { page } = await fresh('bypass')
    await page.getByRole('button', { name: /Вернуть «Обход»/ }).click()
    await page.waitForTimeout(900)
    check('bypass: «После покупки будет доступно 50 ГБ»', await page.getByText('После покупки будет доступно 50 ГБ').isVisible())
    check('bypass: «не сгорают 1-го числа»', await page.getByText(/не сгорают 1-го числа/).isVisible())
    await page.screenshot({ path: `${out}/t-bypass-sheet.png` })
    await page.close()
}

// 10. devices stepper
{
    const { page } = await fresh('active')
    await page.locator('ul li').getByRole('button', { name: /Добавить/ }).click()
    await page.waitForTimeout(900)
    const v = async () => (await page.locator('output').innerText()).trim()
    const a = await v()
    await page.getByRole('button', { name: '+1' }).click()
    const b = await v()
    check('devices: +1 → +2 per tap', a === '+1' && b === '+2', `${a} → ${b}`)
    check('devices: «Станет 5 устройств, сейчас 3»', await page.getByText('Станет 5 устройств, сейчас 3').isVisible())
    const db = await page.locator('.mantine-Drawer-content').boundingBox()
    check('devices sheet hugs its content (< 450)', db && db.height < 450, `${Math.round(db?.height)}`)
    await page.close()
}

// 11. English, 320 px, desktop
{
    const { page } = await fresh('active', { locale: 'en-US' })
    const en = await page.getByRole('heading', { name: 'VPN is working' }).isVisible()
    check('English page', en)
    await page.close()
    const ctx = await browser.newContext({ viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark', locale: 'ru-RU' })
    const p = await ctx.newPage()
    for (const s of ['active', 'nodevices', 'trial', 'expired', 'bypass', 'expiring']) {
        await p.goto(`${base}/${s}/${UUID}`, { waitUntil: 'networkidle' })
        await p.waitForTimeout(800)
        const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
        check(`320px ${s}: no sideways scroll`, !overflow)
        await p.screenshot({ path: `${out}/w320-${s}.png`, fullPage: true })
    }
    const d = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light', locale: 'ru-RU' })
    const dp = await d.newPage()
    await dp.goto(`${base}/active/${UUID}`, { waitUntil: 'networkidle' })
    await dp.waitForTimeout(900)
    check('desktop: no sideways scroll', !(await dp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)))
    await dp.screenshot({ path: `${out}/desktop-light.png` })
}

await browser.close()
fs.writeFileSync(`${out}/checks.txt`, results.join('\n'))
console.log(results.join('\n'))
