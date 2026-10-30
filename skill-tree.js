'use strict';
(() => {
  const data=window.FRENCH_SKILLS;
  const DAY=86400000;
  const states=['未学习','已接触','能独立运用','复测巩固'];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const byId=new Map(data.nodes.map(n=>[n.id,n]));
  const groups={verbs:'动词与时态',nominals:'冠词与修饰',structure:'句型与代词'};
  let relationBack='';
  let dispose=()=>{},activeNavigate=null,lastSkillHash='';
  const viewMemory=new Map();
  const canReview=(record,now=Date.now())=>Boolean(record?.level>=2&&record.masteredAt&&now-Date.parse(record.masteredAt)>=DAY);
  function summary(nodes,records={},now=Date.now()){
    const actual=nodes.filter(n=>!n.planned);
    return {total:actual.length,touched:actual.filter(n=>(records[n.id]?.level||0)>=1).length,mastered:actual.filter(n=>(records[n.id]?.level||0)>=2).length,reviewed:actual.filter(n=>records[n.id]?.level===3).length,due:actual.filter(n=>records[n.id]?.level===2&&canReview(records[n.id],now)).length};
  }
  function recommend(nodes,records={},completed=[]){
    return nodes.filter(n=>!n.planned&&(records[n.id]?.level||0)<2&&n.requires.every(id=>(records[id]?.level||0)>=2)).map((n,i)=>({n,i,score:(records[n.id]?.level||0)*2+Number(n.refs.some(r=>completed.includes(r.lesson)))})).sort((a,b)=>b.score-a.score||a.i-b.i)[0]?.n||null;
  }
  const normalize=text=>String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’‘]/g,"'").toLocaleLowerCase();
  const courseByNumber=new Map((window.COURSE_LIBRARY?.lessons||[]).map(c=>[c.number,c]));
  const coverage=()=>Math.max(0,...data.nodes.flatMap(n=>n.refs.map(r=>r.lesson)));
  const bounded=(v,max)=>Number.isInteger(Number(v))&&Number(v)>=1&&Number(v)<=max?Number(v):0;
  function searchNodes(term){const query=normalize(term.trim());return query?data.nodes.filter(n=>normalize([n.title,n.goal,...n.criteria,...(window.FRENCH_GRAMMAR?.records.find(r=>r.id===n.id)?.aliases||[]),...(n.aliases||[]),...n.refs.map(r=>['第'+r.lesson+'课',courseByNumber.get(r.lesson)?.title,courseByNumber.get(r.lesson)?.translation,courseByNumber.get(r.lesson)?.sections.find(s=>s.id===r.section)?.title].join(' ')),data.branches.find(b=>b.id===n.branch).name].join(' ')).includes(query)):[];}
  const reviewLabels=window.KNOWLEDGE_MAP?.reviewLabels||{all:'全部状态',unrecorded:'未记录掌握',touched:'已接触',independent:'能独立运用',due:'待复测',reviewed:'复测巩固'};
  const reviewState=(record,now=Date.now())=>window.KNOWLEDGE_MAP?.reviewState(record,now)||(record?.level===3?'reviewed':record?.level===2?(canReview(record,now)?'due':'independent'):record?.level===1?'touched':'unrecorded');
  function recommendation(nodes,records={},completed=[]){
    const node=recommend(nodes,records,completed);if(!node)return null;
    const reasons=[];if(records[node.id]?.level===1)reasons.push('你已记录接触此技能');
    if(node.requires.length)reasons.push('建议基础均已自评能独立运用');else reasons.push('没有需要先记录掌握的基础技能');
    const lessons=[...new Set(node.refs.filter(r=>completed.includes(r.lesson)).map(r=>r.lesson))];if(lessons.length)reasons.push('相关课程已标记完成：'+lessons.join('、'));
    return {node,reasons};
  }
  function practiceSources(node){return [...new Set(node.refs.map(r=>r.lesson))].filter(n=>courseByNumber.get(n)?.sections.some(s=>s.id==='practice')).map(n=>({lesson:n,href:'#lesson/'+n+'/practice'}));}
  function route(hash){
    const [path,queryString='']=hash.split('?');
    const [,level,branch,item]=path.replace(/^#/,'').split('/');
    const params=new URLSearchParams(queryString);
    const stage=data.stages.includes(level)?level:'all';
    const category=data.branches.some(b=>b.id===branch)?branch:'all';
    const node=byId.get(item);
    const validScope=(!level||level==='all'||data.stages.includes(level))&&(!branch||branch==='all'||data.branches.some(b=>b.id===branch));
    const selected=validScope&&node&&(stage==='all'||node.stage===stage)&&(category==='all'||node.branch===category)?node:null;
    return {review:Object.hasOwn(reviewLabels,params.get('review'))?params.get('review'):'all',unit:bounded(params.get('unit'),9),lesson:bounded(params.get('lesson'),36),stage,branch:category,node:selected,group:category==='grammar'?(groups[item]?item:params.get('group')==='all'?'':selected?.group||''):'',allGroups:params.get('group')==='all',mode:params.get('view')==='list'?'list':'graph',query:(params.get('q')||'').slice(0,200)};
  }
  function href(stage='all',branch='all',item='',options={}){
    const params=new URLSearchParams();
    if(options.mode==='list')params.set('view','list');
    if(options.allGroups)params.set('group','all');
    if(options.review&&options.review!=='all'&&Object.hasOwn(reviewLabels,options.review))params.set('review',options.review);
    if(bounded(options.unit,9))params.set('unit',options.unit);
    if(bounded(options.lesson,36))params.set('lesson',options.lesson);
    if(options.query)params.set('q',options.query.slice(0,200));
    return '#skills/'+stage+'/'+branch+(item?'/'+item:'')+(params.size?'?'+params.toString():'');
  }
  const CACHE_KEY='bonjour-francais-skill-view-v1';
  function readViewCache(raw){
    const saved=JSON.parse(raw||'null'),views=new Map();if(!saved)return {last:'',views};
    const safe=h=>typeof h==='string'&&h.length<2000&&h.startsWith('#skills/')&&href(route(h).stage,route(h).branch,route(h).node?.id||route(h).group,route(h))===h;
    for(const entry of (Array.isArray(saved.views)?saved.views:[]).slice(-60)){
      if(!Array.isArray(entry))continue;const [key,v]=entry;
      if(safe(key)&&v&&v.view&&['x','y','scale'].every(k=>Number.isFinite(v.view[k]))&&v.view.scale>0&&v.view.scale<=3&&Math.abs(v.view.x)<1e7&&Math.abs(v.view.y)<1e7&&['width','height','scroll','detail'].every(k=>Number.isFinite(v[k])&&v[k]>=0&&v[k]<1e6))views.set(key,v);
    }
    return {last:safe(saved.last)?saved.last:'',views};
  }
  try{const cache=readViewCache(window.sessionStorage?.getItem(CACHE_KEY));lastSkillHash=cache.last;for(const [k,v] of cache.views)viewMemory.set(k,v);}catch{}
  function scopedNodes(scope,withQuery=true,records={},now=Date.now()){
    const matches=withQuery&&scope.query?new Set(searchNodes(scope.query).map(n=>n.id)):null;
    return data.nodes.filter(n=>(!scope.review||scope.review==='all'||(!n.planned&&reviewState(records[n.id],now)===scope.review))&&(!scope.unit||n.refs.some(r=>Math.ceil(r.lesson/4)===scope.unit&&(!scope.lesson||r.lesson===scope.lesson)))&&(!scope.lesson||n.refs.some(r=>r.lesson===scope.lesson))&&(scope.stage==='all'?!n.planned:n.stage===scope.stage)&&(scope.branch==='all'||n.branch===scope.branch)&&(!scope.group||n.group===scope.group)&&(!matches||matches.has(n.id)));
  }
  function icon(name){const shapes={sound:'<path d="M3 10v4m4-8v12m5-15v18m5-15v12m4-8v4"/>',book:'<path d="M12 6v15M3 4h5a4 4 0 0 1 4 3 4 4 0 0 1 4-3h5v15h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3Z"/>',structure:'<path d="M8 3h8v6H8zM2 16h7v5H2zm13 0h7v5h-7zM12 9v4M5 16v-3h14v3"/>',headphones:'<path d="M4 14v-3a8 8 0 0 1 16 0v3M3 13h4v8H3zm14 0h4v8h-4z"/>',chat:'<path d="M3 4h18v13H9l-6 4Z"/><path d="M7 9h10m-10 4h6"/>',eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',pen:'<path d="m4 16 12-12 4 4L8 20H4Z M13 7l4 4M13 21h9"/>'};return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${shapes[name]||shapes.structure}</svg>`;}
  function render(){return `<section class="skill-tree st-modern" id="skill-tree" aria-label="法语知识技能树">
    <header class="st-header"><a href="#route" class="st-brand"><span class="st-brand-mark">B.</span><span>Bonjour Français<small>LE PARCOURS DES COMPÉTENCES</small></span></a><nav aria-label="成长视图"><a href="#skills" aria-current="page">技能树</a><a href="#skills/A1/grammar/verbs" class="st-sample-entry">动词与时态</a><a href="#verbs">动词手册</a><a href="${esc(window.KNOWLEDGE_MAP?.resumeHref()||'#map')}">${esc(window.KNOWLEDGE_MAP?.resumeLabel?.()||'知识大陆')}</a><a href="#route">返回书房</a><a href="#settings">记录与备份</a></nav></header>
    <div class="st-hero"><div><p class="st-eyebrow">VOTRE PROGRESSION</p><h1>你的法语，正在生长。</h1><p class="st-subtitle">首批 ${data.nodes.filter(n=>!n.planned).length} 个技能 · A1 第1—${Math.max(...data.nodes.flatMap(n=>n.refs.map(r=>r.lesson)))}课 · 后续阶段逐步扩展</p><a class="st-next" id="st-next"></a></div><div class="st-stats" id="st-stats"></div><div class="st-goal"><span>长期目标</span><strong>NCLC 7</strong><small>听 · 说 · 读 · 写</small></div></div>
    <div class="st-controls"><nav id="st-levels" aria-label="学习阶段"></nav><label class="st-branch-label">分支<select id="st-branch" aria-label="选择技能分支"><option value="all">全部分支</option>${data.branches.map(b=>`<option value="${b.id}">${b.name}</option>`).join('')}</select></label><nav id="st-view-modes" class="st-view-modes" aria-label="知识展示方式"></nav><label class="st-search-label"><span>⌕</span><input id="st-search" type="search" aria-label="搜索技能" placeholder="搜索技能，例如：过去时" maxlength="200" autocomplete="off"></label></div>
    <div class="st-scope-controls"><label>单元<select id="st-unit"><option value="0">全部单元</option>${Array.from({length:9},(_,i)=>`<option value="${i+1}">单元 ${i+1}</option>`).join('')}</select></label><label>课次<select id="st-lesson"><option value="0">全部课次</option>${Array.from({length:36},(_,i)=>`<option value="${i+1}">第 ${i+1} 课</option>`).join('')}</select></label><label>技能状态<select id="st-review">${Object.entries(reviewLabels).map(([id,name])=>`<option value="${id}">${name}</option>`).join('')}</select></label><button data-st-action="clear-scope">清除范围与状态</button></div><p class="st-next-reason" id="st-next-reason"></p><div class="st-path" id="st-path"></div>
    <div class="st-layout"><div class="st-stage" id="st-stage" tabindex="0" aria-label="技能树画布，可拖动、滚轮缩放，方向键移动，0键查看全貌"><div class="st-board" id="st-board"></div><div class="st-canvas-hint">拖动探索 · 滚轮缩放 · 点击节点</div></div><aside class="st-detail" id="st-detail" aria-label="技能详情" hidden><button class="st-close" id="st-close" aria-label="关闭技能详情">×</button><div id="st-detail-body"></div></aside></div>
    <footer class="st-footer"><div class="st-legend">${states.map((s,i)=>`<span><i class="st-dot st-level-${i}"></i>${s}</span>`).join('')}<span class="st-plan-legend">◇ 后续规划</span></div><div class="st-zoom"><button data-st-action="minus" aria-label="缩小技能树">−</button><span id="st-scale">100%</span><button data-st-action="plus" aria-label="放大技能树">＋</button><button data-st-action="fit">全景适配</button></div></footer><div class="st-live" id="st-live" role="status" aria-live="polite"></div>
    </section>`;}
  function graphLayout(nodes){
    const ids=new Set(nodes.map(n=>n.id)),ranks=new Map();
    function rank(n,stack=new Set()){if(ranks.has(n.id))return ranks.get(n.id);if(stack.has(n.id))return 0;const next=new Set(stack).add(n.id);const r=Math.max(0,...n.requires.filter(id=>ids.has(id)).map(id=>rank(byId.get(id),next)+1));ranks.set(n.id,r);return r;}
    nodes.forEach(n=>rank(n));const counts=new Map();nodes.forEach(n=>counts.set(ranks.get(n.id),(counts.get(ranks.get(n.id))||0)+1));
    const used=new Map(),starts=new Map(),lanes=[];let columns=0;
    for(const r of [...counts.keys()].sort((a,b)=>a-b)){
      const span=Math.ceil(counts.get(r)/3);starts.set(r,columns);
      lanes.push({x:40+columns*370,width:span*370-50,title:['起步与基础','连接与表达','组合运用','延伸与巩固'][Math.min(r,3)],caption:'建议基础关系 · 可自由跳转'});columns+=span;
    }
    const points=new Map(nodes.map(n=>{
      const r=ranks.get(n.id),i=used.get(r)||0;used.set(r,i+1);
      const col=starts.get(r)+Math.floor(i/3),rows=Math.min(3,counts.get(r)-Math.floor(i/3)*3);
      return [n.id,{x:200+col*370,y:470+(i%3-(rows-1)/2)*160}];
    }));
    return {width:Math.max(780,columns*370+40),height:800,points,lanes};
  }
  // Presentation groups only: stable semantic IDs and prerequisites remain in skills.json.
  const verbSections=[
    {title:'现在时基础',caption:'从主语与变位出发',ids:['g-etre','g-avoir','g-er']},
    {title:'表达与变化',caption:'把动作放进真实表达',ids:['g-irregular','g-imperative','g-reflexive']},
    {title:'构成过去时',caption:'助动词 + 过去分词',ids:['g-participles','g-past-avoir']},
    {title:'配合与词序',caption:'让过去的表达更准确',ids:['g-past-etre','g-past-agreement','g-past-order']}
  ];
  function verbLayout(){
    const points=new Map();
    verbSections.forEach((section,col)=>section.ids.forEach((id,row)=>points.set(id,{x:200+col*370,y:310+row*160})));
    return {width:1520,height:800,points};
  }
  function skillRelations(id){
    const node=byId.get(id);
    return {before:node?.requires||[],after:data.nodes.filter(n=>!n.planned&&n.requires.includes(id)).map(n=>n.id)};
  }
  function grammarPreview(id){
    const r=window.FRENCH_GRAMMAR?.records.find(r=>r.id===id);if(!r)return '';
    return `<section class="st-shared-grammar"><p class="st-help">${esc(r.scope)}</p><h3>核心规则</h3><ul>${r.rules.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><h3>例句</h3>${r.examples.map(x=>`<p lang="fr">${esc(x)}</p>`).join('')}<h3>易错点</h3><ul>${r.pitfalls.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>${r.blocks.map(b=>`<details><summary>第 ${b.lesson} 课 · ${esc(b.title)}</summary>${b.html}<a href="#lesson/${b.lesson}/${b.section}">返回课程语境 →</a></details>`).join('')}</section>`;
  }
  function mount(adapter){
    dispose();const root=document.getElementById('skill-tree');if(!root)return;
    const controller=new AbortController(),on=(target,event,fn,options={})=>target.addEventListener(event,fn,{...options,signal:controller.signal});
    const stage=root.querySelector('#st-stage'),board=root.querySelector('#st-board'),panel=root.querySelector('#st-detail'),body=root.querySelector('#st-detail-body');
    let reviewSignature='',current=route(location.hash),currentKey=href(current.stage,current.branch,current.node?.id||current.group,current),restoreFrame=0,restoring=false,layout={width:1280,height:680,points:new Map()},view={x:0,y:0,scale:1},lastSize=null,pointers=new Map(),pinch=null,returnFocus=null,noticeTimer=null;
    const isVerbView=()=>current.stage==='A1'&&current.branch==='grammar'&&current.group==='verbs';
    const linkTo=(level='all',branch='all',item='',options={})=>href(level,branch,item,{mode:current.mode,allGroups:current.allGroups,review:current.review,unit:current.unit,lesson:current.lesson,query:level===current.stage&&branch===current.branch?current.query:'',...options});
    const relationHref=n=>linkTo(n.stage,n.branch,n.id,{unit:0,lesson:0,query:'',review:'all',allGroups:false});
    const selectHref=n=>current.mode==='list'&&(current.stage==='all'||current.stage===n.stage)&&(current.branch==='all'||current.branch===n.branch)?linkTo(current.stage,current.branch,n.id,{allGroups:!current.group}):linkTo(n.stage,n.branch,n.id);
    const currentItem=()=>current.node?.id||current.group;
    const isCanvas=()=>current.review==='all'&&!current.unit&&!current.lesson&&current.mode==='graph'&&current.stage==='A1'&&current.branch!=='all'&&(current.branch!=='grammar'||Boolean(current.group));
    const records=()=>adapter.state().skillMastery||{};
    const levelOf=n=>records()[n.id]?.level||0;
    const announce=message=>{clearTimeout(noticeTimer);root.querySelector('#st-live').textContent=message;noticeTimer=setTimeout(()=>{root.querySelector('#st-live').textContent='';},3500);};
    function apply(){
      if(!isCanvas()){board.style.transform='none';return;}
      const w=layout.width*view.scale,h=layout.height*view.scale;
      view.x=w<stage.clientWidth?(stage.clientWidth-w)/2:Math.max(stage.clientWidth-w-60,Math.min(60,view.x));
      view.y=h<stage.clientHeight?(stage.clientHeight-h)/2:Math.max(stage.clientHeight-h-60,Math.min(60,view.y));
      board.style.transform=`translate(${view.x}px,${view.y}px) scale(${view.scale})`;root.querySelector('#st-scale').textContent=Math.round(view.scale*100)+'%';
    }
    const minScale=()=>Math.min(stage.clientWidth/layout.width,stage.clientHeight/layout.height,1)*.8;
    function fit(){
      view.scale=Math.max(.78,Math.min(2.05,(stage.clientWidth-64)/layout.width,(stage.clientHeight-48)/layout.height));
      view.x=(stage.clientWidth-layout.width*view.scale)/2;view.y=(stage.clientHeight-layout.height*view.scale)/2;apply();
    }
    function zoom(factor,cx=stage.clientWidth/2,cy=stage.clientHeight/2){const next=Math.max(minScale(),Math.min(2.2,view.scale*factor)),ratio=next/view.scale;view.x=cx-(cx-view.x)*ratio;view.y=cy-(cy-view.y)*ratio;view.scale=next;apply();}
    function focusNode(id){const point=layout.points.get(id);if(isCanvas()&&layout.width*view.scale<=stage.clientWidth&&layout.height*view.scale<=stage.clientHeight)return;if(point){view.x=stage.clientWidth/2-point.x*view.scale;view.y=stage.clientHeight/2-point.y*view.scale;apply();}}
    function stats(){
      const pool=scopedNodes(current,false,records()),s=summary(pool,records());
      const suggestion=recommendation(pool,records(),adapter.state().completed),next=suggestion?.node,link=root.querySelector('#st-next');
      root.querySelector('#st-next-reason').textContent=suggestion?'推荐依据：'+suggestion.reasons.join('；')+'。可自由选择其他技能。':'当前范围没有待推荐的新技能，可调整范围或按自评状态复习。';
      link.textContent=next?'建议下一步 · '+next.title+' →':s.total?'自由选择技能 · 按需复习':'后续方向 · 尚未接入讲义';
      link.setAttribute('href',next?linkTo(next.stage,next.branch,next.id):linkTo('A1'));
      root.querySelector('#st-stats').innerHTML=`<div><strong>${s.mastered}<small> / ${s.total}</small></strong><span>已点亮技能</span></div><div><strong>${s.touched}</strong><span>接触过（含已掌握）</span></div><div><a href="${linkTo(current.stage,current.branch,current.group,{mode:'list',review:'due'})}"><strong>${s.due}</strong><span>待复测 →</span></a></div>`;
    }
    function controls(){
      root.classList.toggle('st-verbs',isVerbView());
      root.classList.toggle('st-list-mode',current.mode==='list');
      root.classList.toggle('st-canvas-mode',isCanvas());
      stage.classList.toggle('st-flow',!isCanvas());
      stage.setAttribute('aria-label',isCanvas()?'技能关系图，可拖动缩放，方向键移动，0键适配':'知识浏览区，可滚动查看');
      const branch=data.branches.find(b=>b.id===current.branch),title=groups[current.group]||branch?.name||'法语知识全景';
      root.querySelector('h1').textContent=current.stage!=='all'&&current.stage!=='A1'?current.stage+' · 后续学习方向':title;
      root.querySelector('.st-hero .st-eyebrow').textContent=branch?(current.stage==='all'?'A1':current.stage)+' / '+branch.french:'VOTRE PARCOURS / CONNAISSANCES';
      root.querySelector('.st-subtitle').textContent=current.stage!=='all'&&current.stage!=='A1'?'规划节点仅展示方向，不计入掌握进度':branch?branch.description+' · '+scopedNodes(current,false,records()).length+' 个已收录技能':'A1 · 第1—'+coverage()+'课 · 七个领域，连接知识与运用';
      root.querySelector('#st-review').value=current.review;root.querySelector('#st-unit').value=String(current.unit);root.querySelector('#st-lesson').value=String(current.lesson);
      root.querySelector('#st-branch').value=current.branch;
      root.querySelector('#st-search').value=current.query;
      root.querySelector('#st-view-modes').innerHTML=['graph','list'].map(mode=>`<a href="${linkTo(current.stage,current.branch,currentItem(),{mode,...(mode==='graph'?{unit:0,lesson:0,review:'all'}:{})})}" ${current.mode===mode?'aria-current="page"':''}>${mode==='graph'?'关系图':'列表'}</a>`).join('');
      root.querySelector('#st-levels').innerHTML=['all','A1'].map(level=>`<a href="${linkTo(level,current.branch)}" ${level===current.stage?'aria-current="page"':''}>${level==='all'?'知识全景':level}</a>`).join('')+`<details class="st-future"><summary ${!['all','A1'].includes(current.stage)?'class="is-active"':''}>未来方向${!['all','A1'].includes(current.stage)?' · '+current.stage:''}</summary><nav aria-label="后续阶段">${data.stages.filter(l=>l!=='A1').map(l=>`<a href="${linkTo(l,current.branch)}" ${l===current.stage?'aria-current="page"':''}>${l} · 规划</a>`).join('')}</nav></details>`;
      root.querySelector('#st-path').innerHTML=`<a href="${linkTo()}">知识全景</a>${branch?`<span>／</span><a href="${linkTo('A1',branch.id)}">${branch.name}</a>`:''}${current.group?`<span>／</span><span>${groups[current.group]}</span>`:''}${current.branch==='grammar'&&current.stage==='A1'?`<nav aria-label="语法子树"><a href="${linkTo('A1','grammar')}" ${!current.group?'aria-current="page"':''}>全部语法</a>${Object.entries(groups).map(([id,name])=>`<a href="${linkTo('A1','grammar',id)}" ${current.group===id?'aria-current="page"':''}>${name}</a>`).join('')}</nav>`:''}`;
      for(const link of root.querySelectorAll('.st-header nav a')){link.removeAttribute('aria-current');if(link.getAttribute('href')===(isVerbView()?href('A1','grammar','verbs'):'#skills'))link.setAttribute('aria-current','page');}
    }
    function overview(){
      const branches=current.branch==='all'?data.branches:data.branches.filter(b=>b.id===current.branch);
      board.innerHTML=`<div class="st-dashboard"><div class="st-dashboard-intro"><div><p class="st-eyebrow">A1 / VOTRE ATLAS</p><h2>让每一课，连成你的知识体系。</h2><p>从语言基础，到听说读写。选择一个领域，查看真实技能与关联讲义。</p></div><a class="st-dashboard-continue" href="${current.node?linkTo(current.node.stage,current.node.branch,current.node.id,{mode:'graph',allGroups:false}):lastSkillHash&&route(lastSkillHash).node?esc(lastSkillHash):linkTo('A1','grammar','verbs')}">${current.node?'进入所选技能分支':'继续探索'} ↗</a></div>${[['语言基础',['pronunciation','vocabulary','grammar']],['综合运用',['listening','speaking','reading','writing']]].map(([name,ids])=>`<section class="st-domain-group"><h3>${name}</h3><div class="st-domain-grid">${branches.filter(b=>ids.includes(b.id)).map((b,i)=>{
        const nodes=data.nodes.filter(n=>n.branch===b.id&&!n.planned),s=summary(nodes,records());
        return `<article class="st-domain-card ${current.node?.branch===b.id?'is-selected':''}" data-branch="${b.id}"><a class="st-domain-heading" href="${linkTo('A1',b.id)}"><span class="st-domain-icon">${icon(b.icon)}</span><span><small>${b.french}</small><h4>${b.name}</h4></span><span class="st-domain-arrow">↗</span></a><p>${b.description}</p><div class="st-domain-progress"><span>${s.mastered} / ${s.total} 已点亮</span><span>${s.touched} 已接触</span></div><div class="st-progress-track"><i style="width:${s.mastered/s.total*100}%"></i></div><nav aria-label="${b.name}知识入口">${b.id==='grammar'?Object.entries(groups).map(([id,name])=>`<a href="${linkTo('A1',b.id,id)}">${name}<span>↗</span></a>`).join(''):nodes.slice(0,3).map(n=>`<a href="${linkTo(n.stage,n.branch,n.id)}">${esc(n.title)}<i class="st-dot st-level-${levelOf(n)}"></i></a>`).join('')}</nav><a class="st-domain-all" href="${linkTo('A1',b.id)}">探索 ${nodes.length} 个技能 →</a></article>`;
      }).join('')}</div></section>`).join('')}<details class="st-future-panel"><summary>A2—B2 · 查看未来学习方向 <span>规划，不计入当前进度</span></summary><div>${data.stages.filter(l=>l!=='A1').map(l=>`<a href="${linkTo(l)}">${l} · 后续方向 ↗</a>`).join('')}</div></details></div>`;
    }
    function planning(){
      board.innerHTML=`<div class="st-dashboard"><div class="st-dashboard-intro"><div><p class="st-eyebrow">${current.stage} / À VENIR</p><h2>下一阶段，逐步展开。</h2><p>以下仅为学习方向，详细讲义与掌握标准尚未接入；不会计入A1进度。</p></div><a href="${linkTo('A1')}">返回已收录知识 →</a></div><div class="st-plan-grid">${scopedNodes(current,true,records()).map(n=>`<a class="st-plan-card" href="${linkTo(n.stage,n.branch,n.id)}"><small>${data.branches.find(b=>b.id===n.branch).name} · 规划</small><h3>${esc(n.title)}</h3><p>${esc(n.goal)}</p><span>查看方向 ↗</span></a>`).join('')||'<p>没有匹配的方向，请调整搜索。</p>'}</div></div>`;
    }
    function grammarOverview(){
      board.innerHTML=`<div class="st-dashboard"><div class="st-dashboard-intro"><div><p class="st-eyebrow">A1 / GRAMMAIRE</p><h2>从一个词形，到完整的句子。</h2><p>按主题查阅语法；每个技能都连接实际讲义，浏览顺序可以自由选择。</p></div></div><div class="st-grammar-grid">${Object.entries(groups).map(([id,name],i)=>{
        const nodes=data.nodes.filter(n=>n.branch==='grammar'&&n.group===id),s=summary(nodes,records());
        return `<article class="st-domain-card"><a class="st-domain-heading" href="${linkTo('A1','grammar',id)}"><span class="st-domain-icon">0${i+1}</span><h3>${name}</h3><span class="st-domain-arrow">↗</span></a><p>${s.total} 个真实技能 · ${s.mastered} 个已点亮</p><nav aria-label="${name}">${nodes.slice(0,5).map(n=>`<a href="${linkTo(n.stage,n.branch,n.id)}">${esc(n.title)}<i class="st-dot st-level-${levelOf(n)}"></i></a>`).join('')}</nav><a class="st-domain-all" href="${linkTo('A1','grammar',id)}">展开知识关系 →</a></article>`;
      }).join('')}</div></div>`;
    }
    function listView(){
      const nodes=scopedNodes(current,true,records());reviewSignature=nodes.map(n=>n.id).join('|');
      board.innerHTML=`<div class="st-list"><header><div><p class="st-eyebrow">RÉPERTOIRE / 知识索引</p><h2>${current.query?'搜索结果':'按知识查阅'}</h2><p>${nodes.length} 个${nodes.some(n=>n.planned)?'规划方向':'已收录技能'}${current.query?' · '+esc(current.query):' · 与关系图共用学习记录'}</p></div>${current.query?`<button data-st-action="clear-search">清空搜索</button>`:''}</header>${nodes.length?`<div class="st-list-rows">${nodes.map(n=>{
        const b=data.branches.find(b=>b.id===n.branch),ref=n.refs[0];
        return `<article class="st-list-row ${current.node?.id===n.id?'is-selected':''}" data-skill="${n.id}"><a class="st-list-main" href="${selectHref(n)}" ${current.node?.id===n.id?'aria-current="true"':''}><span class="st-list-icon">${icon(b.icon)}</span><span><small>${n.stage} · ${b.name}${n.group?' / '+groups[n.group]:''}</small><strong>${esc(n.title)}</strong><span>${esc(n.goal)}</span></span></a><span class="st-list-state">${n.planned?'◇ 规划':`<i class="st-dot st-level-${levelOf(n)}"></i>${states[levelOf(n)]}`}</span>${ref?`<a class="st-list-source" href="#lesson/${ref.lesson}/${ref.section}">第 ${ref.lesson} 课 · 原讲义 ↗</a>`:'<span class="st-list-source">讲义待接入</span>'}</article>`;
      }).join('')}</div>`:'<div class="st-empty"><h3>没有匹配的技能</h3><p>可调整阶段、分支或关键词；搜索不会修改学习记录。</p><button data-st-action="clear-search">清空搜索</button></div>'}</div>`;
    }
    function detailGraph(){skillGraph(false);}
    function verbGraph(){skillGraph(true);}
    function skillGraph(verbs){
      const nodes=scopedNodes(current,false,records());
      const branch=data.branches.find(b=>b.id===current.branch);
      layout=verbs?verbLayout():graphLayout(nodes);
      const selected=current.node,relations=selected?skillRelations(selected.id):{before:[],after:[]};
      const nearby=new Set([selected?.id,...relations.before,...relations.after]);
      let paths='';
      for(const [id,end] of layout.points){
        const node=byId.get(id);
        for(const required of node.requires){
          const start=layout.points.get(required);if(!start)continue;
          const incoming=selected?.id===id,outgoing=selected?.id===required;
          const state=incoming?'is-before':outgoing?'is-after':selected?'is-muted':'';
          let d;
          if(start.x===end.x){d=`M${start.x} ${start.y+68} L${end.x} ${end.y-78}`;}
          else if(end.x-start.x>400){
            const a=start.x+144,b=end.x-154,rail=130;
            d=`M${a} ${start.y} C${a+24} ${start.y},${a+24} ${rail},${a+48} ${rail} L${b-40} ${rail} C${b-10} ${rail},${b-10} ${end.y},${b} ${end.y}`;
          }else{const a=start.x+144,b=end.x-154;d=`M${a} ${start.y} C${(a+b)/2} ${start.y},${(a+b)/2} ${end.y},${b} ${end.y}`;}
          paths+=`<path d="${d}" class="${state}" marker-end="url(#st-verb-arrow${incoming?'-before':outgoing?'-after':''})"/>`;
        }
      }
      const zones=verbs?verbSections.map((n,i)=>({...n,x:40+i*370,width:320})):layout.lanes;
      const sections=zones.map((section,i)=>`<section class="st-verb-zone" style="left:${section.x}px;width:${section.width}px" aria-label="${section.title}"><div class="st-verb-zone-title"><span>0${i+1}</span><div><h2>${section.title}</h2><p>${section.caption}</p></div></div></section>`).join('');
      const cards=nodes.map((n,index)=>{
        const id=n.id,point=layout.points.get(id),level=levelOf(n);
        const relationship=selected?(id===selected.id?'当前选择':relations.before.includes(id)?'建议基础':relations.after.includes(id)?'后续技能':''):'';
        return `<a class="st-node st-verb-node st-level-${level} ${selected?.id===id?'is-selected':''} ${selected&&!nearby.has(id)?'is-muted':''} ${relationship==='建议基础'?'is-before':relationship==='后续技能'?'is-after':''}" style="left:${point.x}px;top:${point.y}px" href="${linkTo(n.stage,n.branch,id)}" ${selected?.id===id?'aria-current="true"':''} aria-label="${esc(n.title)}，${states[level]}${relationship?'，'+relationship:''}"><span class="st-verb-node-meta"><span>${String(index+1).padStart(2,'0')}</span><span>${relationship||`${n.refs.length} 处讲义`}</span></span><span class="st-verb-node-title"><span class="st-verb-symbol" aria-hidden="true">${icon(branch.icon)}</span><strong>${esc(n.title)}</strong></span><span class="st-verb-node-state"><i class="st-dot st-level-${level}"></i>${states[level]}<span aria-hidden="true">↗</span></span></a>`;
      }).join('');
      board.innerHTML=`<div class="st-verb-board-title"><span>${branch.french}</span><p>${verbs?'从词形，到完整表达。':esc(branch.description)}</p><small>按主题探索 · 无需按顺序解锁</small></div>${sections}<svg class="st-edges st-verb-edges" viewBox="0 0 ${layout.width} ${layout.height}" aria-hidden="true"><defs>${['','-before','-after'].map(suffix=>`<marker id="st-verb-arrow${suffix}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 1 L8 5 L0 9"/></marker>`).join('')}</defs>${paths}</svg>${cards}<p class="st-verb-board-foot">${selected?'蓝色 · 建议基础　／　金色 · 后续技能　／　其余节点仍可自由查看':'选择一个技能，查看它的基础、后续与原始讲义。'}</p>`;
    }
    function draw(){
      controls();stats();
      if(current.mode==='list'||current.unit||current.lesson||current.review!=='all')listView();
      else if(!['all','A1'].includes(current.stage))planning();
      else if(isVerbView())verbGraph();
      else if(current.stage==='A1'&&current.branch==='grammar'&&!current.group)grammarOverview();
      else if(isCanvas())detailGraph();
      else overview();
      board.style.width=isCanvas()?layout.width+'px':'';
      board.style.height=isCanvas()?layout.height+'px':'';
      if(!isCanvas())board.style.transform='none';
    }
    function openNode(node,focus=true){
      const record=records()[node.id]||{},level=record.level||0,branch=data.branches.find(b=>b.id===node.branch);
      if(!panel.contains(document.activeElement))returnFocus=document.activeElement;panel.hidden=false;
      body.innerHTML=`<p class="st-eyebrow">${node.stage} / ${branch.french}</p><div class="st-detail-icon st-level-${level}">${icon(branch.icon)}</div><h2>${esc(node.title)}</h2><p class="st-detail-goal">${esc(node.goal)}</p>${window.VERB_KNOWLEDGE?.skillPreview(node.id)||''}${grammarPreview(node.id)}${!node.planned?`<a class="st-verb-read" href="#lesson/${node.refs[0].lesson}/${node.refs[0].section}"><span>打开原始讲义</span><strong>第 ${node.refs[0].lesson} 课 · 查看规则与例句 <span aria-hidden="true">↗</span></strong></a>`:''}${node.planned?`<div class="st-planning"><strong>后续学习方向</strong><p>这一阶段的详细教材与技能尚未接入。你可以先了解方向，后续再逐步展开。</p></div>`:`<div class="st-detail-state"><i class="st-dot st-level-${level}"></i>${states[level]}<span>自评记录</span></div><h3>什么时候算掌握？</h3><ul class="st-criteria">${node.criteria.map(c=>`<li>${esc(c)}</li>`).join('')}</ul><h3>点亮这个技能</h3><div class="st-state-buttons">${states.map((name,i)=>`<button data-st-level="${i}" aria-pressed="${i===level}" ${i===3&&!canReview(record)?'disabled':''}>${i===3?'✓ ':''}${name}</button>`).join('')}</div><p class="st-help">“能独立运用”由你按上面的标准自评；掌握满24小时并再次独立完成后，可记录“复测巩固”。</p>${skillRelations(node.id).after.length?`<h3>后续技能</h3><div class="st-prerequisites st-successors">${skillRelations(node.id).after.map(id=>{const n=byId.get(id);return `<a href="${relationHref(n)}">${esc(n.title)} · ${data.branches.find(b=>b.id===n.branch).name} ↗</a>`;}).join('')}</div>`:''}${node.requires.length?`<h3>建议先掌握</h3><div class="st-prerequisites">${node.requires.map(id=>{const n=byId.get(id);return `<a href="${relationHref(n)}"><i class="st-dot st-level-${levelOf(n)}"></i>${esc(n.title)} · ${data.branches.find(b=>b.id===n.branch).name}</a>`;}).join('')}</div><p class="st-help">连线表示建议顺序，你可以随时查看任何技能。</p>`:''}${relationBack?`<button data-st-action="relation-back">↩ 返回原知识视图</button>`:''}<h3>复习与练习</h3><p class="st-help">按关联课程提供已有练习，不代表每道题对应本技能。自评后关闭详情，继续当前列表。</p>${practiceSources(node).map(r=>`<a class="st-practice-source" href="${r.href}">第 ${r.lesson} 课 · 书面练习与参考答案 →</a>`).join('')}<h3>关联课程</h3><div class="st-sources">${node.refs.map(ref=>{const course=adapter.courses.get(ref.lesson),section=course?.sections.find(s=>s.id===ref.section);return `<a href="#lesson/${ref.lesson}/${ref.section}"><span>第 ${ref.lesson} 课${adapter.state().completed.includes(ref.lesson)?' · 课程已学':''}</span><strong>${esc(section?.title||course?.title||'查看课程')}</strong></a>`;}).join('')}</div><label class="st-note-label" for="st-note">运用记录 <small>例句、易错点，或复测结果</small></label><textarea id="st-note" maxlength="2000" rows="3" placeholder="例如：不用讲义，写出昨天的三件事…">${esc(record.note||'')}</textarea><p class="st-note-status" id="st-note-status">${record.updatedAt?'记录更新于 '+esc(new Date(record.updatedAt).toLocaleString()):'记录保存在当前浏览器，可在书房导出备份。'}</p>`}`;
      if(focus){panel.scrollTop=0;root.querySelector('#st-close').focus({preventScroll:true});}
    }
    function remember(){
      const saved={view:{...view},width:stage.clientWidth,height:stage.clientHeight,scroll:stage.scrollTop,detail:panel.scrollTop,expanded:[...body.querySelectorAll('details')].map((d,i)=>d.open?i:-1).filter(i=>i>=0)};
      if(restoring)return;
      viewMemory.set(currentKey,saved);
      if(viewMemory.size>60)viewMemory.delete(viewMemory.keys().next().value);
      lastSkillHash=href(current.stage,current.branch,currentItem(),current);
      try{window.sessionStorage?.setItem(CACHE_KEY,JSON.stringify({last:lastSkillHash,views:[...viewMemory]}));}catch{}
    }
    function restore(ensureSelection=false){
      cancelAnimationFrame(restoreFrame);restoring=true;root.setAttribute('aria-busy','true');
      const saved=viewMemory.get(currentKey);
      restoreFrame=requestAnimationFrame(()=>{
        if(isCanvas()){
          if(saved){view={...saved.view};view.x+=(stage.clientWidth-saved.width)/2;view.y+=(stage.clientHeight-saved.height)/2;apply();if(ensureSelection&&current.node){const card=board.querySelector('.is-selected')?.getBoundingClientRect(),bounds=stage.getBoundingClientRect();if(card&&(card.left<bounds.left||card.right>bounds.right||card.top<bounds.top||card.bottom>bounds.bottom))focusNode(current.node.id);}}
          else{fit();if(current.node)focusNode(current.node.id);}
        }else stage.scrollTop=saved?.scroll||0;
        if(current.node&&saved){const expanded=Array.isArray(saved.expanded)?saved.expanded:[];body.querySelectorAll('details').forEach((d,i)=>d.open=expanded.includes(i));panel.scrollTop=saved.detail;}
        lastSize={w:stage.clientWidth,h:stage.clientHeight};restoring=false;root.setAttribute('aria-busy','false');
      });
    }
    function close(){
      const hadQuery=Boolean(current.query);
      if(current.node||hadQuery){location.hash=linkTo(current.stage,current.branch,current.group);return;}
      panel.hidden=true;
      if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});else stage.focus({preventScroll:true});
    }
    function searchResults(){
      if(!current.query){if(current.node)openNode(current.node,false);else panel.hidden=true;return;}
      const found=scopedNodes(current,true,records());panel.hidden=false;
      body.innerHTML=`<p class="st-eyebrow">RECHERCHE</p><h2>查找技能</h2><p class="st-help">${found.length} 个结果 · 当前阶段与分支</p><div class="st-search-results">${found.map(n=>`<a href="${selectHref(n)}"><span>${n.stage} · ${data.branches.find(b=>b.id===n.branch).name}${n.planned?' · 规划':''}</span><strong>${esc(n.title)}</strong><small>${n.planned?'后续学习方向':states[levelOf(n)]}</small></a>`).join('')||'<p>没有匹配的技能，可以调整分支或试试“冠词”“过去”“听辨”。</p>'}</div>`;
    }
    function search(){
      remember();current.query=root.querySelector('#st-search').value.slice(0,200);
      const hash=href(current.stage,current.branch,currentItem(),current);
      history.replaceState(history.state,'',hash);currentKey=hash;
      // Only replace the results, keeping the search input focused during typing.
      root.querySelector('#st-view-modes').innerHTML=['graph','list'].map(mode=>`<a href="${linkTo(current.stage,current.branch,currentItem(),{mode,...(mode==='graph'?{unit:0,lesson:0,review:'all'}:{})})}" ${current.mode===mode?'aria-current="page"':''}>${mode==='graph'?'关系图':'列表'}</a>`).join('');
      if(current.mode==='list'||current.unit||current.lesson||current.review!=='all'){listView();stage.scrollTop=0;}
      else searchResults();
    }
    function navigate(){
      remember();const previous=current,previousSaved=viewMemory.get(currentKey);
      current=route(location.hash);currentKey=href(current.stage,current.branch,current.node?.id||current.group,current);
      if(previous.node&&current.node&&previous.node.id!==current.node.id){relationBack=href(previous.stage,previous.branch,previous.node.id,previous);try{window.sessionStorage?.setItem('bonjour-francais-skill-relation-back',relationBack);}catch{}}
      const sameScope=['stage','branch','group','mode','query','unit','lesson','review'].every(key=>previous[key]===current[key]);
      if(sameScope&&!viewMemory.has(currentKey))viewMemory.set(currentKey,{...previousSaved,detail:0});
      panel.hidden=true;draw();
      if(current.node)openNode(current.node);else if(current.query&&current.mode==='graph')searchResults();
      restore(previous.node?.id!==current.node?.id);return true;
    }
    try{const saved=window.sessionStorage?.getItem('bonjour-francais-skill-relation-back');if(typeof saved==='string'&&saved.startsWith('#skills/')&&route(saved).node)relationBack=saved;}catch{}
    activeNavigate=navigate;
    on(root,'click',e=>{
      const link=e.target.closest('a[href^="#skills"]');
      if(link?.getAttribute('href')===location.hash){e.preventDefault();return;}
      const levelButton=e.target.closest('[data-st-level]');
      if(levelButton&&current.node){
        const level=Number(levelButton.dataset.stLevel);
        if(adapter.setSkill(current.node.id,{level})){
          const detailScroll=panel.scrollTop,stageScroll=stage.scrollTop;
          draw();board.querySelector('.is-selected')?.classList.add('just-updated');openNode(current.node,false);
          panel.scrollTop=detailScroll;stage.scrollTop=stageScroll;
          body.querySelector(`[data-st-level="${level}"]`).focus({preventScroll:true});announce('技能状态已保存：'+states[level]);
        }else announce('记录未能保存，请导出备份。');return;
      }
      const action=e.target.closest('[data-st-action]')?.dataset.stAction;
      if(action==='relation-back'){if(relationBack)location.hash=relationBack;return;}
      if(action==='clear-scope'){location.hash=linkTo(current.stage,current.branch,current.group,{unit:0,lesson:0,review:'all'});return;}
      if(action==='clear-search'){root.querySelector('#st-search').value='';search();}
      if(!isCanvas())return;
      if(action==='plus')zoom(1.25);if(action==='minus')zoom(.8);if(action==='fit')fit();
    });
    on(root.querySelector('#st-close'),'click',close);
    on(window,'pagehide',remember);
    on(root.querySelector('#st-review'),'change',e=>location.hash=linkTo(current.stage,current.branch,'',{mode:'list',review:Object.hasOwn(reviewLabels,e.target.value)?e.target.value:'all'}));
    for(const field of ['unit','lesson'])on(root.querySelector('#st-'+field),'change',e=>{const value=bounded(e.target.value,field==='unit'?9:36);location.hash=linkTo(current.stage,current.branch,'',{mode:'list',[field]:value,...(field==='unit'?{lesson:0}:{})});});
    on(root.querySelector('#st-branch'),'change',e=>location.hash=linkTo(current.stage==='all'&&e.target.value!=='all'?'A1':current.stage,e.target.value,'',{allGroups:false}));
    on(root.querySelector('#st-search'),'input',search);
    on(body,'input',e=>{if(e.target.id==='st-note'&&current.node){const ok=adapter.setSkill(current.node.id,{note:e.target.value});root.querySelector('#st-note-status').textContent=ok?'运用记录已保存':'未能保存，请先复制这段记录';}});
    on(stage,'wheel',e=>{if(!isCanvas())return;e.preventDefault();const r=stage.getBoundingClientRect();zoom(Math.exp(-e.deltaY*.0012),e.clientX-r.left,e.clientY-r.top);},{passive:false});
    on(stage,'pointerdown',e=>{if(!isCanvas())return;if(e.target.closest('a,button'))return;stage.focus();stage.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const [a,b]=[...pointers.values()];pinch=Math.hypot(a.x-b.x,a.y-b.y);}});
    on(stage,'pointermove',e=>{const prev=pointers.get(e.pointerId);if(!prev)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const[a,b]=[...pointers.values()],d=Math.hypot(a.x-b.x,a.y-b.y),r=stage.getBoundingClientRect();if(pinch)zoom(d/pinch,(a.x+b.x)/2-r.left,(a.y+b.y)/2-r.top);pinch=d;}else{view.x+=e.clientX-prev.x;view.y+=e.clientY-prev.y;apply();}});
    const release=e=>{pointers.delete(e.pointerId);pinch=null;};['pointerup','pointercancel','lostpointercapture'].forEach(event=>on(stage,event,release));
    on(root,'keydown',e=>{if(e.key==='Escape'&&!panel.hidden){close();return;}if(e.target!==stage||!isCanvas())return;const moves={ArrowLeft:[50,0],ArrowRight:[-50,0],ArrowUp:[0,50],ArrowDown:[0,-50]};if(moves[e.key]){e.preventDefault();view.x+=moves[e.key][0];view.y+=moves[e.key][1];apply();}if(e.key==='+'||e.key==='='){e.preventDefault();zoom(1.2);}if(e.key==='-'){e.preventDefault();zoom(1/1.2);}if(e.key==='0')fit();});
    on(board,'focusin',e=>{if(!isCanvas())return;const node=e.target.closest('.st-node,.st-cluster,.st-root');if(node&&e.target!==returnFocus){const r=node.getBoundingClientRect(),s=stage.getBoundingClientRect();if(r.left<s.left||r.right>s.right||r.top<s.top||r.bottom>s.bottom){view.x+=s.x+s.width/2-(r.x+r.width/2);view.y+=s.y+s.height/2-(r.y+r.height/2);apply();}}});
    const observer=new ResizeObserver(()=>{
      const size={w:stage.clientWidth,h:stage.clientHeight};
      if(!size.w||!size.h||restoring)return;
      if(isCanvas()&&(!lastSize||lastSize.w!==size.w||lastSize.h!==size.h)){fit();if(current.node)focusNode(current.node.id);}
      lastSize=size;
    });observer.observe(stage);
    draw();if(current.node)openNode(current.node);else if(current.query&&current.mode==='graph')searchResults();restore();
    const reviewTimer=setInterval(()=>{stats();if(current.review!=='all'&&reviewSignature!==scopedNodes(current,true,records()).map(n=>n.id).join('|')){const scroll=stage.scrollTop;listView();stage.scrollTop=scroll;}if(current.node&&!current.node.planned){const button=body.querySelector('[data-st-level="3"]');if(button)button.disabled=!canReview(records()[current.node.id]);}},60000);
    let disposed=false;
    dispose=()=>{if(disposed)return;disposed=true;remember();cancelAnimationFrame(restoreFrame);controller.abort();observer.disconnect();clearInterval(reviewTimer);clearTimeout(noticeTimer);activeNavigate=null;};
  }
  window.SKILL_TREE={render,mount,unmount:()=>dispose(),navigate:()=>activeNavigate?.()||false,summary,recommend,recommendation,reviewState,practiceSources,grammarPreview,coverage,readViewCache,searchNodes,canReview,route,href,scopedNodes,graphLayout,verbLayout,skillRelations,states,resumeHref:()=>lastSkillHash||'#skills'};
})();

