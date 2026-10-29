"""Optional K1 browser verification; requires local site, Playwright and Chromium."""
import json
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'docs/visuals/K1'
OUT.mkdir(parents=True,exist_ok=True)
BASE='http://127.0.0.1:8765/'
KEY='bonjour-francais-progress-v1'
report={'viewports':[],'interactions':[],'pageErrors':[],'failedLocalRequests':[]}
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
 for label,w,h,dpr in [('2k',2560,1440,1),('4k',3840,2160,1),('4k-200',1920,1080,2),('2k-150',1707,960,1.5),('2k-200',1280,720,2)]:
  for theme in ['glass','paper']:
   for appearance in ['light','dark']:
    ctx=browser.new_context(viewport={'width':w,'height':h},device_scale_factor=dpr,color_scheme=appearance)
    ctx.add_init_script("localStorage.setItem('bonjour-francais-theme-v1',"+json.dumps(theme)+")")
    page=ctx.new_page();page.on('pageerror',lambda e:report['pageErrors'].append(str(e)))
    page.on('response',lambda r:report['failedLocalRequests'].append(r.url) if r.url.startswith(BASE) and r.status>=400 else None)
    page.goto(BASE+'#verbs');expect(page.locator('.vk-card')).to_have_count(42)
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(label,theme,appearance)
    for record in ['present-etre','present-s-appeler','present-nager']:
     expect(page.locator(f'[data-verb="{record}"] tbody tr')).to_have_count(6)
    if theme=='glass' and appearance=='light' and label in ['2k','4k']:page.screenshot(path=str(OUT/(label+'-library.jpg')),type='jpeg',quality=88,scale='css')
    page.goto(BASE+'#verbs/present-se-lever');expect(page.locator('.vk-card')).to_have_count(1)
    expect(page.locator('.vk-table')).to_contain_text('nous nous levons')
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(label,theme,appearance,'detail')
    if label=='2k' and theme=='paper' and appearance=='light':page.screenshot(path=str(OUT/'2k-reflexive-detail.jpg'),type='jpeg',quality=88,scale='css')
    report['viewports'].append({'label':label,'css':[w,h],'deviceScaleFactor':dpr,'browserZoom':'100%','theme':theme,'appearance':appearance,'views':['42 tables','pronominal detail']})
    ctx.close()
 ctx=browser.new_context(viewport={'width':1920,'height':1080})
 page=ctx.new_page();page.on('pageerror',lambda e:report['pageErrors'].append(str(e)))
 page.goto(BASE+'#verbs')
 before=page.evaluate(f'localStorage.getItem({json.dumps(KEY)})')
 page.locator('#vk-search').fill('etre');expect(page.locator('.vk-card')).to_have_count(1)
 expect(page.locator('.vk-card')).to_have_attribute('data-verb','present-etre')
 page.locator('#vk-search').fill("s'appeler");expect(page.locator('.vk-card')).to_have_attribute('data-verb','present-s-appeler')
 page.locator('#vk-search').fill('起床');expect(page.locator('.vk-card')).to_have_attribute('data-verb','present-se-lever')
 page.locator('.vk-card h2 a').click();expect(page.locator('.vk-single')).to_be_visible()
 page.reload();expect(page.locator('#vk-search')).to_have_value('起床')
 page.locator('.vk-results-bar a',has_text='返回筛选结果').click();expect(page.locator('.vk-card')).to_have_count(1)
 page.locator('#vk-search').fill('zz-no-such-verb');expect(page.locator('.vk-empty')).to_contain_text('没有匹配')
 page.locator('.vk-empty a').click();expect(page.locator('.vk-card')).to_have_count(42)
 report['interactions'].append('Accent and apostrophe normalization, Chinese search, shareable filtered details, reload, return and empty state')
 page.locator('#vk-kind').select_option('reflexive');expect(page.locator('.vk-card')).to_have_count(10)
 page.locator('#vk-group').select_option('3');expect(page.locator('.vk-card')).to_have_count(1)
 expect(page.locator('.vk-card')).to_have_attribute('data-verb','present-se-detendre')
 page.locator('.vk-reset').click();expect(page.locator('.vk-card')).to_have_count(42)
 for limit,count in [(4,9),(8,10),(12,11),(16,42)]:
  page.locator('#vk-range').select_option('through-'+str(limit));expect(page.locator('.vk-card')).to_have_count(count)
 page.locator('#vk-range').select_option('lesson-14');expect(page.locator('.vk-card')).to_have_count(4)
 page.go_back();expect(page.locator('.vk-card')).to_have_count(42)
 page.go_forward();expect(page.locator('.vk-card')).to_have_count(4)
 assert page.evaluate(f'localStorage.getItem({json.dumps(KEY)})')==before
 report['interactions'].append('Group/use/range filters, exact lesson coverage and browser history; lookup does not change learning state')
 # Course and skill use the same content and preserve legacy anchors.
 page.goto(BASE+'#lesson/14/faire');expect(page.locator('#lesson14-faire')).to_contain_text('nous')
 page.locator('#lesson14-faire .vk-section-links a').click();expect(page.locator('.vk-card')).to_have_attribute('data-verb','present-faire')
 expect(page.locator('.vk-card')).to_contain_text('nous faisons')
 page.locator('.vk-card footer>a[href="#lesson/14/faire"]').click();expect(page.locator('#lesson14-faire')).to_be_visible()
 page.goto(BASE+'#skills/A1/grammar/g-etre');expect(page.locator('.vk-skill-preview tbody tr')).to_have_count(6)
 expect(page.locator('.vk-skill-preview')).to_contain_text('nous sommes')
 page.screenshot(path=str(OUT/'skill-inline-table.jpg'),type='jpeg',quality=88,scale='css')
 page.locator('.vk-skill-preview a',has_text='查看规则').click();expect(page.locator('.vk-card')).to_have_attribute('data-verb','present-etre')
 page.locator('.vk-heading>a').click();expect(page.locator('#st-detail h2')).to_have_text('être 现在时')
 page.goto(BASE+'#verbs/list?skill=g-reflexive');expect(page.locator('.vk-card')).to_have_count(10)
 page.goto(BASE+'#verbs/invalid-id');expect(page.locator('.vk-empty')).to_contain_text('未找到这条变位')
 report['interactions'].append('Course ↔ lookup links, stable lesson14/faire anchor, direct skill table and return to same skill; invalid ID handled')
 ctx.close()
 # Old records must remain valid with unified lesson14; do not change IDs or options.
 old={'version':1,'completed':[1,14],'wrong':['q1','q7'],'favorites':[14],'notes':{'lesson-14':'K1 legacy note'},'attempts':{'q1':False,'q7':False},'currentLesson':15,'skillMastery':{'g-etre':{'level':2,'masteredAt':'2026-10-27T00:00:00Z','updatedAt':'2026-10-27T00:00:00Z'}}}
 ctx=browser.new_context(viewport={'width':1920,'height':1080});ctx.add_init_script('localStorage.setItem('+json.dumps(KEY)+','+json.dumps(json.dumps(old))+')')
 page=ctx.new_page();page.on('pageerror',lambda e:report['pageErrors'].append(str(e)))
 page.goto(BASE+'#verbs');page.locator('#vk-search').fill('faire');expect(page.locator('.vk-card')).to_have_attribute('data-verb','present-faire')
 saved=page.evaluate('JSON.parse(localStorage.getItem('+json.dumps(KEY)+'))')
 for field in ['completed','wrong','favorites','notes','attempts','currentLesson','skillMastery']:assert saved[field]==old[field],field
 page.goto(BASE+'#lesson/14');expect(page.locator('[data-note="lesson-14"]')).to_have_value('K1 legacy note')
 expect(page.locator('[data-question]')).to_have_count(30)
 page.goto(BASE+'#review');expect(page.locator('[data-question="q1"]')).to_have_count(1);expect(page.locator('[data-question="q7"]')).to_have_count(1)
 report['interactions'].append('Old q1/q7 mistakes, lesson-14 note, favorites, completed lessons and skill mastery survive unified lesson14; 30 quiz items remain')
 page.goto(BASE+'#settings')
 with page.expect_download() as download:page.locator('#export').click()
 exported=json.loads(Path(download.value.path()).read_text())
 assert exported['notes']['lesson-14']=='K1 legacy note' and set(exported['wrong'])=={'q1','q7'}
 page.goto(BASE+'#lesson/14')
 page.locator('[data-note="lesson-14"]').fill('Changed in isolated verification')
 page.goto(BASE+'#settings');page.on('dialog',lambda d:d.accept())
 page.locator('#import').set_input_files({'name':'legacy-k1.json','mimeType':'application/json','buffer':json.dumps(old).encode()})
 page.wait_for_function("JSON.parse(localStorage.getItem('bonjour-francais-progress-v1')).notes['lesson-14']==='K1 legacy note'")
 restored=page.evaluate('JSON.parse(localStorage.getItem('+json.dumps(KEY)+'))')
 assert restored['wrong']==old['wrong'] and restored['completed']==old['completed']
 page.goto(BASE+'#lesson/14');expect(page.locator('[data-note="lesson-14"]')).to_have_value('K1 legacy note')
 report['interactions'].append('Actual UI export includes old mistakes and note; importing legacy v1 backup restores edited note, completion and old q1/q7 IDs')
 ctx.close();browser.close()
assert not report['pageErrors'],report['pageErrors']
assert not report['failedLocalRequests'],report['failedLocalRequests']
(OUT/'browser-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps({'desktopCases':len(report['viewports']),'pageErrors':report['pageErrors'],'failedLocalRequests':report['failedLocalRequests'],'interactions':report['interactions']},ensure_ascii=False,indent=2))
