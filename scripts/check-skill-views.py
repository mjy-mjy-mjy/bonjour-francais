"""Optional VIS-02 desktop browser checks; requires Playwright, Chromium and localhost:8765."""
import json
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'docs/visuals/VIS-02'
OUT.mkdir(parents=True,exist_ok=True)
BASE='http://127.0.0.1:8765/'
report={'viewports':[],'interactions':[],'errors':[]}
branches=[('pronunciation','p-rhythm'),('vocabulary','v-routine'),('listening','l-routine'),('speaking','s-routine'),('reading','r-article'),('writing','w-routine'),('grammar','g-agreement'),('grammar','g-y'),('grammar','g-past-etre')]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
 for label,w,h,dpr in [('2k',2560,1440,1),('4k',3840,2160,1),('4k-200',1920,1080,2),('2k-150',1707,960,1.5),('2k-200',1280,720,2)]:
  context=b.new_context(viewport={'width':w,'height':h},device_scale_factor=dpr)
  page=context.new_page();page.on('pageerror',lambda e:report['errors'].append(str(e)))
  page.goto(BASE+'#skills');expect(page.locator('.st-domain-card')).to_have_count(7)
  assert page.locator('.st-future-panel').get_attribute('open') is None
  assert page.locator('#st-stats').inner_text().replace('\n',' ').find('/ 64')>=0
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  if label in ['2k','4k']:page.screenshot(path=str(OUT/(label+'-overview.jpg')),type='jpeg',quality=88,scale='css')
  cases=[]
  for branch,node in branches:
   page.goto(BASE+f'#skills/A1/{branch}/{node}')
   expect(page.locator('.st-node.is-selected')).to_have_count(1)
   page.wait_for_timeout(60)
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(label,node)
   boxes=page.locator('.st-node').evaluate_all('nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})')
   for i,a in enumerate(boxes):
    for c in boxes[i+1:]:assert a['x']+a['w']<=c['x'] or c['x']+c['w']<=a['x'] or a['y']+a['h']<=c['y'] or c['y']+c['h']<=a['y'],(label,node,'overlap')
   expect(page.locator('.st-verb-read')).to_be_visible()
   cases.append({'branch':branch,'node':node,'cards':len(boxes),'scale':page.locator('#st-scale').inner_text()})
   if label=='2k' and node in ['s-routine','g-y']:page.screenshot(path=str(OUT/(label+'-'+node+'.jpg')),type='jpeg',quality=88,scale='css')
  page.goto(BASE+'#skills/all/all?view=list');expect(page.locator('.st-list-row')).to_have_count(64)
  if label in ['2k','4k']:page.screenshot(path=str(OUT/(label+'-list.jpg')),type='jpeg',quality=88,scale='css')
  page.locator('#st-branch').select_option('reading');expect(page.locator('.st-list-row')).to_have_count(5)
  report['viewports'].append({'label':label,'css':[w,h],'deviceScaleFactor':dpr,'browserZoom':'100%','branchChecks':cases})
  context.close()
 context=b.new_context(viewport={'width':1920,'height':1080})
 page=context.new_page();page.on('pageerror',lambda e:report['errors'].append(str(e)))
 # Selection should not narrow a broad list; selection must survive mode switch and refresh.
 page.goto(BASE+'#skills/all/all?view=list')
 page.locator('.st-list-row[data-skill="g-past-etre"] .st-list-main').click()
 expect(page.locator('.st-list-row')).to_have_count(64)
 expect(page.locator('#st-detail h2')).to_have_text('être 复合过去时')
 selected_url=page.url
 page.locator('#st-view-modes a',has_text='关系图').click()
 expect(page.locator('#st-detail h2')).to_have_text('être 复合过去时')
 expect(page.locator('.st-domain-card.is-selected')).to_have_count(1)
 page.locator('#st-view-modes a',has_text='列表').click();page.reload()
 expect(page.locator('.st-list-row.is-selected')).to_have_attribute('data-skill','g-past-etre')
 expect(page.locator('.st-list-row')).to_have_count(64)
 # Grammar broad scope should also stay broad.
 page.goto(BASE+'#skills/A1/grammar?view=list')
 page.locator('.st-list-row[data-skill="g-etre"] .st-list-main').click()
 expect(page.locator('.st-list-row')).to_have_count(27)
 report['interactions'].append('List selection preserves broad 64-skill and 27-grammar scopes; selection survives graph/list switch and reload')
 # Search state shared between list and graph. No-result cleanup and URL encoding.
 page.goto(BASE+'#skills/A1/grammar/verbs?view=list')
 page.locator('#st-search').fill('etre')
 count=page.locator('.st-list-row').count();assert count>0 and count<11
 assert 'q=etre' in page.url
 page.locator('#st-view-modes a',has_text='关系图').click()
 expect(page.locator('.st-search-results a')).to_have_count(count)
 page.locator('#st-view-modes a',has_text='列表').click()
 expect(page.locator('.st-list-row')).to_have_count(count)
 page.locator('#st-search').fill('zz-no-match');expect(page.locator('.st-empty')).to_contain_text('没有匹配')
 page.locator('.st-empty button').click();expect(page.locator('.st-list-row')).to_have_count(11)
 page.locator('#st-search').fill('<img src=x onerror=alert(1)>')
 assert page.locator('.st-list img').count()==0
 page.reload();expect(page.locator('#st-search')).to_have_value('<img src=x onerror=alert(1)>')
 report['interactions'].append('Shared scoped search, accent normalization, URL query persistence, no results, clear and escaped query')
 # Planning is available but readonly.
 page.goto(BASE+'#skills')
 page.locator('.st-future-panel summary').click();page.locator('.st-future-panel a',has_text='A2').click()
 expect(page.locator('.st-plan-card')).to_have_count(7)
 page.locator('.st-plan-card').first.click();expect(page.locator('.st-planning')).to_be_visible()
 expect(page.locator('[data-st-level]')).to_have_count(0)
 report['interactions'].append('Future stages remain accessible, explicitly planned, excluded from mastery and readonly')
 # Saved list scroll across course and map, and history navigation.
 page.goto(BASE+'#skills/all/all?view=list')
 row=page.locator('.st-list-row[data-skill="r-article"]')
 row.locator('.st-list-main').click();expect(page.locator('#st-detail h2')).to_have_text('短文主旨与细节')
 scroll=page.locator('#st-stage').evaluate('(n)=>n.scrollTop');assert scroll>1000
 url=page.url
 row.locator('.st-list-source').click();expect(page.locator('.skill-return')).to_be_visible()
 page.locator('.skill-return').click();expect(page.locator('.st-list-row.is-selected')).to_have_attribute('data-skill','r-article')
 page.wait_for_timeout(100)
 assert abs(page.locator('#st-stage').evaluate('(n)=>n.scrollTop')-scroll)<3
 page.locator('.st-header a',has_text='知识大陆').click()
 page.locator('.map-actions a',has_text='知识技能树').click()
 expect(page.locator('.st-list-row.is-selected')).to_have_attribute('data-skill','r-article')
 assert page.url==url
 page.wait_for_timeout(100)
 assert abs(page.locator('#st-stage').evaluate('(n)=>n.scrollTop')-scroll)<3
 page.go_back();expect(page.locator('#knowledge-map')).to_be_visible()
 page.go_forward();expect(page.locator('.st-list-row.is-selected')).to_have_attribute('data-skill','r-article')
 report['interactions'].append('Course return, map return and history preserve list mode, selection, broad filter and scroll position')
 # Bare #skills and its canonical URL must share overview scroll memory.
 page.goto(BASE+'#skills');expect(page.locator('#skill-tree')).to_have_attribute('aria-busy','false')
 page.locator('#st-stage').evaluate('(n)=>n.scrollTop=n.scrollHeight')
 overview_scroll=page.locator('#st-stage').evaluate('(n)=>n.scrollTop')
 page.locator('.st-header a',has_text='知识大陆').click();page.locator('.map-actions a',has_text='知识技能树').click()
 expect(page.locator('#skill-tree')).to_have_attribute('aria-busy','false')
 assert abs(page.locator('#st-stage').evaluate('(n)=>n.scrollTop')-overview_scroll)<3
 report['interactions'].append('Bare overview URL and canonical URL share scroll restoration')
 # Same-session graph viewport and selected detail scroll survive leaving and returning.
 page.goto(BASE+'#skills/A1/speaking/s-routine')
 expect(page.locator('#skill-tree')).to_have_attribute('aria-busy','false')
 stage=page.locator('#st-stage');stage.focus()
 for _ in range(8):page.keyboard.press('+')
 page.keyboard.press('ArrowRight')
 transform=page.locator('#st-board').evaluate('(n)=>getComputedStyle(n).transform')
 page.locator('#st-detail').evaluate('(n)=>n.scrollTop=260')
 page.locator('.st-header a',has_text='知识大陆').click()
 page.locator('.map-actions a',has_text='知识技能树').click()
 expect(page.locator('#st-detail h2')).to_have_text('介绍日常与采访');page.wait_for_timeout(100)
 assert page.locator('#st-board').evaluate('(n)=>getComputedStyle(n).transform')==transform
 assert abs(page.locator('#st-detail').evaluate('(n)=>n.scrollTop')-260)<3
 page.locator('[data-st-level="2"]').click()
 page.locator('#st-note').fill('VIS-02 verification')
 page.locator('#st-view-modes a',has_text='列表').click()
 expect(page.locator('.st-list-row.is-selected .st-list-state')).to_contain_text('能独立运用')
 page.reload();expect(page.locator('#st-note')).to_have_value('VIS-02 verification')
 expect(page.locator('[data-st-level="3"]')).to_be_disabled()
 report['interactions'].append('Graph zoom/pan and detail scroll restored across map; mastery and notes shared with list and persist on refresh; 24h review remains protected')
 assert page.evaluate("JSON.parse(localStorage.getItem('bonjour-francais-progress-v1')).completed.length")==0
 context.close();b.close()
assert not report['errors'],report['errors']
(OUT/'browser-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps({'viewports':len(report['viewports']),'branchChecks':sum(len(v['branchChecks']) for v in report['viewports']),'interactions':report['interactions'],'errors':report['errors']},ensure_ascii=False,indent=2))
