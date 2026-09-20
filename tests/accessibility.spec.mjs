import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {readFile} from 'node:fs/promises';
const catalog=JSON.parse(await readFile(new URL('../content/projects.json',import.meta.url),'utf8'));
test('all pages have no serious or critical automated accessibility violations',async({page})=>{
 test.setTimeout(60000);await page.setViewportSize({width:390,height:844});
 for(const route of ['/','/about/',...catalog.projects.map(p=>'/work/'+p.slug+'/')]){
  await page.goto(route);const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(result.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),route).toEqual([]);
 }
});
for(const width of [390,1440])test(`cold initial transfer and layout stability at ${width}px`,async({browser})=>{
 const context=await browser.newContext({viewport:{width,height:900}});const page=await context.newPage();
 await page.addInitScript(()=>{window.layoutShifts=0;new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.layoutShifts+=e.value;}).observe({type:'layout-shift',buffered:true});});
 await page.goto('http://127.0.0.1:4173/');await page.waitForTimeout(5000);await page.waitForLoadState('networkidle');
 const measured=await page.evaluate(()=>({bytes:performance.getEntriesByType('navigation').reduce((n,e)=>n+e.transferSize,0)+performance.getEntriesByType('resource').reduce((n,e)=>n+e.transferSize,0),cls:window.layoutShifts}));
 console.log(`${width}px initial: ${measured.bytes} bytes, CLS ${measured.cls}`);expect(measured.bytes).toBeLessThan(width===390?900000:1500000);expect(measured.cls).toBeLessThanOrEqual(.1);await context.close();
});
