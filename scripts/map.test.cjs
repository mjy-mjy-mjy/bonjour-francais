const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
function data(){const c=vm.createContext({});c.window=c;for(const file of ['content.js','course.js','lesson14.js','knowledge-map.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);const catalog=c.COURSE_LIBRARY.catalog;return {c,catalog,courses:new Map([...c.COURSE_LIBRARY.lessons,{...catalog.find(l=>l.number===14),...c.LESSON14_CONTENT}].map(l=>[l.number,l]))};}
test('map covers the real 9 units and all 36 lessons without treating missing content as available',()=>{
 const {c,catalog,courses}=data();const model=c.KNOWLEDGE_MAP.unitsModel(c.COURSE_CONTENT.units,catalog,courses,{completed:[1,14,36]});
 assert.equal(model.length,9);const lessons=model.flatMap(u=>u.lessons);assert.equal(lessons.length,36);assert.equal(new Set(lessons.map(l=>l.number)).size,36);
 assert.equal(lessons.filter(l=>l.available).length,21);assert.equal(lessons[13].title,'À Londres');assert.equal(lessons[35].available,false);assert.equal(lessons[35].completed,true);
});
test('knowledge atlas deep links reach original sections and topic IDs are stable and unique',()=>{
 const {c,courses}=data();const entries=c.KNOWLEDGE_MAP.knowledgeEntries(courses);assert.ok(entries.length>100);assert.equal(entries.length,new Set(entries.map(e=>e.id)).size);
 for(const e of entries){assert.ok(courses.get(e.lesson).sections.some(s=>s.id===e.section));assert.equal(e.href,`#lesson/${e.lesson}/${e.section}`);assert.match(e.id,/^(?:[1-9]|[12][0-9]|3[0-6]):[a-z0-9-]+$/);}
 assert.ok(entries.some(e=>e.id==='19:y'&&e.categories.includes('grammar')));
});
test('map HTML is keyboard discoverable, has an asset fallback and starts without invented progress',()=>{
 const {c}=data();const html=c.KNOWLEDGE_MAP.render();assert.match(html,/tabindex="0"/);assert.match(html,/map-load-error/);assert.match(html,/知识图鉴/);assert.doesNotMatch(html,/已完成\d+%/);assert.ok(fs.existsSync(path.join(root,'assets/knowledge-continent.webp')));
});
test('viewport bounds retain a visible map after extreme pan and center undersized artwork',()=>{
 const {c}=data(),clamp=c.KNOWLEDGE_MAP.constrainView;
 for(const [width,height,scale] of [[1363,710,1],[390,300,.4],[320,220,.1]])for(const x of [-1e6,1e6])for(const y of [-1e6,1e6]){
   const v=clamp({x,y,scale},width,height),w=2048*scale,h=1152*scale;
   if(w<=width)assert.equal(v.x,(width-w)/2);else{assert.ok(v.x<=0);assert.ok(v.x+w>=width);}
   if(h<=height)assert.equal(v.y,(height-h)/2);else{assert.ok(v.y<=0);assert.ok(v.y+h>=height);}
 }
});
test('fractional, nonnumeric and out-of-range unit links use a valid fallback',()=>{
 const {c}=data(),unit=c.KNOWLEDGE_MAP.unitNumber;
 for(const bad of ['1.5','bogus','0','-1','99',undefined])assert.equal(unit(bad,4),4);
 assert.equal(unit('9',4),9);
});

// Exercise mount/navigation with deterministic DOM events; these are not visual browser checks.
function mounted(savedSession,storageFails=false){
 const elements=new Map(),frames=new Map(),storage={value:savedSession},handlers={};let nextFrame=0;
 function el(id){if(elements.has(id))return elements.get(id);const x={id,hidden:false,scrollTop:0,value:'',open:false,clientWidth:1200,clientHeight:700,innerHTML:'',style:{setProperty(){}},classList:{toggle(){}},focus(){},contains(){return false;},isConnected:true,
  addEventListener(t,fn,options={}){const wrapper=e=>{if(!options.signal?.aborted)fn(e);};(handlers[id+':'+t]??=[]).push(wrapper);},querySelector(q){if(q==='.map-chapters')return this.innerHTML.includes('map-chapters')?el('chapters'):null;return el(q);},getBoundingClientRect(){return {left:0,top:0};},setPointerCapture(){}};elements.set(id,x);return x;}
 const c=vm.createContext({console,AbortController,location:{hash:'#map'},document:{getElementById:()=>el('root'),activeElement:null},sessionStorage:{getItem:()=>{if(storageFails)throw Error('blocked');return storage.value;},setItem:(_,v)=>{if(storageFails)throw Error('blocked');storage.value=v;}},requestAnimationFrame:fn=>{frames.set(++nextFrame,fn);return nextFrame;},cancelAnimationFrame:id=>frames.delete(id),ResizeObserver:class{observe(){}disconnect(){}}});c.window=c;c.addEventListener=(...args)=>el('window').addEventListener(...args);
 for(const f of ['content.js','course.js','lesson14.js','skill-tree-data.js','knowledge-map.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),c);
 const state={completed:[20],knowledgeMastery:{'21:coi':{level:2,updatedAt:'2026-10-30T00:00:00Z'}},skillMastery:{'g-coi-imperative':{level:1}}};
 const adapter={units:c.COURSE_CONTENT.units,catalog:c.COURSE_LIBRARY.catalog,courses:new Map(c.COURSE_LIBRARY.lessons.map(l=>[l.number,l])),state:()=>state,currentLesson:()=>21,toggleComplete:()=>false,setMastery:()=>false};
 const fire=(id,type,event={})=>(handlers[id+':'+type]||[]).forEach(f=>f(event));
 return {c,el,storage,state,mount:(level,unit)=>{
  // The app unmounts before replacing the map DOM on each hash navigation.
  c.KNOWLEDGE_MAP.unmount();el('#map-panel').hidden=true;el('#map-detail').innerHTML='';el('chapters').open=false;
  c.KNOWLEDGE_MAP.mount(adapter,level,unit);
 },flush:()=>{while(frames.size){const [id,fn]=frames.entries().next().value;frames.delete(id);fn();}},click:action=>fire('root','click',{target:{closest:()=>({dataset:{map:action}})}}),fire,
 limitPanelScroll(collapsed,expanded){
  // Model the browser's scrollTop clamp against the current content height.
  let top=0;Object.defineProperty(el('#map-panel'),'scrollTop',{get:()=>top,set:v=>{top=Math.max(0,Math.min(v,el('chapters').open?expanded:collapsed));}});
 }};
}
test('current location opens the actual course across units without changing learning records',()=>{
 const a=mounted(),before=JSON.stringify(a.state);a.mount('world');a.click('current');assert.equal(a.c.location.hash,'#map/A1/6');a.mount('A1','6');a.flush();
 assert.match(a.el('#map-detail').innerHTML,/C’est interdit/);assert.match(a.el('#map-detail').innerHTML,/#skills\/A1\/grammar\/g-coi-imperative/);assert.match(a.el('#map-detail').innerHTML,/技能自评 · 已接触/);assert.match(a.el('#map-detail').innerHTML,/章节自评/);assert.equal(JSON.stringify(a.state),before);
});
test('course selection, view and chapter scroll restore after leaving and after same-tab reload',()=>{
 const a=mounted();a.mount('A1','6');a.click('lesson:21');a.el('#map-panel').scrollTop=410;a.el('chapters').open=true;
 a.fire('#map-stage','wheel',{preventDefault(){},deltaY:-120,clientX:500,clientY:300});const transform=a.el('#map-world').style.transform;
 a.c.KNOWLEDGE_MAP.unmount();const snapshot=a.storage.value;a.c.KNOWLEDGE_MAP.unmount();assert.equal(a.storage.value,snapshot,'Repeated cleanup must not overwrite position');
 const b=mounted(snapshot);assert.equal(b.c.KNOWLEDGE_MAP.resumeHref(),'#map/A1/6');b.mount('A1','6');b.flush();assert.match(b.el('#map-detail').innerHTML,/C’est interdit/);assert.equal(b.el('#map-panel').scrollTop,410);assert.equal(b.el('chapters').open,true);assert.equal(b.el('#map-world').style.transform,transform);
 b.el('#map-stage').clientWidth=800;b.c.KNOWLEDGE_MAP.unmount();assert.doesNotThrow(()=>JSON.parse(b.storage.value));
});
test('atlas filters and scroll survive navigation, and explicit closing remains closed',()=>{
 const a=mounted();a.mount('A1','6');a.click('atlas');a.el('#map-atlas-search').value='过去时';a.el('#map-atlas-category').value='grammar';a.fire('root','input',{target:{id:'map-atlas-search'}});a.el('#map-panel').scrollTop=120;a.c.KNOWLEDGE_MAP.unmount();
 const b=mounted(a.storage.value);b.mount('A1','6');b.flush();assert.equal(b.el('#map-atlas-search').value,'过去时');assert.equal(b.el('#map-atlas-category').value,'grammar');assert.equal(b.el('#map-panel').scrollTop,120);assert.match(b.el('#map-atlas-results').innerHTML,/过去时/);b.click('close');b.c.KNOWLEDGE_MAP.unmount();
 const d=mounted(b.storage.value);d.mount('A1','6');d.flush();assert.equal(d.el('#map-panel').hidden,true);
});
test('damaged caches and blocked storage fall back safely while in-memory return still works',()=>{
 for(const bad of ['{','{"last":"javascript:alert(1)","views":[]}',JSON.stringify({last:'#map/A1/6',views:[['#map/A1/6',{panel:'lesson',lesson:99,cx:NaN,cy:0,zoom:Infinity}]]})]){const a=mounted(bad);assert.doesNotThrow(()=>{a.mount('A1','6');a.flush();});assert.doesNotMatch(a.el('#map-detail').innerHTML,/第 99 课/);}
 const a=mounted(null,true);a.mount('A1','6');a.click('lesson:21');a.c.KNOWLEDGE_MAP.unmount();a.mount('A1','6');a.flush();assert.match(a.el('#map-detail').innerHTML,/C’est interdit/);
});

test('expanded chapters are restored before deep panel scroll is clamped',()=>{
 const a=mounted();a.limitPanelScroll(400,2500);a.mount('A1','6');a.click('lesson:21');a.el('chapters').open=true;a.el('#map-panel').scrollTop=1500;a.c.KNOWLEDGE_MAP.unmount();
 for(const b of [a,mounted(a.storage.value)]){
  if(b!==a)b.limitPanelScroll(400,2500);
  b.mount('A1','6');b.flush();assert.equal(b.el('chapters').open,true);assert.equal(b.el('#map-panel').scrollTop,1500,'Same-tab navigation and reload must preserve deep chapter scroll');
 }
});

test('full view resets cached world zoom and panels while ordinary returns preserve context',()=>{
 const a=mounted();a.mount('world');const full=a.el('#map-world').style.transform;
 a.click('zoom-in');a.click('atlas');const zoomed=a.el('#map-world').style.transform;
 a.mount('A1','6');a.mount('world');a.flush();assert.equal(a.el('#map-world').style.transform,zoomed);assert.equal(a.el('#map-panel').hidden,false);assert.match(a.el('#map-detail').innerHTML,/跨课检索/);
 a.mount('A1','6');a.click('lesson:21');a.click('reset');assert.equal(a.c.location.hash,'#map');a.mount('world');a.flush();
 assert.equal(a.el('#map-world').style.transform,full);assert.equal(a.el('#map-panel').hidden,true);
 a.mount('A1','6');a.flush();assert.match(a.el('#map-detail').innerHTML,/C’est interdit/,'Reset keeps unit context available');
 a.mount('world');a.flush();a.click('zoom-in');a.click('atlas');a.c.KNOWLEDGE_MAP.unmount();
 const b=mounted(a.storage.value);b.mount('world');b.click('reset');b.flush();assert.equal(b.el('#map-world').style.transform,full,'Pending restore cannot undo a reset');assert.equal(b.el('#map-panel').hidden,true);
 b.c.KNOWLEDGE_MAP.unmount();const reload=mounted(b.storage.value);reload.mount('world');reload.flush();assert.equal(reload.el('#map-world').style.transform,full);assert.equal(reload.el('#map-panel').hidden,true);
});
