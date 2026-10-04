import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
const host=document.querySelector('#cad-stage');
try {
const scene=new THREE.Scene();scene.background=new THREE.Color('#e7ebdf');
const camera=new THREE.PerspectiveCamera(32,1,.1,1000);camera.position.set(100,70,135);
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;host.append(renderer.domElement);
renderer.domElement.setAttribute('aria-label','Rotatable Pocketframe enclosure model');renderer.domElement.setAttribute('role','img');
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,6,8);controls.enableDamping=false;controls.minDistance=85;controls.maxDistance=700;
scene.add(new THREE.HemisphereLight(0xffffff,0x777d6e,2.5));const key=new THREE.DirectionalLight(0xffffff,3.5);key.position.set(-60,100,100);key.castShadow=true;key.shadow.bias=-.0003;key.shadow.normalBias=.4;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-100;key.shadow.camera.right=100;key.shadow.camera.top=100;key.shadow.camera.bottom=-100;scene.add(key);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(600,600),new THREE.MeshStandardMaterial({color:'#e7ebdf',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-27;floor.receiveShadow=true;scene.add(floor);
const model=await fetch('cad/pocketframe-model.json').then(r=>{if(!r.ok)throw Error('Model could not be loaded');return r.json()});
const objects=[];for(const p of model.parts){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(p.triangles.flat(2),3));geometry.computeVertexNormals();const material=new THREE.MeshStandardMaterial({color:p.color,roughness:.8,metalness:0,side:THREE.DoubleSide});const mesh=new THREE.Mesh(geometry,material);mesh.name=p.name;mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);objects.push(mesh);}
function draw(){renderer.render(scene,camera)}
function size(){camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();renderer.setSize(host.clientWidth,host.clientHeight);draw()};new ResizeObserver(size).observe(host);controls.addEventListener('change',draw);
let view='assembled';function setView(value){view=value;for(const obj of objects){obj.position.set(0,0,0);obj.material.transparent=false;obj.material.opacity=1;
 if(value==='exploded'){if(obj.name==='rear-lid')obj.position.set(-65,0,-20);if(obj.name==='mb-dock-envelope')obj.position.z=-12;if(obj.name==='shutter-cap')obj.position.set(55,14,15);if(obj.name==='shell')obj.position.set(55,0,15);if(obj.name==='lens-envelope')obj.position.set(55,0,15);}
 if(value==='inside'&&obj.name==='shell'){obj.material.transparent=true;obj.material.opacity=.2;}
}camera.position.set(value==='exploded'?140:-100,80,value==='exploded'?420:135);controls.target.set(0,5,view==='exploded'?0:8);controls.update();document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===value)));document.querySelector('#cad-status').textContent=value==='exploded'?'Exploded view: shell, board envelopes, lid and shutter.':value==='inside'?'Transparent shell: board shapes indicate reserved space, not verified fit.':'Assembled study: 64 × 52 × 32 mm body, excluding lens and viewfinder.';draw();}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
document.querySelector('#reset-view').addEventListener('click',()=>setView(view));
window.pocketframeCad={ready:true,parts:objects.length,setView};size();controls.update();draw();
}catch(e){host.innerHTML='<img src="/media/pocketframe-assembled-736.webp" width="736" height="560" alt="Static assembled Pocketframe CAD study" style="width:100%;height:100%;object-fit:contain">';document.querySelector('#cad-status').textContent='Static CAD view. Interactive 3D is unavailable in this browser; editable files are below.';document.querySelectorAll('.cad-toolbar button').forEach(b=>b.disabled=true);document.querySelector('.cad-toolbar .hint').hidden=true;}
