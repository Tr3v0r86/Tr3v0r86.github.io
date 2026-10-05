import {test,expect} from '@playwright/test';
test('?order=catalog keeps the requested order and preserve remaining relative order',async({page})=>{
 await page.goto('/?order=catalog');
 const order=['moss','pocketframe','trevos','turnkeep','padlano','papercolor-cal','elc-portal','second-brain-builder','bodybrain','reggio-projects','learning-and-making','pomodoist','cal','project-dashboard','esp32-experiments','trips','custom-media-databank'];
 expect(await page.locator('[data-project]').evaluateAll(nodes=>nodes.map(n=>n.dataset.project))).toEqual(order);
 await page.locator('.project-picker select').selectOption('8');await expect(page.locator('[data-project="bodybrain"]')).toHaveAttribute('aria-current','true');
 await page.goto('/work/bodybrain/');await expect(page.locator('.case-pagination a').first()).toHaveAttribute('href','/work/second-brain-builder/');await expect(page.locator('.case-pagination a').last()).toHaveAttribute('href','/work/reggio-projects/');
});
test('collection shuffles per visit, holds the order within the visit and keeps labels and picker in step',async({browser})=>{
 const visit=async()=>{const context=await browser.newContext(),page=await context.newPage();await page.goto('http://127.0.0.1:4173/');return {context,page,order:await page.locator('[data-project]').evaluateAll(nodes=>nodes.map(n=>n.dataset.project))};};
 const seen=new Set();let last;
 for(let n=0;n<5;n++){if(last)await last.context.close();last=await visit();seen.add(last.order.join());}
 expect(seen.size).toBeGreaterThan(1);
 const {page,order,context}=last;
 const catalogPage=await context.newPage();await catalogPage.goto('http://127.0.0.1:4173/?order=catalog');
 expect([...order].sort()).toEqual((await catalogPage.locator('[data-project]').evaluateAll(nodes=>nodes.map(n=>n.dataset.project))).sort());
 const titles=await page.locator('.piece h3').allTextContents(),n=titles.length,pad=i=>String(i+1).padStart(2,'0');
 expect(await page.locator('.project-picker option').allTextContents()).toEqual(titles.map((t,i)=>`${pad(i)} · ${t}`));
 expect(await page.locator('.piece .index').allTextContents()).toEqual(titles.map((t,i)=>pad(i)));
 const loading=await page.locator('.piece .artifact img').evaluateAll(imgs=>imgs.map(i=>i.loading));expect(loading.slice(0,4)).toEqual(Array(4).fill('eager'));expect(loading.slice(4)).toEqual(Array(n-4).fill('lazy'));await expect(page.locator('.piece img').first()).toHaveAttribute('fetchpriority','high');
 await expect(page.locator(`[data-project="${order[0]}"]`)).toHaveAttribute('aria-current','true');
 await page.locator('.project-picker select').selectOption('4');await expect(page.locator(`[data-project="${order[4]}"]`)).toHaveAttribute('aria-current','true');
 await page.goto(`http://127.0.0.1:4173/work/${order[2]}/`);await page.getByRole('link',{name:'Back to collection',exact:false}).first().click();
 expect(await page.locator('[data-project]').evaluateAll(nodes=>nodes.map(n=>n.dataset.project))).toEqual(order);
 await context.close();
});
