import {test,expect} from '@playwright/test';

test('selection number and visual marker follow keyboard precedence',async({page})=>{
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/');
  const first=page.locator('[data-project="turnkeep"]');
  const second=page.locator('[data-project="reggio-projects"]');
  await first.focus();
  await second.hover();
  await expect(page.locator('[data-preview-number]')).toHaveText('01');
  await expect(first).toHaveClass(/is-selected/);
  await expect(second).not.toHaveClass(/is-selected/);
  await first.evaluate(el=>el.blur());
  await expect(page.locator('[data-preview-number]')).toHaveText('02');
  await expect(second).toHaveClass(/is-selected/);
  await page.mouse.move(1,1);
  await expect(page.locator('[data-preview-number]')).toHaveText('—');
  await expect(second).not.toHaveClass(/is-selected/);
});

test('reduced motion keeps selected objects still, including Reggio',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/');
  const reggio=page.locator('[data-project="reggio-projects"]');
  await reggio.hover();
  await expect(page.locator('[data-preview-number]')).toHaveText('02');
  expect(await reggio.locator('.artifact').evaluate(el=>getComputedStyle(el).transform)).toBe('none');
  await reggio.focus();
  expect(await reggio.locator('.artifact').evaluate(el=>getComputedStyle(el).transform)).toBe('none');
});
