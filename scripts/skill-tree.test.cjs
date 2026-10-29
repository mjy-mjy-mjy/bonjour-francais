const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
function model(){const c=vm.createContext({});c.window=c;for(const file of ['course.js','lesson14.js','skill-tree-data.js','skill-tree.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);return {c,data:c.FRENCH_SKILLS,tree:c.SKILL_TREE};}
test('curated scope has seven branches, 64 linked skills and 21 explicitly planned directions',()=>{
 const {data}=model();assert.equal(data.branches.length,7);assert.equal(data.nodes.filter(n=>!n.planned).length,64);assert.equal(data.nodes.filter(n=>n.planned).length,21);assert.equal(new Set(data.nodes.map(n=>n.id)).size,data.nodes.length);
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
 assert.deepEqual(JSON.parse(JSON.stringify(tree.summary(data.nodes,records,now))),{total:64,touched:3,mastered:2,reviewed:1,due:1});
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
