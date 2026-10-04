// Pocketframe v0.1: editable proportion study, millimetres. Not fit-verified.
// Run: node pocketframe.cjs [output-directory]
// Dependencies: @jscad/modeling and @jscad/stl-serializer.
const {primitives:P,booleans:B,transforms:T,measurements:M} = require('@jscad/modeling');
const fs=require('node:fs'), path=require('node:path'), assert=require('node:assert/strict');
const params={width:64,height:52,depth:32,wall:2,radius:3,lensX:-7,lensY:2,lensDiameter:12};
const move=(x,y,z,g)=>T.translate([x,y,z],g);
const box=(size,center=[0,0,0])=>P.cuboid({size,center});
const round=(size,center,r=2)=>P.roundedCuboid({size,center,roundRadius:r,segments:24});
const cyl=(r,h,center)=>P.cylinder({radius:r,height:h,center,segments:48});
function main(p=params){
 const w=p.width,h=p.height,d=p.depth-2,t=p.wall;
 const holes=[[-w/2+4.5,-h/2+4.5],[w/2-4.5,-h/2+4.5],[-w/2+4.5,h/2-4.5],[w/2-4.5,h/2-4.5]];
 let shell=B.subtract(round([w,h,d],[0,0,d/2],p.radius),round([w-2*t,h-2*t,d],[0,0,d/2-t],1));
 const bosses=holes.map(([x,y])=>cyl(3.5,d,[x,y,d/2]));
 const finder=B.subtract(round([19,14,22],[20,h/2+6,18],1.5),box([14,9,26],[20,h/2+6,18]));
 shell=B.union(shell,...bosses,finder);
 const shutterHole=move(-20,h/2,18,T.rotateX(Math.PI/2,P.cylinder({radius:3.2,height:8,segments:32})));
 shell=B.subtract(shell,cyl(p.lensDiameter/2,8,[p.lensX,p.lensY,d]),shutterHole,
  box([8,10,7],[-w/2,-14,8]), // USB clearance placeholder, verify connector location.
  box([8,18,3],[-w/2,5,12]), // SD access placeholder, verify card travel.
  ...holes.map(([x,y])=>cyl(1.2,d+4,[x,y,d/2])));
 const lid=B.subtract(round([w,h,2],[0,0,-1],.7),...holes.map(([x,y])=>cyl(1.5,5,[x,y,-1])));
 const shutter=move(-20,h/2+1.6,18,T.rotateX(Math.PI/2,P.cylinder({radius:4.5,height:3,segments:48})));
 const board=box([27,40,1.6],[p.lensX,0,23]);
 const dock=box([27,40,1.6],[p.lensX,0,7]);
 const headers=B.union(box([2.5,36,14],[p.lensX-11,0,15]),box([2.5,36,14],[p.lensX+11,0,15]));
 const lens=cyl(5.5,5,[p.lensX,p.lensY,d+1]);
 return [{name:'shell',geometry:shell,color:'#66754b',manufactured:true},{name:'rear-lid',geometry:lid,color:'#768260',manufactured:true},
 {name:'shutter-cap',geometry:shutter,color:'#0084da',manufactured:true},{name:'camera-board-envelope',geometry:board,color:'#285744'},
 {name:'mb-dock-envelope',geometry:dock,color:'#262b26'},{name:'header-envelope',geometry:headers,color:'#171d18'},
 {name:'lens-envelope',geometry:lens,color:'#121813'}];
}
function triangles(g){return g.polygons.flatMap(poly=>{const v=poly.vertices;return v.slice(1,-1).map((_,i)=>[v[0],v[i+1],v[i+2]]);});}
if(require.main===module){
 const out=process.argv[2]||__dirname;fs.mkdirSync(out,{recursive:true});const parts=main();
 const stl=require('@jscad/stl-serializer');
 for(const part of parts){assert(M.measureVolume(part.geometry)>0,part.name);assert(triangles(part.geometry).flat(2).every(Number.isFinite));
  if(part.manufactured)fs.writeFileSync(path.join(out,`pocketframe-${part.name}.stl`),Buffer.concat(stl.serialize({binary:true},part.geometry).map(x=>Buffer.from(x))));
 }
 const shellBounds=M.measureBoundingBox(parts[0].geometry);assert(Math.abs(shellBounds[1][0]-shellBounds[0][0]-params.width)<.001);
 fs.writeFileSync(path.join(out,'pocketframe-model.json'),JSON.stringify({units:'mm',status:'proportion study; not fit-verified',params,parts:parts.map(p=>({name:p.name,color:p.color,triangles:triangles(p.geometry),volume:M.measureVolume(p.geometry)}))}));
 console.log(JSON.stringify({parts:parts.length,shellBounds,volumes:parts.map(p=>[p.name,M.measureVolume(p.geometry)]),checks:'positive volumes, finite vertices, 64mm shell width'}));
}
module.exports={main,params};
