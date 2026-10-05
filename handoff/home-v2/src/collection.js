// trevorcardozo.com · home v2 filmstrip. Drop-in replacement for src/collection.js.
// Same hooks as v1: .collection, .piece, [data-project], [data-prev], [data-next],
// [data-carousel-count], .project-picker select. New optional hook: .carousel-progress i.
(() => {
 const track=document.querySelector('.collection');
 if(track){
  const slides=[...track.querySelectorAll('.piece')],N=slides.length,prev=document.querySelector('[data-prev]'),next=document.querySelector('[data-next]'),counter=document.querySelector('[data-carousel-count]'),picker=document.querySelector('.project-picker select'),bar=document.querySelector('.carousel-progress i');
  const reduced=matchMedia('(prefers-reduced-motion:reduce)'),pad=n=>String(n).padStart(2,'0');let current=0,frame=0,drag=null,dragged=false;
  const set=i=>{current=i;slides.forEach((s,k)=>{s.classList.toggle('is-active',k===i);s.classList.toggle('is-past',k<i);const a=s.querySelector('[data-project]');if(k===i)a.setAttribute('aria-current','true');else a.removeAttribute('aria-current');});
   counter.innerHTML=`${pad(i+1)}<span> / ${pad(N)}</span>`;if(picker)picker.value=String(i);prev.disabled=i===0;next.disabled=i===N-1;if(bar)bar.style.width=`${(i+1)/N*100}%`;};
  const pos=i=>slides[i].offsetLeft-track.offsetLeft-(parseFloat(getComputedStyle(track).scrollPaddingLeft)||0);
  const go=(i,instant=false)=>{i=Math.max(0,Math.min(N-1,i));set(i);track.scrollTo({left:pos(i),behavior:instant||reduced.matches?'instant':'smooth'});};
  const nearest=()=>{const x=track.scrollLeft;let best=0,d=Infinity;slides.forEach((s,k)=>{const dd=Math.abs(pos(k)-x);if(dd<d){d=dd;best=k;}});return best;};
  track.addEventListener('scroll',()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{const n=nearest();if(n!==current)set(n);});},{passive:true});
  prev.addEventListener('click',()=>go(current-1));next.addEventListener('click',()=>go(current+1));
  if(picker)picker.addEventListener('change',()=>go(Number(picker.value)));
  track.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();go(e.key==='Home'?0:e.key==='End'?N-1:current+(e.key==='ArrowRight'?1:-1));slides[current].querySelector('[data-project]').focus({preventScroll:true});}});
  track.addEventListener('focusin',e=>{const s=e.target.closest('.piece');if(s)go(slides.indexOf(s),true);});
  // Native touch scrolling handles both axes. Mouse dragging is an enhancement only.
  track.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||e.button!==0)return;drag={x:e.clientX,left:track.scrollLeft};dragged=false;});
  track.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x;if(Math.abs(dx)>6){dragged=true;track.classList.add('is-dragging');track.setPointerCapture(e.pointerId);track.scrollLeft=drag.left-dx;}});
  const finish=e=>{if(!drag)return;drag=null;track.classList.remove('is-dragging');if(track.hasPointerCapture(e.pointerId))track.releasePointerCapture(e.pointerId);if(dragged)go(nearest());};
  track.addEventListener('pointerup',finish);track.addEventListener('pointercancel',finish);track.addEventListener('lostpointercapture',()=>{drag=null;track.classList.remove('is-dragging');});
  track.addEventListener('click',e=>{if(dragged){e.preventDefault();e.stopPropagation();dragged=false;}},true);track.addEventListener('dragstart',e=>e.preventDefault());
  new ResizeObserver(()=>go(current,true)).observe(track);
  document.documentElement.classList.add('carousel-ready');set(0);
 }
 const failed=img=>{img.classList.add('image-failed');if(img.parentElement.querySelector('.image-fallback'))return;const label=document.createElement('span');label.className='image-fallback';label.textContent=img.alt;img.parentElement.append(label);};
 document.querySelectorAll('img').forEach(img=>{img.addEventListener('error',()=>failed(img));if(img.complete&&!img.naturalWidth)failed(img);});
 if(!matchMedia('(prefers-reduced-motion:reduce)').matches&&'IntersectionObserver' in window){const io=new IntersectionObserver(es=>es.forEach(en=>en.isIntersecting?en.target.play().catch(()=>{}):en.target.pause()),{threshold:.5});document.querySelectorAll('.gallery-image video').forEach(v=>io.observe(v));}
})();
