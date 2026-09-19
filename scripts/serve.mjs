import http from 'node:http';
import path from 'node:path';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.xml':'application/xml','.txt':'text/plain'};
const port=Number(process.env.PORT||4173);
http.createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);let file=path.resolve(root,'.'+pathname);if(!file.startsWith(path.resolve(root)+path.sep)&&file!==path.resolve(root))throw Error('outside root');if((await stat(file)).isDirectory())file=path.join(file,'index.html');res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.statusCode=404;res.setHeader('Content-Type','text/html; charset=utf-8');res.end(await readFile(path.join(root,'404.html')));}}).listen(port,'127.0.0.1',()=>console.log(`Portfolio preview: http://127.0.0.1:${port}`));
