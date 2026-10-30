"""Optional browser acceptance: isolated Chromium, no personal browser profile.

Run a static server at the parent directory, then:
python3 scripts/check-learning-flow.py --base http://127.0.0.1:8766/bonjour-francais/
Requires Playwright and Chromium; screenshots and JSON default to work/acceptance.
CSS viewports and DPR emulation do not verify physical displays or OS scaling.
"""
import argparse
import json
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--base', default='http://127.0.0.1:8766/bonjour-francais/')
parser.add_argument('--out', default='work/acceptance')
args = parser.parse_args()
out = Path(args.out)
out.mkdir(parents=True, exist_ok=True)
report = {'base': args.base, 'browser': '', 'interactions': [], 'viewports': [],
          'errors': [], 'limitations': ['Headless Chromium; browser zoom 100%.',
          'CSS viewport and deviceScaleFactor are emulated independently; no real OS scaling or mobile hardware.']}
KEY = 'bonjour-francais-progress-v1'


def settle(page):
    page.evaluate('() => new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')


def visit(page, route):
    page.goto(args.base + route)
    settle(page)


def top(page, selector):
    return page.locator(selector).evaluate('(e)=>e.scrollTop')


def record(message):
    report['interactions'].append(message)
    print('PASS', message, flush=True)


def snapshot(page, name):
    page.screenshot(path=str(out / (name + '.jpg')), type='jpeg', quality=82, scale='css')


