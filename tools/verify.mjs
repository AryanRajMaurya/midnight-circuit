/* MIDNIGHT CIRCUIT — headless smoke test.
 * Usage: BASE=http://127.0.0.1:8000 node tools/verify.mjs
 *
 * Note on the frame-rate check: this sandbox renders through SwiftShader
 * (software), so the number reported is a floor, not a real GPU figure. It
 * asserts the loop is alive rather than fast.
 */

import { chromium } from '/data/home/.hermes/skills/software-development/playwright-skill/node_modules/playwright/index.mjs';

const base = process.env.BASE || 'http://127.0.0.1:8000';
const out = process.env.SHOT || '/data/home/.hermes/cache/scratch/midnight-circuit.png';

const checks = [];
function check(name, ok, detail = '') {
  checks.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });

const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});

await page.goto(base, { waitUntil: 'load' });
await page.waitForFunction(() => window.__midnight && window.__midnight.ready, null, { timeout: 90000 });

check('the world builds', await page.evaluate(() => window.__midnight.ready));
check('the title screen is up', await page.evaluate(() => window.__midnight.phase === 'title'));
check('the HUD is hidden on the title', await page.evaluate(() => document.getElementById('hud').hidden));
await page.screenshot({ path: out.replace('.png', '-title.png') });

await page.click('#start');
await page.waitForFunction(() => window.__midnight.phase === 'drive');
check('starting enters the drive', true);

const info = await page.evaluate(() => window.__midnight.info);
check('the city is cheap to draw', info.calls < 60, `${info.calls} calls, ${info.triangles} triangles`);

const before = await page.evaluate(() => window.__midnight.position);
await page.evaluate(() => window.__midnight.drive.throttle(true));
await page.waitForFunction(() => window.__midnight.speed > 8, null, { timeout: 90000 });
const started = await page.evaluate(() => window.__midnight.position);
await page.waitForTimeout(3000);
const after = await page.evaluate(() => window.__midnight.position);
const moved = Math.hypot(after.x - started.x, after.z - started.z);
check('the car keeps driving', moved > 8, `${moved.toFixed(1)} units in 3s`);
check('the speed readout is live',
  await page.evaluate(() => Number(document.getElementById('speed').textContent) > 25),
  await page.evaluate(() => `${document.getElementById('speed').textContent} km/h`));

await page.evaluate(() => window.__midnight.drive.steer(1));
const headingBefore = await page.evaluate(() => window.__midnight.car.state.heading);
await page.waitForFunction((prev) => Math.abs(window.__midnight.car.state.heading - prev) > 0.08,
  headingBefore, { timeout: 30000 });
check('the car steers', true, await page.evaluate(() => `heading ${window.__midnight.car.state.heading.toFixed(2)}`));
await page.evaluate(() => window.__midnight.drive.steer(0));

await page.evaluate(() => window.__midnight.drive.nitrous(true));
await page.waitForTimeout(2500);
const tank = await page.evaluate(() => window.__midnight.tank);
check('nitrous drains the tank', tank < 0.98, `tank ${tank.toFixed(2)}`);
await page.evaluate(() => { window.__midnight.drive.nitrous(false); window.__midnight.drive.throttle(false); });

const fps = await page.evaluate(() => window.__midnight.fps);
check('the loop is running', fps > 2, `${fps} fps under software rendering`);

await page.screenshot({ path: out });

await page.evaluate(() => window.__midnight.setTime('dusk'));
await page.waitForTimeout(2500);
check('the time of day changes', await page.evaluate(() => window.__midnight.time === 'dusk'));
await page.screenshot({ path: out.replace('.png', '-dusk.png') });

await page.evaluate(() => window.__midnight.pause());
check('pause opens the pause screen', await page.evaluate(() => window.__midnight.phase === 'pause'));
await page.evaluate(() => window.__midnight.resume());
check('resume returns to the drive', await page.evaluate(() => window.__midnight.phase === 'drive'));

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();

const failed = checks.filter((c) => !c.ok).length;
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
process.exit(failed ? 1 : 0);
