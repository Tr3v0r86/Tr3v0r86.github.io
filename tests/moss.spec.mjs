import {test,expect} from '@playwright/test';

test('Moss preview changes species and growth without contacting the farm',async({page})=>{
 const external=[];
 page.on('request',request=>{if(new URL(request.url()).hostname==='moss.trevorcardozo.com')external.push(request.url());});
 await page.goto('/work/moss/');
 await expect(page.getByRole('heading',{level:1})).toHaveText('Moss');
 await expect(page.getByRole('link',{name:'Visit the invite-only farm'})).toHaveAttribute('href','https://moss.trevorcardozo.com');
 await page.getByLabel('Habitat artwork').selectOption('space');
 await page.getByLabel('Companion species').selectOption('brook');
 await expect(page.locator('[data-preview-habitat]')).toHaveAttribute('src',/habitat-space/);
 await expect(page.locator('[data-preview-name]')).toHaveText('Brook spirit');
 await expect(page.locator('[data-preview-sprite]')).toHaveAttribute('src',/brook/);
 await page.getByLabel('Growth stage',{exact:true}).selectOption('0');
 await expect(page.locator('[data-preview-status]')).toContainText('1 completed session');
 await page.getByRole('button',{name:'Complete a preview session'}).click();
 await expect(page.locator('[data-preview-status]')).toContainText('2 completed sessions');
 for(let i=0;i<3;i++)await page.getByRole('button',{name:'Complete a preview session'}).click();
 await expect(page.getByLabel('Growth stage',{exact:true})).toHaveValue('1');
 await expect(page.locator('[data-preview-status]')).toContainText('5 completed sessions · Youngster');
 await page.getByLabel('Companion species').selectOption('antler');
 await expect(page.locator('[data-preview-status]')).toContainText('10 completed sessions');
 await page.getByLabel('Growth stage',{exact:true}).selectOption('3');
 await expect(page.locator('[data-preview-sprite]')).toHaveAttribute('src',/stage-4/);
 await expect(page.locator('[data-preview-note]')).toContainText('Illustrative preview');
 expect(external).toEqual([]);
});

test('motion starts paused for reduced motion and can be explicitly controlled',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/work/moss/');
 await expect(page.locator('[data-moss-preview]')).toHaveAttribute('data-paused','true');
 await expect(page.getByRole('button',{name:'Play sprite animation'})).toBeVisible();
 await page.getByRole('button',{name:'Play sprite animation'}).click();
 await expect(page.locator('[data-moss-preview]')).toHaveAttribute('data-paused','false');
 await page.getByRole('button',{name:'Pause sprite animation'}).click();
 await expect(page.locator('[data-moss-preview]')).toHaveAttribute('data-paused','true');
});

test('audio is created only by the chime button',async({page})=>{
 await page.addInitScript(()=>{
  window.audioContextsCreated=0;
  const NativeContext=window.AudioContext;
  window.AudioContext=class extends NativeContext{constructor(...args){super(...args);window.audioContextsCreated++;}};
 });
 await page.goto('/work/moss/');
 expect(await page.evaluate(()=>window.audioContextsCreated)).toBe(0);
 await page.getByRole('button',{name:'Complete a preview session'}).click();
 expect(await page.evaluate(()=>window.audioContextsCreated)).toBe(0);
 await page.getByRole('button',{name:'Hear the three-note chime'}).click();
 await expect.poll(()=>page.evaluate(()=>window.audioContextsCreated)).toBe(1);
});

test('Moss still tells the whole story without JavaScript',async({browser})=>{
 const context=await browser.newContext({javaScriptEnabled:false});
 const page=await context.newPage();await page.goto('http://127.0.0.1:4173/work/moss/');
 await expect(page.locator('main > section')).toHaveCount(5);
 await expect(page.locator('[data-moss-field-guide] figure')).toHaveCount(5);
 await expect(page.locator('[data-moss-legendaries] figure')).toHaveCount(7);
 await expect(page.locator('[data-preview-sprite]')).toBeVisible();
 await expect(page.getByText('Enable JavaScript to try the local preview.')).toBeVisible();
 await expect(page.getByRole('button',{name:'Complete a preview session'})).toBeHidden();
 await context.close();
});
