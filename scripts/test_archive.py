#!/usr/bin/env python3
import argparse,json,pathlib,subprocess,tarfile,tempfile,zipfile
from package_binary import ROOT,native
p=argparse.ArgumentParser();p.add_argument('--platform',default=native());a=p.parse_args()
version=json.loads((ROOT/'executas/mini-notes/manifest.json').read_text())['version']
windows=a.platform.startswith('windows');entry='bin/mini-notes'+('.exe' if windows else '')
archive=ROOT/'dist'/('mini-notes-'+version+'-'+a.platform+('.zip' if windows else '.tar.gz'))
with tempfile.TemporaryDirectory() as temp:
    if windows:
        with zipfile.ZipFile(archive) as z:
            assert set(z.namelist())=={'manifest.json',entry};z.extractall(temp)
    else:
        with tarfile.open(archive) as z:
            assert set(z.getnames())=={'manifest.json',entry};assert z.getmember(entry).mode & 0o111;z.extractall(temp)
    m=json.loads((pathlib.Path(temp)/'manifest.json').read_text());assert m['runtime']['binary']['entrypoint']==entry;assert m['runtime']['binary']['permissions'][entry]=='0o755'
    if a.platform==native():
        r=subprocess.run([str(pathlib.Path(temp)/entry)],input='{"jsonrpc":"2.0","id":1,"method":"describe"}\n',text=True,capture_output=True,check=True,timeout=10)
        result=json.loads(r.stdout)['result'];assert result['name']==m['name'];assert result['version']==m['version']
print('PASS archive:',a.platform)
