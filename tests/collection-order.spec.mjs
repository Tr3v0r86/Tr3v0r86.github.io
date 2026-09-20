import {test,expect} from '@playwright/test';
test('collection and picker use the requested order and preserve remaining relative order',async({page})=>{
 await page.goto('/');
 const order=['turnkeep','padlano','elc-portal','second-brain-builder','bodybrain','reggio-projects','learning-and-making','pomodoist','project-dashboard','esp32-experiments','trips','custom-media-databank'];
 expect(await page.locator('[data-project]').evaluateAll(nodes=>nodes.map(n=>n.dataset.project))).toEqual(order);
 await page.getByLabel('Choose a project').selectOption('4');await expect(page.locator('[data-project="bodybrain"]')).toHaveAttribute('aria-current','true');
 await page.goto('/work/bodybrain/');await expect(page.locator('.case-pagination a').first()).toHaveAttribute('href','/work/second-brain-builder/');await expect(page.locator('.case-pagination a').last()).toHaveAttribute('href','/work/reggio-projects/');
});
