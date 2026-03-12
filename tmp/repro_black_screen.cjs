const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (err) => { errors.push('PAGEERROR: ' + err.message); });
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push('CONSOLE ERROR: ' + msg.text()); });

  await page.goto('http://localhost:8088/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /jouer maintenant/i }).click();
  await page.waitForURL('**/play**', { timeout: 15000 });

  await page.getByRole('textbox').first().fill('KarlTest');
  await page.getByRole('button', { name: /^Hote$/i }).click();
  await page.getByRole('button', { name: /Creer la partie/i }).click();
  await page.getByRole('button', { name: /Lancer la partie/i }).click({ timeout: 15000 });

  await page.waitForTimeout(3000);
  const bodyText = await page.locator('body').innerText();
  const hasGameMarkers = /Manche|Tour de|Points|Kudobox|Joueurs/i.test(bodyText);
  console.log('HAS_GAME_MARKERS=', hasGameMarkers);
  console.log('URL=', page.url());
  console.log('BODY_SNIPPET=', bodyText.slice(0, 350).replace(/\s+/g, ' '));
  if (errors.length) {
    console.log('ERRORS_START');
    for (const e of errors) console.log(e);
    console.log('ERRORS_END');
  } else {
    console.log('NO_BROWSER_ERRORS');
  }
  await page.screenshot({ path: 'tmp/play_after_start.png', fullPage: true });
  await browser.close();
})();
