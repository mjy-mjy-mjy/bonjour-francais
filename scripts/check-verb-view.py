"""Optional VIS-01 browser check. Requires Playwright, Chromium and a local server on 8765."""
import json
import shutil
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parent.parent
TEMP=tempfile.TemporaryDirectory(prefix='bonjour-vis01-')
OUT=ROOT/'docs/visuals/VIS-01'
OUT.mkdir(parents=True,exist_ok=True)
BASE='http://127.0.0.1:8765/'
ROUTE='#skills/A1/grammar/verbs'
DETAIL='#skills/A1/grammar/g-past-etre'
report={'viewports':[],'interactions':[],'errors':[]}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=shutil.which('chromium') or '/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for label,w,h,dpr in [('2k',2560,1440,1),('4k',3840,2160,1),('4k-200',1920,1080,2),('2k-150',1707,960,1.5),('2k-200',1280,720,2)]:
  context=b.new_context(viewport={'width':w,'height':h},device_scale_factor=dpr)
  page=context.new_page()
  page.on('pageerror',lambda e:report['errors'].append(str(e)))
  page.goto(BASE+ROUTE);expect(page.locator('.st-verb-node')).to_have_count(11)
  page.wait_for_timeout(150)
  assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
  if label in ['2k','4k']:
   page.screenshot(path=str(OUT/(label+'-branch.jpg')),type='jpeg',quality=88,scale='css')
  page.locator('a.st-node[href$="g-past-etre"]').click()
  expect(page.locator('#st-detail h2')).to_have_text('être 复合过去时')
  expect(page.locator('.st-verb-node.is-before')).to_have_count(2)
  expect(page.locator('.st-verb-node.is-after')).to_have_count(1)
  expect(page.locator('.st-verb-edges>path.is-before')).to_have_count(2)
  expect(page.locator('.st-verb-edges>path.is-after')).to_have_count(1)
  page.wait_for_timeout(150)
  bounds=page.evaluate('''() => {const stage=document.querySelector('#st-stage').getBoundingClientRect();return {stage:{x:stage.x,y:stage.y,width:stage.width,height:stage.height},outside:[...document.querySelectorAll('.st-verb-node')].filter(n=>{const r=n.getBoundingClientRect();return r.left<stage.left||r.right>stage.right||r.top<stage.top||r.bottom>stage.bottom}).length,font:getComputedStyle(document.querySelector('.st-verb-node strong')).fontSize,scale:document.querySelector('#st-scale').textContent}}''')
  # 2K at 200% scaling intentionally pans instead of reducing cards to unreadable sizes.
  if label!='2k-200':assert bounds['outside']==0,(label,bounds)
  assert page.locator('#st-detail').bounding_box()['x']>=page.locator('#st-stage').bounding_box()['width']-1
  page.screenshot(path=str(OUT/(label+'-detail.jpg')),type='jpeg',quality=88,scale='css')
  report['viewports'].append({'name':label,'css':[w,h],'dpr':dpr,'browser_zoom':'100%','bounds':bounds})
  context.close()
 context=b.new_context(viewport={'width':1920,'height':1080},device_scale_factor=1)
 page=context.new_page();page.on('pageerror',lambda e:report['errors'].append(str(e)))
 page.goto(BASE+DETAIL)
 # Persistent state and notes, independent of course completion.
 expect(page.locator('[data-st-level="3"]')).to_be_disabled()
 page.locator('[data-st-level="2"]').click()
 expect(page.locator('[data-st-level="2"]')).to_have_attribute('aria-pressed','true')
 page.locator('#st-note').fill('VIS-01 browser verification')
 page.reload();expect(page.locator('#st-note')).to_have_value('VIS-01 browser verification')
 expect(page.locator('.st-verb-node.is-selected')).to_have_class(__import__('re').compile('st-level-2'))
 report['interactions'].append('Deep link, mastery and note persist after reload; 24h review stays disabled')
 # Export/import current and old backups through UI; do not store test progress in repository.
 page.goto(BASE+'#settings')
 with page.expect_download() as download:page.locator('#export').click()
 backup_path=Path(TEMP.name)/'backup.json';download.value.save_as(backup_path)
 backup=json.loads(backup_path.read_text());assert backup['skillMastery']['g-past-etre']['level']==2
 assert not backup['completed']
 page.on('dialog',lambda d:d.accept())
 legacy={k:v for k,v in backup.items() if k not in ['skillMastery','knowledgeMastery']}
 legacy['notes']={'lesson-19':'legacy note'}
 page.locator('#import').set_input_files({'name':'legacy.json','mimeType':'application/json','buffer':json.dumps(legacy).encode()})
 page.wait_for_function("JSON.parse(localStorage.getItem('bonjour-francais-progress-v1')).notes['lesson-19']==='legacy note'")
 page.locator('#import').set_input_files(str(backup_path))
 page.wait_for_function("JSON.parse(localStorage.getItem('bonjour-francais-progress-v1')).skillMastery?.['g-past-etre']?.level===2")
 page.goto(BASE+DETAIL);expect(page.locator('#st-note')).to_have_value('VIS-01 browser verification')
 report['interactions'].append('Export and import preserve skill state; legacy backup accepted; courses not marked complete')
 # Search and no results, escaping returns to branch.
 page.locator('#st-search').fill('zzzz-no-match');expect(page.locator('#st-detail-body')).to_contain_text('没有匹配')
 page.locator('#st-search').fill('etre');expect(page.locator('.st-search-results a')).not_to_have_count(0)
 page.locator('.st-search-results a[href$="g-etre"]').click()
 expect(page.locator('#st-detail h2')).to_have_text('être 现在时')
 page.go_back();expect(page.locator('#st-detail h2')).to_have_text('être 复合过去时')
 page.go_forward();expect(page.locator('#st-detail h2')).to_have_text('être 现在时')
 page.locator('#st-close').press('Escape');expect(page.locator('#st-detail')).to_be_hidden()
 report['interactions'].append('Search accent normalization, no results, result selection, history back/forward and Escape close')
 # Original course links and cross-branch relation routing.
 page.goto(BASE+DETAIL);page.locator('.st-successors a[href$="s-past"]').click()
 expect(page.locator('#st-detail h2')).to_have_text('叙述过去经历')
 assert not page.locator('#skill-tree').evaluate('(n)=>n.classList.contains("st-verbs")')
 page.goto(BASE+DETAIL);page.locator('.st-verb-read').click()
 expect(page.locator('.lesson-skills')).to_be_visible()
 assert '#lesson/19/' in page.url,page.url
 report['interactions'].append('Cross-branch successor opens original speaking tree; original lesson and reverse skill link work')
 # Pan and zoom, keyboard, reduced motion, standard overview unchanged.
 page.goto(BASE+ROUTE)
 page.locator('#st-stage').focus()
 for _ in range(8):page.keyboard.press('+')
 assert page.locator('#st-scale').inner_text()=='220%'
 transform=page.locator('#st-board').get_attribute('style')
 page.keyboard.press('ArrowRight')
 assert page.locator('#st-board').get_attribute('style')!=transform
 stage=page.locator('#st-stage').bounding_box()
 page.mouse.move(stage['width']/2,stage['y']+40)
 transform=page.locator('#st-board').get_attribute('style')
 page.mouse.down();page.mouse.move(stage['width']/2+70,stage['y']+40,steps=5);page.mouse.up()
 assert page.locator('#st-board').get_attribute('style')!=transform
 page.mouse.wheel(0,120);page.wait_for_timeout(100)
 assert page.locator('#st-scale').inner_text()!='220%'
 page.locator('#st-stage').focus();page.keyboard.press('0')
 page.emulate_media(reduced_motion='reduce')
 assert page.locator('.st-verb-node').first.evaluate('(n)=>getComputedStyle(n).transitionDuration')=='0s'
 page.goto(BASE+'#skills');assert not page.locator('#skill-tree').evaluate('(n)=>n.classList.contains("st-verbs")')
 page.locator('.st-sample-entry').click();expect(page.locator('.st-verb-node')).to_have_count(11)
 report['interactions'].append('Keyboard zoom/pan/reset, pointer drag and wheel zoom, reduced motion, overview and visible sample entry')
 context.close();b.close()
assert not report['errors'],report['errors']
(OUT/'browser-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False,indent=2))
