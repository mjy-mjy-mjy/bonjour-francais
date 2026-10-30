const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
function data(){const c=vm.createContext({});c.window=c;for(const file of ['content.js','course.js','lesson14.js','skill-tree-data.js','knowledge-map.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);const catalog=c.COURSE_LIBRARY.catalog;return {c,catalog,courses:new Map([...c.COURSE_LIBRARY.lessons,{...catalog.find(l=>l.number===14),...c.LESSON14_CONTENT}].map(l=>[l.number,l]))};}
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
 function el(id){if(elements.has(id))return elements.get(id);const x={id,hidden:false,scrollTop:0,value:'',open:false,clientWidth:1200,clientHeight:700,innerHTML:'',style:{setProperty(){}},classList:{toggle(){}},focus(){this.focused=true;},contains(){return false;},isConnected:true,
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

test('atlas keeps every original chapter and uses only exact authored skill references',()=>{
 const {c,courses}=data(),map=c.KNOWLEDGE_MAP,before=JSON.stringify(c.FRENCH_SKILLS),atlas=map.atlasModel(courses);
 assert.equal(atlas.skills.length,67);assert.equal(new Set(atlas.skills.map(n=>n.id)).size,67);
 assert.equal(atlas.skills.reduce((count,n)=>count+n.refs.length,0),174);
 assert.deepEqual(Array.from(atlas.chapters,e=>e.id),Array.from(map.knowledgeEntries(courses),e=>e.id));
 assert.equal(atlas.chapters.length,221);assert.ok(atlas.chapters.some(e=>!e.skills.length));
 for(const n of atlas.skills){
  const source=c.FRENCH_SKILLS.nodes.find(s=>s.id===n.id);assert.equal(source.planned,false);
  for(const ref of n.refs){assert.ok(source.refs.some(r=>r.lesson===ref.lesson&&ref.id===r.lesson+':'+r.section));assert.ok(courses.get(ref.lesson).sections.some(s=>ref.href==='#lesson/'+ref.lesson+'/'+s.id));}
 }
 for(const e of atlas.chapters){const expected=c.FRENCH_SKILLS.nodes.filter(n=>!n.planned&&n.refs.some(r=>r.lesson===e.lesson&&r.section===e.section)).map(n=>n.id);assert.deepEqual(Array.from(e.skills,n=>n.id),Array.from(expected));}
 assert.equal(JSON.stringify(c.FRENCH_SKILLS),before);
});

test('atlas searches knowledge, exact sources and course names with French accent normalization',()=>{
 const {c,courses}=data(),map=c.KNOWLEDGE_MAP,atlas=map.atlasModel(courses),search=options=>map.atlasResults(atlas,options);
 assert.ok(search({query:'命令式',category:'grammar'}).some(n=>n.id==='g-imperative'));
 assert.ok(search({query:'telephone-moi'}).some(n=>n.id==='g-coi-imperative'));
 for(const branch of c.FRENCH_SKILLS.branches){const found=search({category:branch.id});assert.ok(found.length,branch.id);assert.ok(found.every(n=>n.branch===branch.id));}
 assert.ok(search({query:'C’est interdit'}).some(n=>n.id==='g-coi-imperative'));
 const chapters=search({mode:'course',query:'第21课'});assert.ok(chapters.length);assert.ok(chapters.every(e=>e.lesson===21));
 assert.ok(search({mode:'course',query:'命令式',category:'grammar'}).some(e=>e.id==='21:imperative'));
 const unlinked=atlas.chapters.find(e=>!e.skills.length);assert.ok(search({mode:'course',query:unlinked.title}).some(e=>e.id===unlinked.id));
 assert.equal(search({query:'no-result-xyz'}).length,0);
});

test('atlas renders separate self-evaluations and navigable sources without copying lesson bodies',()=>{
 const {c,courses}=data(),map=c.KNOWLEDGE_MAP,atlas=map.atlasModel(courses),state={completed:[21],knowledgeMastery:{'21:coi':{level:4}},skillMastery:{'g-coi-imperative':{level:1}}},before=JSON.stringify(state);
 const knowledge=map.atlasResultsHtml(atlas.skills.filter(n=>n.id==='g-coi-imperative'),'knowledge',state);
 assert.match(knowledge,/技能自评：已接触/);assert.doesNotMatch(knowledge,/章节自评|已复测/);assert.match(knowledge,/href="#lesson\/21\/coi"/);assert.match(knowledge,/href="#skills\/A1\/grammar\/g-coi-imperative"/);
 const chapter=map.atlasResultsHtml(atlas.chapters.filter(e=>e.id==='21:coi'),'course',state);
 assert.match(chapter,/章节自评：已复测/);assert.match(chapter,/#skills\/A1\/grammar\/g-coi-imperative/);assert.equal(JSON.stringify(state),before);
 const unsafe={...atlas.skills[0],title:'<script>bad</script>',goal:'<img onerror=bad>',refs:[]};assert.doesNotMatch(map.atlasResultsHtml([unsafe],'knowledge',state),/<script>|<img/);
});

test('both atlas modes preserve filtered results, scroll and map view on return and reload',()=>{
 for(const mode of ['knowledge','course']){
  const a=mounted(),before=JSON.stringify(a.state);a.mount('A1','6');a.click('atlas');a.click('atlas-mode:'+mode);
  a.el('#map-atlas-search').value='命令式';a.el('#map-atlas-category').value='grammar';a.fire('root','input',{target:{id:'map-atlas-search'}});
  assert.match(a.el('#map-atlas-results').innerHTML,/#lesson\/21\/imperative/);
  a.el('#map-panel').scrollTop=700;a.click('zoom-in');const transform=a.el('#map-world').style.transform;a.c.KNOWLEDGE_MAP.unmount();
  for(const b of [a,mounted(a.storage.value)]){
   assert.equal(b.c.KNOWLEDGE_MAP.resumeHref(),'#map/A1/6');b.mount('A1','6');b.flush();
   assert.ok(b.el('#map-detail').innerHTML.includes('data-map="atlas-mode:'+mode+'" aria-pressed="true"'));
   assert.equal(b.el('#map-atlas-search').value,'命令式');assert.equal(b.el('#map-atlas-category').value,'grammar');assert.equal(b.el('#map-panel').scrollTop,700);assert.equal(b.el('#map-world').style.transform,transform);assert.match(b.el('#map-atlas-results').innerHTML,/#lesson\/21\/imperative/);assert.equal(JSON.stringify(b.state),before);
  }
 }
});

test('legacy chapter atlas caches keep their mode while invalid optional filters safely default',()=>{
 const a=mounted();a.mount('world');a.click('atlas');a.el('#map-atlas-search').value='过去时';a.fire('root','input',{target:{id:'map-atlas-search'}});a.c.KNOWLEDGE_MAP.unmount();
 const saved=JSON.parse(a.storage.value);delete saved.views[0][1].atlasMode;
 const b=mounted(JSON.stringify(saved));b.mount('world');b.flush();assert.match(b.el('#map-detail').innerHTML,/atlas-mode:course" aria-pressed="true"/);assert.match(b.el('#map-atlas-count').textContent,/个章节/);assert.equal(b.el('#map-atlas-search').value,'过去时');
 saved.views[0][1].atlasMode='bad';saved.views[0][1].category='unknown';const d=mounted(JSON.stringify(saved));d.mount('world');d.flush();assert.match(d.el('#map-detail').innerHTML,/atlas-mode:knowledge" aria-pressed="true"/);assert.equal(d.el('#map-atlas-category').value,'');
});

test('atlas mode switching retains query and category and empty results can be cleared',()=>{
 const a=mounted();a.mount('world');a.click('atlas');assert.match(a.el('#map-detail').innerHTML,/atlas-mode:knowledge" aria-pressed="true"/);assert.equal(a.el('#map-atlas-count').textContent,'67 个知识点');
 a.el('#map-atlas-search').value='no-result-xyz';a.el('#map-atlas-category').value='listening';a.fire('root','input',{target:{id:'map-atlas-search'}});a.click('atlas-mode:course');
 assert.equal(a.el('#map-atlas-search').value,'no-result-xyz');assert.equal(a.el('#map-atlas-category').value,'listening');assert.match(a.el('#map-atlas-results').innerHTML,/清除筛选/);assert.equal(a.el('[data-map="atlas-mode:course"]').focused,true);
 a.click('atlas-clear');assert.equal(a.el('#map-atlas-search').value,'');assert.equal(a.el('#map-atlas-category').value,'');assert.equal(a.el('#map-atlas-count').textContent,'21 课 · 221 个章节');assert.equal(a.el('#map-atlas-search').focused,true);
});

test('label collisions prioritize selection across desktop CSS viewport scales',()=>{
 const {c}=data();for(const width of [1280,1707,2048,2560,3072,3840])for(const scale of [.4,.8,1.5]){
 const items=[{id:'current',x:300,y:150,priority:2},{id:'selected',x:310,y:155,priority:3},{id:'far',x:700,y:150,priority:1}];
 const visible=c.KNOWLEDGE_MAP.labelVisibility(items,scale,width,900);assert.ok(visible.has('selected'));assert.ok(!visible.has('current'));
 }
 const a=mounted();a.mount('A1','6');a.click('lesson:22');assert.match(a.el('#map-markers').innerHTML,/◎ 当前学习/);assert.match(a.el('#map-markers').innerHTML,/◇ 正在查看/);a.click('route-sample');assert.match(a.el('#map-markers').innerHTML,/map-route-sample/);a.click('route-sample');assert.doesNotMatch(a.el('#map-markers').innerHTML,/map-route-sample/);a.click('unit:6');assert.doesNotMatch(a.el('#map-markers').innerHTML,/◇ 正在查看/);
});

test('unit and lesson filters intersect in both modes and course atlas locates and returns',()=>{
 const {c,courses}=data(),m=c.KNOWLEDGE_MAP,atlas=m.atlasModel(courses);
 for(const mode of ['knowledge','course']){
 const found=m.atlasResults(atlas,{mode,scopeUnit:6,scopeLesson:21});assert.ok(found.length);assert.ok(found.every(n=>mode==='course'?n.lesson===21:n.refs.some(r=>r.lesson===21)));
 assert.equal(m.atlasResults(atlas,{mode,scopeUnit:5,scopeLesson:21}).length,0);
 }
 const a=mounted();a.mount('A1','6');a.click('lesson:21');a.click('atlas-lesson:21');assert.equal(a.el('#map-atlas-lesson').value,'21');a.el('#map-panel').scrollTop=450;a.click('locate:21');assert.match(a.el('#map-detail').innerHTML,/返回图鉴结果/);a.click('atlas-return');a.flush();assert.equal(a.el('#map-atlas-lesson').value,'21');assert.equal(a.el('#map-panel').scrollTop,450);
 const b=mounted();b.mount('world');b.click('atlas');b.el('#map-panel').scrollTop=510;b.click('locate:21');b.mount('A1','6');b.flush();b.c.KNOWLEDGE_MAP.unmount();const reload=mounted(b.storage.value);reload.mount('A1','6');reload.flush();reload.click('atlas-return');assert.equal(reload.c.location.hash,'#map');reload.mount('world');reload.flush();assert.equal(reload.el('#map-panel').scrollTop,510);
});

test('review states use actual timestamps and never infer skill mastery from course completion',()=>{
 const {c,courses}=data(),map=c.KNOWLEDGE_MAP,now=Date.parse('2026-10-30T12:00:00Z');
 assert.equal(map.reviewState(undefined,now),'unrecorded');assert.equal(map.reviewState({level:1},now),'touched');
 assert.equal(map.reviewState({level:2,masteredAt:new Date(now-86399999).toISOString()},now),'independent');assert.equal(map.reviewState({level:2,masteredAt:new Date(now-86400000).toISOString()},now),'due');assert.equal(map.reviewState({level:2,masteredAt:'bad'},now),'independent');assert.equal(map.reviewState({level:3},now),'reviewed');
 const atlas=map.atlasModel(courses);for(const n of atlas.skills)for(const r of n.practiceRefs)assert.ok(courses.get(r.lesson).sections.some(s=>s.id==='practice')&&r.href==='#lesson/'+r.lesson+'/practice');
 const html=map.atlasResultsHtml(atlas.skills.filter(n=>n.id==='g-coi-imperative'),'knowledge',{completed:[21],skillMastery:{}},true);assert.match(html,/未记录掌握/);assert.match(html,/#lesson\/21\/practice/);assert.match(html,/不代表逐题对应/);assert.match(html,/查看掌握标准并记录自评/);
});

test('review filters and scope survive skill self-evaluation round trip and refresh',()=>{
 const a=mounted();a.mount('A1','6');a.click('review-lesson:21');a.el('#map-review-status').value='due';a.state.skillMastery['g-coi-imperative']={level:2,masteredAt:'2020-01-01T00:00:00Z'};
 a.fire('root','change',{target:{id:'map-review-status',value:'due',matches:()=>false}});assert.match(a.el('#map-atlas-results').innerHTML,/命令式与间接宾语代词/);a.el('#map-panel').scrollTop=250;a.c.KNOWLEDGE_MAP.unmount();assert.equal(a.c.KNOWLEDGE_MAP.resumeLabel(),'返回知识复习');
 // This is the state returned by the existing skill page after its saved self-evaluation.
 a.state.skillMastery['g-coi-imperative']={level:3,masteredAt:'2020-01-01T00:00:00Z',reviewedAt:'2026-10-30T00:00:00Z'};a.mount('A1','6');a.flush();assert.equal(a.el('#map-review-status').value,'due');assert.equal(a.el('#map-atlas-lesson').value,'21');assert.equal(a.el('#map-atlas-count').textContent,'0 个知识点 · 第 21 课');assert.equal(a.el('#map-panel').scrollTop,250);a.c.KNOWLEDGE_MAP.unmount();
 const b=mounted(a.storage.value);b.mount('A1','6');b.flush();assert.equal(b.el('#map-review-status').value,'due');assert.match(b.el('#map-detail').innerHTML,/知识复习/);b.click('atlas-clear');assert.equal(b.el('#map-review-status').value,'all');assert.equal(b.el('#map-atlas-lesson').value,'0');
});

test('review has no atlas mode exit and ignores stale mode actions without losing filters',()=>{
 const a=mounted();a.mount('A1','6');a.click('review-lesson:21');a.el('#map-review-status').value='unrecorded';a.fire('root','change',{target:{id:'map-review-status',value:'unrecorded',matches:()=>false}});
 assert.doesNotMatch(a.el('#map-detail').innerHTML,/aria-label="图鉴浏览方式"/);
 a.click('atlas-mode:knowledge');assert.equal(a.el('#map-review-status').value,'unrecorded');assert.match(a.el('#map-detail').innerHTML,/知识复习/);assert.equal(a.el('#map-atlas-lesson').value,'21');
 a.c.KNOWLEDGE_MAP.unmount();const b=mounted(a.storage.value);b.mount('A1','6');b.flush();assert.equal(b.el('#map-review-status').value,'unrecorded');
});

test('selected and current course labels outrank the unit label when their boxes collide',()=>{
 const a=mounted();a.mount('A1','6');a.click('lesson:21');
 const html=a.el('#map-markers').innerHTML,priority=id=>Number(html.match(new RegExp('data-map="'+id+'"[^>]*data-priority="(\\d+)"'))[1]);
 assert.ok(priority('lesson:21')>priority('unit:6'));
 const visible=a.c.KNOWLEDGE_MAP.labelVisibility([{id:'town',x:100,y:100,priority:priority('unit:6')},{id:'course',x:100,y:100,priority:priority('lesson:21')}],1,500,500);
 assert.equal(visible.has('course'),true);assert.equal(visible.has('town'),false);
 a.click('lesson:22');const updated=a.el('#map-markers').innerHTML,active=Number(updated.match(/data-map="lesson:21"[^>]*data-priority="(\d+)"/)[1]);assert.ok(active>priority('unit:6'));
});
