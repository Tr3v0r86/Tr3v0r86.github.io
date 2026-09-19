import {readFile,writeFile,mkdir,cp,rm,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {renderHome,renderCase,render404,escape} from '../src/templates.mjs';
export const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const statuses=new Set(['Live web app','Live school platform','Open-source prototype','Educational practice','In development','Hardware/software prototype','Public source','Ongoing experiments']);
function fail(context,message){throw new Error(`${context}: ${message}`);}
const str=(value,context)=>{if(typeof value!=='string'||!value.trim())fail(context,'must be a non-empty string');};
const keys=(value,allowed,context)=>{for(const key of Object.keys(value))if(!allowed.includes(key))fail(context+'.'+key,'unknown/private field must not enter public catalog');};
export function safeURL(value){
 if(typeof value!=='string'||/[\s\\<>"\x00-\x1f]/.test(value))return false;
 if(value.startsWith('/')&&!value.startsWith('//'))return !value.includes('..')&&!/%2e|%2f|%5c/i.test(value);
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}
}
export function validateCatalog(catalog){
 if(!catalog||!Array.isArray(catalog.projects)||!catalog.projects.length)fail('catalog','projects must be a non-empty array');
 if(!Array.isArray(catalog.expectedSlugs)||!catalog.expectedSlugs.length)fail('catalog','expectedSlugs release manifest is required');
 keys(catalog,['site','expectedSlugs','projects'],'catalog');
 if(catalog.site?.name!=='Trevor Cardozo'||catalog.site?.origin!=='https://trevorcardozo.com')fail('site','name and origin must match the portfolio');
 keys(catalog.site,['name','origin'],'site');
 const ids=new Set(),orders=new Set();
 const link=(l,ctx)=>{str(l?.label,ctx+'.label');if(!safeURL(l.href))fail(ctx+'.href','use a safe root path or HTTPS URL');keys(l,['label','href'],ctx);};
 const asset=(src,ctx)=>{if(typeof src!=='string'||!/^\/media\/[a-zA-Z0-9][a-zA-Z0-9._-]*\.(webp|avif|png|jpg|svg)$/.test(src)||src.includes('..'))fail(ctx,'use a file directly inside public/media');};
 const media=(m,ctx)=>{
   if(!m||typeof m!=='object')fail(ctx,'media record required');asset(m.src,ctx+'.src');str(m.alt,ctx+'.alt');
   keys(m,['src','width','height','alt','caption','layout','credit','textEquivalent','accessibleLink','variants'],ctx);
   for(const dimension of ['width','height'])if(!Number.isSafeInteger(m[dimension])||m[dimension]<1||m[dimension]>20000)fail(ctx+'.'+dimension,'positive dimensions required');
   if(m.caption!==undefined){str(m.caption,ctx+'.caption');if(m.caption.trim().split(/\s+/).length>12)fail(ctx+'.caption','maximum 12 words');}
   if(m.layout&&!['wide','pair','detail'].includes(m.layout))fail(ctx+'.layout','unknown layout');
   if(m.credit){str(m.credit.text,ctx+'.credit');if(m.credit.url&&!safeURL(m.credit.url))fail(ctx+'.credit.url','unsafe URL');keys(m.credit,['text','url'],ctx+'.credit');}
   if(m.textEquivalent!==undefined)str(m.textEquivalent,ctx+'.textEquivalent');
   if(m.accessibleLink)link(m.accessibleLink,ctx+'.accessibleLink');
   if(m.variants!==undefined){if(!Array.isArray(m.variants)||!m.variants.length)fail(ctx+'.variants','non-empty array required');const widths=new Set();for(const v of m.variants){asset(v.src,ctx+'.variant.src');if(!Number.isSafeInteger(v.width)||v.width<1||widths.has(v.width))fail(ctx+'.variant.width','positive unique widths required');widths.add(v.width);if(!['image/webp','image/avif','image/png','image/jpeg'].includes(v.type))fail(ctx+'.variant.type','supported image MIME required');}}
 };
 for(const p of catalog.projects){
  const ctx=p?.slug||'project';if(typeof p?.slug!=='string'||! /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug)||ids.has(p.slug))fail(ctx,'slug must be safe and unique');ids.add(p.slug);
  if(!Number.isSafeInteger(p.order)||p.order<1||orders.has(p.order))fail(ctx,'order must be positive and unique');orders.add(p.order);
  for(const key of ['title','descriptor','role','summary'])str(p[key],ctx+'.'+key);
  if(!statuses.has(p.status))fail(ctx+'.status','unknown status');
  if(typeof p.featured!=='boolean')fail(ctx+'.featured','boolean required');
  if(p.dateLabel!==undefined)str(p.dateLabel,ctx+'.dateLabel');
  if(p.summary.trim().split(/\s+/).length>90||/[\r\n]/.test(p.summary))fail(ctx+'.summary','one paragraph, maximum 90 words');
  if(!Array.isArray(p.gallery)||!p.gallery.length)fail(ctx+'.gallery','at least one distinct additional view required');
  media(p.cover,ctx+'.cover');p.gallery.forEach((m,i)=>media(m,ctx+'.gallery['+i+']'));
  if(new Set([p.cover.src,...p.gallery.map(m=>m.src)]).size<2)fail(ctx+'.gallery','must contain a distinct view');
  if(!Array.isArray(p.links))fail(ctx+'.links','array required');p.links.forEach((l,i)=>link(l,ctx+'.links['+i+']'));
  const allowed=new Set(['slug','title','descriptor','status','role','order','featured','summary','cover','gallery','links','dateLabel']);for(const k of Object.keys(p))if(!allowed.has(k))fail(ctx+'.'+k,'unknown/private field must not enter public catalog');
  if(p.slug==='learning-and-making'&&(p.dateLabel||p.links.length||/\belc\b|tauquil|payal|bangkok|elc\.ac\.th/i.test(JSON.stringify(p))))fail(ctx,'school case must remain anonymous and undated');
 }
 if(catalog.expectedSlugs.length!==ids.size||catalog.expectedSlugs.some(id=>!ids.has(id)))fail('catalog','release slug manifest differs from projects');
 if(!catalog.projects.some(p=>p.featured))fail('catalog','at least one featured project required');
 return [...catalog.projects].sort((a,b)=>a.order-b.order);
}
export async function verifyMedia(projects,publicDir=path.join(root,'public')){
 const seen=new Set();for(const p of projects)for(const m of [p.cover,...p.gallery])for(const item of [{src:m.src,width:m.width,height:m.height},...(m.variants||[])]){
  const key=item.src+':'+item.width;if(seen.has(key))continue;seen.add(key);const file=path.join(publicDir,item.src.slice(1));
  try{const meta=await sharp(file).metadata();await sharp(file).raw().toBuffer();if(meta.width!==item.width||(item.height&&meta.height!==item.height))fail(p.slug,item.src+' dimensions disagree with image');}catch(err){fail(p.slug,item.src+' invalid or missing media: '+err.message);}
 }
}
export async function build(){
 let catalog;try{catalog=JSON.parse(await readFile(path.join(root,'content/projects.json'),'utf8'));}catch(err){fail('catalog','cannot read/parse content/projects.json: '+err.message);}
 const projects=validateCatalog(catalog);await verifyMedia(projects);
 const publicDir=path.join(root,'public');if((await readFile(path.join(publicDir,'CNAME'),'utf8')).trim()!=='trevorcardozo.com')fail('CNAME','must remain trevorcardozo.com');
 if((await readdir(publicDir)).includes('turnkeep'))fail('public','must not shadow the existing Turnkeep project');
 const dest=path.join(root,'dist');await rm(dest,{recursive:true,force:true});await mkdir(dest,{recursive:true});await cp(publicDir,dest,{recursive:true});await mkdir(path.join(dest,'assets'),{recursive:true});
 for(const f of ['styles.css','collection.js'])await cp(path.join(root,'src',f),path.join(dest,'assets',f));
 await writeFile(path.join(dest,'index.html'),renderHome(projects));await writeFile(path.join(dest,'404.html'),render404());
 for(const p of projects){const dir=path.join(dest,'work',p.slug);await mkdir(dir,{recursive:true});await writeFile(path.join(dir,'index.html'),renderCase(p,projects));}
 await writeFile(path.join(dest,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['/',...projects.map(p=>'/work/'+p.slug+'/')].map(p=>`<url><loc>https://trevorcardozo.com${escape(p)}</loc></url>`).join('')}</urlset>`);
 await writeFile(path.join(dest,'robots.txt'),'User-agent: *\nAllow: /\nSitemap: https://trevorcardozo.com/sitemap.xml\n');await writeFile(path.join(dest,'.nojekyll'),'');
 const allowed=new Set(['media','fonts','assets','work','index.html','404.html','favicon.svg','CNAME','robots.txt','sitemap.xml','.nojekyll']);for(const name of await readdir(dest))if(!allowed.has(name))fail('artifact','unapproved output '+name);
 console.log(`Built ${projects.length} cases. Media decoded, content validated, Turnkeep route preserved.`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))build().catch(err=>{console.error(err.message);process.exitCode=1;});
