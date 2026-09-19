import sharp from 'sharp';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const [source,name]=process.argv.slice(2);
if(!source||!name||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)){console.error('Usage: node scripts/media.mjs <cleared-image-file> <kebab-name>');process.exit(1);}
const bytes=await readFile(source);const meta=await sharp(bytes).metadata();const variants=[];
for(const width of [...new Set([480,960,1600].map(w=>Math.min(w,meta.width)))]){const image=await sharp(bytes).resize({width,withoutEnlargement:true}).webp({quality:84}).toBuffer();const hash=createHash('sha256').update(image).digest('hex').slice(0,10);const file=`${name}-${width}-${hash}.webp`;await writeFile('public/media/'+file,image);variants.push({src:'/media/'+file,width,type:'image/webp'});}
const largest=variants.at(-1);console.log(JSON.stringify({src:largest.src,width:largest.width,height:Math.round(meta.height*largest.width/meta.width),variants,alt:'REPLACE with useful alternative text',caption:'REPLACE with a factual caption'},null,2));
