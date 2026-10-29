const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
function model(){const c={URLSearchParams};c.window=c;vm.createContext(c);for(const name of ['course.js','lesson14.js','skill-tree-data.js','verb-data.js','verb-knowledge.js'])vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),c);return {c,api:c.VERB_KNOWLEDGE,data:c.VERB_LIBRARY,byName:new Map(c.VERB_LIBRARY.records.map(r=>[r.infinitive,r]))};}
test('shared source covers 42 complete present entries, ordinary and pronominal uses, with valid original references',()=>{
 const {c,data,byName}=model();const source=JSON.parse(fs.readFileSync(path.join(root,'knowledge/verbs.json'),'utf8'));
 assert.deepEqual(JSON.parse(JSON.stringify(data)),source);assert.equal(data.records.length,42);assert.equal(new Set(data.records.map(r=>r.id)).size,42);
 assert.equal(data.records.filter(r=>r.pronominal).length,10);
 for(const r of data.records){assert.equal(r.forms.length,6);assert.ok(r.forms.every(f=>f.trim()));for(const ref of r.refs)assert.ok(c.COURSE_LIBRARY.lessons.find(l=>l.number===ref.lesson)?.sections.some(s=>s.id===ref.section));assert.ok(r.notes.length&&r.examples.length&&r.skillIds.length);}
 assert.equal(byName.get('aller').group,'3');assert.equal(byName.get('dormir').pronominal,false);
 assert.ok(byName.get('appeler').relatedIds.includes(byName.get('s’appeler').id));
});
test('high-risk spelling and clitic forms render correctly without substituting ordinary and pronominal meanings',()=>{
 const {byName,api}=model();
 for(const [verb,person,expected] of [['être',4,'vous êtes'],['avoir',0,'j’ai'],['écrire',0,'j’écris'],['habiller',0,'j’habille'],['appeler',3,'nous appelons'],['s’appeler',3,'nous nous appelons'],['lever',0,'je lève'],['se lever',4,'vous vous levez'],['commencer',3,'nous commençons'],['nager',3,'nous nageons'],['prendre',5,'ils / elles prennent'],['s’entraîner',0,'je m’entraîne'],['se détendre',4,'vous vous détendez']])assert.equal(api.fullForm(byName.get(verb),person),expected,verb);
 assert.equal(api.fullForm({forms:['hache'],jeElision:false},0),'je hache','Do not infer silent h from spelling alone');
 assert.notEqual(byName.get('coucher').meaning,byName.get('se coucher').meaning);
 assert.ok(byName.get('se terminer').notes.join(' ').includes('第三人称'));
});
test('search handles accents and apostrophes, and filters use real complete-table coverage',()=>{
 const {api}=model();
 assert.equal(api.filter(api.route('#verbs/list?q=etre'))[0].infinitive,'être');
 assert.equal(api.filter(api.route("#verbs/list?q=s%27appeler"))[0].infinitive,'s’appeler');
 assert.ok(api.filter(api.route('#verbs/list?q='+encodeURIComponent('起床'))).some(r=>r.infinitive==='se lever'));
 assert.equal(api.filter(api.route('#verbs/list?through=4')).length,9);
 assert.ok(!api.filter(api.route('#verbs/list?through=4')).some(r=>r.infinitive==='lire'));
 assert.equal(api.filter(api.route('#verbs/list?kind=reflexive')).length,10);
 assert.equal(api.filter(api.route('#verbs/list?lesson=14')).length,4);
 assert.equal(api.filter(api.route('#verbs/list?q=no-such-verb')).length,0);
 assert.ok(api.filter(api.route('#verbs/list?skill=g-etre')).every(r=>r.id==='present-etre'));
});
test('shareable routes restore filters and reject invalid IDs without changing learning records',()=>{
 const {api}=model();const r=api.route(api.href('present-se-lever',{query:'起床',group:'1',kind:'reflexive',lesson:15,skill:'g-reflexive'}));
 assert.equal(r.id,'present-se-lever');assert.equal(r.query,'起床');assert.equal(r.lesson,15);assert.equal(r.kind,'reflexive');
 assert.equal(api.route('#verbs/missing').id,null);assert.equal(api.route('#verbs/list?group=2&lesson=99&through=-1').through,16);
 assert.equal(api.route('#verbs/list?group=2').group,'all');
 assert.equal(api.route('#verbs/list?q='+ 'x'.repeat(300)).query.length,200);
});
test('unification preserves legacy section IDs, quiz IDs, choices and answers across all 20 lessons',()=>{
 const {c}=model(),legacy=JSON.parse(fs.readFileSync(path.join(root,'scripts/fixtures/k1-legacy-signatures.json'),'utf8'));
 assert.equal(c.COURSE_LIBRARY.lessons.length,20);assert.equal(c.LESSON14_CONTENT,c.COURSE_LIBRARY.lessons.find(l=>l.number===14));assert.equal(c.LESSON14_CONTENT.exercises.length,10);
 for(const [n,before] of Object.entries(legacy)){
  const lesson=c.COURSE_LIBRARY.lessons.find(l=>l.number===Number(n));
  assert.deepEqual(Array.from(lesson.sections,s=>s.id),before.sections,n);
  for(const old of before.questions){const current=lesson.quickQuestions.find(q=>q.id===old.id);assert.ok(current,old.id);assert.equal(current.answer,old.answer,old.id);assert.deepEqual(Array.from(current.options),old.options,old.id);}
  assert.ok(!lesson.sections.some(s=>s.html.includes('{{verb:')),n);
 }
});
test('skill preview, lookup and courses expose the same conjugation data',()=>{
 const {api,c,byName}=model(),etre=byName.get('être');
 assert.match(api.skillPreview('g-etre'),/nous sommes/);assert.ok(!api.skillPreview('g-past-etre'));
 assert.match(api.sectionLinks(14,'faire'),/present-faire/);assert.equal(api.lessonLink(20),'');
 assert.match(c.COURSE_LIBRARY.lessons.find(l=>l.number===1).sections.find(s=>s.id==='verbs').html,/sommes/);
 // Exercise the rendered knowledge view using the same data object, not a second hard-coded table.
 const original=etre.forms[3];etre.forms[3]='SHARED-TEST';assert.match(api.table(etre),/nous SHARED-TEST/);etre.forms[3]=original;
});
