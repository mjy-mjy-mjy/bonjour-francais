"""Build the curated semantic skills source. Never infer mastery from course completion."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
data=json.loads((ROOT/'knowledge/skills.json').read_text(encoding='utf-8'))
ids=[n['id'] for n in data['nodes']]
assert len(ids)==len(set(ids)), 'Duplicate skill ID'
for n in data['nodes']:
    assert n['branch'] in [b['id'] for b in data['branches']]
    assert n['stage'] in data['stages']
    assert all(id in ids for id in n['requires'])
    assert n['planned'] or (n['refs'] and n['criteria'])
(ROOT/'skill-tree-data.js').write_text('// Generated from knowledge/skills.json by scripts/build-skills.py.\nwindow.FRENCH_SKILLS = '+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
