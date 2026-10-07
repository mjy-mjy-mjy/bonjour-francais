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
                assert (ROOT / path).is_file(), f'Missing asset: {path}'


AssetCheck().feed((ROOT / 'index.html').read_text(encoding='utf-8'))
snapshot = json.loads((ROOT / 'data' / 'draws.json').read_text(encoding='utf-8'))
assert snapshot['rounds'], 'Official round snapshot is empty'
assert len({r['id'] for r in snapshot['rounds']}) == len(snapshot['rounds'])
for row in snapshot['rounds']:
    assert 0 <= row['crs'] <= 1200 and row['invitations'] > 0
    assert urlparse(row['source']).hostname == 'www.canada.ca'
print('Public assets and invitation data passed validation')
