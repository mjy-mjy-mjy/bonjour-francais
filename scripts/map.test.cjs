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
 assert.equal(lessons.filter(l=>l.available).length,20);assert.equal(lessons[13].title,'À Londres');assert.equal(lessons[35].available,false);assert.equal(lessons[35].completed,true);
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

