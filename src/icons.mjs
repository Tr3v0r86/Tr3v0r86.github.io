import {readFileSync} from 'node:fs';
const projectIcons={turnkeep:'dices','reggio-projects':'sprout',padlano:'trophy','learning-and-making':'school','elc-portal':'panels-top-left',pomodoist:'timer','project-dashboard':'columns-3','esp32-experiments':'cpu','second-brain-builder':'brain',trips:'map',bodybrain:'activity','custom-media-databank':'images'};
const brands=['linkedin','substack','github'];
const sources=Object.fromEntries([...new Set([...Object.values(projectIcons),...brands])].map(name=>{
 const source=readFileSync(new URL(`./icon-sources/${name}.svg`,import.meta.url),'utf8');
 if(!source.includes('<svg')||/<script|<foreignObject|\bon\w+=|href=/i.test(source))throw Error('Unexpected icon source: '+name);
 const body=source.replace(/<!--[\s\S]*?-->/g,'').replace(/<title>[\s\S]*?<\/title>/g,'').match(/<svg[^>]*>([\s\S]*?)<\/svg>/)[1];
 return [name,body];
}));
function icon(name){return `<svg class="icon ${brands.includes(name)?'icon--brand':''}" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false" ${brands.includes(name)?'fill="currentColor"':'fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"'}>${sources[name]}</svg>`;}
export const projectIcon=slug=>projectIcons[slug]?icon(projectIcons[slug]):'';
export const socialIcon=href=>{let host;try{host=new URL(href).hostname;}catch{return '';}const name=host==='github.com'?'github':host==='www.linkedin.com'?'linkedin':host.endsWith('.substack.com')?'substack':null;return name?icon(name):'';};
