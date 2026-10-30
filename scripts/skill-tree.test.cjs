const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
function model(){const c=vm.createContext({URLSearchParams});c.window=c;for(const file of ['course.js','lesson14.js','skill-tree-data.js','grammar-data.js','skill-tree.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);return {c,data:c.FRENCH_SKILLS,tree:c.SKILL_TREE};}
test('curated scope has seven branches, 67 linked skills and 21 explicitly planned directions',()=>{
 const {data}=model();assert.equal(data.branches.length,7);assert.equal(data.nodes.filter(n=>!n.planned).length,67);assert.equal(data.nodes.filter(n=>n.planned).length,21);assert.equal(new Set(data.nodes.map(n=>n.id)).size,data.nodes.length);
 const source=JSON.parse(fs.readFileSync(path.join(root,'knowledge/skills.json'),'utf8'));assert.deepEqual(JSON.parse(JSON.stringify(data)),source);
 for(const n of data.nodes){assert.match(n.id,/^[a-z][a-z0-9-]{1,79}$/);assert.ok(data.branches.some(b=>b.id===n.branch));assert.ok(data.stages.includes(n.stage));if(n.planned){assert.equal(n.refs.length,0);}else{assert.ok(n.criteria.length>=2);assert.ok(n.refs.length);assert.equal(n.stage,'A1');}}
});
test('every skill reference reaches an existing original lesson section',()=>{
 const {c,data}=model();const courses=new Map([...c.COURSE_LIBRARY.lessons,{number:14,...c.LESSON14_CONTENT}].map(l=>[l.number,l]));
 for(const n of data.nodes)for(const r of n.refs)assert.ok(courses.get(r.lesson)?.sections.some(s=>s.id===r.section),`${n.id}: ${r.lesson}/${r.section}`);
 const y=data.nodes.filter(n=>n.id==='g-y');assert.equal(y.length,1);assert.deepEqual(Array.from(y[0].refs,r=>r.lesson),[10,19,20]);
});
test('recommended prerequisites form an acyclic graph and every grammar group fits valid node bounds',()=>{
 const {data,tree}=model(),nodes=new Map(data.nodes.map(n=>[n.id,n])),done=new Set(),stack=new Set();
 function visit(n){assert.ok(!stack.has(n.id),'Cycle at '+n.id);if(done.has(n.id))return;stack.add(n.id);for(const id of n.requires){assert.ok(nodes.has(id),'Missing '+id);assert.notEqual(n.id,id);visit(nodes.get(id));}stack.delete(n.id);done.add(n.id);}
 data.nodes.forEach(visit);
 for(const branch of data.branches){const list=data.nodes.filter(n=>n.branch===branch.id&&!n.planned),g=tree.graphLayout(list);assert.equal(g.points.size,list.length);for(const p of g.points.values()){assert.ok(p.x-99>=0&&p.x+99<=g.width);assert.ok(p.y-35>=0&&p.y+35<=g.height);}}
});
test('progress excludes roadmap nodes and does not infer mastery from completed lessons',()=>{
 const {data,tree}=model(),now=Date.parse('2026-10-29T12:00:00Z');
 const records={'g-etre':{level:2,masteredAt:'2026-10-27T12:00:00Z'},'g-y':{level:1},'p-r':{level:3},'a2-grammar':{level:3}};
 assert.deepEqual(JSON.parse(JSON.stringify(tree.summary(data.nodes,records,now))),{total:67,touched:3,mastered:2,reviewed:1,due:1});
 assert.equal(tree.summary(data.nodes,{},now).mastered,0);
});
test('review requires 24 hours after an independently recorded mastery state',()=>{
 const {tree}=model(),start=Date.parse('2026-10-28T00:00:00Z'),record={level:2,masteredAt:new Date(start).toISOString()};
 assert.equal(tree.canReview(record,start+86399999),false);assert.equal(tree.canReview(record,start+86400000),true);assert.equal(tree.canReview({level:1,masteredAt:record.masteredAt},start+172800000),false);
});
test('deep links restore stage, branch, group and semantic skill; invalid routes fall back safely',()=>{
 const {tree}=model();const r=tree.route('#skills/A1/grammar/g-past-etre');assert.equal(r.stage,'A1');assert.equal(r.group,'verbs');assert.equal(r.node.id,'g-past-etre');
 assert.equal(tree.route('#skills/A1/grammar/nominals').group,'nominals');assert.equal(tree.route('#skills/A2/grammar/a2-grammar').node.planned,true);
 const invalid=tree.route('#skills/XYZ/missing/g-y');assert.equal(invalid.stage,'all');assert.equal(invalid.branch,'all');assert.equal(invalid.node,null);
});
test('next-step suggestion respects prerequisites, prefers touched skills and never recommends planned nodes',()=>{
 const {data,tree}=model();const records={'g-etre':{level:1}};
 const n=tree.recommend(data.nodes,records,[1,5]);assert.notEqual(n.id,'g-etre');assert.ok(n.requires.every(id=>(records[id]?.level||0)>=2));
 records['g-pronouns']={level:2};assert.equal(tree.recommend(data.nodes,records,[1,5]).id,'g-etre');
 const all=Object.fromEntries(data.nodes.filter(n=>!n.planned).map(n=>[n.id,{level:2}]));assert.equal(tree.recommend(data.nodes,all,[]),null);
});
test('skill search finds criteria and accepts unaccented French input',()=>{
 const {tree}=model();assert.ok(tree.searchNodes('etre').some(n=>n.id==='g-etre'));
 assert.ok(tree.searchNodes('过去').some(n=>n.id==='l-past'));
 assert.ok(tree.searchNodes('复数').some(n=>n.id==='g-articles'));
 assert.equal(tree.searchNodes('no-such-knowledge-123').length,0);
});

test('verb sample covers each authored verb skill once with readable, nonoverlapping card bounds',()=>{
 const {data,tree}=model(),g=tree.verbLayout(),ids=data.nodes.filter(n=>n.group==='verbs'&&!n.planned).map(n=>n.id);
 assert.deepEqual([...g.points.keys()].sort(),Array.from(ids).sort());
 const points=[...g.points.values()];
 for(const p of points){assert.ok(p.x-144>=0&&p.x+144<=g.width);assert.ok(p.y-78>=0&&p.y+78<=g.height);}
 for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){
  assert.ok(Math.abs(points[i].x-points[j].x)>=308||Math.abs(points[i].y-points[j].y)>=156,'Cards overlap or lack spacing');
 }
});
test('selection relations retain cross-branch prerequisites and only show direct successors',()=>{
 const {tree}=model(),past=tree.skillRelations('g-past-etre');
 assert.deepEqual(Array.from(past.before),['g-etre','g-past-avoir']);
 assert.ok(past.after.includes('g-past-agreement'));
 assert.ok(past.after.includes('s-past'),'Cross-branch speaking relationship must remain discoverable');
 assert.ok(!past.after.includes('g-participles'));
 assert.ok(tree.skillRelations('g-past-agreement').before.includes('g-agreement'));
 assert.deepEqual(JSON.parse(JSON.stringify(tree.skillRelations('missing'))),{before:[],after:[]});
});

test('overview and list scopes expose actual skills, exclude plans and share search normalization',()=>{
 const {tree}=model(),scope=tree.route('#skills');
 assert.equal(tree.scopedNodes(scope).length,67);
 assert.equal(tree.scopedNodes(tree.route('#skills/A2/all?view=list')).length,7);
 const branch=tree.route('#skills/A1/grammar?view=list');
 assert.equal(tree.scopedNodes(branch).length,28);
 const found=tree.scopedNodes(tree.route('#skills/A1/grammar/verbs?q=etre'));
 assert.ok(found.every(n=>n.group==='verbs'));assert.ok(found.some(n=>n.id==='g-etre'));assert.ok(found.some(n=>n.id==='g-past-etre'));assert.ok(!found.some(n=>n.id==='g-y'));
 assert.equal(tree.scopedNodes(tree.route('#skills/all/all?view=list&q=zz-no-match')).length,0);
});
test('mode, query and selection round-trip without narrowing an explicitly broad list scope',()=>{
 const {tree}=model();
 const h=tree.href('all','all','g-past-etre',{mode:'list',query:'être & passé',allGroups:true});
 const r=tree.route(h);assert.equal(r.node.id,'g-past-etre');assert.equal(r.mode,'list');assert.equal(r.query,'être & passé');
 assert.equal(tree.scopedNodes({...r,query:''}).length,67);
 const grammar=tree.route(tree.href('A1','grammar','g-etre',{mode:'list',allGroups:true}));
 assert.equal(grammar.group,'');assert.equal(tree.scopedNodes(grammar).length,28);
 assert.equal(tree.route('#skills/A1/grammar/g-etre?view=unknown').mode,'graph');
 assert.equal(tree.route('#skills/invalid/all/g-etre?view=list').node,null);
 assert.equal(tree.route('#skills/A1/writing/g-etre').node,null);
 assert.equal(tree.route('#skills/A1/grammar/verbs?q='+ 'x'.repeat(400)).query.length,200);
});
test('shared branch layouts keep every card separate and dependencies pointing forward',()=>{
 const {data,tree}=model();
 for(const branch of data.branches){
  const scopes=branch.id==='grammar'?['verbs','nominals','structure']:[''];
  for(const group of scopes){
   const nodes=data.nodes.filter(n=>!n.planned&&n.branch===branch.id&&(!group||n.group===group)),g=group==='verbs'?tree.verbLayout():tree.graphLayout(nodes);
   assert.equal(g.points.size,nodes.length);
   const points=[...g.points.values()];
   for(const p of points){assert.ok(p.x>=144&&p.x+144<=g.width);assert.ok(p.y>=78&&p.y+78<=g.height);}
   for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)assert.ok(Math.abs(points[i].x-points[j].x)>=308||Math.abs(points[i].y-points[j].y)>=156,`${branch.id}/${group}: overlap`);
   for(const n of nodes)for(const req of n.requires){const a=g.points.get(req),b=g.points.get(n.id);if(a)assert.ok(b.x>a.x||(b.x===a.x&&b.y>a.y),`${req} -> ${n.id}`);}
  }
 }
});

test('course-aware search and URL range filters find lesson 21 without changing knowledge IDs',()=>{
 const {tree}=model();assert.equal(tree.coverage(),21);assert.equal(tree.searchNodes('第21课').length,9);assert.equal(tree.searchNodes('C’est interdit').length,9);
 const h=tree.href('all','all','',{mode:'list',unit:6,lesson:21,query:'命令式'}),r=tree.route(h);assert.equal(r.unit,6);assert.equal(r.lesson,21);assert.ok(tree.scopedNodes(r).some(n=>n.id==='g-coi-imperative'));assert.equal(tree.scopedNodes({...r,unit:5}).length,0);assert.equal(tree.route('#skills/all/all?unit=99&lesson=1.5').lesson,0);
});

function mountedTree(saved,hash='#skills/all/all?view=list'){
 const els=new Map(),handlers=new Map(),frames=new Map();let serial=0;
 function el(id){if(els.has(id))return els.get(id);const e={innerHTML:'',hidden:false,scrollTop:0,value:'',clientWidth:1600,clientHeight:900,style:{},isConnected:true,classList:{toggle(){},add(){}},setAttribute(){},removeAttribute(){},getAttribute(){return null;},focus(){},contains(){return false;},getBoundingClientRect(){return {left:0,right:1600,top:0,bottom:900};},querySelector:q=>el(q),querySelectorAll:()=>[],addEventListener(t,fn,o={}){const key=id+':'+t;if(!handlers.has(key))handlers.set(key,[]);handlers.get(key).push(e=>{if(!o.signal?.aborted)fn(e);});}};els.set(id,e);return e;}
 const storage={value:saved};const c=vm.createContext({URLSearchParams,AbortController,console,location:{hash},history:{state:null,replaceState(_,__,h){c.location.hash=h;}},document:{getElementById:()=>el('root'),activeElement:null},sessionStorage:{getItem:()=>storage.value,setItem:(_,v)=>storage.value=v},requestAnimationFrame:fn=>{frames.set(++serial,fn);return serial;},cancelAnimationFrame:id=>frames.delete(id),ResizeObserver:class{observe(){}disconnect(){}},setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){}});c.window=c;c.addEventListener=(...args)=>el('window').addEventListener(...args);
 for(const f of ['course.js','skill-tree-data.js','grammar-data.js','skill-tree.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),c);
 const state={completed:[],skillMastery:{}};const adapter={state:()=>state,courses:new Map(c.COURSE_LIBRARY.lessons.map(l=>[l.number,l])),setSkill:(id,patch)=>{state.skillMastery[id]={...state.skillMastery[id],...patch};return true;}};
 return {c,el,state,storage,mount:()=>c.SKILL_TREE.mount(adapter),flush(){while(frames.size){const [id,fn]=frames.entries().next().value;frames.delete(id);fn();}},fire:(id,type,e)=>(handlers.get(id+':'+type)||[]).forEach(fn=>fn(e))};
}

test('skill view restores list and detail scroll on refresh and rejects damaged session entries',()=>{
 const a=mountedTree(null,'#skills/all/all/g-coi-imperative?view=list&unit=6&lesson=21');a.mount();a.flush();a.el('#st-stage').scrollTop=480;a.el('#st-detail').scrollTop=210;a.c.SKILL_TREE.unmount();
 const b=mountedTree(a.storage.value,a.c.location.hash);b.mount();b.flush();assert.equal(b.el('#st-stage').scrollTop,480);assert.equal(b.el('#st-detail').scrollTop,210);assert.equal(b.el('#st-lesson').value,'21');
 b.fire('#st-close','click',{});assert.match(b.c.location.hash,/unit=6/);assert.match(b.c.location.hash,/lesson=21/);
 const {tree}=model();assert.equal(tree.readViewCache('{"last":"javascript:bad","views":[null,123]}').last,'');assert.equal(tree.readViewCache('{"views":[["#skills/all/all",{"view":{"scale":999}}]]}').views.size,0);
});

test('shared grammar preview and course blocks come from the same scoped author records',()=>{
 const {c,tree}=model();assert.equal(c.FRENCH_GRAMMAR.records.length,3);let count=0;
 for(const r of c.FRENCH_GRAMMAR.records){const html=tree.grammarPreview(r.id);assert.match(html,/核心规则/);assert.match(html,/例句/);assert.match(html,/易错点/);for(const b of r.blocks){count++;const course=c.COURSE_LIBRARY.lessons.find(l=>l.number===b.lesson);assert.equal(course.sections.find(s=>s.id===b.section).html,b.html);assert.ok(html.includes(b.html));}}
 assert.equal(count,6);assert.equal(tree.grammarPreview('g-y'),'');assert.ok(tree.searchNodes('negation').some(n=>n.id==='g-negative'));
});

test('cross-branch relation navigation can return to the exact original filtered view',()=>{
 const hash='#skills/A1/grammar/g-past-etre?view=list&unit=5&lesson=19';const a=mountedTree(null,hash);a.mount();a.flush();a.el('#st-stage').scrollTop=350;
 a.c.location.hash='#skills/A1/speaking/s-past?view=list';a.c.SKILL_TREE.navigate();a.flush();assert.match(a.el('#st-detail-body').innerHTML,/返回原知识视图/);
 a.fire('root','click',{target:{closest:q=>q==='[data-st-action]'?{dataset:{stAction:'relation-back'}}:null}});assert.equal(a.c.location.hash,hash);a.c.SKILL_TREE.navigate();a.flush();assert.equal(a.el('#st-stage').scrollTop,350);
});

test('review statuses and recommendations explain actual records without fabricating mastery',()=>{
 const {tree,data}=model(),now=Date.parse('2026-10-30T12:00:00Z');assert.equal(tree.reviewState(null,now),'unrecorded');assert.equal(tree.reviewState({level:1},now),'touched');assert.equal(tree.reviewState({level:2,masteredAt:new Date(now-86399999).toISOString()},now),'independent');assert.equal(tree.reviewState({level:2,masteredAt:new Date(now-86400000).toISOString()},now),'due');assert.equal(tree.reviewState({level:2,masteredAt:'bad'},now),'independent');assert.equal(tree.reviewState({level:3},now),'reviewed');
 const records={'g-pronouns':{level:2},'g-etre':{level:1}};const suggestion=tree.recommendation(data.nodes,records,[1]);assert.equal(suggestion.node.id,'g-etre');assert.ok(suggestion.reasons.some(r=>r.includes('记录接触')));assert.ok(suggestion.reasons.some(r=>r.includes('基础')));assert.ok(suggestion.reasons.some(r=>r.includes('课程')));
 const scope=tree.route(tree.href('all','all','',{mode:'list',review:'due',unit:6,lesson:21}));assert.equal(scope.review,'due');const due=tree.scopedNodes(scope,true,{'g-coi-imperative':{level:2,masteredAt:'2020-01-01T00:00:00Z'}},now);assert.deepEqual(Array.from(due,n=>n.id),['g-coi-imperative']);assert.equal(tree.scopedNodes(scope,true,{},now).length,0);
 for(const n of data.nodes.filter(n=>!n.planned))for(const ref of tree.practiceSources(n)){const course=JSON.parse(fs.readFileSync(path.join(root,'lessons',String(ref.lesson).padStart(2,'0')+'.json'),'utf8'));assert.ok(course.sections.some(s=>s.id==='practice'));}
});

test('review list updates after self-evaluation and keeps scope on closing and refresh',()=>{
 const hash='#skills/all/all/g-coi-imperative?view=list&review=due&unit=6&lesson=21';const a=mountedTree(null,hash);a.state.skillMastery['g-coi-imperative']={level:2,masteredAt:'2020-01-01T00:00:00Z'};a.mount();a.flush();a.el('#st-stage').scrollTop=300;
 assert.match(a.el('#st-board').innerHTML,/命令式与间接宾语代词/);assert.match(a.el('#st-detail-body').innerHTML,/#lesson\/21\/practice/);
 a.fire('root','click',{target:{closest:q=>q==='[data-st-level]'?{dataset:{stLevel:'3'}}:null}});assert.equal(a.state.skillMastery['g-coi-imperative'].level,3);assert.doesNotMatch(a.el('#st-board').innerHTML,/data-skill="g-coi-imperative"/);
 a.fire('#st-close','click',{});assert.match(a.c.location.hash,/review=due/);a.c.SKILL_TREE.navigate();a.flush();assert.equal(a.el('#st-lesson').value,'21');a.c.SKILL_TREE.unmount();const b=mountedTree(a.storage.value,a.c.location.hash);b.mount();b.flush();assert.equal(b.el('#st-review').value,'due');assert.equal(b.el('#st-stage').scrollTop,300);
});

test('expanded shared text is restored before applying deep detail scroll',()=>{
 const a=mountedTree(null,'#skills/A1/grammar/g-articles');const fold={open:true};a.mount();a.flush();a.el('#st-detail-body').querySelectorAll=()=>[fold];a.el('#st-detail').scrollTop=900;a.c.SKILL_TREE.unmount();
 const b=mountedTree(a.storage.value,a.c.location.hash),restored={open:false};b.el('#st-detail-body').querySelectorAll=()=>[restored];let scroll=0;Object.defineProperty(b.el('#st-detail'),'scrollTop',{get:()=>scroll,set:v=>scroll=Math.min(v,restored.open?2000:200)});b.mount();b.flush();assert.equal(restored.open,true);assert.equal(scroll,900);
});

test('changing branch preserves keyword, course range and review status as combined filters',()=>{
 const a=mountedTree(null,'#skills/all/all?view=list&review=unrecorded&unit=6&lesson=21&q='+encodeURIComponent('命令式'));a.mount();a.flush();
 a.fire('#st-branch','change',{target:{value:'grammar'}});const r=a.c.SKILL_TREE.route(a.c.location.hash);
 assert.equal(r.query,'命令式');assert.equal(r.branch,'grammar');assert.equal(r.unit,6);assert.equal(r.lesson,21);assert.equal(r.review,'unrecorded');
 assert.equal(a.c.SKILL_TREE.scopedNodes(r).length,2);
});

test('self-evaluation preserves expanded shared text before restoring deep reading position',()=>{
 const a=mountedTree(null,'#skills/A1/grammar/g-negative');a.mount();a.flush();const fold={open:true},body=a.el('#st-detail-body');body.querySelectorAll=()=>[fold];
 let html=body.innerHTML;Object.defineProperty(body,'innerHTML',{get:()=>html,set:v=>{html=v;fold.open=false;}});
 let scroll=0;Object.defineProperty(a.el('#st-detail'),'scrollTop',{get:()=>scroll,set:v=>scroll=Math.min(v,fold.open?3000:300)});a.el('#st-detail').scrollTop=1800;
 a.fire('root','click',{target:{closest:q=>q==='[data-st-level]'?{dataset:{stLevel:'1'}}:null}});
 assert.equal(a.state.skillMastery['g-negative'].level,1);assert.equal(fold.open,true);assert.equal(scroll,1800);
});
