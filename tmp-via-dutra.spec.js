import { test } from '@playwright/test';

test('inspect Via Dutra panel controls', async ({ page }) => {
  await page.goto('https://rodovias.motiva.com.br/riosp/', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });

  await page.waitForTimeout(5000);

  const cookieButton = page.getByRole('button', { name: /ok/i });
  if (await cookieButton.count()) {
    await cookieButton.click().catch(() => {});
    await page.waitForTimeout(1000);
  }

  const bodyText = await page.locator('body').innerText();
  console.log('BODY_START');
  console.log(bodyText);
  console.log('BODY_END');

  const selects = await page.locator('select').evaluateAll((nodes) =>
    nodes.map((node, index) => ({
      index,
      name: node.getAttribute('name'),
      id: node.getAttribute('id'),
      ariaLabel: node.getAttribute('aria-label'),
      options: Array.from(node.options).map((opt) => ({
        value: opt.value,
        text: opt.textContent,
      })),
    }))
  );

  console.log('SELECTS_START');
  console.log(JSON.stringify(selects, null, 2));
  console.log('SELECTS_END');

  const buttons = await page.locator('button, [role="button"]').evaluateAll((nodes) =>
    nodes.map((node, index) => ({
      index,
      text: (node.textContent || '').trim(),
      ariaLabel: node.getAttribute('aria-label'),
      id: node.getAttribute('id'),
      className: node.getAttribute('class'),
    }))
  );

  console.log('BUTTONS_START');
  console.log(JSON.stringify(buttons, null, 2));
  console.log('BUTTONS_END');
});
