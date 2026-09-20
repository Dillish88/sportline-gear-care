// Run with the local server active: node tests/qr-flow.cjs
// Requires Playwright and Microsoft Edge. No messages are sent.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.SPORTLINE_TEST_URL || 'http://127.0.0.1:8765';

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => { window.open = url => { window.testOutgoingUrl = url; }; });
    const open = path => page.goto(base + path);
    const visible = id => page.locator(id).isVisible();
    const message = async () => {
      const url = new URL(await page.evaluate(() => window.testOutgoingUrl));
      assert.equal(url.origin, 'https://wa.me');
      assert.equal(url.pathname, '/918056436668');
      return url.searchParams.get('text');
    };

    await open('/?src=play-area-demo');
    assert(await visible('#chooser'));
    assert.equal(await page.locator('#sourceNote').innerText(), 'Referred by: play-area-demo');
    await page.locator('[data-sp="bad"]').click();
    await page.locator('#go').click();
    assert.match(await page.locator('#err').innerText(), /your name.*mobile/);
    assert.equal(await page.evaluate(() => window.testOutgoingUrl), undefined);

    await open('/?svc=string&src=academy-demo');
    assert(await visible('#badBlk'));
    await page.locator('#guideBtn').click();
    await page.locator('#gApply').click();
    assert.match(await page.locator('#str option:checked').innerText(), /BG65 Titanium/);
    assert.equal(await page.locator('#col').inputValue(), 'Black');
    assert.equal(await page.locator('#ten').inputValue(), '23');
    assert.equal(await page.locator('#tot').innerText(), '₹650');
    await page.locator('input[name="k"][value="4"]').check();
    await page.locator('#pre').check();
    assert.equal(await page.locator('#tot').innerText(), '₹700');
    await page.locator('#nm').fill('Test Customer');
    await page.locator('#ph').fill('+91 98765 43210');
    await page.locator('#gear').fill('Test racket');
    await page.locator('#go').click();
    const badminton = await message();
    for (const text of ['BG65 Titanium', 'Black', '23 lbs', '₹700', '9876543210', 'Test racket', 'Ref: academy-demo', 'Drop-off: Sportline, 6th Avenue']) {
      assert(badminton.includes(text), 'Missing message field: ' + text);
    }
    assert(await visible('#handoff'));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

    await open('/?svc=bat&src=shop-demo');
    assert(await visible('#criBlk'));
    await page.locator('#nm').fill('Test Customer');
    await page.locator('#ph').fill('9876543210');
    await page.locator('#go').click();
    assert.match(await page.locator('#err').innerText(), /at least one bat job/);
    await page.locator('input[value="knockH"]').check();
    await page.locator('input[value="crack"]').check();
    assert.equal(await page.locator('#tot').innerText(), '₹500');
    await page.locator('#go').click();
    const cricket = await message();
    for (const text of ['Knocking-in, by hand', 'Crack binding', 'inspection quote', 'Ref: shop-demo']) assert(cricket.includes(text));
    assert(!cricket.includes('Priority'));

    await open('/?sport=cricket');
    assert(await visible('#criBlk'));
    await open('/?sport=badminton');
    assert(await visible('#badBlk'));
    await open('/?src=%3Cimg%20src=x%20onerror=alert(1)%3E');
    assert.equal(await page.locator('#sourceNote img').count(), 0);
    await page.setViewportSize({ width: 1440, height: 900 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

    await open('/gear-care.html?svc=bat&shop=pickup&area=Kilpauk');
    await page.locator('#slot').selectOption('late');
    assert.match(await page.locator('#slotNote').innerText(), /tomorrow morning/);
    assert.equal(await page.locator('input[value="weight"]').count(), 0);
    await page.locator('#weightChk').check();
    assert.match(await page.locator('#sumRows').innerText(), /Weight reducing/);
    assert.deepEqual(errors, []);
    console.log('PASS: QR sources and aliases, service selection, validation, recommendation and colours, totals, WhatsApp payloads, injection handling, mobile/desktop overflow, legacy fixes. No messages sent.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
