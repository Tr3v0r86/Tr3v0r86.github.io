import {test,expect} from '@playwright/test';
test('brain concept generates a named downloadable blueprint',async({page})=>{
 await page.goto('/prototypes/second-brain-builder/');await page.getByLabel('What will you call your workspace?').fill('My workshop');await page.getByRole('button',{name:'Plain text',exact:true}).click();await page.getByRole('button',{name:'Build my blueprint'}).click();await expect(page.locator('#output')).toContainText('# My workshop');await expect(page.locator('#output')).toContainText('Format: Plain text');const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download blueprint'}).click();expect((await download).suggestedFilename()).toBe('START-HERE.txt');
});
test('trip map selection, visited state and packing list work',async({page})=>{
 await page.goto('/prototypes/trips/');await page.getByRole('button',{name:'Select village stop'}).click();await expect(page.locator('#stop-title')).toHaveText('The village');await page.getByRole('button',{name:'Mark as visited'}).click();await expect(page.locator('#visited-count')).toHaveText('1 of 3 visited');await page.getByRole('button',{name:'Packing list',exact:true}).click();await page.getByLabel('Water bottle').check();await page.getByRole('button',{name:'Explore',exact:true}).click();await expect(page.getByRole('button',{name:'Visited ✓'})).toBeVisible();await page.getByRole('button',{name:'Packing list',exact:true}).click();await expect(page.getByLabel('Water bottle')).toBeChecked();
});
test('bodybrain charts and sources respond to selection',async({page})=>{
 await page.goto('/prototypes/bodybrain/');await page.getByRole('button',{name:'Nutrition',exact:true}).click();await expect(page.locator('#metric-value')).toContainText('128');await page.getByRole('button',{name:'Previous week'}).click();await expect(page.locator('#metric-value')).toContainText('116');await page.getByLabel('Check-in note').fill('Sample check-in');await page.getByRole('button',{name:'Save note'}).click();await expect(page.getByRole('status')).toContainText('demo visit');await page.getByRole('button',{name:'Data sources'}).click();await expect(page.locator('#sources')).toContainText('Bloodwork');
});
test('app concepts fit phone widths without horizontal overflow',async({page})=>{
 for(const width of [320,390,480])for(const slug of ['trips','bodybrain','second-brain-builder']){await page.setViewportSize({width,height:844});await page.goto('/prototypes/'+slug+'/');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${slug} at ${width}`).toBe(true);}
});
