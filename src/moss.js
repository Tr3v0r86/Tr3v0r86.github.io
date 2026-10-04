const preview=document.querySelector('[data-moss-preview]');
if(preview){
 const data=JSON.parse(document.getElementById('moss-preview-data').textContent);
 const speciesSelect=preview.querySelector('[data-species]');
 const stageSelect=preview.querySelector('[data-stage]');
 const habitatSelect=preview.querySelector('[data-habitat]');
 const sprite=preview.querySelector('[data-preview-sprite]');
 const motion=preview.querySelector('[data-motion]');
 const chime=preview.querySelector('[data-chime]');
 const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
 let selected=data[0],stage=0,sessions=selected.thresholds[0],frame=0;
 let paused=reducedMotion.matches;
 let audioContext;
 const render=()=>{
  const form=selected.stages[stage];
  preview.querySelector('[data-preview-name]').textContent=selected.name;
  preview.querySelector('[data-preview-stage]').textContent=form.name;
  preview.querySelector('[data-preview-habitat]').src=habitatSelect.selectedOptions[0].dataset.src;
  sprite.src=form.frames[frame%form.frames.length];
  sprite.alt=`${selected.name} ${form.name}`;
  stageSelect.value=String(stage);
  preview.querySelector('[data-preview-status]').textContent=`${sessions} completed ${sessions===1?'session':'sessions'} · ${form.name}`;
  const start=selected.thresholds[stage],next=selected.thresholds[stage+1];
  preview.querySelector('[data-growth-fill]').style.width=next?`${((sessions-start)/(next-start))*100}%`:'100%';
  preview.querySelector('[data-next-stage]').textContent=next?`${next-sessions} more ${next-sessions===1?'session':'sessions'} to ${selected.stages[stage+1].name}.`:'Mature. The companion keeps you company as you focus.';
 };
 const renderMotion=()=>{
  preview.dataset.paused=String(paused);
  motion.textContent=paused?'Play sprite animation':'Pause sprite animation';
  if(paused){frame=0;sprite.src=selected.stages[stage].frames[0];}
 };
 speciesSelect.addEventListener('change',()=>{
  selected=data.find(s=>s.slug===speciesSelect.value);
  sessions=selected.thresholds[stage];frame=0;render();
 });
 habitatSelect.addEventListener('change',render);
 stageSelect.addEventListener('change',()=>{stage=Number(stageSelect.value);sessions=selected.thresholds[stage];frame=0;render();});
 preview.querySelector('[data-complete]').addEventListener('click',()=>{
  sessions++;
  if(stage<selected.stages.length-1&&sessions>=selected.thresholds[stage+1]){stage++;frame=0;}
  render();
 });
 motion.addEventListener('click',()=>{paused=!paused;renderMotion();});
 reducedMotion.addEventListener('change',event=>{paused=event.matches;renderMotion();});
 let onScreen=false;
 const observer=new IntersectionObserver(entries=>{onScreen=entries[0].isIntersecting;});observer.observe(preview);
 setInterval(()=>{
  if(paused||!onScreen||document.hidden)return;
  frame=(frame+1)%selected.stages[stage].frames.length;
  sprite.src=selected.stages[stage].frames[frame];
 },650);
 chime.addEventListener('click',async()=>{
  const status=preview.querySelector('[data-audio-status]');
  const AudioContext=window.AudioContext||window.webkitAudioContext;
  if(!AudioContext){status.textContent='Audio is unavailable in this browser.';return;}
  chime.disabled=true;
  try{
   audioContext??=new AudioContext();
   await audioContext.resume();
   const start=audioContext.currentTime;
   [784,988,1175].forEach((frequency,i)=>{
    const oscillator=audioContext.createOscillator();
    const gain=audioContext.createGain();
    oscillator.type='sine';oscillator.frequency.value=frequency;
    const at=start+i*.195;
    gain.gain.setValueAtTime(0,at);
    gain.gain.linearRampToValueAtTime(.09,at+.015);
    gain.gain.exponentialRampToValueAtTime(.001,at+.175);
    oscillator.connect(gain);gain.connect(audioContext.destination);
    oscillator.start(at);oscillator.stop(at+.18);
    oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
   });
   status.textContent='Playing a speaker approximation of the device’s completion chime.';
   setTimeout(()=>{chime.disabled=false;status.textContent='Three notes, then quiet.';audioContext.suspend().catch(()=>{});},750);
  }catch{
   chime.disabled=false;status.textContent='Audio could not start. Try the chime again.';
  }
 });
 preview.querySelector('.moss-enhancement').hidden=false;
 preview.querySelector('[data-preview-fallback]').hidden=true;
 render();renderMotion();
}
