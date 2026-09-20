import sharp from 'sharp';
import {readFile,writeFile} from 'node:fs/promises';
const catalog=JSON.parse(await readFile('content/projects.json','utf8'));
for(const slug of ['second-brain-builder','trips','bodybrain']){
 const p=catalog.projects.find(p=>p.slug===slug);
 for(const state of ['app','detail'])for(const width of [480,960,1440])await sharp(`.local/${slug}-${state}.png`).resize({width}).webp({lossless:true}).toFile(`public/media/${slug}-${state}-v3-${width}.webp`);
 const media=(state,caption)=>({src:`/media/${slug}-${state}-v3-1440.webp`,width:1440,height:2850,alt:`${p.title} interactive interface concept: ${state==='app'?({trips:'island map, selectable stops and visit tracking',bodybrain:'training ring, weekly chart and check-in note','second-brain-builder':'workspace file tree, file preview and blueprint controls'})[slug]:'secondary app view with fictional sample content'}.`,caption,variants:[480,960,1440].map(width=>({src:`/media/${slug}-${state}-v3-${width}.webp`,width,type:'image/webp'}))});
 p.cover=media('app','Interactive interface concept · fictional data');p.collectionCover=structuredClone(p.cover);
 p.gallery=p.gallery.filter(m=>!m.src.endsWith('-v2.svg'));
 p.gallery.unshift(media('detail',slug==='trips'?'Packing checklist · interactive concept':slug==='bodybrain'?'Data source view · concept, no accounts connected':'Generated blueprint · downloadable sample'));
 p.links=p.links.filter(l=>!l.href.startsWith('/prototypes/'));p.links.unshift({label:'Try the interface concept',href:`/prototypes/${slug}/`});
}
await writeFile('content/projects.json',JSON.stringify(catalog,null,2)+'\n');