def progress(page):
    return page.evaluate('(key)=>JSON.parse(localStorage.getItem(key))', KEY)


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=shutil.which('chromium'), headless=True,
                                args=['--no-sandbox'])
    report['browser'] = browser.version
    context = browser.new_context(viewport={'width': 1920, 'height': 1080}, locale='zh-CN')
    page = context.new_page()
    page.on('pageerror', lambda e: report['errors'].append(str(e)))
    visit(page, '#route')
    page.locator('#learning-course').select_option('21')
    page.locator('a.map-quick-link').click()
    page.locator('[data-map="current"]').click()
    expect(page.locator('#map-detail h2')).to_have_text('C’est interdit !')
    expect(page.locator('.map-pin[data-map="lesson:21"]')).to_contain_text('◎')
    expect(page.locator('.map-pin[data-map="lesson:21"]')).to_contain_text('◇')
    page.locator('.map-pin[data-map="lesson:22"]').click()
    expect(page.locator('#map-detail')).to_contain_text('讲义待补充')
    expect(page.locator('.map-pin[data-map="lesson:21"]')).to_contain_text('◎')
    expect(page.locator('.map-pin[data-map="lesson:22"]')).to_contain_text('◇')
    page.locator('[data-map="current"]').click()
    page.locator('[data-map="complete:21"]').click()
    expect(page.locator('#map-detail')).to_contain_text('已学完')
    assert progress(page)['completed'] == [21]
    assert progress(page)['skillMastery'] == {} and progress(page)['knowledgeMastery'] == {}
    page.locator('[data-map="complete:21"]').click()
    page.locator('.map-chapters summary').click()
    chapter = page.locator('[data-map-mastery]').first
    chapter.select_option('2')
    assert progress(page)['skillMastery'] == {} and progress(page)['completed'] == []
    page.reload();settle(page)
    expect(page.locator('.map-chapters')).to_have_attribute('open', '')
    expect(page.locator('[data-map-mastery]').first).to_have_value('2')
    record('Current/viewed/completed/pending lesson states; course and chapter writes remain independent of skills.')

    page.locator('[data-map="atlas-lesson:21"]').click()
    expect(page.locator('#map-atlas-count')).to_contain_text('9 个知识点')
    page.locator('#map-atlas-category').select_option('grammar')
    page.locator('#map-atlas-search').fill('命令式')
    expect(page.locator('.map-atlas-card')).to_have_count(2)
    page.locator('[data-map="atlas-mode:course"]').click()
    assert page.locator('#map-atlas-lesson').input_value() == '21'
    assert page.locator('.map-atlas-chapter').count() > 0
    page.locator('[data-map="atlas-mode:knowledge"]').click()
    target = page.locator('.map-atlas-card h3 a[href$="/g-coi-imperative"]')
    target.scroll_into_view_if_needed()
    atlas_scroll = top(page, '#map-panel')
    target.click();settle(page)
    expect(page.locator('#st-detail h2')).to_have_text('命令式与间接宾语代词')
    assert page.locator('.st-criteria li').count() >= 2
    source = page.locator('.st-verb-read')
    source.click();settle(page)
    assert '#lesson/21/' in page.url and page.evaluate('scrollY') > 0
    page.go_back();settle(page)
    page.locator('.st-practice-source[href="#lesson/21/practice"]').click();settle(page)
    fold = page.locator('#lesson21-practice details').first
    fold.locator('summary').click();fold.scroll_into_view_if_needed();settle(page)
    reading_scroll = page.evaluate('scrollY')
    page.go_back();settle(page);page.go_forward();settle(page)
    expect(page.locator('#lesson21-practice details').first).to_have_attribute('open', '')
    assert abs(page.evaluate('scrollY') - reading_scroll) <= 2
    page.reload();settle(page)
    expect(page.locator('#lesson21-practice details').first).to_have_attribute('open', '')
    assert abs(page.evaluate('scrollY') - reading_scroll) <= 2
    page.locator('.skill-return').click();settle(page)
    page.locator('[data-st-level="1"]').click()
    page.locator('.st-header a[href^="#map"]').click();settle(page)
    expect(page.locator('#map-atlas-search')).to_have_value('命令式')
    expect(page.locator('#map-atlas-category')).to_have_value('grammar')
    expect(page.locator('#map-atlas-lesson')).to_have_value('21')
    assert abs(top(page, '#map-panel') - atlas_scroll) <= 2
    expect(page.locator('.map-atlas-card').filter(has=page.locator('h3 a[href$="/g-coi-imperative"]'))).to_contain_text('已接触')
    page.reload();settle(page)
    assert abs(top(page, '#map-panel') - atlas_scroll) <= 2
    record('Lesson21 → combined atlas → skill criteria → original lecture/practice → expanded answer; back/forward/reload and return link restore filters, selection and reading position.')

    page.locator('[data-map="locate:21"]').last.click();settle(page)
    page.locator('[data-map="atlas-return"]').click();settle(page)
    expect(page.locator('#map-atlas-search')).to_have_value('命令式')
    page.locator('#map-atlas-search').fill('no-result-xyz')
    expect(page.locator('.map-atlas-card')).to_have_count(0)
    page.locator('[data-map="atlas-clear"]').first.click()
    expect(page.locator('#map-atlas-lesson')).to_have_value('0')
    expect(page.locator('#map-atlas-category')).to_have_value('')
    expect(page.locator('#map-atlas-search')).to_have_value('')
    record('Atlas course/knowledge modes, course location/return, empty result and clear-all filters.')

    visit(page, '#skills/all/all?view=list&unit=6&lesson=21&review=unrecorded')
    page.locator('#st-search').fill('命令式')
    page.locator('#st-branch').select_option('grammar');settle(page)
    expect(page.locator('#st-search')).to_have_value('命令式')
    expect(page.locator('.st-list-row')).to_have_count(1)  # COI already touched above.
    expect(page.locator('#st-review')).to_have_value('unrecorded')
    expect(page.locator('#st-lesson')).to_have_value('21')
    record('Branch changes preserve keyword, unit, lesson and self-evaluation filter.')

    visit(page, '#skills/all/all/g-negative?view=list&unit=6&lesson=21')
    page.locator('.st-shared-grammar details summary').click()
    button = page.locator('[data-st-level="1"]');button.scroll_into_view_if_needed()
    detail_scroll = top(page, '#st-detail')
    button.click();settle(page)
    expect(page.locator('.st-shared-grammar details')).to_have_attribute('open', '')
    assert abs(top(page, '#st-detail') - detail_scroll) <= 2
    page.reload();settle(page)
    expect(page.locator('.st-shared-grammar details')).to_have_attribute('open', '')
    assert abs(top(page, '#st-detail') - detail_scroll) <= 2
    page.locator('#st-close').click();settle(page)
    expect(page.locator('#st-lesson')).to_have_value('21')
    assert page.locator('.st-list-row').count() == 9
    record('Existing shared negation text stays expanded with deep scroll after self-evaluation and reload; closing retains lesson list.')

    # Clock advancement is confined to this disposable context, never a real record.
    visit(page, '#skills/A1/grammar/g-coi-imperative')
    page.clock.install()
    page.locator('[data-st-level="2"]').click()
    expect(page.locator('#st-stats > div').nth(0).locator('strong')).to_contain_text('1')
    expect(page.locator('[data-st-level="3"]')).to_be_disabled()
    page.clock.fast_forward(86400000)
    visit(page, '#map/A1/6')
    page.locator('[data-map="review"]').click()
    page.locator('#map-atlas-unit').select_option('6')
    page.locator('#map-atlas-lesson').select_option('21')
    page.locator('#map-atlas-category').select_option('grammar')
    page.locator('#map-review-status').select_option('due')
    expect(page.locator('.map-atlas-modes')).to_have_count(0)
    expect(page.locator('.map-atlas-card')).to_have_count(1)
    page.reload();settle(page)
    expect(page.locator('#map-review-status')).to_have_value('due')
    page.locator('.map-review-standard').click();settle(page)
    expect(page.locator('#st-stats > div').nth(2).locator('strong')).to_have_text('1')
    page.locator('[data-st-level="3"]').click()
    expect(page.locator('#st-stats > div').nth(2).locator('strong')).to_have_text('0')
    page.locator('.st-header a[href^="#map"]').click();settle(page)
    expect(page.locator('#map-review-status')).to_have_value('due')
    expect(page.locator('#map-atlas-lesson')).to_have_value('21')
    expect(page.locator('.map-atlas-card')).to_have_count(0)
    page.locator('#map-review-status').select_option('reviewed')
    expect(page.locator('.map-atlas-card')).to_have_count(1)
    assert progress(page)['completed'] == [] and len(progress(page)['knowledgeMastery']) == 1
    record('24h threshold with isolated virtual clock; reviewed skill leaves due list, statistics/filter update and review context persists.')
    context.close()

    # Physical-resolution equivalents are descriptive scenarios, not OS-scale claims.
    cases = [('1280',1280,720,1),('1366',1366,768,1),('2k-200-effective',1280,720,2),
             ('2k-150-effective',1707,960,1.5),('2k-125-effective',2048,1152,1.25),('2k',2560,1440,1),
             ('4k-125-effective',3072,1728,1.25),('4k-150-effective',2560,1440,1.5),('4k-200-effective',1920,1080,2),
             ('4k',3840,2160,1),('mobile-smoke',390,844,1)]
    for label,w,h,dpr in cases:
        context = browser.new_context(viewport={'width':w,'height':h},device_scale_factor=dpr,locale='zh-CN')
        page = context.new_page()
        page.on('pageerror', lambda e: report['errors'].append(str(e)))
        visit(page, '#map/A1/6')
        page.locator('#map-detail [data-map="lesson:21"]').click();settle(page)
        assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
        if w >= 1280:
            expect(page.locator('.map-pin[data-map="lesson:21"] .map-pin-label')).to_be_visible()
        # Hover expands labels by design; check default placement with pointer clear.
        page.mouse.move(0,0)
        labels = page.locator('.map-pin-label:visible').evaluate_all('(els)=>els.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})')
        for i,a in enumerate(labels):
            for z in labels[i+1:]:
                assert a['x']+a['w'] <= z['x'] or z['x']+z['w'] <= a['x'] or a['y']+a['h'] <= z['y'] or z['y']+z['h'] <= a['y'], (label,'map label overlap')
        map_box=page.locator('#map-panel').bounding_box()
        snapshot(page,label+'-map')
        visit(page,'#skills/all/all/g-coi-imperative?view=list&unit=6&lesson=21')
        expect(page.locator('.st-list-row')).to_have_count(9)
        assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
        page.locator('[data-st-level="1"]').click()
        expect(page.locator('[data-st-level="1"]')).to_have_attribute('aria-pressed','true')
        page.locator('#st-detail').evaluate('(e)=>e.scrollTop=0')
        snapshot(page,label+'-tree')
        report['viewports'].append({'label':label,'css':[w,h],'deviceScaleFactor':dpr,
                                   'browserZoom':'100%','mapDetail':map_box,'visibleLabels':len(labels)})
        context.close()
    browser.close()
assert not report['errors'], report['errors']
(out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(f'PASS {len(report["interactions"])} interaction groups; {len(report["viewports"])} viewports; no page errors.',flush=True)
