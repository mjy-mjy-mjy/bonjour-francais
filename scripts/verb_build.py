"""Compile shared conjugations into authored lessons and a static browser bundle."""
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOKEN = re.compile(r'\{\{verb:([a-z0-9-]+):([0-5])\}\}')


def load_verbs():
    data = json.loads((ROOT / 'knowledge/verbs.json').read_text(encoding='utf-8'))
    records = data['records']
    assert data['version'] == 1 and len(data['persons']) == 6
    assert len({r['id'] for r in records}) == len(records), 'Duplicate verb ID'
    skills = {n['id'] for n in json.loads((ROOT / 'knowledge/skills.json').read_text())['nodes']}
    for record in records:
        assert re.fullmatch(r'present-[a-z0-9-]+', record['id']), record['id']
        assert record['mood'] == 'indicatif' and record['tense'] == 'present'
        assert len(record['forms']) == 6 and all(isinstance(f, str) and f.strip() for f in record['forms'])
        assert record['group'] in ['1', '2', '3'] and isinstance(record['pronominal'], bool)
        assert isinstance(record['jeElision'], bool), record['id']
        assert record['meaning'] and record['notes'] and record['examples'] and record['refs']
        assert set(record['skillIds']) <= skills
        assert all(1 <= ref['lesson'] <= 16 and ref['role'] in ['core', 'review', 'extension'] for ref in record['refs'])
    return data


def expand_lesson(authored, records):
    by_id = {r['id']: r for r in records}
    result = json.loads(json.dumps(authored, ensure_ascii=False))
    for section in result['sections']:
        def replace(match):
            assert match[1] in by_id, f'Unknown shared conjugation: {match[1]}'
            return html.escape(by_id[match[1]]['forms'][int(match[2])], quote=False)
        section['html'] = TOKEN.sub(replace, section['html'])
        assert '{{verb:' not in section['html'], 'Malformed conjugation token'
    return result


def validate_references(data, authored_lessons):
    ids = {r['id'] for r in data['records']}
    for record in data['records']:
        assert set(record['relatedIds']) <= ids
        for ref in record['refs']:
            lesson = authored_lessons[ref['lesson']]
            section = next((s for s in lesson['sections'] if s['id'] == ref['section']), None)
            assert section, (record['id'], ref)
            for person in range(6):
                token = '{{verb:' + record['id'] + ':' + str(person) + '}}'
                assert token in section['html'], (record['id'], ref, 'missing person', person)


def write_bundle(data):
    (ROOT / 'verb-data.js').write_text('// Generated from knowledge/verbs.json by scripts/build-course.py.\nwindow.VERB_LIBRARY = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
