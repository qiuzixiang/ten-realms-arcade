"""Verify the committed game's reproducibility in a fresh scoped git archive."""
import argparse
import datetime
import hashlib
import io
import json
import pathlib
import shutil
import subprocess
import tarfile
import tempfile
import zoneinfo

parser = argparse.ArgumentParser()
parser.add_argument('--audit-script', required=True, help='Archived minitool 1.7.0 audit_artifact.py')
args = parser.parse_args()
source = pathlib.Path(__file__).resolve().parents[1]
repo = pathlib.Path(subprocess.check_output(['git', 'rev-parse', '--show-toplevel'], cwd=source, text=True).strip())
scope = source.relative_to(repo).as_posix()
commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=repo, text=True).strip()
report = {
    'sourceCommit': commit,
    'method': 'git archive scoped committed tree; remove dist before regenerating and building',
    'checks': [],
    'checkedAt': datetime.datetime.now(zoneinfo.ZoneInfo('Asia/Shanghai')).isoformat(),
}
with tempfile.TemporaryDirectory(prefix='tessera-clean-') as temporary:
    archive = subprocess.check_output(['git', 'archive', '--format=tar', commit, scope], cwd=repo)
    root = pathlib.Path(temporary)
    with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
        tar.extractall(root, filter='data')
    game = root / scope
    baseline = {name: hashlib.sha256((game / name).read_bytes()).hexdigest() for name in [
        'levels.js', 'release/proofs.json', 'dist/tessera-mural-studio-xhs.zip'
    ]}
    shutil.rmtree(game / 'dist')

    def run(argv):
        result = subprocess.run(argv, cwd=game, text=True, capture_output=True)
        report['checks'].append({
            'argv': argv, 'exitCode': result.returncode,
            'stdout': result.stdout, 'stderr': result.stderr,
        })
        print('PASS' if result.returncode == 0 else 'FAIL', ' '.join(argv), flush=True)
        if result.returncode:
            raise RuntimeError(result.stdout + result.stderr)

    run(['npm', 'run', 'generate'])
    report['generatorByteIdentical'] = all(
        baseline[name] == hashlib.sha256((game / name).read_bytes()).hexdigest()
        for name in ['levels.js', 'release/proofs.json']
    )
    assert report['generatorByteIdentical']
    run(['npm', 'run', 'build'])
    report['zipByteIdentical'] = baseline['dist/tessera-mural-studio-xhs.zip'] == hashlib.sha256(
        (game / 'dist/tessera-mural-studio-xhs.zip').read_bytes()
    ).hexdigest()
    assert report['zipByteIdentical']
    for argv in [
        ['npm', 'test'], ['node', 'scripts/compatibility.cjs'],
        ['node', 'scripts/browser.cjs'], ['node', 'scripts/edge-browser.cjs'],
        ['python3', str(pathlib.Path(args.audit_script).resolve()), 'dist/xhs'],
        ['python3', str(pathlib.Path(args.audit_script).resolve()), 'dist/tessera-mural-studio-xhs.zip'],
        ['unzip', '-t', 'dist/tessera-mural-studio-xhs.zip'],
    ]:
        run(argv)
    report['browserResults'] = json.loads((game / 'release/browser-results.json').read_text())
    report['status'] = 'PASSED'
    report['temporaryDirectoryRemoved'] = True
(source / 'release/clean-checkout.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print('Clean archive generation, ZIP bytes, 9 rule suites, production browser and audits passed.')
