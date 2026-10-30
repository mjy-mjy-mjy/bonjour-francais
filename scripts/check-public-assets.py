"""Compare a public static endpoint against an exact local publish source.

Example (review builds belong in a temporary copy):
python3 scripts/check-public-assets.py --root work/review-copy \
  --base https://mjy-mjy-mjy.github.io/bonjour-francais/ --out work/assets.json
HTTP checks do not exercise JavaScript, browser history, layout, or scaling.
"""
import argparse
import hashlib
import json
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qs, urljoin, urlsplit
from urllib.request import urlopen


class References(HTMLParser):
    def __init__(self):
        super().__init__()
        self.assets = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        value = attrs.get('src') if tag == 'script' else attrs.get('href') if tag == 'link' and attrs.get('rel') == 'stylesheet' else None
        if value:
            self.assets.append(value)


def verify(root, base):
    html = (root / 'index.html').read_bytes()
    parser = References()
    parser.feed(html.decode())
    report = {'base': base, 'kind': 'HTTP bytes, not browser acceptance', 'html_sha256': hashlib.sha256(html).hexdigest(),
              'fingerprints': [], 'requests': [], 'status': 'source-validated'}
    for ref in parser.assets:
        parsed = urlsplit(ref)
        assert not parsed.scheme and not parsed.netloc and not parsed.path.startswith('/'), ref
        digest = hashlib.sha256((root / parsed.path).read_bytes()).hexdigest()
        assert parse_qs(parsed.query).get('v') == [digest[:12]], ('fingerprint', ref)
        report['fingerprints'].append({'reference': ref, 'sha256': digest})
    assert len(set(parser.assets)) == len(parser.assets), 'Duplicate script/style reference'
    # Also check the map artwork requested by knowledge-map.js at runtime.
    refs = ['', *parser.assets, 'assets/knowledge-continent.webp']
    try:
        for ref in refs:
            target = urljoin(base, ref)
            assert urlsplit(target).path.startswith(urlsplit(base).path), ('subpath escaped', ref)
            expected = html if not ref else (root / urlsplit(ref).path).read_bytes()
            with urlopen(target, timeout=20) as response:
                content = response.read()
                result = {'reference': ref or 'index.html', 'status': response.status,
                          'sha256': hashlib.sha256(content).hexdigest(), 'matches_source': content == expected}
            report['requests'].append(result)
            assert result['status'] == 200 and result['matches_source'], result
        report['status'] = 'passed'
    except Exception as error:
        # Do not include signed URLs, proxy credentials, or local environment dumps.
        report['status'] = 'blocked-or-failed'
        report['error'] = type(error).__name__ + ': ' + str(error).split('?')[0]
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--base', required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    assert args.base.endswith('/'), 'Base must include trailing slash'
    result = verify(args.root, args.base)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(result['status'], len(result['fingerprints']), 'fingerprints;', len(result['requests']), 'HTTP responses checked')
    if 'error' in result:
        print(result['error'])
    raise SystemExit(0 if result['status'] == 'passed' else 1)
