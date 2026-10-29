'use strict';
(() => {
  const data=window.VERB_LIBRARY,records=data.records,byId=new Map(records.map(r=>[r.id,r]));
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim().toLocaleLowerCase();
  const roles={core:'核心／重点',review:'复习',extension:'补充／拓展'};
  let dispose=()=>{},activeNavigate=null;
  function route(hash){
    const [path,query='']=hash.split('?'),id=path.split('/')[1]||'list',p=new URLSearchParams(query);
    const lesson=Number(p.get('lesson')),through=Number(p.get('through'));
    return {id:id==='list'?'':byId.has(id)?id:null,query:(p.get('q')||'').slice(0,200),group:['1','3'].includes(p.get('group'))?p.get('group'):'all',kind:['plain','reflexive'].includes(p.get('kind'))?p.get('kind'):'all',through:[4,8,12,16].includes(through)?through:16,lesson:Number.isInteger(lesson)&&lesson>=1&&lesson<=16?lesson:0,skill:records.some(r=>r.skillIds.includes(p.get('skill')))?p.get('skill'):''};
  }
  function href(id='',options={}){
    const p=new URLSearchParams();
    if(options.query)p.set('q',options.query.slice(0,200));
    if(['1','3'].includes(options.group))p.set('group',options.group);
    if(['plain','reflexive'].includes(options.kind))p.set('kind',options.kind);
    if(options.lesson)p.set('lesson',options.lesson);else if(options.through&&options.through!==16)p.set('through',options.through);
    if(options.skill)p.set('skill',options.skill);
    return '#verbs/'+(id||'list')+(p.size?'?'+p.toString():'');
  }
  function filter(options){
    const query=normalize(options.query||'');
    return records.filter(r=>(!query||normalize([r.infinitive,r.meaning,...(r.aliases||[])].join(' ')).includes(query))&&(options.group==='all'||!options.group||r.group===options.group)&&(options.kind==='all'||!options.kind||r.pronominal===(options.kind==='reflexive'))&&(options.lesson?r.refs.some(ref=>ref.lesson===options.lesson):r.firstLesson<=(options.through||16))&&(!options.skill||r.skillIds.includes(options.skill)));
  }
  function fullForm(record,index){
    const form=record.forms[index];
    return index===0&&record.jeElision?'j’'+form:data.persons[index]+' '+form;
  }
  function table(record,compact=false){
    return `<div class="vk-table-wrap"><table class="vk-table ${compact?'vk-table-compact':''}" aria-label="${esc(record.infinitive)}直陈式现在时"><thead><tr><th scope="col">人称</th><th scope="col">完整形式</th></tr></thead><tbody>${data.persons.map((person,i)=>`<tr><th scope="row">${esc(person)}</th><td lang="fr">${esc(fullForm(record,i))}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function card(record,detail=false,options={}){
    const refs=[...new Map(record.refs.map(ref=>[ref.lesson+'/'+ref.section,ref])).values()];
    return `<article class="vk-card ${detail?'vk-card-detail':''}" id="verb-${record.id}" data-verb="${record.id}"><header><div><p class="vk-eyebrow">A1 · 直陈式现在时 · 第${record.group}组${record.pronominal?' · 代词式':''}</p><h2><a href="${href(record.id,options)}" lang="fr">${esc(record.infinitive)}</a></h2><p class="vk-meaning">${esc(record.meaning)}</p></div>${detail?'':`<a class="vk-expand" href="${href(record.id,options)}" aria-label="查看${esc(record.infinitive)}详情">↗</a>`}</header>${table(record)}<div class="vk-usage"><h3>变化与用法</h3>${record.notes.map(note=>`<p>${esc(note)}</p>`).join('')}</div><div class="vk-example">${record.examples.map(e=>`<p lang="fr">${esc(e.fr)}</p><p>${esc(e.zh)}</p>`).join('')}</div>${record.relatedIds.length?`<div class="vk-related">对比用法：${record.relatedIds.map(id=>`<a href="${href(id)}" lang="fr">${esc(byId.get(id).infinitive)} ↗</a>`).join('')}</div>`:''}<footer><h3>来源与学习范围</h3>${refs.map(ref=>`<a href="#lesson/${ref.lesson}/${ref.section}">第${ref.lesson}课 · ${roles[ref.role]} ↗</a>`).join('')}${detail?refs.filter(ref=>ref.roleNote).map(ref=>`<p>第${ref.lesson}课：${esc(ref.roleNote)}</p>`).join(''):''}<div class="vk-skill-links">${record.skillIds.map(id=>{const n=window.FRENCH_SKILLS?.nodes.find(n=>n.id===id);return n?`<a href="#skills/${n.stage}/${n.branch}/${n.id}">技能 · ${esc(n.title)} ↗</a>`:'';}).join('')}</div></footer></article>`;
  }
  function results(options){
    if(options.id===null)return '<div class="vk-empty"><h2>未找到这条变位</h2><p>可返回手册搜索法语原形或中文含义。</p><a class="button" href="#verbs">返回动词手册</a></div>';
    const selected=options.id?byId.get(options.id):null,found=selected?[selected]:filter(options);
    const skill=window.FRENCH_SKILLS?.nodes.find(n=>n.id===options.skill);
    return `<div class="vk-results-bar" role="status"><span>${selected?'变位详情':`${found.length} / ${records.length} 条已收录变位`}${options.lesson?' · 第'+options.lesson+'课完整表':''}${skill?' · 关联技能：'+esc(skill.title):''}</span>${selected?`<a href="${href('',options)}">← 返回筛选结果</a>`:''}${options.skill?`<a href="${href('',{...options,skill:''})}">查看其他技能</a>`:''}</div>${found.length?`<div class="vk-grid ${selected?'vk-single':''}">${found.map(r=>card(r,Boolean(selected),options)).join('')}</div>`:'<div class="vk-empty"><h2>没有匹配的动词</h2><p>试试“être”“起床”或减少筛选条件。</p><a class="button secondary" href="#verbs">清除筛选</a></div>'}`;
  }
  function render(){
    const current=route(location.hash);
    return `<div class="verb-knowledge" id="verb-knowledge"><header class="vk-heading"><div><p class="vk-eyebrow">LE NOUVEAU TAXI ! 1 / UNITÉS 1—4</p><h1>动词变位手册</h1><p>原形、词义、六个人称。在一处连起来复习。</p></div><a class="button secondary" href="${esc(window.SKILL_TREE?.resumeHref()||'#skills')}">返回知识技能树 ↗</a></header><div class="vk-scope"><strong>${records.length} 条现在时 · ${records.filter(r=>r.pronominal).length} 种代词式用法</strong><span>第1—16课已有完整变位；识别词、命令式及后续时态尚未纳入。</span></div><form class="vk-filters" id="vk-filters" role="search"><label class="vk-search-label">查找动词<input id="vk-search" type="search" maxlength="200" placeholder="法语原形或中文，例如 être、起床" value="${esc(current.query)}"></label><label>组别<select id="vk-group"><option value="all">全部已收录组别</option><option value="1">第一组（含拼写变化）</option><option value="3">第三组／不规则</option></select></label><label>用法<select id="vk-kind"><option value="all">普通与代词式</option><option value="plain">普通形式</option><option value="reflexive">代词式用法</option></select></label><label>课次范围<select id="vk-range">${[4,8,12,16].map(n=>`<option value="through-${n}">截至第${n}课 · ${n/4}单元</option>`).join('')}${Array.from({length:16},(_,i)=>`<option value="lesson-${i+1}">仅第${i+1}课的完整表</option>`).join('')}</select></label><a class="vk-reset" href="#verbs">重置</a></form><section id="vk-results" aria-label="变位查阅结果">${results(current)}</section></div>`;
  }
  function mount(){
    dispose();const root=document.getElementById('verb-knowledge');if(!root)return;
    const controller=new AbortController();let current=route(location.hash);
    const sync=()=>{
      root.querySelector('#vk-search').value=current.query;root.querySelector('#vk-group').value=current.group;root.querySelector('#vk-kind').value=current.kind;root.querySelector('#vk-range').value=current.lesson?'lesson-'+current.lesson:'through-'+current.through;
      root.querySelector('#vk-results').innerHTML=results(current);
    };
    activeNavigate=()=>{current=route(location.hash);sync();window.scrollTo(0,0);return true;};
    root.querySelector('#vk-search').addEventListener('input',e=>{
      current={...current,id:'',query:e.target.value.slice(0,200)};history.replaceState(history.state,'',href('',current));root.querySelector('#vk-results').innerHTML=results(current);
    },{signal:controller.signal});
    root.querySelector('#vk-filters').addEventListener('submit',e=>e.preventDefault(),{signal:controller.signal});
    root.querySelector('#vk-filters').addEventListener('change',()=>{
      const [kind,value]=root.querySelector('#vk-range').value.split('-');
      const next={...current,id:'',group:root.querySelector('#vk-group').value,kind:root.querySelector('#vk-kind').value,lesson:kind==='lesson'?Number(value):0,through:kind==='through'?Number(value):16};
      location.hash=href('',next);
    },{signal:controller.signal});
    sync();dispose=()=>{controller.abort();activeNavigate=null;};
  }
  function sectionLinks(lesson,section){
    const found=records.filter(r=>r.refs.some(ref=>ref.lesson===lesson&&ref.section===section));
    return found.length?`<nav class="vk-section-links" aria-label="本节共享变位"><span>共享变位速查</span>${found.map(r=>`<a href="${href(r.id)}" lang="fr">${esc(r.infinitive)} ↗</a>`).join('')}</nav>`:'';
  }
  function lessonLink(lesson){return records.some(r=>r.refs.some(ref=>ref.lesson===lesson))?`<a class="vk-lesson-link" href="${href('',{lesson})}">本课共享变位 ↗</a>`:'';}
  function skillPreview(skill){
    const found=records.filter(r=>r.skillIds.includes(skill));if(!found.length)return '';
    const record=found[0];
    return `<section class="vk-skill-preview" aria-label="关联变位速查"><p class="st-eyebrow">共享知识 / 现在时</p><h3 lang="fr">${esc(record.infinitive)} <small>${esc(record.meaning)}</small></h3>${table(record,true)}<p>${esc(record.notes[0])}</p><a href="${href(record.id)}">查看规则、例句与来源 ↗</a>${found.length>1?`<a href="${href('',{skill})}">查看此技能关联的 ${found.length} 条变位 →</a>`:''}</section>`;
  }
  window.VERB_KNOWLEDGE={render,mount,unmount:()=>dispose(),navigate:()=>activeNavigate?.()||false,route,href,filter,fullForm,table,card,sectionLinks,lessonLink,skillPreview};
})();
