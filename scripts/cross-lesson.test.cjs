// Integrated application event regression. This is a DOM model, not a browser,
// screenshot, layout, native history, or OS/browser zoom acceptance test.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const cases=[
 {lesson:14,id:'g-irregular',query:'不规则',section:'verbs',sharedVerb:true},
 {lesson:20,id:'g-dernier',query:'dernier',section:'dernier'},
 {lesson:21,id:'g-coi-imperative',query:'间接宾语',section:'coi'}
];

function session(hash='#route',saved={}){
 const elements=new Map(),events=new Map(),frames=new Map();let serial=0,c;
 const local=new Map(saved.local||[]),storage=new Map(saved.storage||[]);
 function element(id){
  if(elements.has(id))return elements.get(id);
  let html='';const classes=new Set();
  const e={hidden:false,value:'',textContent:'',scrollTop:0,clientWidth:1600,clientHeight:900,style:{setProperty(){}},attributes:{},folds:[],isConnected:true,
   classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle(x,on){const yes=on??!classes.has(x);yes?classes.add(x):classes.delete(x);return yes;}},
   focus(){},contains(){return false;},setAttribute(k,v){this.attributes[k]=v;},removeAttribute(k){delete this.attributes[k];},getAttribute(k){return this.attributes[k]??null;},
   getBoundingClientRect(){return {left:0,top:0,x:0,y:0,right:1600,bottom:900,width:1600,height:900};},scrollIntoView(){c.scrollY=1000;},setPointerCapture(){},
   querySelector(q){if(q==='.map-chapters')return html.includes('map-chapters')?element('chapters'):null;return element(q);},
   querySelectorAll(q){return q==='details'?this.folds:[];},
   insertAdjacentHTML(_,v){this.innerHTML=v+this.innerHTML;},
   addEventListener(name,fn,options={}){const key=id+':'+name;if(!events.has(key))events.set(key,[]);events.get(key).push({fn,signal:options.signal});}
  };
  Object.defineProperty(e,'innerHTML',{get:()=>html,set:v=>{html=v;e.folds=Array.from({length:[...v.matchAll(/<details(?:\s|>)/g)].length},()=>({open:false}));}});
  elements.set(id,e);return e;
 }
 c=vm.createContext({URLSearchParams,URL,Blob,AbortController,console,location:{hash},scrollY:0,
  document:{documentElement:{dataset:{}},body:element('body'),getElementById:element,querySelector:()=>element('skip'),createElement:()=>({click(){}})},
  localStorage:{getItem:k=>local.get(k)??null,setItem:(k,v)=>local.set(k,v)},
  sessionStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},
  requestAnimationFrame:fn=>{frames.set(++serial,fn);return serial;},cancelAnimationFrame:id=>frames.delete(id),
  setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},ResizeObserver:class{observe(){}disconnect(){}},
  fetch:async()=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(root,'data/draws.json'),'utf8'))}),confirm:()=>true,
  FormData:class{constructor(form){this.form=form;}get(){return this.form.answer;}},
  history:{state:null,replaceState(_,__,h){c.location.hash=h;}}
 });c.window=c;c.addEventListener=(...args)=>element('window').addEventListener(...args);c.scrollTo=(_,y)=>{c.scrollY=y;};
 for(const file of ['content.js','course.js','lesson14.js','skill-tree-data.js','grammar-data.js','verb-data.js','verb-knowledge.js','knowledge-map.js','skill-tree.js','app.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c,{filename:file});
 const fire=(id,event,data={})=>(events.get(id+':'+event)||[]).forEach(({fn,signal})=>{if(!signal?.aborted)fn(data);});
 const flush=()=>{while(frames.size){const [id,fn]=frames.entries().next().value;frames.delete(id);fn();}};
 const go=h=>{const oldURL='https://example.test/bonjour-francais/'+c.location.hash;c.location.hash=h;fire('window','hashchange',{oldURL});flush();};
 flush();
 return {c,el:element,fire,flush,go,state:()=>vm.runInContext('state',c),snapshot:()=>({local:[...local],storage:[...storage]}),
  map:action=>fire('knowledge-map','click',{target:{closest:()=>({dataset:{map:action}})}}),
  level:level=>fire('skill-tree','click',{target:{closest:q=>q==='[data-st-level]'?{dataset:{stLevel:String(level)}}:null}}),
  change(id,value){element('#'+id).value=value;fire('knowledge-map','change',{target:{id,value,matches:()=>false}});},
  saveReading:()=>fire('window','pagehide')};
}

for(const sample of cases)test(`lesson ${sample.lesson}: atlas, standards, actual sources, independent writes and cached round trip`,()=>{
 const {lesson:n,id,query,section}=sample,unit=Math.ceil(n/4),a=session('#map/A1/'+unit),map=a.c.KNOWLEDGE_MAP;
 a.map('lesson:'+n);assert.match(a.el('#map-detail').innerHTML,new RegExp('第 '+n+' 课'));
 a.map('atlas-lesson:'+n);a.change('map-atlas-category','grammar');
 a.el('#map-atlas-search').value=query;a.fire('knowledge-map','input',{target:{id:'map-atlas-search'}});
 const atlas=a.el('#map-atlas-results').innerHTML;assert.ok(atlas.includes('/'+id+'"'));
 assert.equal(a.el('#map-atlas-unit').value,String(unit));assert.equal(a.el('#map-atlas-lesson').value,String(n));
 a.el('#map-panel').scrollTop=460;
 a.go('#skills/all/all/'+id+'?view=list&group=all&unit='+unit+'&lesson='+n+'&q='+encodeURIComponent(query));
 assert.ok(a.el('#st-detail-body').innerHTML.includes('什么时候算掌握'));
 assert.ok(a.el('#st-detail-body').innerHTML.includes('#lesson/'+n+'/'+section));
 assert.ok(a.el('#st-detail-body').innerHTML.includes('#lesson/'+n+'/practice'));
 assert.equal(a.el('#st-detail-body').innerHTML.includes('vk-skill-preview'),!!sample.sharedVerb);
 assert.equal(a.el('#st-detail-body').innerHTML.includes('st-shared-grammar'),false,'These selected skills have no grammar pilot text');
 const skillHash=a.c.location.hash;a.el('#st-stage').scrollTop=320;a.el('#st-detail').scrollTop=580;
 a.go('#lesson/'+n+'/'+section);assert.ok(a.el('page-content').innerHTML.includes('lesson'+n+'-'+section));
 if(n===14){assert.ok(a.el('page-content').innerHTML.includes('本课共享变位'));assert.ok(a.c.VERB_KNOWLEDGE.filter(a.c.VERB_KNOWLEDGE.route('#verbs/list?lesson=14')).length===4);}
 a.go('#lesson/'+n+'/practice');assert.ok(a.el('page-content').innerHTML.includes('参考答案'));
 const question=vm.runInContext('questions',a.c).find(q=>q.lesson===n),feedback={};
 const form={dataset:{question:question.id},answer:String(question.answer),querySelector:()=>feedback};
 a.fire('page-content','submit',{target:{closest:()=>form},preventDefault(){}});
 assert.equal(a.state().attempts[question.id],true);assert.deepEqual(Array.from(a.state().completed),[]);assert.equal(Object.keys(a.state().skillMastery).length,0);
 a.fire('page-content','input',{target:{id:'',dataset:{note:'lesson-'+n},value:'ACCEPT-02 synthetic note'}});
 const fold=a.el('page-content').folds[0];assert.ok(fold);fold.open=true;a.c.scrollY=7200;a.saveReading();
 a.go(skillHash);assert.equal(a.el('#st-stage').scrollTop,320);assert.equal(a.el('#st-detail').scrollTop,580);
 a.go('#lesson/'+n+'/practice');assert.equal(a.el('page-content').folds[0].open,true);assert.equal(a.c.scrollY,7200);
 const reload=session(a.c.location.hash,a.snapshot());assert.equal(reload.el('page-content').folds[0].open,true);assert.equal(reload.c.scrollY,7200);
 a.go(skillHash);a.level(1);assert.equal(a.state().skillMastery[id].level,1);assert.deepEqual(Array.from(a.state().completed),[]);assert.equal(Object.keys(a.state().knowledgeMastery).length,0);
 assert.ok(a.el('#st-board').innerHTML.includes('已接触'));assert.match(a.el('#st-stats').innerHTML,/<strong>1<\/strong><span>接触过/);assert.equal(a.c.SKILL_TREE.summary([a.c.FRENCH_SKILLS.nodes.find(x=>x.id===id)],a.state().skillMastery).touched,1);
 a.go(map.resumeHref());assert.equal(a.el('#map-atlas-search').value,query);assert.equal(a.el('#map-atlas-lesson').value,String(n));assert.equal(a.el('#map-panel').scrollTop,460);assert.ok(a.el('#map-atlas-results').innerHTML.includes('已接触'));
 a.map('lesson:'+n);a.map('complete:'+n);assert.equal(a.state().completed.includes(n),true);assert.equal(a.state().skillMastery[id].level,1);assert.equal(Object.keys(a.state().knowledgeMastery).length,0);
 const chapter=n+':'+section;a.fire('knowledge-map','change',{target:{id:'',value:'2',dataset:{mapMastery:chapter},matches:q=>q==='[data-map-mastery]'}});
 assert.equal(a.state().knowledgeMastery[chapter].level,2);assert.equal(a.state().skillMastery[id].level,1);assert.equal(a.state().completed.includes(n),true);
 a.map('atlas-lesson:'+n);a.change('map-atlas-category','grammar');a.el('#map-atlas-search').value='accept02-no-match';a.fire('knowledge-map','input',{target:{id:'map-atlas-search'}});assert.ok(a.el('#map-atlas-results').innerHTML.includes('没有匹配结果'));a.map('atlas-clear');assert.equal(a.el('#map-atlas-lesson').value,'0');assert.equal(a.el('#map-atlas-category').value,'');assert.equal(a.el('#map-atlas-search').value,'');
 assert.equal(a.state().notes['lesson-'+n],'ACCEPT-02 synthetic note');assert.equal(a.state().attempts[question.id],true);
});

test('shared grammar remains a limited pilot when checking lesson 20 agreement and lesson 21 negation',()=>{
 const a=session();
 for(const [id,n] of [['g-agreement',20],['g-negative',21]]){
  const node=a.c.FRENCH_SKILLS.nodes.find(x=>x.id===id);assert.ok(node.refs.some(r=>r.lesson===n));
  const preview=a.c.SKILL_TREE.grammarPreview(id);assert.ok(preview.includes('核心规则'));assert.ok(!preview.includes(`第 ${n} 课 ·`));
  const record=a.c.FRENCH_GRAMMAR.records.find(r=>r.id===id);assert.ok(record.blocks.every(b=>b.lesson<=16));
 }
});
