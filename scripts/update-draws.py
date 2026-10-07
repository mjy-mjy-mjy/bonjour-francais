"""Normalize IRCC's public dataset. Failed validation preserves the saved snapshot."""
import argparse
import datetime as dt
import json
import re
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import urlencode

ROOT = Path(__file__).resolve().parent.parent
SOURCE = 'https://www.canada.ca/content/dam/ircc/documents/json/ee_rounds_123_en.json'
DETAIL = 'https://www.canada.ca/en/immigration-refugees-citizenship/corporate/mandate/policies-operational-instructions-agreements/ministerial-instructions/express-entry-rounds/invitations.html'


def category(name):
    if 'french' in name.lower():
        return '法语能力类别'
    return {'Canadian Experience Class': '加拿大经验类（CEC）',
            'Provincial Nominee Program': 'EE 省提名（PNP）',
            'No Program Specified': '一般邀请',
            'General': '一般邀请',
            'Federal Skilled Worker': '联邦技术移民（FSW）',
            'Federal Skilled Trades': '联邦技工（FST）'}.get(name, name)


def normalize(data):
    raw = data['rounds']
    if not isinstance(raw, list) or not raw:
        raise ValueError('IRCC returned no rounds')
    results, seen = [], set()
    for item in raw:
        identifier = str(item['drawNumber'])
        if not re.fullmatch(r'\d+[a-z]?', identifier) or identifier in seen:
            raise ValueError('Invalid or duplicate round identifier')
        seen.add(identifier)
        date = item['drawDate']
        dt.date.fromisoformat(date)
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', date):
            raise ValueError('Invalid official date')
        invitations = int(str(item['drawSize']).replace(',', ''))
        crs = int(str(item['drawCRS']).replace(',', ''))
        if invitations <= 0 or not 0 <= crs <= 1200:
            raise ValueError('Invalid invitation count or CRS')
        name = item['drawName']
        if not isinstance(name, str) or not name.strip():
            raise ValueError('Invalid round category')
        time = re.search(r'\d{2}:\d{2}:\d{2}', item.get('drawDateTime', ''))
        results.append({'id': identifier, 'date': date,
                        'time': time.group() if time else '',
                        'category': category(name), 'official_category': name,
                        'crs': crs, 'invitations': invitations,
                        'tie_breaking': item.get('drawCutOff', ''),
                        'source': DETAIL + '?' + urlencode({'q': identifier})})
    return sorted(results, key=lambda r: (r['date'], int(re.match(r'\d+', r['id']).group()), r['id']), reverse=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', type=Path, help='Normalize an already downloaded official file')
    args = parser.parse_args()
    if args.input:
        payload = args.input.read_text(encoding='utf-8')
    else:
        result = subprocess.run(['curl', '--fail', '--silent', '--show-error', '--location',
                                 '--retry', '2', '--max-time', '60', SOURCE],
                                capture_output=True, text=True, check=True)
        payload = result.stdout
    rounds = normalize(json.loads(payload))
    output = ROOT / 'data' / 'draws.json'
    if output.exists():
        previous = json.loads(output.read_text(encoding='utf-8'))
        # An incomplete upstream response must not discard historical records.
        previous_ids = {r['id'] for r in previous['rounds']}
        if not previous_ids.issubset({r['id'] for r in rounds}):
            raise ValueError('Source is missing historical rounds; retained existing snapshot')
    snapshot = {'source': SOURCE, 'checked_at': dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%d %H:%M UTC'),
                'rounds': rounds}
    output.parent.mkdir(exist_ok=True)
    with tempfile.NamedTemporaryFile(mode='w', dir=output.parent, suffix='.tmp',
                                     encoding='utf-8', delete=False) as temporary:
        json.dump(snapshot, temporary, ensure_ascii=False, indent=2)
        temporary.write('\n')
        temporary_path = Path(temporary.name)
    temporary_path.replace(output)
    print(f'Validated {len(rounds)} official rounds; latest source date: {rounds[0]["date"]}')


if __name__ == '__main__':
    main()
