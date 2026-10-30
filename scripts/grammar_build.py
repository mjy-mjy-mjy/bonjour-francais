"""Compile the small, explicitly scoped grammar pilot from one author source."""
import json,re,copy
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
TOKEN=re.compile(r'\{\{grammar:([a-z0-9-]+):([a-z0-9-]+)\}\}')
def load_grammar():
 data=json.loads((ROOT/'knowledge/grammar.json').read_text())
 ids=set();seen=set()
 skills=json.loads((ROOT/'knowledge/skills.json').read_text());by={n['id']:n for n in skills['nodes']}
 for r in data['records']:
  assert r['id'] in by and r['id'] not in ids;ids.add(r['id'])
  assert r['rules'] and r['examples'] and r['pitfalls']
  for b in r['blocks']:
   assert 1<=b['lesson']<=16 and (r['id'],b['id']) not in seen;seen.add((r['id'],b['id']))
   assert any(ref['lesson']==b['lesson'] and ref['section']==b['section'] for ref in by[r['id']]['refs'])
   course=json.loads((ROOT/'lessons'/f"{b['lesson']:02}.json").read_text())
   assert next(s for s in course['sections'] if s['id']==b['section'])['html']=='{{grammar:'+r['id']+':'+b['id']+'}}'
   assert '<h2>' in b['html'] and '{{grammar:' not in b['html']
 return data
def expand_grammar(course,data):
 result=copy.deepcopy(course);blocks={(r['id'],b['id']):b['html'] for r in data['records'] for b in r['blocks']}
 for section in result['sections']:
  section['html']=TOKEN.sub(lambda m:blocks[(m[1],m[2])],section['html'])
  assert '{{grammar:' not in section['html']
 return result
def write_grammar(data):
 (ROOT/'grammar-data.js').write_text('// Generated from knowledge/grammar.json.\nwindow.FRENCH_GRAMMAR = '+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n')
