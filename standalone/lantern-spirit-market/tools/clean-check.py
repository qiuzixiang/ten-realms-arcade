from pathlib import Path
import shutil,tempfile,subprocess,json,hashlib
root=Path(__file__).resolve().parents[1];clean=Path(tempfile.mkdtemp(prefix='lantern-clean-'))/'game';clean.mkdir()
for f in root.iterdir():
 if f.name in ['dist','release','node_modules','.DS_Store']:continue
 if f.is_dir():shutil.copytree(f,clean/f.name)
 else:shutil.copy2(f,clean/f.name)
(clean/'release').mkdir()
commands=[]
try:
 for args in [['node','--test','tests/adapter.test.mjs','tests/core.test.mjs'],['node','tools/build.mjs']]:
  result=subprocess.run(args,cwd=clean,capture_output=True,text=True);commands.append({'command':args,'exitCode':result.returncode,'stdout':result.stdout,'stderr':result.stderr});assert result.returncode==0
 files={f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in (root/'dist/xhs').iterdir()}
 assert all(hashlib.sha256((clean/'dist/xhs'/name).read_bytes()).hexdigest()==digest for name,digest in files.items())
 ziphash=hashlib.sha256((root/'dist/lantern-spirit-market-xhs.zip').read_bytes()).hexdigest()
 assert hashlib.sha256((clean/'dist/lantern-spirit-market-xhs.zip').read_bytes()).hexdigest()==ziphash
 (root/'release/clean-build-report.json').write_text(json.dumps({'commands':commands,'runtimeHashesEqual':True,'runtimeHashes':files,'zipHashEqual':True,'zipSha256':ziphash},ensure_ascii=False,indent=2))
 print('Clean source tests and deterministic ZIP rebuild passed')
finally:shutil.rmtree(clean.parent)
