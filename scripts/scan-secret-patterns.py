"""Offline heuristic scan of tracked files and optional HEAD history; never prints values.

This is not entropy/BIP39 scanning, credential validation, or a guarantee of no secrets.
Ignored/untracked files, remote-only refs and external logs/artifacts are outside scope.
"""
import argparse
import json
import pathlib
import re
import subprocess

PATTERNS = {
    'private-key-pem': rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
    'github-token': rb'\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{70,})\b',
    'aws-access-key': rb'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b',
    'literal-wallet-secret': rb'''(?i)(?:private[_-]?key|secret[_-]?key|mnemonic|seed[_-]?phrase)\s*[=:]\s*["'][A-Za-z0-9 +/]{32,}["']''',
}

def findings(data):
    result = [name for name, pattern in PATTERNS.items() if re.search(pattern, data)]
    try:
        value = json.loads(data)
        if isinstance(value, list) and len(value) == 64 and all(type(x) is int and 0 <= x <= 255 for x in value):
            result.append('solana-64-byte-key-file')
    except (ValueError, UnicodeDecodeError):
        pass
    return result

def git(*args):
    return subprocess.check_output(['git', *args])

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--history', action='store_true')
    args = parser.parse_args()
    records = []
    paths = git('ls-files', '-z').decode().split('\0')
    scanned = 0
    for name in filter(None, paths):
        path = pathlib.Path(name)
        if not path.is_file():
            continue
        scanned += 1
        for rule in findings(path.read_bytes()):
            records.append({'scope': 'tracked', 'path': name, 'rule': rule})
        if path.name in ('id.json', 'wallet.json', '.env') or path.name.endswith('.keypair.json'):
            records.append({'scope': 'tracked', 'path': name, 'rule': 'sensitive-file-name'})
    blobs = 0
    if args.history:
        objects = [line.split(b' ', 1)[0] for line in git('rev-list', '--objects', 'HEAD').splitlines()]
        batch = subprocess.run(['git', 'cat-file', '--batch'], input=b'\n'.join(objects) + b'\n', stdout=subprocess.PIPE, check=True).stdout
        cursor = 0
        for _ in objects:
            end = batch.index(b'\n', cursor)
            oid, kind, size = batch[cursor:end].split()
            cursor = end + 1
            data = batch[cursor:cursor + int(size)]
            cursor += int(size) + 1
            if kind != b'blob':
                continue
            blobs += 1
            for rule in findings(data):
                records.append({'scope': 'HEAD-history', 'blob': oid.decode(), 'rule': rule})
    print(json.dumps({'trackedFiles': scanned, 'historyBlobs': blobs, 'findings': records, 'heuristicOnly': True}, indent=2))
    return bool(records)

if __name__ == '__main__':
    raise SystemExit(main())
