import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const {projects}=JSON.parse(await readFile(new URL('../content/projects.json',import.meta.url),'utf8'));

test('Turnkeep uses its concept on the index and preserves physical evidence inside',async({page})=>{
 const p=projects.find(p=>p.slug==='turnkeep');await page.goto('/');
 await expect(page.locator('[data-project="turnkeep"] img')).toHaveAttribute('src',p.collectionCover.src);
 await expect(page.locator('[data-project="turnkeep"]')).toContainText('AI-generated concept');
 await page.locator('[data-project="turnkeep"]').click();
 await expect(page.locator('.case-hero img')).toHaveAttribute('src',p.cover.src);
 for(const m of p.gallery)await expect(page.locator(`main img[src="${m.src}"]`)).toHaveCount(1);
});

test('new cases distinguish illustrative evidence and preserve institutional anonymity',async({page})=>{
 await page.goto('/work/bodybrain/');await expect(page.locator('.case-meta')).toContainText('In development');await expect(page.locator('.case-story')).toContainText('illustrative');
 await page.goto('/work/plj-databank/');await expect(page.locator('.case-story')).toContainText('fictional and anonymised');
 expect(JSON.stringify(projects.find(p=>p.slug==='plj-databank'))).not.toMatch(/\belc\b|elc\.ac\.th|drive\.google/i);
 await expect(page.locator('.case-gallery')).toContainText('hosting environment');
});

test('Reggio duration is consistent across discovery, case and about',async({page})=>{
 await page.goto('/');await expect(page.locator('[data-project="reggio-projects"]')).toContainText('15 years');
 await page.goto('/work/reggio-projects/');await expect(page.locator('.case-story')).toContainText('For 15 years');
 await expect(page.locator('meta[name="description"]')).toHaveAttribute('content',/^15 years/);
 await page.getByRole('link',{name:'About',exact:true}).click();await expect(page.locator('.about-story')).toContainText('For 15 years');await expect(page.locator('.about-portrait img')).toBeVisible();
});
