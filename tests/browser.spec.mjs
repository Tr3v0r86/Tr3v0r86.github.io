import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const catalog=JSON.parse(await readFile(new URL('../content/projects.json',import.meta.url),'utf8'));
for(const width of [320,390,768,1440])test(`all routes render without overflow at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 for(const route of ['/','/about/',...catalog.projects.map(p=>'/work/'+p.slug+'/')]){
  const response=await page.goto(route);expect(response.status()).toBe(200);await expect(page.locator('h1')).toHaveCount(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),route).toBe(true);
  const imgs=page.locator('main img');for(let i=0;i<await imgs.count();i++){await imgs.nth(i).scrollIntoViewIfNeeded();await expect(imgs.nth(i)).toHaveJSProperty('complete',true);expect(await imgs.nth(i).evaluate(img=>img.naturalWidth)).toBeGreaterThan(0);}
 }
});
test('all cases remain accessible with JavaScript disabled',async({browser})=>{
 const context=await browser.newContext({javaScriptEnabled:false});const page=await context.newPage();await page.goto('http://127.0.0.1:4173/');await expect(page.locator('.piece-link')).toHaveCount(catalog.projects.filter(p=>p.featured).length);await page.locator('[data-project="reggio-projects"]').click();await expect(page.locator('h1')).toHaveText('Reggio projects');await page.getByRole('link',{name:'Back to collection',exact:false}).first().click();await expect(page).toHaveURL(/\/#work$/);await context.close();
});
test('touch opens a case in one tap and reduced motion removes animation',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});const page=await context.newPage();await page.goto('http://127.0.0.1:4173/');expect(await page.locator('.artifact').first().evaluate(el=>getComputedStyle(el).transitionDuration)).toBe('0s');await page.locator('[data-project="padlano"]').tap();await expect(page.locator('h1')).toHaveText('Padlano');await context.close();
});
test('broken images retain a readable fallback and navigation',async({page})=>{
 await page.route('**/media/**',route=>route.abort());await page.goto('/');await expect(page.locator('.image-fallback').first()).toBeVisible();await page.locator('[data-project="turnkeep"]').click();await expect(page.locator('h1')).toHaveText('Turnkeep');await expect(page.getByRole('link',{name:'Build Turnkeep'})).toHaveAttribute('href','/turnkeep/');
});
test('404 and case root anchors behave correctly',async({page})=>{
 expect((await page.goto('/does-not-exist')).status()).toBe(404);await expect(page.locator('h1')).toContainText('isn’t here');await page.goto('/work/learning-and-making/');expect(await page.locator('.case-heading, .case-lead, .case-gallery').allTextContents()).not.toEqual(expect.arrayContaining([expect.stringMatching(/\bELC\b|Tauquil|Payal/)]));await page.getByRole('link',{name:'About',exact:true}).click();await expect(page).toHaveURL(/\/about\/$/);
});
test('dashboard screenshot keeps the entire frame at desktop and mobile sizes',async({page})=>{
 for(const width of [390,1440]){await page.setViewportSize({width,height:900});await page.goto('/');const img=page.locator('[data-project="project-dashboard"] img');await img.scrollIntoViewIfNeeded();await expect(img).toHaveJSProperty('complete',true);const geometry=await img.evaluate(el=>({fit:getComputedStyle(el).objectFit,ratio:el.getBoundingClientRect().width/el.getBoundingClientRect().height,natural:el.naturalWidth/el.naturalHeight}));expect(geometry.fit).toBe('contain');expect(geometry.ratio).toBeCloseTo(geometry.natural,2);}
});
