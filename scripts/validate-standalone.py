import pathlib,re,urllib.parse,zipfile,json
root=pathlib.Path('dist').resolve(); base=root/'standalone'; errors=[]
games=json.loads(pathlib.Path('standalone/games.json').read_text())
for game in games:
 assert (base/game['slug']/'index.html').is_file(),game['slug']
 with zipfile.ZipFile(base/'downloads'/(game['slug']+'-offline.zip')) as z:assert z.testzip() is None
for p in base.rglob('*'):
 if p.suffix not in ['.html','.css']:continue
 t=p.read_text();t=re.sub(r'''url\(\s*["']data:.*?["']\s*\)''','',t,flags=re.S);refs=re.findall(r'''(?:src|href)\s*=\s*["']([^"']+)["']''',t) if p.suffix=='.html' else re.findall(r'''url\(\s*["']?([^\s)'";]+)''',t)
 for ref in refs:
  u=urllib.parse.urlsplit(ref)
  if u.scheme or u.netloc or not u.path:continue
  target=(root/u.path.lstrip('/') if u.path.startswith('/') else p.parent/urllib.parse.unquote(u.path)).resolve()
  if not target.exists():errors.append(str(p.relative_to(root))+': '+ref)
if errors:raise SystemExit('\n'.join(errors))
print(f'{len(games)} entries, local HTML/CSS references and ZIP CRC verified.')
