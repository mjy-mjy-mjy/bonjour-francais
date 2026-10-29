'use strict';
(() => {
  const regions=[{id:'A1',name:'初识法语',x:22,y:47,description:'沿 Le Nouveau Taxi! 1 的 9 个单元、36 课探索。'},
    {id:'A2',name:'日常交流',x:76,y:54,description:'下一阶段：处理日常事务，叙述经历与安排。课程待扩充。'},
    {id:'B1',name:'连贯表达',x:44,y:22,description:'后续阶段：连续叙述、解释理由、协商解决问题。课程待扩充。'},
    {id:'B2',name:'深入讨论',x:82,y:17,description:'后续阶段：比较观点、论证与回应。课程待扩充；等级以测评为准。'}];
  const towns=[[14,64],[34,51],[42,74],[32,37],[48,61],[20,34],[12,47],[24,76],[47,44]];
  const skillNames={grammar:'语法',vocabulary:'词汇',pronunciation:'语音',reading:'阅读',speaking:'口语',writing:'写作'};
  const states=['未记录','接触过','能回忆','能运用','已复测'];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let cleanup=()=>{};
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
  function unitsModel(units,catalog,courses,state){return units.map((name,i)=>({number:i+1,name,point:towns[i],lessons:Array.from({length:4},(_,j)=>{
    const n=i*4+j+1,meta=catalog.find(c=>c.number===n);
    return {number:n,title:meta?.title||'教材学习记录',translation:meta?.translation||'详细讲义待补充',core:meta?.core||[],available:courses.has(n),completed:state.completed.includes(n)};
  })}));}
  function render(){return `<section class="knowledge-map" id="knowledge-map" aria-label="法语知识学习大陆">
    <header class="map-header"><a href="#route" class="map-brand">Bonjour Français<small>知识学习大陆</small></a><div class="map-actions"><a href="${esc(window.SKILL_TREE?.resumeHref()||'#skills')}">知识技能树</a><button data-map="atlas">知识图鉴</button><button data-map="list" aria-label="打开单元与课程列表">课程目录</button><button data-map="fullscreen">全屏</button><a href="#route">返回书房</a></div></header>
    <nav class="map-breadcrumb" id="map-breadcrumb" aria-label="地图位置"></nav>
    <div class="map-body">
      <div class="map-stage" id="map-stage" tabindex="0" aria-label="学习地图，可用方向键移动，加减键缩放，0键回到全貌">
        <div class="map-world" id="map-world"><img src="assets/knowledge-continent.webp" alt="羊皮纸上的法式城镇、庄园、河流、森林与山脉" draggable="false"><div id="map-markers"></div></div>
        <div class="map-load-error" id="map-load-error" hidden>地图底图暂未加载，可用“课程目录”继续学习。<button data-map="list">打开课程目录</button></div>
      </div>
      <aside class="map-panel" id="map-panel" hidden aria-label="课程与知识详情"><button class="map-panel-close" data-map="close" aria-label="关闭详情">×</button><div id="map-detail"></div></aside>
    </div>
    <footer class="map-footer"><div class="map-progress" id="map-progress" aria-live="polite"></div><div class="map-caption">拖动探索 · 滚轮或双指缩放 · 点击地点查看课程<span id="map-status" role="status" aria-live="polite"></span></div><div class="map-tools"><button data-map="zoom-in" aria-label="放大地图">＋</button><button data-map="zoom-out" aria-label="缩小地图">−</button><button data-map="reset">全貌</button><button data-map="current">我的位置</button></div></footer>
    </section>`;}
  function mount(adapter,level='world',unitArg){
    cleanup();const root=document.getElementById('knowledge-map');if(!root)return;
    const controller=new AbortController(),signal=controller.signal;
    const on=(target,type,fn,options={})=>target.addEventListener(type,fn,{...options,signal});
    const stage=root.querySelector('#map-stage'),world=root.querySelector('#map-world'),markers=root.querySelector('#map-markers'),panel=root.querySelector('#map-panel'),detail=root.querySelector('#map-detail');
    let model=unitsModel(adapter.units,adapter.catalog,adapter.courses,adapter.state());
    const entries=knowledgeEntries(adapter.courses);
    const current=adapter.currentLesson();
    const unit=unitNumber(unitArg,unitNumber(Math.ceil(current/4)));
    const unitView=level==='A1'&&unitArg!==undefined;
    const region=regions.find(r=>r.id===level);
    let view={x:0,y:0,scale:1},minScale=.2,activePointers=new Map(),pinch=null,returnFocus=null,focusPoint=[50,50],focusZoom=1,lastSize=null;
    const apply=()=>{view=constrainView(view,stage.clientWidth,stage.clientHeight);root.classList.toggle('map-labels-compact',view.scale<.7);world.style.transform=`translate(${view.x}px,${view.y}px) scale(${view.scale})`;world.style.setProperty('--pin-scale',1/view.scale);};
    const center=(x,y,multiplier=1)=>{focusPoint=[x,y];focusZoom=multiplier;view.scale=minScale*multiplier;view.x=stage.clientWidth*.5-x/100*2048*view.scale;view.y=stage.clientHeight*.5-y/100*1152*view.scale;apply();};
    const fit=()=>{minScale=Math.min(stage.clientWidth/2048,stage.clientHeight/1152);center(50,50);};
    const zoom=(factor,cx=stage.clientWidth/2,cy=stage.clientHeight/2)=>{const next=Math.max(minScale*.8,Math.min(minScale*5,view.scale*factor)),ratio=next/view.scale;view.x=cx-(cx-view.x)*ratio;view.y=cy-(cy-view.y)*ratio;view.scale=next;apply();};
    const open=html=>{if(!panel.contains(document.activeElement))returnFocus=document.activeElement;detail.innerHTML=html;panel.scrollTop=0;panel.hidden=false;root.querySelector('.map-panel-close').focus();};
    const close=()=>{panel.hidden=true;(returnFocus?.isConnected?returnFocus:stage).focus();};
    const title=(eyebrow,name)=>`<p class="map-eyebrow">${esc(eyebrow)}</p><h2>${esc(name)}</h2>`;
    const pin=(x,y,label,action,kind='',symbol='⌂')=>`<button class="map-pin ${kind}" style="left:${x}%;top:${y}%" data-map="${action}" aria-label="${esc(label)}"><span class="map-pin-symbol" aria-hidden="true">${symbol}</span><span class="map-pin-label">${esc(label)}</span></button>`;
    function updateProgress(){const s=adapter.state(),count=s.completed.length;root.querySelector('#map-progress').innerHTML=`<strong>A1 · 课程探索</strong><span>${count} / 36 课已标记学习</span><progress value="${count}" max="36" aria-label="A1课程学习记录"></progress><small>课程记录与能力等级分别追踪</small>`;}
    function draw(){
      model=unitsModel(adapter.units,adapter.catalog,adapter.courses,adapter.state());
      markers.innerHTML=(level==='A1'?[]:regions).map(r=>pin(r.x,r.y,r.id+' · '+r.name,'region:'+r.id,'region '+(r.id==='A1'?'active':''),r.id)).join('');
      if(level==='A1'){
        const visibleUnits=unitView?[model[unit-1]]:model;
        markers.innerHTML+=visibleUnits.map(u=>pin(...u.point,u.name,'unit:'+u.number,'town '+(u.number===unit&&unitView?'selected':''),'U'+u.number)).join('');
        if(unitView){
          const u=model[unit-1],offsets=[[-9,6],[-3,15],[5,15],[11,6]];
          markers.innerHTML+=u.lessons.map((l,i)=>pin(u.point[0]+offsets[i][0],u.point[1]+offsets[i][1],l.title,'lesson:'+l.number,'lesson '+(l.completed?'done ':'')+(l.number===adapter.currentLesson()?'active':''),String(l.number).padStart(2,'0'))).join('');
        }
      }
      root.querySelector('#map-breadcrumb').innerHTML=`<a href="#map">大陆全貌</a>${region?`<span>／</span><a href="#map/${region.id}">${region.id} · ${esc(region.name)}</a>`:''}${unitView?`<span>／</span><button data-map="unit:${unit}">单元 ${unit}</button>`:''}`;
      updateProgress();
    }
    function openUnit(n){const u=model[n-1];open(title('A1 / UNITÉ '+n,u.name)+`<p>第 ${(n-1)*4+1}—${n*4} 课 · ${u.lessons.filter(l=>l.completed).length}/4 已标记学习</p><div class="map-list">${u.lessons.map(l=>`<button data-map="lesson:${l.number}"><span>${String(l.number).padStart(2,'0')}</span><div><strong lang="fr">${esc(l.title)}</strong><small>${esc(l.translation)} · ${l.completed?'已学习':'待学习'} · ${l.available?'详细讲义':'教材笔记'}</small></div></button>`).join('')}</div>`);}
    function openLesson(n){const l=model[Math.ceil(n/4)-1].lessons.find(l=>l.number===n),knowledge=entries.filter(e=>e.lesson===n);open(title('A1 / 单元 '+Math.ceil(n/4)+' / 第 '+n+' 课',l.title)+`<p>${esc(l.translation)}</p><ul>${l.core.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>${!l.available?'<p>详细讲义待补充，可以先结合教材记录笔记。</p>':''}<div class="map-panel-actions"><a class="map-primary" href="#lesson/${n}">${l.available?'进入课程':'打开教材笔记'}</a><button data-map="complete:${n}">${l.completed?'撤销已学习标记':'标记本课已学习'}</button></div><h3>本课知识</h3><p class="map-muted">掌握状态由你自评记录；“已复测”请在隔日独立复测后选择。</p>${knowledge.map(e=>`<div class="map-knowledge"><a href="${e.href}">${esc(e.title)}</a><label>掌握状态<select data-map-mastery="${esc(e.id)}">${states.map((s,i)=>`<option value="${i}" ${Number(adapter.state().knowledgeMastery?.[e.id]?.level||0)===i?'selected':''}>${s}</option>`).join('')}</select></label></div>`).join('')}`);}
    function openList(){open(title('A1 / 教材目录','9 个单元 · 36 课')+`<div class="map-list">${model.map(u=>`<button data-map="unit:${u.number}"><span>${u.number}</span><div><strong>${esc(u.name)}</strong><small>第 ${(u.number-1)*4+1}—${u.number*4} 课</small></div></button>`).join('')}</div>`);}
    function openAtlas(){open(title('CONNAISSANCES / 跨课检索','知识图鉴')+`<label>查找知识<input id="map-atlas-search" type="search" placeholder="例如：过去时、动词、冠词"></label><label>分类<select id="map-atlas-category"><option value="">全部知识</option>${Object.entries(skillNames).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><p class="map-muted">汇集现有详细讲义；同一知识记录在课程与图鉴中共用。</p><div id="map-atlas-results"></div>`);filterAtlas();}
    function filterAtlas(){const input=root.querySelector('#map-atlas-search');if(!input)return;const term=input.value.trim().toLowerCase(),category=root.querySelector('#map-atlas-category').value;const found=entries.filter(e=>(!category||e.categories.includes(category))&&(!term||(e.title+' '+e.lesson).toLowerCase().includes(term)));root.querySelector('#map-atlas-results').innerHTML=`<p>${found.length} 项知识</p>`+found.map(e=>`<a class="map-atlas-item" href="${e.href}"><strong>${esc(e.title)}</strong><small>第 ${e.lesson} 课 · ${states[Number(adapter.state().knowledgeMastery?.[e.id]?.level||0)]}</small></a>`).join('');}
    on(root,'click',async e=>{const button=e.target.closest('[data-map]');if(!button)return;const [action,id]=button.dataset.map.split(':');
      if(action==='close')close();
      if(action==='region')location.hash='#map/'+id;
      if(action==='unit'){if(!unitView||Number(id)!==unit)location.hash='#map/A1/'+id;else openUnit(Number(id));}
      if(action==='lesson')openLesson(Number(id));
      if(action==='complete'){
        const n=Number(id),scroll=panel.scrollTop;
        if(adapter.toggleComplete(n)){draw();openLesson(n);panel.scrollTop=scroll;detail.querySelector('[data-map="complete:'+n+'"]').focus({preventScroll:true});root.querySelector('#map-status').textContent='课程学习记录已保存';}
        else root.querySelector('#map-status').textContent='记录未能保存，请导出备份';
      }
      if(action==='zoom-in')zoom(1.3);if(action==='zoom-out')zoom(1/1.3);if(action==='reset'){if(level!=='world')location.hash='#map';else{fit();close();}}
      if(action==='current'){const currentUnit=Math.ceil(adapter.currentLesson()/4);if(unitView&&unit===currentUnit){center(...model[currentUnit-1].point,2);openUnit(currentUnit);}else location.hash='#map/A1/'+currentUnit;}
      if(action==='atlas')openAtlas();
      if(action==='list')openList();
      if(action==='fullscreen'){try{if(document.fullscreenElement)await document.exitFullscreen();else await root.requestFullscreen();}catch{root.querySelector('#map-status').textContent='当前浏览器未允许系统全屏，地图已占满页面。';}}
    });
    on(root,'change',e=>{if(e.target.matches('[data-map-mastery]')){const ok=adapter.setMastery(e.target.dataset.mapMastery,Number(e.target.value));if(!ok)e.target.value=String(adapter.state().knowledgeMastery?.[e.target.dataset.mapMastery]?.level||0);root.querySelector('#map-status').textContent=ok?'知识掌握状态已保存':'掌握状态未能保存，请导出学习记录备份';}if(e.target.id==='map-atlas-category')filterAtlas();});
    on(root,'input',e=>{if(e.target.id==='map-atlas-search')filterAtlas();});
    on(stage,'wheel',e=>{e.preventDefault();const r=stage.getBoundingClientRect();zoom(Math.exp(-e.deltaY*.0015),e.clientX-r.left,e.clientY-r.top);},{passive:false});
    on(stage,'pointerdown',e=>{if(e.target.closest('button,a'))return;stage.focus();stage.setPointerCapture(e.pointerId);activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(activePointers.size===2){const [a,b]=[...activePointers.values()];pinch=Math.hypot(a.x-b.x,a.y-b.y);}});
    on(stage,'pointermove',e=>{const old=activePointers.get(e.pointerId);if(!old)return;activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(activePointers.size===2){const [a,b]=[...activePointers.values()],d=Math.hypot(a.x-b.x,a.y-b.y),r=stage.getBoundingClientRect();if(pinch)zoom(d/pinch,(a.x+b.x)/2-r.left,(a.y+b.y)/2-r.top);pinch=d;}else{view.x+=e.clientX-old.x;view.y+=e.clientY-old.y;apply();}});
    const release=e=>{activePointers.delete(e.pointerId);pinch=null;};on(stage,'pointerup',release);on(stage,'pointercancel',release);on(stage,'lostpointercapture',release);
    on(root,'keydown',e=>{if(e.key==='Escape'&&!panel.hidden){close();return;}if(e.target!==stage)return;const moves={ArrowLeft:[40,0],ArrowRight:[-40,0],ArrowUp:[0,40],ArrowDown:[0,-40]};if(moves[e.key]){e.preventDefault();view.x+=moves[e.key][0];view.y+=moves[e.key][1];apply();}if(e.key==='+'||e.key==='='){e.preventDefault();zoom(1.2);}if(e.key==='-'){e.preventDefault();zoom(1/1.2);}if(e.key==='0')fit();});
    const observer=new ResizeObserver(()=>{
      const width=stage.clientWidth,height=stage.clientHeight;
      if(!width||!height)return;
      root.classList.toggle('map-compact',width<700);
      const oldMin=minScale;minScale=Math.min(width/2048,height/1152);
      if(lastSize){
        const wx=(lastSize.width/2-view.x)/view.scale,wy=(lastSize.height/2-view.y)/view.scale;
        view.scale*=minScale/oldMin;view.x=width/2-wx*view.scale;view.y=height/2-wy*view.scale;apply();
      }else center(...focusPoint,focusZoom);
      lastSize={width,height};
    });observer.observe(stage);
    const img=world.querySelector('img');const imageFailed=()=>{root.querySelector('#map-load-error').hidden=false;};on(img,'error',imageFailed);if(img.complete&&!img.naturalWidth)imageFailed();
    draw();fit();if(unitView){const point=model[unit-1].point;center(point[0],point[1]+7,2);openUnit(unit);}else if(level==='A1'){center(30,55,1.25);openList();}else if(region){center(region.x,region.y,1.6);open(title(region.id+' / 后续区域',region.name)+`<p>${esc(region.description)}</p><p>这里保留后续学习方向，尚未接入教材课程。</p>`);}
    cleanup=()=>{controller.abort();observer.disconnect();};
  }
  window.KNOWLEDGE_MAP={render,mount,unmount:()=>cleanup(),knowledgeEntries,unitsModel,regions,states,constrainView,unitNumber};
})();
