'use strict';
(() => {
  const regions=[{id:'A1',name:'初识法语',x:22,y:47,description:'沿 Le Nouveau Taxi! 1 的 9 个单元、36 课探索。'},
    {id:'A2',name:'日常交流',x:76,y:54,description:'下一阶段：处理日常事务，叙述经历与安排。课程待扩充。'},
    {id:'B1',name:'连贯表达',x:44,y:22,description:'后续阶段：连续叙述、解释理由、协商解决问题。课程待扩充。'},
    {id:'B2',name:'深入讨论',x:82,y:17,description:'后续阶段：比较观点、论证与回应。课程待扩充；等级以测评为准。'}];
  const towns=[[14,64],[34,51],[42,74],[32,37],[48,61],[20,34],[12,47],[24,76],[47,44]];
  const skillNames={grammar:'语法',vocabulary:'词汇',pronunciation:'语音',listening:'听力',reading:'阅读',speaking:'口语',writing:'写作'};
  const states=['未记录','接触过','能回忆','能运用','已复测'];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let cleanup=()=>{},lastMapHash='',pendingLesson=null,atlasBookmark=null,pendingBookmark=null;
  const memory=new Map(),CACHE_KEY='bonjour-francais-map-view-v1';
  const validHash=h=>typeof h==='string'&&/^#map(?:\/(?:A1(?:\/[1-9])?|A2|B1|B2))?$/.test(h);
  const validView=(key,value)=>validHash(key)&&value&&['none','unit','lesson','list','atlas','region'].includes(value.panel)&&Number.isFinite(value.cx)&&Number.isFinite(value.cy)&&value.cx>=0&&value.cx<=2048&&value.cy>=0&&value.cy<=1152&&Number.isFinite(value.zoom)&&value.zoom>=.8&&value.zoom<=5&&Number.isFinite(value.scroll)&&value.scroll>=0&&value.scroll<=100000&&Number.isInteger(value.lesson)&&value.lesson>=0&&value.lesson<=36&&typeof value.query==='string'&&value.query.length<=200&&typeof value.category==='string';
  try {const saved=JSON.parse(window.sessionStorage?.getItem(CACHE_KEY)||'null');
    if(saved&&validHash(saved.last)){lastMapHash=saved.last;if(saved.atlasBookmark&&validView(saved.atlasBookmark.hash,saved.atlasBookmark.value))atlasBookmark=saved.atlasBookmark;
      for(const [key,value] of (Array.isArray(saved.views)?saved.views:[]).slice(-20)){
        if(validView(key,value))memory.set(key,value);
      }
    }
  } catch {}
  const resumeHref=()=>lastMapHash||'#map';
  const branchMarks={grammar:'句',vocabulary:'词',pronunciation:'音',listening:'听',reading:'读',speaking:'说',writing:'写'};
  function courseBadges(lesson,{current=false,viewed=false}={}){
    return [current&&{kind:'current',symbol:'◎',label:'当前学习'},viewed&&{kind:'viewed',symbol:'◇',label:'正在查看'},lesson.completed&&{kind:'done',symbol:'✓',label:'已学完'},!lesson.available&&{kind:'pending',symbol:'△',label:'讲义待补充'}].filter(Boolean);
  }
  const badgeHtml=badges=>badges.map(b=>`<span class="map-badge map-badge-${b.kind}"><span aria-hidden="true">${b.symbol}</span> ${b.label}</span>`).join('');
  function lessonSkills(n){return (window.FRENCH_SKILLS?.nodes||[]).filter(s=>!s.planned&&s.refs.some(r=>r.lesson===n));}
  function lessonDetail(l,knowledge,state,options={}){
    const skills=lessonSkills(l.number),labels=window.SKILL_TREE?.states||['未学习','已接触','能独立运用','复测巩固'];
    return `<p class="map-eyebrow">A1 / 单元 ${Math.ceil(l.number/4)} / 第 ${l.number} 课</p>
      <h2 ${l.available?'lang="fr"':''}>${esc(l.title)}</h2><p class="map-lesson-subtitle">${esc(l.translation)}</p>
      <div class="map-lesson-status">${badgeHtml(courseBadges(l,{...options,viewed:true}))}${!l.completed?'<span class="map-badge map-badge-neutral">未标记学完</span>':''}</div>
      <p class="map-course-source"><span>${l.available?'详细讲义':'教材笔记入口'}</span>${l.pages?'<span>教材 '+esc(l.pages)+' 页</span>':''}</p>
      <div class="map-panel-actions"><a class="map-primary" href="#lesson/${l.number}">${l.available?'进入讲义':'打开教材笔记'} <span aria-hidden="true">→</span></a><button data-map="atlas-lesson:${l.number}">本课知识图鉴</button><button data-map="review-lesson:${l.number}">复习本课</button></div>
      ${atlasBookmark?'<button class="map-return-results" data-map="atlas-return">↩ 返回图鉴结果</button>':''}
      <div class="map-completion-action"><button data-map="complete:${l.number}">${l.completed?'撤销已学习标记':'标记本课已学习'}</button><small>仅记录课程完成，与技能自评分开。</small></div>
      <div class="map-section-heading"><h3>本课关联技能</h3><span>${skills.length} 项</span></div><p class="map-muted">查看技能标准，继续阅读或记录自评。</p>
      <div class="map-skill-list">${skills.length?skills.map(n=>`<a class="map-atlas-item map-skill-row" href="#skills/${n.stage}/${n.branch}/${n.id}"><span class="map-skill-mark" aria-hidden="true">${branchMarks[n.branch]||'知'}</span><span class="map-skill-content"><strong>${esc(n.title)}</strong><small class="map-skill-state map-skill-level-${state.skillMastery?.[n.id]?.level||0}">技能自评 · ${esc(labels[state.skillMastery?.[n.id]?.level||0])}</small></span><span class="map-skill-arrow" aria-hidden="true">↗</span></a>`).join(''):'<p class="map-muted">本课尚无已收录的关联技能。</p>'}</div>
      <details class="map-chapters"><summary>章节目录与章节自评 · ${knowledge.length} 项</summary><p class="map-muted">章节自评保留原记录，与跨课技能自评分别记录。</p>${knowledge.map(e=>`<div class="map-knowledge"><a href="${e.href}">${esc(e.title)}</a><label>章节自评<select data-map-mastery="${esc(e.id)}">${states.map((label,i)=>`<option value="${i}" ${Number(state.knowledgeMastery?.[e.id]?.level||0)===i?'selected':''}>${label}</option>`).join('')}</select></label></div>`).join('')}</details>
      <details><summary>本课学习要点</summary><ul>${l.core.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></details>`;
  }
  const unitNumber=(value,fallback=1)=>Number.isInteger(Number(value))&&Number(value)>=1&&Number(value)<=9?Number(value):fallback;
  function constrainView(view,width,height){
    const worldWidth=2048*view.scale,worldHeight=1152*view.scale,pad=0;
    return {...view,
      x:worldWidth<=width?(width-worldWidth)/2:Math.max(width-worldWidth-pad,Math.min(pad,view.x)),
      y:worldHeight<=height?(height-worldHeight)/2:Math.max(height-worldHeight-pad,Math.min(pad,view.y))};
  }
  function knowledgeEntries(courses){
    return Array.from(courses.values()).sort((a,b)=>a.number-b.number).flatMap(c=>c.sections.filter(s=>!['practice','answers','sources','notes','check','goals','review'].includes(s.id)).map(s=>({
      id:c.number+':'+s.id,lesson:c.number,title:s.title,section:s.id,
      categories:Object.entries(c.categorySections||{}).filter(([,ids])=>ids.includes(s.id)).map(([key])=>key),
      href:'#lesson/'+c.number+'/'+s.id
    })));
  }
  function labelVisibility(items,scale,width,height){
    const boxes=[],visible=new Set();
    for(const item of [...items].sort((a,b)=>b.priority-a.priority)){
      if(item.anchorVisible===false)continue;
      const w=item.width>0?item.width:156,h=item.height>0?item.height:64;
      const x=item.x*scale+(item.offsetX||0),y=item.y*scale+(item.offsetY??24),box={left:x-w/2,right:x+w/2,top:y,bottom:y+h};
      if(box.left<0||box.right>width||box.top<0||box.bottom>height)continue;
      if(boxes.some(b=>box.left<b.right+6&&box.right>b.left-6&&box.top<b.bottom+6&&box.bottom>b.top-6))continue;
      visible.add(item.id);boxes.push(box);
    }
    return visible;
  }
  function labelPlacement(x,y,width,height,viewportWidth,viewportHeight,pinHeight=52){
    const distance=pinHeight/2+8;
    return {offsetX:width+16<=viewportWidth?Math.max(8+width/2-x,Math.min(viewportWidth-8-width/2-x,0)):0,
      offsetY:y+distance+height>viewportHeight-8?-height-distance:distance,
      anchorVisible:x>=0&&x<=viewportWidth&&y>=0&&y<=viewportHeight};
  }
  function unitFraming(point,width,height){
    const minimum=Math.min(width/2048,height/1152);
    const scale=Math.max(minimum,Math.min(minimum*5,1.6,(Math.max(120,width-224))/(2048*.20),(Math.max(90,height-160))/(1152*.15)));
    return constrainView({scale,x:width/2-(point[0]+1)/100*2048*scale,y:height*.44-(point[1]+7.5)/100*1152*scale},width,height);
  }
  const normalizeAtlas=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’‘]/g,"'").toLowerCase();
  function atlasModel(courses){
    const linked=new Map();
    const skills=(window.FRENCH_SKILLS?.nodes||[]).filter(n=>!n.planned).map(n=>{
      const seen=new Set(),refs=[];
      for(const ref of n.refs){
        const course=courses.get(ref.lesson),section=course?.sections.find(s=>s.id===ref.section),id=ref.lesson+':'+ref.section;
        if(!section||seen.has(id))continue;
        seen.add(id);
        refs.push({id,lesson:ref.lesson,title:section.title,courseTitle:course.title,translation:course.translation,href:'#lesson/'+ref.lesson+'/'+ref.section});
      }
      const skill={id:n.id,title:n.title,goal:n.goal,criteria:n.criteria,branch:n.branch,href:'#skills/'+n.stage+'/'+n.branch+'/'+n.id,refs,practiceRefs:[...new Set(refs.map(r=>r.lesson))].filter(number=>courses.get(number)?.sections.some(section=>section.id==='practice')).map(number=>({lesson:number,href:'#lesson/'+number+'/practice'}))};
      for(const ref of refs){if(!linked.has(ref.id))linked.set(ref.id,[]);linked.get(ref.id).push(skill);}
      return skill;
    });
    const chapters=knowledgeEntries(courses).map(e=>({...e,courseTitle:courses.get(e.lesson).title,translation:courses.get(e.lesson).translation,skills:linked.get(e.id)||[]}));
    return {skills,chapters};
  }
  const reviewLabels={all:'全部状态',unrecorded:'未记录掌握',touched:'已接触',independent:'能独立运用',due:'待复测',reviewed:'复测巩固'};
  function reviewState(record,now=Date.now()){
    if(!record?.level)return 'unrecorded';
    if(record.level===1)return 'touched';
    if(record.level===3)return 'reviewed';
    return (window.SKILL_TREE?.canReview(record,now)??(record.level===2&&Number.isFinite(Date.parse(record.masteredAt))&&now-Date.parse(record.masteredAt)>=86400000))?'due':'independent';
  }
  function atlasResults(atlas,{mode='knowledge',query='',category='',scopeUnit=0,scopeLesson=0}={}){
    const term=normalizeAtlas(query.trim()),inScope=n=>(!scopeUnit||Math.ceil(n/4)===scopeUnit)&&(!scopeLesson||n===scopeLesson);
    if(mode==='course')return atlas.chapters.filter(e=>inScope(e.lesson)&&(!category||e.categories.includes(category))&&(!term||normalizeAtlas([e.title,e.courseTitle,e.translation,'第'+e.lesson+'课',...e.skills.map(n=>n.title)].join(' ')).includes(term)));
    return atlas.skills.filter(n=>n.refs.some(r=>inScope(r.lesson))&&(!category||n.branch===category)&&(!term||normalizeAtlas([n.title,n.goal,...(n.criteria||[]),skillNames[n.branch],...n.refs.map(r=>['第'+r.lesson+'课',r.courseTitle,r.translation,r.title].join(' '))].join(' ')).includes(term)));
  }
  function atlasResultsHtml(found,mode,state,review=false){
    if(!found.length)return '<p class="map-muted">没有匹配结果，试试其他关键词或分类。</p><button class="map-atlas-clear" data-map="atlas-clear">清除筛选</button>';
    if(mode==='knowledge'){
      const labels=window.SKILL_TREE?.states||['未学习','已接触','能独立运用','复测巩固'];
      return found.map(n=>`<article class="map-atlas-card"><h3><a href="${esc(n.href)}">${esc(n.title)}</a></h3><p class="map-muted">${esc(skillNames[n.branch])} · 技能自评：${esc(labels[state.skillMastery?.[n.id]?.level||0])}</p><p>${esc(n.goal)}</p>${review?`<p class="map-review-state">复习状态：${reviewLabels[reviewState(state.skillMastery?.[n.id])]}</p><a class="map-review-standard" href="${esc(n.href)}">查看掌握标准并记录自评 →</a><p class="map-muted">课程练习按出处提供，不代表逐题对应本技能。</p>${(n.practiceRefs||[]).map(r=>`<a class="map-review-practice" href="${r.href}">第 ${r.lesson} 课 · 已有书面练习与答案</a>`).join('')}`:''}<p class="map-atlas-source-label">课程出处</p><ul class="map-atlas-refs">${n.refs.map(r=>`<li><a href="${esc(r.href)}">第 ${r.lesson} 课 · ${esc(r.courseTitle)}<span>${esc(r.title)}</span></a><button class="map-locate" data-map="locate:${r.lesson}">定位第 ${r.lesson} 课</button></li>`).join('')}</ul>${n.refs.length?'':'<p class="map-muted">章节出处待补充。</p>'}</article>`).join('');
    }
    const groups=new Map();
    for(const e of found){if(!groups.has(e.lesson))groups.set(e.lesson,[]);groups.get(e.lesson).push(e);}
    return [...groups].map(([number,chapters])=>`<section class="map-atlas-course"><h3><a href="#lesson/${number}">第 ${number} 课 · ${esc(chapters[0].courseTitle)}</a></h3>${chapters.map(e=>`<div class="map-atlas-chapter"><button class="map-locate" data-map="locate:${number}">定位第 ${number} 课</button><a class="map-atlas-item" href="${esc(e.href)}"><strong>${esc(e.title)}</strong><small>章节自评：${esc(states[state.knowledgeMastery?.[e.id]?.level||0])}</small></a>${e.skills.length?`<div class="map-atlas-links"><span>关联知识</span>${e.skills.map(n=>`<a href="${esc(n.href)}">${esc(n.title)}</a>`).join('')}</div>`:'<p class="map-muted">关联知识待整理</p>'}</div>`).join('')}</section>`).join('');
  }
  function unitsModel(units,catalog,courses,state){return units.map((name,i)=>({number:i+1,name,point:towns[i],lessons:Array.from({length:4},(_,j)=>{
    const n=i*4+j+1,meta=catalog.find(c=>c.number===n);
    return {number:n,title:meta?.title||'教材学习记录',translation:meta?.translation||'详细讲义待补充',core:meta?.core||[],pages:meta?.pages||'',available:courses.has(n),completed:state.completed.includes(n)};
  })}));}
  function render(){return `<section class="knowledge-map" id="knowledge-map" aria-label="法语知识学习大陆">
    <header class="map-header"><a href="#route" class="map-brand">Bonjour Français<small>知识学习大陆</small></a>
      <nav class="map-actions" aria-label="学习与地图导航"><div class="map-learning-nav"><button data-map="list" aria-label="打开单元与课程列表">课程目录</button><button data-map="atlas">知识图鉴</button><button data-map="review">知识复习</button><a href="${esc(window.SKILL_TREE?.resumeHref()||'#skills')}">知识技能树 <span aria-hidden="true">↗</span></a></div>
      <div class="map-utility-nav"><details class="map-more"><summary>地图工具</summary><div><button data-map="fullscreen">全屏</button><button data-map="route-sample">第6单元路线样板</button></div></details><a href="#route" class="map-home">返回书房</a></div></nav></header>
    <nav class="map-breadcrumb" id="map-breadcrumb" aria-label="地图位置"></nav>
    <div class="map-body">
      <div class="map-stage" id="map-stage" tabindex="0" aria-label="学习地图，可用方向键移动，加减键缩放，0键回到全貌">
        <div class="map-world" id="map-world"><img src="assets/knowledge-continent.webp" alt="羊皮纸上的法式城镇、庄园、河流、森林与山脉" draggable="false"><div id="map-markers"></div></div>
        <div class="map-load-error" id="map-load-error" hidden>地图底图暂未加载，可用“课程目录”继续学习。<button data-map="list">打开课程目录</button></div>
      </div>
      <aside class="map-panel" id="map-panel" hidden aria-label="课程与知识详情"><button class="map-panel-close" data-map="close" aria-label="关闭详情">×</button><div id="map-detail"></div></aside>
    </div>
    <footer class="map-footer"><div class="map-progress" id="map-progress" aria-live="polite"></div>
      <div class="map-caption"><div class="map-legend">${badgeHtml([{kind:'current',symbol:'◎',label:'当前学习'},{kind:'viewed',symbol:'◇',label:'正在查看'},{kind:'done',symbol:'✓',label:'已学完'},{kind:'pending',symbol:'△',label:'讲义待补充'}])}</div><span id="map-status" role="status" aria-live="polite"></span></div>
      <div class="map-tools" aria-label="地图视图控制"><div class="map-zoom-group"><button data-map="zoom-out" aria-label="缩小地图">−</button><output id="map-scale" aria-live="off" aria-label="相对全貌缩放">100%</output><button data-map="zoom-in" aria-label="放大地图">＋</button></div><button data-map="reset">全貌</button><button class="map-current-action" data-map="current">◎ 我的位置</button></div></footer>
    </section>`;}
  function mount(adapter,level='world',unitArg){
    cleanup();const root=document.getElementById('knowledge-map');if(!root)return;
    const controller=new AbortController(),signal=controller.signal;
    const on=(target,type,fn,options={})=>target.addEventListener(type,fn,{...options,signal});
    const stage=root.querySelector('#map-stage'),world=root.querySelector('#map-world'),markers=root.querySelector('#map-markers'),panel=root.querySelector('#map-panel'),detail=root.querySelector('#map-detail');
    let model=unitsModel(adapter.units,adapter.catalog,adapter.courses,adapter.state());
    const entries=knowledgeEntries(adapter.courses);
    const atlas=atlasModel(adapter.courses);
    const current=adapter.currentLesson();
    const unit=unitNumber(unitArg,unitNumber(Math.ceil(current/4)));
    const unitView=level==='A1'&&unitArg!==undefined;
    const region=regions.find(r=>r.id===level);
    const key=level==='A1'?'#map/A1'+(unitView?'/'+unit:''):region?'#map/'+region.id:'#map';
    lastMapHash=key;
    let panelKind='none',selectedLesson=0,reviewMode=false,reviewFilter='all',scopeUnit=0,scopeLesson=0,routeSample=false,query='',category='',atlasMode='knowledge',disposed=false,restoreFrame=0,restoring=false,autoFraming=false;
    const remembered=pendingBookmark?.hash===key?pendingBookmark.value:memory.get(key);pendingBookmark=null;
    let view={x:0,y:0,scale:1},minScale=.2,activePointers=new Map(),pinch=null,returnFocus=null,focusPoint=[50,50],focusZoom=1,lastSize=null;
    const apply=()=>{view=constrainView(view,stage.clientWidth,stage.clientHeight);root.classList.toggle('map-labels-compact',view.scale<.7);world.style.transform=`translate(${view.x}px,${view.y}px) scale(${view.scale})`;world.style.setProperty('--pin-scale',1/view.scale);root.querySelector('#map-scale').textContent=Math.round(view.scale/minScale*100)+'%';layoutLabels();};
    const center=(x,y,multiplier=1)=>{focusPoint=[x,y];focusZoom=multiplier;view.scale=minScale*multiplier;view.x=stage.clientWidth*.5-x/100*2048*view.scale;view.y=stage.clientHeight*.5-y/100*1152*view.scale;apply();};
    const fit=()=>{minScale=Math.min(stage.clientWidth/2048,stage.clientHeight/1152);center(50,50);};
    const zoom=(factor,cx=stage.clientWidth/2,cy=stage.clientHeight/2)=>{autoFraming=false;const next=Math.max(minScale*.8,Math.min(minScale*5,view.scale*factor)),ratio=next/view.scale;view.x=cx-(cx-view.x)*ratio;view.y=cy-(cy-view.y)*ratio;view.scale=next;apply();};
    const open=html=>{if(!panel.contains(document.activeElement))returnFocus=document.activeElement;detail.innerHTML=html;panel.scrollTop=0;panel.hidden=false;root.querySelector('.map-panel-close').focus({preventScroll:true});};
    const close=()=>{panelKind='none';panel.hidden=true;(returnFocus?.isConnected?returnFocus:stage).focus();};
    const title=(eyebrow,name)=>`<p class="map-eyebrow">${esc(eyebrow)}</p><h2>${esc(name)}</h2>`;
    function frameUnit(){
      if(!unitView)return;cancelAnimationFrame(restoreFrame);restoring=false;autoFraming=true;
      minScale=Math.min(stage.clientWidth/2048,stage.clientHeight/1152);
      view=unitFraming(model[unit-1].point,stage.clientWidth,stage.clientHeight);apply();
    }
    function layoutLabels(){
      const pins=[...(markers.querySelectorAll?.('.map-pin')||[])];
      const items=pins.map((p,i)=>{
        const label=p.querySelector('.map-pin-label'),bounds=label?.getBoundingClientRect(),pinBounds=p.getBoundingClientRect();
        const width=bounds?.width||190,height=bounds?.height||80;
        const x=Number(p.dataset.x)/100*2048+view.x/view.scale,y=Number(p.dataset.y)/100*1152+view.y/view.scale;
        const placement=labelPlacement(x*view.scale,y*view.scale,width,height,stage.clientWidth,stage.clientHeight,pinBounds.height||52);
        p.style.setProperty('--label-shift-x',placement.offsetX+'px');p.style.setProperty('--label-offset-y',placement.offsetY+'px');
        return {id:i,x,y,width,height,...placement,priority:Number(p.dataset.priority)||0};
      });
      const visible=labelVisibility(items,view.scale,stage.clientWidth,stage.clientHeight);
      pins.forEach((p,i)=>p.classList.toggle('map-label-hidden',!visible.has(i)));
    }
    const pin=(x,y,label,action,kind='',symbol='⌂',options={})=>`<button class="map-pin ${kind}" style="left:${x}%;top:${y}%" data-map="${action}" data-x="${x}" data-y="${y}" data-priority="${kind.includes('lesson')&&kind.includes('selected')?5:kind.includes('lesson')&&kind.includes('active')?4:kind.includes('selected')?3:kind.includes('active')?2:1}" aria-label="${esc(label)}"><span class="map-pin-symbol" aria-hidden="true">${options.number?`<span class="map-pin-number">${esc(options.number)}</span><span class="map-pin-flags">${esc(symbol)}</span>`:esc(symbol)}</span><span class="map-pin-label"><strong class="map-pin-title" ${options.french?'lang="fr"':''}>${esc(options.title||label)}</strong>${options.meta?`<small class="map-pin-meta">${esc(options.meta)}</small>`:''}${options.badges?.length?`<span class="map-pin-states">${badgeHtml(options.badges)}</span>`:''}</span></button>`;
    function updateProgress(){const s=adapter.state(),count=s.completed.length;root.querySelector('#map-progress').innerHTML=`<strong>第 ${adapter.currentLesson()} 课 · 当前学习</strong><span>${count} / 36 课已标记学习</span><progress value="${count}" max="36" aria-label="A1课程学习记录"></progress><small>课程记录与能力等级分别追踪</small>`;}
    function draw(){
      model=unitsModel(adapter.units,adapter.catalog,adapter.courses,adapter.state());
      markers.innerHTML=(level==='A1'?[]:regions).map(r=>pin(r.x,r.y,r.id+' · '+r.name,'region:'+r.id,'region '+(r.id==='A1'?'active':''),r.id)).join('');
      if(level==='A1'){
        const visibleUnits=unitView?[model[unit-1]]:model;
        markers.innerHTML+=visibleUnits.map(u=>pin(...u.point,'单元 '+u.number+' · '+u.name,'unit:'+u.number,'town '+(u.number===unit&&unitView?'selected':''),'U'+u.number,{title:u.name,french:true,meta:'单元 '+u.number+' · 第 '+((u.number-1)*4+1)+'—'+(u.number*4)+' 课'})).join('');
        if(unitView){
          const u=model[unit-1],offsets=[[-9,6],[-3,15],[5,15],[11,6]];
          markers.innerHTML+=u.lessons.map((l,i)=>{
            const badges=courseBadges(l,{current:l.number===adapter.currentLesson(),viewed:l.number===selectedLesson});
            const description='第 '+l.number+' 课 · '+l.title+(badges.length?' · '+badges.map(b=>b.symbol+' '+b.label).join(' / '):'');
            return pin(u.point[0]+offsets[i][0],u.point[1]+offsets[i][1],description,'lesson:'+l.number,'lesson '+(!l.available?'unavailable ':'')+(l.completed?'done ':'')+(l.number===adapter.currentLesson()?'active ':'')+(l.number===selectedLesson?'selected':''),badges.map(b=>b.symbol).join(' '),{number:String(l.number).padStart(2,'0'),title:l.title,french:l.available,badges});
          }).join('');
        }
      }
      root.querySelector('#map-breadcrumb').innerHTML=`<a href="#map">大陆全貌</a>${region?`<span>／</span><a href="#map/${region.id}">${region.id} · ${esc(region.name)}</a>`:''}${unitView?`<span>／</span><button data-map="unit:${unit}">单元 ${unit}</button>`:''}`;
      if(routeSample&&unitView&&unit===6){const u=model[5],offsets=[[-9,6],[-3,15],[5,15],[11,6]];markers.innerHTML='<svg class="map-route-sample" viewBox="0 0 2048 1152" aria-label="第6单元课次顺序样板，不代表必经学习路径"><polyline points="'+offsets.map(([x,y])=>((u.point[0]+x)/100*2048)+','+((u.point[1]+y)/100*1152)).join(' ')+'"/></svg>'+markers.innerHTML;}
      layoutLabels();updateProgress();
    }
    function openUnit(n){panelKind='unit';selectedLesson=0;const u=model[n-1];open(title('A1 / UNITÉ '+n,u.name)+`<p>第 ${(n-1)*4+1}—${n*4} 课 · ${u.lessons.filter(l=>l.completed).length}/4 已标记学习</p><div class="map-list">${u.lessons.map(l=>`<button data-map="lesson:${l.number}"><span>${String(l.number).padStart(2,'0')}</span><div><strong lang="fr">${esc(l.title)}</strong><small>${esc(l.translation)} · ${l.completed?'已学习':'待学习'} · ${l.available?'详细讲义':'教材笔记'}</small></div></button>`).join('')}</div>`);draw();}
    function openLesson(n){if(!Number.isInteger(n)||n<1||n>36)return;selectedLesson=n;panelKind='lesson';const l=model[Math.ceil(n/4)-1].lessons.find(l=>l.number===n);open(lessonDetail(l,entries.filter(e=>e.lesson===n),adapter.state(),{current:n===adapter.currentLesson()}));draw();}
    function openList(){panelKind='list';open(title('A1 / 教材目录','9 个单元 · 36 课')+`<div class="map-list">${model.map(u=>`<button data-map="unit:${u.number}"><span>${u.number}</span><div><strong>${esc(u.name)}</strong><small>第 ${(u.number-1)*4+1}—${u.number*4} 课</small></div></button>`).join('')}</div>`);}
    function openAtlas(){
      panelKind='atlas';if(!Object.hasOwn(reviewLabels,reviewFilter))reviewFilter='all';if(!Object.hasOwn(skillNames,category))category='';
      const scopeControls=`<div class="map-scope"><label>单元<select id="map-atlas-unit"><option value="0">全部单元</option>${model.map(u=>`<option value="${u.number}">单元 ${u.number} · ${esc(u.name)}</option>`).join('')}</select></label><label>课次<select id="map-atlas-lesson"><option value="0">全部课次</option>${model.flatMap(u=>u.lessons).filter(l=>!scopeUnit||Math.ceil(l.number/4)===scopeUnit).map(l=>`<option value="${l.number}">第 ${l.number} 课 · ${esc(l.title)}</option>`).join('')}</select></label></div>`;
      open(title('CONNAISSANCES / 跨课检索',reviewMode?'知识复习':'知识图鉴')+`${reviewMode?'':`<nav class="map-atlas-modes" aria-label="图鉴浏览方式"><button data-map="atlas-mode:knowledge" aria-pressed="${atlasMode==='knowledge'}">按知识</button><button data-map="atlas-mode:course" aria-pressed="${atlasMode==='course'}">按课程</button></nav>`}<button class="map-atlas-clear" data-map="atlas-clear">清除筛选</button><label>搜索知识、课程或章节<input id="map-atlas-search" type="search" maxlength="200" placeholder="例如：命令式、21、Téléphone"></label><label>分类<select id="map-atlas-category"><option value="">全部分类</option>${Object.entries(skillNames).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label>${scopeControls}${reviewMode?`<label>技能自评状态<select id="map-review-status">${Object.entries(reviewLabels).map(([id,name])=>`<option value="${id}">${name}</option>`).join('')}</select></label><p class="map-muted">选范围后查看讲义、练习和掌握标准。自评后返回本列表继续；待复测沿用已记录掌握时间满24小时的规则，不代表已经通过测评。</p>`:''}<p class="map-muted">${atlasMode==='knowledge'?'已收录 '+atlas.skills.length+' 个知识点，点击名称查看技能详情及自评标准。':'按课程保留现有讲义章节，关联知识逐步整理。'}章节自评与技能自评分别记录。</p><p id="map-atlas-scope" class="map-muted"></p><p id="map-atlas-count" role="status" aria-live="polite"></p><div id="map-atlas-results"></div>`);
      if(reviewMode)root.querySelector('#map-review-status').value=reviewFilter;root.querySelector('#map-atlas-unit').value=String(scopeUnit);root.querySelector('#map-atlas-lesson').value=String(scopeLesson);root.querySelector('#map-atlas-search').value=query;root.querySelector('#map-atlas-category').value=category;filterAtlas();
    }
    function filterAtlas(){
      const input=root.querySelector('#map-atlas-search');if(!input)return;
      query=input.value.slice(0,200);category=root.querySelector('#map-atlas-category').value;
      const found=atlasResults(atlas,{mode:atlasMode,query,category,scopeUnit,scopeLesson}).filter(n=>!reviewMode||reviewFilter==='all'||reviewState(adapter.state().skillMastery?.[n.id])===reviewFilter);root.querySelector('#map-atlas-scope').textContent=[scopeUnit?'单元 '+scopeUnit:'全部单元',scopeLesson?'第 '+scopeLesson+' 课':'全部课次',skillNames[category]||'全部分类',query?'搜索：'+query:''].filter(Boolean).join(' · ');
      root.querySelector('#map-atlas-count').textContent=atlasMode==='knowledge'?found.length+' 个知识点'+(scopeLesson?' · 第 '+scopeLesson+' 课':scopeUnit?' · 单元 '+scopeUnit:''):new Set(found.map(e=>e.lesson)).size+' 课 · '+found.length+' 个章节';
      root.querySelector('#map-atlas-results').innerHTML=atlasResultsHtml(found,atlasMode,adapter.state(),reviewMode);panel.scrollTop=0;
    }
    on(root,'click',async e=>{const button=e.target.closest('[data-map]');if(!button)return;root.querySelector('.map-more').open=false;const [action,id]=button.dataset.map.split(':');
      if(action==='close')close();
      if(action==='region')location.hash='#map/'+id;
      if(action==='unit'){if(!unitView||Number(id)!==unit)location.hash='#map/A1/'+id;else openUnit(Number(id));}
      if(action==='lesson')openLesson(Number(id));
      if(action==='complete'){
        const n=Number(id),scroll=panel.scrollTop;
        if(adapter.toggleComplete(n)){draw();openLesson(n);panel.scrollTop=scroll;detail.querySelector('[data-map="complete:'+n+'"]').focus({preventScroll:true});root.querySelector('#map-status').textContent='课程学习记录已保存';}
        else root.querySelector('#map-status').textContent='记录未能保存，请导出备份';
      }
      if(action==='zoom-in')zoom(1.3);if(action==='zoom-out')zoom(1/1.3);
      if(action==='reset'){
        if(level!=='world'){
          // Explicit reset discards the world view; ordinary links still resume it.
          memory.delete('#map');pendingLesson=null;location.hash='#map';
        }else{
          cancelAnimationFrame(restoreFrame);restoring=false;fit();close();
        }
      }
      if(action==='current'){const currentUnit=Math.ceil(adapter.currentLesson()/4);if(unitView&&unit===currentUnit){openLesson(adapter.currentLesson());frameUnit();}else {pendingLesson=adapter.currentLesson();location.hash='#map/A1/'+currentUnit;}}
      if(action==='route-sample'){if(unitView&&unit===6){routeSample=!routeSample;draw();root.querySelector('#map-status').textContent=routeSample?'第6单元课次顺序样板，视觉待验':'路线样板已关闭';}else root.querySelector('#map-status').textContent='请进入第6单元查看路线样板';}
      if(action==='review'||action==='review-lesson'){reviewMode=true;reviewFilter='all';atlasMode='knowledge';query='';category='';scopeLesson=action==='review-lesson'?Number(id):0;scopeUnit=scopeLesson?Math.ceil(scopeLesson/4):0;openAtlas();}
      if(action==='atlas-lesson'){reviewMode=false;scopeLesson=Number(id);scopeUnit=Math.ceil(scopeLesson/4);query='';category='';atlasMode='knowledge';openAtlas();}
      if(action==='locate'){
        const n=Number(id);if(!Number.isInteger(n)||n<1||n>36)return;
        if(panelKind==='atlas'){remember();atlasBookmark={hash:key,value:memory.get(key)};}
        if(unitView&&Math.ceil(n/4)===unit){openLesson(n);frameUnit();}else{pendingLesson=n;location.hash='#map/A1/'+Math.ceil(n/4);}
      }
      if(action==='atlas-return'&&atlasBookmark){const back=atlasBookmark;cleanup();pendingBookmark=back;if(back.hash===key)mount(adapter,level,unitArg);else location.hash=back.hash;}
      if(action==='atlas'){reviewMode=false;openAtlas();}
      if(action==='atlas-mode'&&!reviewMode&&['knowledge','course'].includes(id)){reviewMode=false;atlasMode=id;openAtlas();root.querySelector('[data-map="atlas-mode:'+id+'"]').focus({preventScroll:true});}
      if(action==='atlas-clear'){reviewFilter='all';scopeUnit=0;scopeLesson=0;query='';category='';openAtlas();root.querySelector('#map-atlas-search').value='';root.querySelector('#map-atlas-category').value='';filterAtlas();root.querySelector('#map-atlas-search').focus({preventScroll:true});}
      if(action==='list')openList();
      if(action==='fullscreen'){try{if(document.fullscreenElement)await document.exitFullscreen();else await root.requestFullscreen();}catch{root.querySelector('#map-status').textContent='当前浏览器未允许系统全屏，地图已占满页面。';}}
    });
    on(root,'change',e=>{if(e.target.matches('[data-map-mastery]')){const ok=adapter.setMastery(e.target.dataset.mapMastery,Number(e.target.value));if(!ok)e.target.value=String(adapter.state().knowledgeMastery?.[e.target.dataset.mapMastery]?.level||0);root.querySelector('#map-status').textContent=ok?'知识掌握状态已保存':'掌握状态未能保存，请导出学习记录备份';}if(e.target.id==='map-atlas-category')filterAtlas();if(e.target.id==='map-review-status'){reviewFilter=Object.hasOwn(reviewLabels,e.target.value)?e.target.value:'all';filterAtlas();}if(['map-atlas-unit','map-atlas-lesson'].includes(e.target.id)){scopeUnit=unitNumber(root.querySelector('#map-atlas-unit').value,0);const n=Number(root.querySelector('#map-atlas-lesson').value);scopeLesson=Number.isInteger(n)&&n>=1&&n<=36&&(!scopeUnit||Math.ceil(n/4)===scopeUnit)?n:0;openAtlas();root.querySelector('#'+e.target.id).focus({preventScroll:true});}});
    on(root,'input',e=>{if(e.target.id==='map-atlas-search')filterAtlas();});
    on(stage,'wheel',e=>{e.preventDefault();const r=stage.getBoundingClientRect();zoom(Math.exp(-e.deltaY*.0015),e.clientX-r.left,e.clientY-r.top);},{passive:false});
    on(stage,'pointerdown',e=>{if(e.target.closest('button,a'))return;stage.focus();stage.setPointerCapture(e.pointerId);activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(activePointers.size===2){const [a,b]=[...activePointers.values()];pinch=Math.hypot(a.x-b.x,a.y-b.y);}});
    on(stage,'pointermove',e=>{const old=activePointers.get(e.pointerId);if(!old)return;autoFraming=false;activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(activePointers.size===2){const [a,b]=[...activePointers.values()],d=Math.hypot(a.x-b.x,a.y-b.y),r=stage.getBoundingClientRect();if(pinch)zoom(d/pinch,(a.x+b.x)/2-r.left,(a.y+b.y)/2-r.top);pinch=d;}else{view.x+=e.clientX-old.x;view.y+=e.clientY-old.y;apply();}});
    const release=e=>{activePointers.delete(e.pointerId);pinch=null;};on(stage,'pointerup',release);on(stage,'pointercancel',release);on(stage,'lostpointercapture',release);
    on(root,'keydown',e=>{if(e.key==='Escape'){const more=root.querySelector('.map-more');if(more.open){e.preventDefault();more.open=false;more.querySelector('summary').focus();return;}if(!panel.hidden){close();return;}}if(e.target!==stage)return;const moves={ArrowLeft:[40,0],ArrowRight:[-40,0],ArrowUp:[0,40],ArrowDown:[0,-40]};if(moves[e.key]){autoFraming=false;e.preventDefault();view.x+=moves[e.key][0];view.y+=moves[e.key][1];apply();}if(e.key==='+'||e.key==='='){e.preventDefault();zoom(1.2);}if(e.key==='-'){e.preventDefault();zoom(1/1.2);}if(e.key==='0'){autoFraming=false;fit();}});
    const observer=new ResizeObserver(()=>{
      const width=stage.clientWidth,height=stage.clientHeight;
      if(!width||!height)return;
      root.classList.toggle('map-compact',width<700);
      const oldMin=minScale;minScale=Math.min(width/2048,height/1152);
      if(autoFraming&&unitView){frameUnit();}
      else if(lastSize){
        const wx=(lastSize.width/2-view.x)/view.scale,wy=(lastSize.height/2-view.y)/view.scale;
        view.scale*=minScale/oldMin;view.x=width/2-wx*view.scale;view.y=height/2-wy*view.scale;apply();
      }else if(!restoring)center(...focusPoint,focusZoom);
      lastSize={width,height};
    });observer.observe(stage);
    const img=world.querySelector('img');const imageFailed=()=>{root.querySelector('#map-load-error').hidden=false;};on(img,'error',imageFailed);if(img.complete&&!img.naturalWidth)imageFailed();
    draw();fit();if(unitView){openUnit(unit);frameUnit();}else if(level==='A1'){center(30,55,1.25);openList();}else if(region){center(region.x,region.y,1.6);panelKind='region';open(title(region.id+' / 后续区域',region.name)+`<p>${esc(region.description)}</p><p>这里保留后续学习方向，尚未接入教材课程。</p>`);}
    function remember(){
      if(restoring)return;
      const size=lastSize||{width:stage.clientWidth,height:stage.clientHeight};
      const value={cx:(size.width/2-view.x)/view.scale,cy:(size.height/2-view.y)/view.scale,zoom:view.scale/minScale,panel:panel.hidden?'none':panelKind,lesson:selectedLesson,scroll:panel.scrollTop,query,category,scopeUnit,scopeLesson,reviewMode,reviewFilter,atlasMode,chapters:!!detail.querySelector('.map-chapters')?.open};
      memory.delete(key);memory.set(key,value);while(memory.size>20)memory.delete(memory.keys().next().value);
      try{window.sessionStorage?.setItem(CACHE_KEY,JSON.stringify({last:key,views:[...memory],atlasBookmark}));}catch{}
    }
    if(pendingLesson&&unitView&&Math.ceil(pendingLesson/4)===unit){openLesson(pendingLesson);pendingLesson=null;}
    else if(remembered){
      query=remembered.query;category=remembered.category;reviewMode=remembered.reviewMode===true;reviewFilter=Object.hasOwn(reviewLabels,remembered.reviewFilter)?remembered.reviewFilter:'all';scopeUnit=unitNumber(remembered.scopeUnit,0);const savedLesson=Number(remembered.scopeLesson);scopeLesson=Number.isInteger(savedLesson)&&savedLesson>=1&&savedLesson<=36&&(!scopeUnit||Math.ceil(savedLesson/4)===scopeUnit)?savedLesson:0;
      // Old atlas snapshots held chapter results; keep their filters in that view.
      atlasMode=remembered.atlasMode==='course'||(remembered.atlasMode===undefined&&remembered.panel==='atlas')?'course':'knowledge';
      if(reviewMode)atlasMode='knowledge';
      if(remembered.panel==='lesson'&&remembered.lesson&&(!unitView||Math.ceil(remembered.lesson/4)===unit))openLesson(remembered.lesson);
      else if(remembered.panel==='atlas')openAtlas();
      else if(remembered.panel==='list')openList();
      else if(remembered.panel==='none')panel.hidden=true;
      restoring=true;autoFraming=false;
      restoreFrame=requestAnimationFrame(()=>{
        minScale=Math.min(stage.clientWidth/2048,stage.clientHeight/1152);view.scale=minScale*remembered.zoom;view.x=stage.clientWidth/2-remembered.cx*view.scale;view.y=stage.clientHeight/2-remembered.cy*view.scale;apply();lastSize={width:stage.clientWidth,height:stage.clientHeight};
        // Restore content height before the browser clamps the requested scroll.
        const chapters=detail.querySelector('.map-chapters');if(chapters)chapters.open=!!remembered.chapters;
        panel.scrollTop=remembered.scroll;restoring=false;
      });
    }
    on(window,'pagehide',remember);
    cleanup=()=>{if(disposed)return;disposed=true;remember();cancelAnimationFrame(restoreFrame);controller.abort();observer.disconnect();};
  }
  window.KNOWLEDGE_MAP={render,mount,unmount:()=>cleanup(),knowledgeEntries,reviewLabels,reviewState,labelVisibility,labelPlacement,atlasModel,atlasResults,atlasResultsHtml,unitsModel,regions,states,constrainView,unitNumber,resumeHref,resumeLabel:()=>memory.get(lastMapHash)?.reviewMode?'返回知识复习':'返回知识大陆',hasVisited:()=>!!lastMapHash,lessonDetail,lessonSkills,courseBadges,unitFraming};
})();
