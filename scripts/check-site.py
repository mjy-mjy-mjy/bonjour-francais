"""Check public files and data integrity before deploying."""
import json
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent


class AssetCheck(HTMLParser):
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for name in ('src', 'href'):
            path = attrs.get(name, '')
            if path and not urlparse(path).scheme and not path.startswith('#'):
                assert (ROOT / urlparse(path).path).is_file(), f'Missing asset: {path}'


AssetCheck().feed((ROOT / 'index.html').read_text(encoding='utf-8'))
snapshot = json.loads((ROOT / 'data' / 'draws.json').read_text(encoding='utf-8'))
assert snapshot['rounds'], 'Official round snapshot is empty'
assert len({r['id'] for r in snapshot['rounds']}) == len(snapshot['rounds'])
for row in snapshot['rounds']:
    assert 0 <= row['crs'] <= 1200 and row['invitations'] > 0
    assert urlparse(row['source']).hostname == 'www.canada.ca'
print('Public assets and invitation data passed validation')

# Authored lesson integrity: broken references or missing answers block publication.
import re
ids = set()
for source in sorted((ROOT / 'lessons').glob('[0-9][0-9].json')):
    course = json.loads(source.read_text(encoding='utf-8'))
    number = course['number']
    sections = course['sections']
    section_ids = [s['id'] for s in sections]
    assert len(set(section_ids)) == len(section_ids), source
    for names in course['categorySections'].values():
        assert all(name in section_ids for name in names), (source, names)
    assert course['listening'].strip(), source
    practice = next(s['html'] for s in sections if s['id'] == 'practice')
    groups = re.findall(r'<h3>([A-J])\. (.*?)</h3>([\s\S]*?)(?=<h3>|$)', practice)
    assert [g[0] for g in groups] == list('ABCDEFGHIJ'), source
    tasks = 0
    for letter, title, body in groups:
        question, answer = body.split('<details>', 1)
        q_count, a_count = question.count('<li>'), answer.count('<li>')
        assert q_count > 0 and q_count == a_count, (source, letter, q_count, a_count)
        assert '<summary>' in answer and '</details>' in answer, (source, letter)
        tasks += q_count
    for q in course['quickQuestions']:
        assert q['id'].startswith(f'l{number:02}-') and q['id'] not in ids, q['id']
        ids.add(q['id'])
        assert len(set(q['options'])) == len(q['options']) >= 2, q['id']
        assert isinstance(q['answer'], int) and 0 <= q['answer'] < len(q['options']), q['id']
        assert q['explanation'].strip() and q['question'].strip(), q['id']
    print(f'Lesson {number}: {len(sections)} sections, {tasks} written tasks with answers, {len(course["quickQuestions"])} valid quiz questions')
