(() => {
 const track=document.querySelector('.collection');
 if(track){
  const slides=[...track.querySelectorAll('.piece')],prev=document.querySelector('[data-prev]'),next=document.querySelector('[data-next]'),counter=document.querySelector('[data-carousel-count]'),picker=document.querySelector('.project-picker select');
  const reduced=matchMedia('(prefers-reduced-motion:reduce)');let current=0,frame=0,drag=null,dragged=false;
  const setCurrent=index=>{current=index;slides.forEach((slide,i)=>{slide.classList.toggle('is-active',i===index);const link=slide.querySelector('[data-project]');if(i===index)link.setAttribute('aria-current','true');else{link.removeAttribute('aria-current');slide.querySelector('details').open=false;}});counter.textContent=`${String(index+1).padStart(2,'0')} / ${String(slides.length).padStart(2,'0')}`;picker.value=String(index);prev.disabled=index===0;next.disabled=index===slides.length-1;};
  const position=index=>{const t=track.getBoundingClientRect(),s=slides[index].getBoundingClientRect();return track.scrollLeft+s.left+s.width/2-t.left-t.width/2;};
  const go=(index,instant=false)=>{index=Math.max(0,Math.min(slides.length-1,index));setCurrent(index);track.scrollTo({left:position(index),behavior:instant||reduced.matches?'instant':'smooth'});};
  const nearest=()=>{const t=track.getBoundingClientRect(),center=t.left+t.width/2;let closest=0,distance=Infinity;slides.forEach((s,i)=>{const r=s.getBoundingClientRect(),d=Math.abs(r.left+r.width/2-center);if(d<distance){distance=d;closest=i;}});return closest;};
  track.addEventListener('scroll',()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{const n=nearest();if(n!==current)setCurrent(n);});},{passive:true});
  prev.addEventListener('click',()=>go(current-1));next.addEventListener('click',()=>go(current+1));picker.addEventListener('change',()=>go(Number(picker.value)));
  track.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();go(e.key==='Home'?0:e.key==='End'?slides.length-1:current+(e.key==='ArrowRight'?1:-1));slides[current].querySelector('[data-project]').focus({preventScroll:true});}});
  track.addEventListener('focusin',e=>{const slide=e.target.closest('.piece');if(slide)go(slides.indexOf(slide),true);});
  track.addEventListener('toggle',e=>{if(e.target.matches('details')&&e.target.open)slides.forEach(s=>{const d=s.querySelector('details');if(d!==e.target)d.open=false;});},true);
  track.addEventListener('keydown',e=>{if(e.key==='Escape'){const opened=track.querySelector('details[open]');if(opened){opened.open=false;opened.querySelector('summary').focus();}}});
  // Native touch scrolling handles both axes. Mouse dragging is an enhancement only.
  track.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||e.button!==0||e.target.closest('summary,.slide-popover,.slide-actions'))return;drag={x:e.clientX,left:track.scrollLeft};dragged=false;});
  track.addEventListener('pointermove',e=>{if(!drag)return;const delta=e.clientX-drag.x;if(Math.abs(delta)>6){dragged=true;track.classList.add('is-dragging');track.setPointerCapture(e.pointerId);track.scrollLeft=drag.left-delta;}});
  const finish=e=>{if(!drag)return;drag=null;track.classList.remove('is-dragging');if(track.hasPointerCapture(e.pointerId))track.releasePointerCapture(e.pointerId);if(dragged)go(nearest());};
  track.addEventListener('pointerup',finish);track.addEventListener('pointercancel',finish);track.addEventListener('lostpointercapture',()=>{drag=null;track.classList.remove('is-dragging');});
  track.addEventListener('click',e=>{if(dragged){e.preventDefault();e.stopPropagation();dragged=false;}},true);track.addEventListener('dragstart',e=>e.preventDefault());
  new ResizeObserver(()=>go(current,true)).observe(track);
  document.documentElement.classList.add('carousel-ready');setCurrent(0);
 }
 const failed=img=>{img.classList.add('image-failed');if(img.parentElement.querySelector('.image-fallback'))return;const label=document.createElement('span');label.className='image-fallback';label.textContent=img.alt;img.parentElement.append(label);};
 document.querySelectorAll('img').forEach(img=>{img.addEventListener('error',()=>failed(img));if(img.complete&&!img.naturalWidth)failed(img);});
})();
