import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {gzipSync} from 'node:zlib';
import {validateCatalog,safeURL,verifyMedia} from '../scripts/build.mjs';
import {renderCase,renderHome} from '../src/templates.mjs';
const catalog=JSON.parse(await readFile(new URL('../content/projects.json',import.meta.url),'utf8'));
const changed=fn=>{const c=structuredClone(catalog);fn(c);return c;};
test('real catalog includes the complete requested collection and decoded media',async()=>{const p=validateCatalog(catalog);assert.deepEqual(p.map(p=>p.slug),catalog.expectedSlugs);assert(p.some(p=>p.slug==='second-brain-builder'));assert(p.some(p=>p.slug==='trips'));assert(!p.some(p=>/face-tracking|espcam/.test(p.slug)));await verifyMedia(p);});
test('invalid content fails with an actionable field',()=>{
 for(const [change,match] of [
  [c=>c.projects[1].slug=c.projects[0].slug,/slug/],
  [c=>c.projects[0].summary='word '.repeat(91),/summary/],
  [c=>c.projects[0].summary='line\nline',/summary/],
  [c=>c.projects[0].cover.src='/media/../secret.png',/cover.src/],
  [c=>c.projects[0].gallery=[],/gallery/],
  [c=>c.projects[0].links[0].href='javascript:alert(1)',/href/],
  [c=>c.projects[0].privateNotes='do not publish',/unknown\/private/],
  [c=>c.projects[0].status='Shipped to thousands',/status/],
  [c=>c.projects[3].dateLabel='2026',/anonymous/],
  [c=>c.projects[3].summary='A school at ELC',/anonymous/],
  [c=>c.projects.pop(),/manifest/]
 ])assert.throws(()=>validateCatalog(changed(change)),match);
});
test('unsafe URL forms fail closed',()=>{for(const url of ['//bad.test','/x/../secret','/x/%2e%2e/secret','https://name:pass@x.test','https://x.test/" onload="x','javascript:alert(1)','http://x.test','data:text/html,x'])assert.equal(safeURL(url),false,url);for(const url of ['/turnkeep/','/#work','https://padlano.com/'])assert.equal(safeURL(url),true,url);});
test('text is escaped, attribution and accessible equivalents survive templates',()=>{const p=structuredClone(catalog.projects[0]);p.title='<img src=x onerror=alert(1)>';p.gallery[0].credit={text:'A & B',url:'https://example.org/'};p.gallery[0].textEquivalent='The wire connects <two> components.';const html=renderCase(p,[p]);assert(!html.includes('<img src=x'));assert(html.includes('&lt;img src=x onerror=alert(1)&gt;'));assert(html.includes('A &amp; B'));assert(html.includes('The wire connects &lt;two&gt; components.'));});
test('native links and case navigation do not depend on JavaScript',()=>{const home=renderHome(catalog.projects);for(const p of catalog.projects)assert(home.includes(`href="/work/${p.slug}/"`));const first=renderCase(catalog.projects[0],catalog.projects);assert(first.includes('href="/turnkeep/"'));assert(first.includes('href="/about/"'));assert(!first.includes('Previous piece'));assert(!first.includes('history.back'));});
test('cover attribution URL and accessible derivative are usable links',()=>{const p=structuredClone(catalog.projects[0]);p.cover.credit={text:'Artifact author',url:'https://example.org/author'};p.cover.accessibleLink={label:'Read the diagram',href:'/media/diagram.svg'};const html=renderCase(p,[p]);assert(html.includes('href="https://example.org/author"'));assert(html.includes('href="/media/diagram.svg"'));});
test('missing or corrupt files stop media validation',async()=>{const tmp=await mkdtemp(path.join(os.tmpdir(),'portfolio-test-'));try{const p=structuredClone(catalog.projects[0]);p.cover={...p.cover,src:'/media/broken.webp',variants:[]};await assert.rejects(verifyMedia([p],tmp),/invalid or missing/);await mkdir(path.join(tmp,'media'));await writeFile(path.join(tmp,'media/broken.webp'),'not an image');await assert.rejects(verifyMedia([p],tmp),/invalid or missing/);}finally{await rm(tmp,{recursive:true,force:true});}});
test('first-party scripts and styles stay inside transfer budgets',async()=>{for(const [name,budget] of [['collection.js',20000],['styles.css',30000]]){const bytes=await readFile(new URL('../src/'+name,import.meta.url));assert(gzipSync(bytes).length<budget,name);}const fonts=await Promise.all(['body','display'].map(n=>readFile(new URL('../public/fonts/'+n+'.woff2',import.meta.url))));assert(fonts.reduce((n,b)=>n+b.length,0)<180000);});
