import {test,expect} from '@playwright/test';

test('TrevOS and both independent apps expose their source and label visual evidence',async({page})=>{
 const repo='https://github.com/Tr3v0r86/trevos-esp32-s3-knob';
 for(const [slug,source] of [['trevos',repo],['pomodoist',repo+'/tree/main/apps/pomodoist'],['cal',repo+'/tree/main/apps/cal']]){
  await page.goto('/work/'+slug+'/');
  await expect(page.locator('main a').filter({hasText:/source/i})).toHaveAttribute('href',source);
  await expect(page.locator('.case-meta')).toContainText('Hardware/software prototype');
  await expect(page.locator('main')).toContainText(/synthetic data/);
 }
 await page.goto('/work/trevos/');
 await expect(page.locator('main')).toContainText(/AI-generated.*concept/);
 await expect(page.locator('main a[href="/work/pomodoist/"]').first()).toBeVisible();
 await expect(page.locator('main a[href="/work/cal/"]').first()).toBeVisible();
 await page.goto('/work/cal/');
 await expect(page.locator('.case-story')).toContainText('the calendar does not change my focus timer');
});
