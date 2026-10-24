import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const {projects}=JSON.parse(await readFile(new URL('../content/projects.json',import.meta.url),'utf8'));

test('Turnkeep uses its concept on the index and preserves physical evidence inside',async({page})=>{
 const p=projects.find(p=>p.slug==='turnkeep');await page.goto('/?order=catalog');
 await expect(page.locator('[data-project="turnkeep"] img')).toHaveAttribute('src',p.collectionCover.src);
 await expect(page.locator('[data-project="turnkeep"] img')).toHaveAttribute('alt',/AI-generated/);
 await page.locator('.project-picker select').selectOption('3');await page.locator('[data-project="turnkeep"]').click();
 await expect(page.locator('.case-hero img')).toHaveAttribute('src',p.cover.src);
 for(const m of p.gallery)await expect(page.locator(`main ${m.poster?"video":"img"}[src="${m.src}"]`)).toHaveCount(1);
});

test('new cases distinguish illustrative evidence and preserve institutional anonymity',async({page})=>{
 await page.goto('/work/bodybrain/');await expect(page.locator('.case-meta')).toContainText('In development');await expect(page.locator('.case-story')).toContainText('illustrative');
 await page.goto('/work/custom-media-databank/');await expect(page.locator('.case-story')).toContainText('fictional and anonymised');
 expect(JSON.stringify(projects.find(p=>p.slug==='custom-media-databank'))).not.toMatch(/\belc\b|elc\.ac\.th|drive\.google/i);
 await expect(page.locator('.case-gallery')).toContainText('hosting environment');
});

test('Reggio duration is consistent across discovery, case and about',async({page})=>{
 await page.goto('/');await expect(page.locator('[data-project="reggio-projects"]')).toContainText('15 years');
 await page.goto('/work/reggio-projects/');await expect(page.locator('.case-story')).toContainText('For 15 years');
 await expect(page.locator('meta[name="description"]')).toHaveAttribute('content',/Children are makers.*15 years/);
 await page.getByRole('link',{name:'About',exact:true}).click();await expect(page.locator('.about-story')).toContainText('For 15 years');await expect(page.locator('.about-portrait img')).toBeVisible();
});

test('Turnkeep video plays while on screen and pauses when scrolled away',async({page})=>{
 await page.goto('/work/turnkeep/');const v=page.locator('main video');
 expect(await v.evaluate(v=>v.paused)).toBe(true);
 await v.scrollIntoViewIfNeeded();await expect.poll(()=>v.evaluate(v=>!v.paused&&v.currentTime>0)).toBe(true);
 await page.evaluate(()=>scrollTo(0,0));await expect.poll(()=>v.evaluate(v=>v.paused)).toBe(true);
});
test('reduced-motion visitors are not autoplayed',async({browser})=>{
 const page=await browser.newPage({reducedMotion:'reduce'});await page.goto('/work/turnkeep/');const v=page.locator('main video');
 await v.scrollIntoViewIfNeeded();await page.waitForTimeout(800);expect(await v.evaluate(v=>v.paused)).toBe(true);await page.close();
});

test('Jarvis case renders its status, section, media and no links',async({page})=>{
 const p=projects.find(p=>p.slug==='jarvis');await page.goto('/work/jarvis/');
 await expect(page.locator('.case-meta')).toContainText('In development');
 await expect(page.locator('.jarvis-harness h3')).toHaveText(['What it does','What stays with me','Why it’s model-agnostic']);
 await expect(page.locator('.jarvis-harness')).toContainText('Version 2 is in development, October 2026.');
 await expect(page.locator('.project-links a')).toHaveCount(0);
 await expect(page.locator(`main img[src="${p.cover.src}"]`)).toHaveCount(1);
 expect(await page.locator(`main img[src="${p.gallery[0].src}"]`).count()).toBeGreaterThanOrEqual(1);
 expect(await page.locator('main').innerText()).not.toMatch(/\belc\b|(?<![-\w])\d{9,}(?![\w])|\/srv\/|\btail[0-9a-f]{4,}\b|tailnet|ts\.net|gbrain/i);
});
