import json,zipfile,re,hashlib,pathlib,xml.etree.ElementTree as ET
root=pathlib.Path('dist/xhs');z=pathlib.Path('dist/moonshade-archive-xhs.zip');errors=[]
with zipfile.ZipFile(z) as f:
 names=f.namelist();assert f.testzip() is None;assert 'index.html' in names
 for name in names:
  if name.endswith('/'):continue
  assert not name.startswith('/') and '..' not in pathlib.PurePosixPath(name).parts
  assert pathlib.Path(name).suffix in ['.html','.css','.js','.svg','.json','.png','.jpg']
  assert f.read(name)==(root/name).read_bytes()
assert z.stat().st_size<2*1024*1024
html=(root/'index.html').read_text();js=(root/'app.js').read_text()
assert not re.search(r'<script(?![^>]*src=)[^>]*>\s*\S',html)
assert not re.search(r'type=["\x27]module|\son\w+=|http-equiv|<iframe|<object|<base',html,re.I)
assert not re.search(r'\b(import|export)\s|fetch\s*\(|XMLHttpRequest|WebSocket|new\s+(?:Function|Worker)|\beval\s*\(|serviceWorker|WebAssembly|\.at\(|replaceAll\(|structuredClone\(',js)
for ref in re.findall(r'(?:src|href)="([^"]+)"',html): assert ref.startswith('./') and (root/ref).is_file(),ref
for svg in (root/'assets').glob('*.svg'):ET.parse(svg)
report={'status':'PASS','zipBytes':z.stat().st_size,'sha256':hashlib.sha256(z.read_bytes()).hexdigest(),'files':[n for n in names if not n.endswith('/')],'checks':['ZIP root and CRC','allowed file types','all references local','classic external JS','blocked API scan','SVG XML parsing','under 2 MiB']}
pathlib.Path('release/package-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2))
