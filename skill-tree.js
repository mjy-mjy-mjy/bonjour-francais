'use strict';
(() => {
  const data=window.FRENCH_SKILLS;
  const DAY=86400000;
  const states=['未学习','已接触','能独立运用','复测巩固'];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const byId=new Map(data.nodes.map(n=>[n.id,n]));
  const groups={verbs:'动词与时态',nominals:'冠词与修饰',structure:'句型与代词'};
  let dispose=()=>{},activeNavigate=null;
  const canReview=(record,now=Date.now())=>Boolean(record?.level>=2&&record.masteredAt&&now-Date.parse(record.masteredAt)>=DAY);
  function summary(nodes,records={},now=Date.now()){
    const actual=nodes.filter(n=>!n.planned);
    return {total:actual.length,touched:actual.filter(n=>(records[n.id]?.level||0)>=1).length,mastered:actual.filter(n=>(records[n.id]?.level||0)>=2).length,reviewed:actual.filter(n=>records[n.id]?.level===3).length,due:actual.filter(n=>records[n.id]?.level===2&&canReview(records[n.id],now)).length};
  }
  function recommend(nodes,records={},completed=[]){
    return nodes.filter(n=>!n.planned&&(records[n.id]?.level||0)<2&&n.requires.every(id=>(records[id]?.level||0)>=2)).map((n,i)=>({n,i,score:(records[n.id]?.level||0)*2+Number(n.refs.some(r=>completed.includes(r.lesson)))})).sort((a,b)=>b.score-a.score||a.i-b.i)[0]?.n||null;
  }
  const normalize=text=>String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’‘]/g,"'").toLocaleLowerCase();
  function searchNodes(term){const query=normalize(term.trim());return query?data.nodes.filter(n=>normalize([n.title,n.goal,...n.criteria,data.branches.find(b=>b.id===n.branch).name].join(' ')).includes(query)):[];}
  function route(hash){
    const [,level,branch,item]=hash.replace(/^#/,'').split('/');
    const stage=data.stages.includes(level)?level:'all';
    const category=data.branches.some(b=>b.id===branch)?branch:'all';
    const node=byId.get(item);
    const selected=node&&node.stage===stage&&node.branch===category?node:null;
    return {stage,branch:category,node:selected,group:category==='grammar'?(groups[item]?item:selected?.group||''):''};
  }
  const href=(stage='all',branch='all',item='')=>'#skills/'+stage+'/'+branch+(item?'/'+item:'');
  function icon(name){const shapes={sound:'<path d="M3 10v4m4-8v12m5-15v18m5-15v12m4-8v4"/>',book:'<path d="M12 6v15M3 4h5a4 4 0 0 1 4 3 4 4 0 0 1 4-3h5v15h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3Z"/>',structure:'<path d="M8 3h8v6H8zM2 16h7v5H2zm13 0h7v5h-7zM12 9v4M5 16v-3h14v3"/>',headphones:'<path d="M4 14v-3a8 8 0 0 1 16 0v3M3 13h4v8H3zm14 0h4v8h-4z"/>',chat:'<path d="M3 4h18v13H9l-6 4Z"/><path d="M7 9h10m-10 4h6"/>',eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',pen:'<path d="m4 16 12-12 4 4L8 20H4Z M13 7l4 4M13 21h9"/>'};return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${shapes[name]||shapes.structure}</svg>`;}
  function render(){return `<section class="skill-tree" id="skill-tree" aria-label="法语知识技能树">
    <header class="st-header"><a href="#route" class="st-brand"><span class="st-brand-mark">B.</span><span>Bonjour Français<small>LE PARCOURS DES COMPÉTENCES</small></span></a><nav aria-label="成长视图"><a href="#skills" aria-current="page">技能树</a><a href="#map">知识大陆</a><a href="#route">返回书房</a><a href="#settings">记录与备份</a></nav></header>
    <div class="st-hero"><div><p class="st-eyebrow">VOTRE PROGRESSION</p><h1>你的法语，正在生长。</h1><p class="st-subtitle">首批 ${data.nodes.filter(n=>!n.planned).length} 个技能 · A1 第1—${Math.max(...data.nodes.flatMap(n=>n.refs.map(r=>r.lesson)))}课 · 后续阶段逐步扩展</p><a class="st-next" id="st-next"></a></div><div class="st-stats" id="st-stats"></div><div class="st-goal"><span>长期目标</span><strong>NCLC 7</strong><small>听 · 说 · 读 · 写</small></div></div>
    <div class="st-controls"><nav id="st-levels" aria-label="学习阶段"></nav><label class="st-branch-label">分支<select id="st-branch" aria-label="选择技能分支"><option value="all">全部分支</option>${data.branches.map(b=>`<option value="${b.id}">${b.name}</option>`).join('')}</select></label><label class="st-search-label"><span>⌕</span><input id="st-search" type="search" aria-label="搜索技能" placeholder="搜索技能，例如：过去时" autocomplete="off"></label></div>
    <div class="st-path" id="st-path"></div>
    <div class="st-layout"><div class="st-stage" id="st-stage" tabindex="0" aria-label="技能树画布，可拖动、滚轮缩放，方向键移动，0键查看全貌"><div class="st-board" id="st-board"></div><div class="st-canvas-hint">拖动探索 · 滚轮缩放 · 点击节点</div></div><aside class="st-detail" id="st-detail" aria-label="技能详情" hidden><button class="st-close" id="st-close" aria-label="关闭技能详情">×</button><div id="st-detail-body"></div></aside></div>
    <footer class="st-footer"><div class="st-legend">${states.map((s,i)=>`<span><i class="st-dot st-level-${i}"></i>${s}</span>`).join('')}<span class="st-plan-legend">◇ 后续规划</span></div><div class="st-zoom"><button data-st-action="minus" aria-label="缩小技能树">−</button><span id="st-scale">100%</span><button data-st-action="plus" aria-label="放大技能树">＋</button><button data-st-action="fit">全景适配</button></div></footer><div class="st-live" id="st-live" role="status" aria-live="polite"></div>
    </section>`;}
  function graphLayout(nodes){
    const ids=new Set(nodes.map(n=>n.id)),ranks=new Map();
    function rank(n,stack=new Set()){if(ranks.has(n.id))return ranks.get(n.id);if(stack.has(n.id))return 0;const next=new Set(stack).add(n.id);const r=Math.max(0,...n.requires.filter(id=>ids.has(id)).map(id=>rank(byId.get(id),next)+1));ranks.set(n.id,r);return r;}
    nodes.forEach(n=>rank(n));const counts=new Map();nodes.forEach(n=>counts.set(ranks.get(n.id),(counts.get(ranks.get(n.id))||0)+1));
    const height=Math.max(400,...Array.from(counts.values(),v=>v*110+100)),width=Math.max(750,(Math.max(0,...ranks.values())+1)*230+80),used=new Map();
    return {width,height,points:new Map(nodes.map(n=>{const r=ranks.get(n.id),i=used.get(r)||0;used.set(r,i+1);return [n.id,{x:135+r*230,y:height/2+(i-(counts.get(r)-1)/2)*110}];}))};
  }
  function mount(adapter){
    dispose();const root=document.getElementById('skill-tree');if(!root)return;
    const controller=new AbortController(),on=(target,event,fn,options={})=>target.addEventListener(event,fn,{...options,signal:controller.signal});
    const stage=root.querySelector('#st-stage'),board=root.querySelector('#st-board'),panel=root.querySelector('#st-detail'),body=root.querySelector('#st-detail-body');
    let current=route(location.hash),layout={width:1280,height:680,points:new Map()},view={x:0,y:0,scale:1},lastSize=null,pointers=new Map(),pinch=null,returnFocus=null,noticeTimer=null;
    const records=()=>adapter.state().skillMastery||{};
    const levelOf=n=>records()[n.id]?.level||0;
    const announce=message=>{clearTimeout(noticeTimer);root.querySelector('#st-live').textContent=message;noticeTimer=setTimeout(()=>{root.querySelector('#st-live').textContent='';},3500);};
    function apply(){
      const w=layout.width*view.scale,h=layout.height*view.scale;
      view.x=w<stage.clientWidth?(stage.clientWidth-w)/2:Math.max(stage.clientWidth-w-60,Math.min(60,view.x));
      view.y=h<stage.clientHeight?(stage.clientHeight-h)/2:Math.max(stage.clientHeight-h-60,Math.min(60,view.y));
      board.style.transform=`translate(${view.x}px,${view.y}px) scale(${view.scale})`;root.querySelector('#st-scale').textContent=Math.round(view.scale*100)+'%';
    }
    const minScale=()=>Math.min(stage.clientWidth/layout.width,stage.clientHeight/layout.height,1)*.8;
    function fit(readable=false){view.scale=Math.min(stage.clientWidth/layout.width,stage.clientHeight/layout.height,1)*.94;if(readable&&(stage.clientWidth<1000||(current.stage==='A1'&&current.branch!=='all'&&(current.group||current.node))))view.scale=Math.max(stage.clientWidth<650&&current.node?1:.82,view.scale);view.x=(stage.clientWidth-layout.width*view.scale)/2;view.y=readable&&layout.height*view.scale>stage.clientHeight?20:(stage.clientHeight-layout.height*view.scale)/2;apply();}
    function zoom(factor,cx=stage.clientWidth/2,cy=stage.clientHeight/2){const next=Math.max(minScale(),Math.min(2.2,view.scale*factor)),ratio=next/view.scale;view.x=cx-(cx-view.x)*ratio;view.y=cy-(cy-view.y)*ratio;view.scale=next;apply();}
    function focusNode(id){const point=layout.points.get(id);if(point){view.x=stage.clientWidth/2-point.x*view.scale;view.y=stage.clientHeight/2-point.y*view.scale;apply();}}
    function stats(){const s=summary(data.nodes,records()),next=recommend(data.nodes,records(),adapter.state().completed),link=root.querySelector('#st-next');link.textContent=next?'建议下一步 · '+next.title+' →':'首批技能已全部点亮 · 继续巩固';link.setAttribute('href',next?href(next.stage,next.branch,next.id):href('A1'));link.title='根据已记录的技能基础建议，可自由选择其他技能。';root.querySelector('#st-stats').innerHTML=`<div><strong>${s.mastered}<small> / ${s.total}</small></strong><span>已点亮技能</span></div><div><strong>${s.touched}</strong><span>已接触</span></div><div><strong>${s.due}</strong><span>待复测</span></div>`;}
    function controls(){root.querySelector('#st-levels').innerHTML=['all',...data.stages].map(l=>`<a href="${href(l,current.branch)}" ${l===current.stage?'aria-current="page"':''}>${l==='all'?'全景':l}</a>`).join('');root.querySelector('#st-branch').value=current.branch;
      const branch=data.branches.find(b=>b.id===current.branch);root.querySelector('#st-path').innerHTML=`<a href="#skills">知识全景</a>${current.stage!=='all'?`<span>／</span><a href="${href(current.stage)}">${current.stage}</a>`:''}${branch?`<span>／</span><a href="${href(current.stage,branch.id)}">${branch.name}</a>`:''}${branch&&current.stage==='A1'?`<span class="st-branch-progress">${summary(data.nodes.filter(n=>n.branch===branch.id&&(!current.group||n.group===current.group)),records()).mastered} / ${data.nodes.filter(n=>n.branch===branch.id&&!n.planned&&(!current.group||n.group===current.group)).length} 已点亮</span>`:''}${branch?.id==='grammar'&&current.stage==='A1'?`<nav aria-label="语法子树"><a href="${href('A1','grammar')}" ${!current.group?'aria-current="page"':''}>全部语法</a>${Object.entries(groups).map(([id,name])=>`<a href="${href('A1','grammar',id)}" ${current.group===id?'aria-current="page"':''}>${name}</a>`).join('')}</nav>`:''}`;
    }
    function edge(a,b,lit=false,planned=false){return `<path d="M${a.x} ${a.y} C${(a.x+b.x)/2} ${a.y},${(a.x+b.x)/2} ${b.y},${b.x} ${b.y}" class="${lit?'lit':''} ${planned?'planned':''}"/>`;}
    function overview(){
      const branches=current.branch==='all'?data.branches:data.branches.filter(b=>b.id===current.branch),stages=current.stage==='all'?data.stages:[current.stage];
      const columnLimit=stage.clientWidth<600?2:stage.clientWidth<1000?4:7,compact=columnLimit<branches.length,columns=Math.min(columnLimit,branches.length),blockHeight=stages.length===1?430:690;const width=compact?columns*170+90:Math.max(760,branches.length*170+90),height=Math.ceil(branches.length/columns)*blockHeight;layout={width,height,points:new Map()};const xFor=i=>columns===1?width/2:125+(i%columns)*170;
      let paths='',html='';branches.forEach((b,i)=>{const x=xFor(i),base=Math.floor(i/columns)*blockHeight;html+=`<a class="st-root" style="left:${x}px;top:${base+22}px" href="${href('A1',b.id)}"><span>${icon(b.icon)}</span><strong>${b.name}</strong><small>${b.french}</small></a>`;
        let previous={x,y:base+125};stages.forEach((level,j)=>{const y=base+(stages.length===1?260:200+j*135);const pool=data.nodes.filter(n=>n.branch===b.id&&n.stage===level);const s=summary(pool,records());const planned=level!=='A1';const node=pool[0];const point={x,y};paths+=edge(previous,point,s.mastered>0,planned);previous=point;
          if(planned)layout.points.set(node.id,point);
          html+=`<a class="st-cluster ${planned?'is-planned':s.mastered?'is-lit':''}" style="left:${x}px;top:${y}px" href="${href(level,b.id,planned?node.id:'')}" aria-label="${level} ${b.name} ${planned?'后续规划':s.mastered+'/'+s.total+' 已点亮'}"><span class="st-cluster-diamond">${planned?'◇':icon(b.icon)}</span><small>${level}${planned?' · 规划':''}</small><strong>${planned?esc(node.title):b.name+'基础'}</strong>${planned?'<em>查看后续方向</em>':`<em>${s.mastered} / ${s.total} 已点亮</em><div class="st-mini-dots">${pool.slice(0,10).map(n=>`<i class="st-level-${levelOf(n)}"></i>`).join('')}${pool.length>10?`<small>+${pool.length-10}</small>`:''}</div>`}</a>`;
        });});
      board.innerHTML=`<svg class="st-edges" viewBox="0 0 ${width} ${height}" aria-hidden="true">${paths}</svg>${html}`;
    }
    function detailGraph(){
      const nodes=data.nodes.filter(n=>n.branch===current.branch&&n.stage==='A1'&&(!current.group||n.group===current.group));layout=graphLayout(nodes);let paths='';nodes.forEach(n=>n.requires.forEach(id=>{if(layout.points.has(id))paths+=edge(layout.points.get(id),layout.points.get(n.id),levelOf(byId.get(id))>=2);}));
      const b=data.branches.find(b=>b.id===current.branch);
      board.innerHTML=`<svg class="st-edges" viewBox="0 0 ${layout.width} ${layout.height}" aria-hidden="true">${paths}</svg>${nodes.map((n,i)=>{const p=layout.points.get(n.id),level=levelOf(n);return `<a class="st-node st-level-${level} ${current.node?.id===n.id?'is-selected':''}" style="left:${p.x}px;top:${p.y}px" href="${href('A1',n.branch,n.id)}" aria-label="${esc(n.title)}，${states[level]}"><span class="st-node-icon">${level===3?'✓':icon(b.icon)}</span><span class="st-node-copy"><small>${String(i+1).padStart(2,'0')} · ${states[level]}</small><strong>${esc(n.title)}</strong></span></a>`;}).join('')}`;
    }
    function grammarOverview(){
      const compact=stage.clientWidth<650,width=compact?430:900,height=compact?770:460;layout={width,height,points:new Map()};
      const origin={x:width/2,y:135};let paths='';
      const cards=Object.entries(groups).map(([id,name],i)=>{const point={x:compact?215:160+i*290,y:compact?245+i*190:310};paths+=edge(origin,point);const pool=data.nodes.filter(n=>n.branch==='grammar'&&n.group===id),s=summary(pool,records());return `<a class="st-cluster st-module ${s.mastered?'is-lit':''}" style="left:${point.x}px;top:${point.y}px" href="${href('A1','grammar',id)}"><small>A1 · GRAMMAIRE</small><strong>${name}</strong><em>${s.mastered} / ${s.total} 已点亮 · 展开技能</em><div class="st-mini-dots">${pool.map(n=>`<i class="st-level-${levelOf(n)}"></i>`).join('')}</div></a>`;}).join('');
      board.innerHTML=`<svg class="st-edges" viewBox="0 0 ${width} ${height}" aria-hidden="true">${paths}</svg><a class="st-root" style="left:${width/2}px;top:30px" href="${href('A1','grammar')}"><span>${icon('structure')}</span><strong>语法体系</strong><small>GRAMMAIRE</small></a>${cards}`;
    }
    function draw(){stats();controls();if(current.stage==='A1'&&current.branch==='grammar'&&!current.group&&!current.node)grammarOverview();else if(current.stage==='A1'&&current.branch!=='all')detailGraph();else overview();board.style.width=layout.width+'px';board.style.height=layout.height+'px';}
    function openNode(node,focus=true){
      const record=records()[node.id]||{},level=record.level||0,branch=data.branches.find(b=>b.id===node.branch);
      if(!panel.contains(document.activeElement))returnFocus=document.activeElement;panel.hidden=false;
      body.innerHTML=`<p class="st-eyebrow">${node.stage} / ${branch.french}</p><div class="st-detail-icon st-level-${level}">${icon(branch.icon)}</div><h2>${esc(node.title)}</h2><p class="st-detail-goal">${esc(node.goal)}</p>${node.planned?`<div class="st-planning"><strong>后续学习方向</strong><p>这一阶段的详细教材与技能尚未接入。你可以先了解方向，后续再逐步展开。</p></div>`:`<div class="st-detail-state"><i class="st-dot st-level-${level}"></i>${states[level]}<span>自评记录</span></div><h3>什么时候算掌握？</h3><ul class="st-criteria">${node.criteria.map(c=>`<li>${esc(c)}</li>`).join('')}</ul><h3>点亮这个技能</h3><div class="st-state-buttons">${states.map((name,i)=>`<button data-st-level="${i}" aria-pressed="${i===level}" ${i===3&&!canReview(record)?'disabled':''}>${i===3?'✓ ':''}${name}</button>`).join('')}</div><p class="st-help">“能独立运用”由你按上面的标准自评；掌握满24小时并再次独立完成后，可记录“复测巩固”。</p>${node.requires.length?`<h3>建议先掌握</h3><div class="st-prerequisites">${node.requires.map(id=>{const n=byId.get(id);return `<a href="${href(n.stage,n.branch,id)}"><i class="st-dot st-level-${levelOf(n)}"></i>${esc(n.title)}</a>`;}).join('')}</div><p class="st-help">连线表示建议顺序，你可以随时查看任何技能。</p>`:''}<h3>关联课程</h3><div class="st-sources">${node.refs.map(ref=>{const course=adapter.courses.get(ref.lesson),section=course?.sections.find(s=>s.id===ref.section);return `<a href="#lesson/${ref.lesson}/${ref.section}"><span>第 ${ref.lesson} 课${adapter.state().completed.includes(ref.lesson)?' · 课程已学':''}</span><strong>${esc(section?.title||course?.title||'查看课程')}</strong></a>`;}).join('')}</div><label class="st-note-label" for="st-note">运用记录 <small>例句、易错点，或复测结果</small></label><textarea id="st-note" maxlength="2000" rows="3" placeholder="例如：不用讲义，写出昨天的三件事…">${esc(record.note||'')}</textarea><p class="st-note-status" id="st-note-status">${record.updatedAt?'记录更新于 '+esc(new Date(record.updatedAt).toLocaleString()):'记录保存在当前浏览器，可在书房导出备份。'}</p>`}`;
      if(focus){panel.scrollTop=0;root.querySelector('#st-close').focus({preventScroll:true});}
    }
    function close(){panel.hidden=true;root.querySelector('#st-search').value='';if(current.node){location.hash=href(current.stage,current.branch,current.group);return;}if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});else stage.focus({preventScroll:true});}
    function search(){const term=root.querySelector('#st-search').value.trim().toLocaleLowerCase();if(!term){if(current.node)openNode(current.node,false);else panel.hidden=true;return;}const found=searchNodes(term);panel.hidden=false;body.innerHTML=`<p class="st-eyebrow">RECHERCHE</p><h2>查找技能</h2><p class="st-help">${found.length} 个结果</p><div class="st-search-results">${found.map(n=>`<a href="${href(n.stage,n.branch,n.id)}"><span>${n.stage} · ${data.branches.find(b=>b.id===n.branch).name}${n.planned?' · 规划':''}</span><strong>${esc(n.title)}</strong><small>${n.planned?'后续学习方向':states[levelOf(n)]}</small></a>`).join('')||'<p>没有匹配的技能，可以试试“冠词”“过去”或“听辨”。</p>'}</div>`;}
    function navigate(){const next=route(location.hash),same=current.stage===next.stage&&current.branch===next.branch&&current.group===next.group;current=next;root.querySelector('#st-search').value='';if(!same){panel.hidden=true;draw();fit(true);}else draw();if(current.node){openNode(current.node);focusNode(current.node.id);}else{panel.hidden=true;stage.focus({preventScroll:true});}return true;}
    activeNavigate=navigate;
    on(root,'click',e=>{const link=e.target.closest('a[href^="#skills"]');if(link?.getAttribute('href')===location.hash){e.preventDefault();navigate();return;}const levelButton=e.target.closest('[data-st-level]');if(levelButton&&current.node){const level=Number(levelButton.dataset.stLevel);if(adapter.setSkill(current.node.id,{level})){const scroll=panel.scrollTop;draw();board.querySelector('.is-selected')?.classList.add('just-updated');openNode(current.node,false);panel.scrollTop=scroll;body.querySelector(`[data-st-level="${level}"]`).focus({preventScroll:true});announce('技能状态已保存：'+states[level]);}else announce('记录未能保存，请导出备份。');return;}const action=e.target.closest('[data-st-action]')?.dataset.stAction;if(action==='plus')zoom(1.25);if(action==='minus')zoom(.8);if(action==='fit')fit();});
    on(root.querySelector('#st-close'),'click',close);
    on(root.querySelector('#st-branch'),'change',e=>location.hash=href(current.stage==='all'&&e.target.value!=='all'?'A1':current.stage,e.target.value));
    on(root.querySelector('#st-search'),'input',search);
    on(body,'input',e=>{if(e.target.id==='st-note'&&current.node){const ok=adapter.setSkill(current.node.id,{note:e.target.value});root.querySelector('#st-note-status').textContent=ok?'运用记录已保存':'未能保存，请先复制这段记录';}});
    on(stage,'wheel',e=>{e.preventDefault();const r=stage.getBoundingClientRect();zoom(Math.exp(-e.deltaY*.0012),e.clientX-r.left,e.clientY-r.top);},{passive:false});
    on(stage,'pointerdown',e=>{if(e.target.closest('a,button'))return;stage.focus();stage.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const [a,b]=[...pointers.values()];pinch=Math.hypot(a.x-b.x,a.y-b.y);}});
    on(stage,'pointermove',e=>{const prev=pointers.get(e.pointerId);if(!prev)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const[a,b]=[...pointers.values()],d=Math.hypot(a.x-b.x,a.y-b.y),r=stage.getBoundingClientRect();if(pinch)zoom(d/pinch,(a.x+b.x)/2-r.left,(a.y+b.y)/2-r.top);pinch=d;}else{view.x+=e.clientX-prev.x;view.y+=e.clientY-prev.y;apply();}});
    const release=e=>{pointers.delete(e.pointerId);pinch=null;};['pointerup','pointercancel','lostpointercapture'].forEach(event=>on(stage,event,release));
    on(root,'keydown',e=>{if(e.key==='Escape'&&!panel.hidden){close();return;}if(e.target!==stage)return;const moves={ArrowLeft:[50,0],ArrowRight:[-50,0],ArrowUp:[0,50],ArrowDown:[0,-50]};if(moves[e.key]){e.preventDefault();view.x+=moves[e.key][0];view.y+=moves[e.key][1];apply();}if(e.key==='+'||e.key==='='){e.preventDefault();zoom(1.2);}if(e.key==='-'){e.preventDefault();zoom(1/1.2);}if(e.key==='0')fit();});
    on(board,'focusin',e=>{const node=e.target.closest('.st-node,.st-cluster,.st-root');if(node&&e.target!==returnFocus){const r=node.getBoundingClientRect(),s=stage.getBoundingClientRect();if(r.left<s.left||r.right>s.right||r.top<s.top||r.bottom>s.bottom){view.x+=s.x+s.width/2-(r.x+r.width/2);view.y+=s.y+s.height/2-(r.y+r.height/2);apply();}}});
    const observer=new ResizeObserver(()=>{const size={w:stage.clientWidth,h:stage.clientHeight};if(!size.w||!size.h)return;if(lastSize){if((size.w<600?2:size.w<1000?4:7)!==(lastSize.w<600?2:lastSize.w<1000?4:7)){draw();fit(true);}else{view.x+=(size.w-lastSize.w)/2;view.y+=(size.h-lastSize.h)/2;apply();}}else fit(true);lastSize=size;if(current.node)focusNode(current.node.id);});observer.observe(stage);
    draw();fit(true);if(current.node)openNode(current.node);
    const reviewTimer=setInterval(()=>{stats();if(current.node&&!current.node.planned){const button=body.querySelector('[data-st-level="3"]');if(button)button.disabled=!canReview(records()[current.node.id]);}},60000);
    dispose=()=>{controller.abort();observer.disconnect();clearInterval(reviewTimer);clearTimeout(noticeTimer);activeNavigate=null;};
  }
  window.SKILL_TREE={render,mount,unmount:()=>dispose(),navigate:()=>activeNavigate?.()||false,summary,recommend,searchNodes,canReview,route,graphLayout,states};
})();

