import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {searchMetadata} from '../src/seo.mjs';
const catalog=JSON.parse(await readFile(new URL('../content/projects.json',import.meta.url),'utf8'));

test('every public page has a distinct title, description, canonical and parseable identity data',async({page})=>{
 const titles=new Set(),descriptions=new Set();
 for(const route of ['/',...catalog.projects.map(p=>`/work/${p.slug}/`)]){
  await page.goto(route);
  const title=await page.title();expect(title).toContain('Trevor Cardozo');expect(titles.has(title)).toBe(false);titles.add(title);
  const description=await page.locator('meta[name="description"]').getAttribute('content');expect(description.length).toBeGreaterThan(60);expect(descriptions.has(description)).toBe(false);descriptions.add(description);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href','https://trevorcardozo.com'+route);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content',/^index, follow/);
  const data=JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
  const entity=data['@graph'][0];expect(entity.url).toBe('https://trevorcardozo.com'+route);
  expect(entity.author['@id']).toBe('https://trevorcardozo.com/#person');
  if(route==='/')expect(data['@graph'].find(x=>x['@type']==='Person').homeLocation.name).toBe('Bangkok, Thailand');
  else expect(data['@graph'].find(x=>x['@type']==='BreadcrumbList').itemListElement.at(-1).item).toBe(entity.url);
 }
});

test('error pages cannot be indexed and school stays a concept in search data',async({page})=>{
 await page.goto('/404.html');await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content','noindex, follow');
 expect(await page.locator('script[type="application/ld+json"]').count()).toBe(0);
 await page.goto('/work/learning-and-making/');
 const description=await page.locator('meta[name="description"]').getAttribute('content');expect(description).toMatch(/concept/);expect(description).not.toMatch(/ELC|Sukhumvit|admissions|enrol/i);
 const data=await page.locator('script[type="application/ld+json"]').textContent();expect(data).not.toMatch(/EducationalOrganization|LocalBusiness|School"/);
 await expect(page.locator('.case-hero figcaption')).toContainText('concept render');
});

test('structured data escapes script terminators without breaking JSON',()=>{
 const data=searchMetadata({title:'A </script><script>alert(1)</script>',description:'A useful example',path:'/work/example/'});
 expect(data.jsonLd).not.toContain('</script>');expect(JSON.parse(data.jsonLd)['@graph'][0].name).toContain('</script>');
});
