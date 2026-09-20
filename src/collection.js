(() => {
  const collection = document.querySelector('.collection');
  const preview = document.querySelector('.preview');
  if (collection && preview) {
    const title = preview.querySelector('[data-preview-title]');
    const status = preview.querySelector('[data-preview-status]');
    const summary = preview.querySelector('[data-preview-summary]');
    const number = preview.querySelector('[data-preview-number]');
    const initial = {title:title.textContent,status:status.textContent,summary:summary.textContent};
    const data = new Map([...document.querySelectorAll('template[data-preview]')].map(t=>[t.dataset.preview,{title:t.content.querySelector('[data-title]').textContent,status:t.content.querySelector('[data-status]').textContent,summary:t.content.querySelector('[data-summary]').textContent}]));
    let focused=null,hovered=null;
    const update=()=>{const selected=focused||hovered;const d=data.get(selected)||initial;title.textContent=d.title;status.textContent=d.status;summary.textContent=d.summary;number.textContent=selected?document.querySelector(`template[data-preview="${selected}"]`).content.querySelector('[data-number]').textContent:'—';preview.dataset.selected=selected||'';collection.querySelectorAll('[data-project]').forEach(a=>a.classList.toggle('is-selected',a.dataset.project===selected));};
    collection.querySelectorAll('[data-project]').forEach(a=>{
      a.addEventListener('focus',()=>{focused=a.dataset.project;update();});
      a.addEventListener('blur',()=>{focused=null;update();});
      a.addEventListener('pointerenter',ev=>{if(ev.pointerType!=='touch'&&matchMedia('(hover:hover) and (pointer:fine)').matches){hovered=a.dataset.project;update();}});
      a.addEventListener('pointerleave',()=>{hovered=null;update();});
    });
    document.documentElement.classList.add('preview-ready');
  }
  const failed = img=>{img.classList.add('image-failed'); if(img.parentElement.querySelector('.image-fallback'))return; const label=document.createElement('span');label.className='image-fallback';label.textContent=img.alt;img.parentElement.append(label);};
  document.querySelectorAll('img').forEach(img=>{img.addEventListener('error',()=>failed(img));if(img.complete&&!img.naturalWidth)failed(img);});
})();
