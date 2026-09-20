const origin='https://trevorcardozo.com';
const personId=origin+'/#person';
const websiteId=origin+'/#website';
const descriptions={
 '/about/':'Meet Trevor Cardozo: trained alternative educator, professional school operator, hobbyist maker and amateur designer based in Bangkok.',
 '/work/bodybrain/':'Bodybrain by Trevor Cardozo connects training, nutrition, recovery and bloodwork. An active personal data project developing into a coaching platform.',
 '/work/custom-media-databank/':'Custom Media Databank by Trevor Cardozo turns learning publications into a searchable editorial media library, with source context, quality checks and human review.',
 '/':'Trevor Cardozo: trained alternative educator, professional school operator, hobbyist maker and amateur designer in Bangkok. Explore the work.',
 '/work/reggio-projects/':'Children are makers. 15 years of Reggio-inspired projects in Bangkok, supported by Trevor Cardozo: time, trust and expertise to design, make and publish.',
 '/work/learning-and-making/':'An alternative middle school and community maker-space concept by Trevor Cardozo, with woodshop and fablab visualisations. A learning model in development.',
 '/work/turnkeep/':'Turnkeep by Trevor Cardozo: a printed tabletop character case with a digital companion. Explore the physical prototype, editable CAD, firmware and build files.',
 '/work/padlano/':'Padlano by Trevor Cardozo: a live padel app for Americano rotations, scoring and shared leagues, alongside sketches for a physical scoring companion.',
 '/work/elc-portal/':'Parent Portal by Trevor Cardozo brings school activities, events, calendars and registration links into one family-facing website.',
 '/work/pomodoist/':'Pomodoist by Trevor Cardozo puts Todoist tasks and a Pomodoro timer on a small ESP32 desk device. See the physical prototype and interface designs.',
 '/work/project-dashboard/':'A single-file project-management dashboard by Trevor Cardozo, with priorities, progress and weekly notes. Explore the public demo and adaptable source.',
 '/work/esp32-experiments/':'TrevOS and ESP32 experiments by Trevor Cardozo: shared software for timers, scoreboards and desk displays, from notebook sketches to hardware prototypes.',
 '/work/second-brain-builder/':'Second Brain Builder by Trevor Cardozo: personalised questions that produce a plain-text blueprint for an AI-assisted knowledge and planning workspace.',
 '/work/trips/':'Trips by Trevor Cardozo: small custom apps for friends and loved ones, with shared day-trip guides, stories, checklists and offline access.'
};
export function searchMetadata({title,description,path,cover}){
 if(path==='/')title='Trevor Cardozo | Alternative Educator & School Operator, Bangkok';
 if(path==='/work/reggio-projects/')title='Reggio-inspired Projects in Bangkok | Trevor Cardozo';
 if(path==='/work/learning-and-making/')title='Alternative School & Maker Space Concept | Trevor Cardozo';
 description=descriptions[path]||description;
 if(path==='/404.html')return {title,description,robots:'noindex, follow',jsonLd:''};
 const page={'@type':path==='/'?'ProfilePage':'WebPage','@id':origin+path+'#page',url:origin+path,name:title,description,inLanguage:'en',isPartOf:{'@id':websiteId},author:{'@id':personId}};
 if(cover)page.primaryImageOfPage={'@type':'ImageObject',contentUrl:origin+cover.src,width:cover.width,height:cover.height,caption:cover.caption||cover.alt};
 const graph=[page];
 if(path==='/'){
  page.mainEntity={'@id':personId};
  graph.push({'@type':'Person','@id':personId,name:'Trevor Cardozo',url:origin+'/',jobTitle:'School operator',description:'Trained alternative educator, professional school operator, hobbyist maker and amateur designer based in Bangkok.',homeLocation:{'@type':'Place',name:'Bangkok, Thailand'},sameAs:['https://www.linkedin.com/in/tcardozo/','https://trevorcardozo.substack.com/','https://github.com/Tr3v0r86']});
  graph.push({'@type':'WebSite','@id':websiteId,url:origin+'/',name:'Trevor Cardozo',publisher:{'@id':personId},inLanguage:'en'});
 }else{
  const breadcrumbId=origin+path+'#breadcrumb';page.breadcrumb={'@id':breadcrumbId};
  graph.push({'@type':'BreadcrumbList','@id':breadcrumbId,itemListElement:[{'@type':'ListItem',position:1,name:'Trevor Cardozo',item:origin+'/'},{'@type':'ListItem',position:2,name:title.split(/ — | \| /)[0],item:origin+path}]});
 }
 // Raw script contents need JSON escaping, not HTML-entity escaping.
 const jsonLd=JSON.stringify({'@context':'https://schema.org','@graph':graph}).replace(/</g,'\\u003c');
 return {title,description,robots:'index, follow, max-image-preview:large',jsonLd};
}
