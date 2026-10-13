#!/usr/bin/env python3
"""Build a native, interpreter-free Executa and archive its root manifest."""
import argparse, hashlib, json, os, pathlib, platform, subprocess, tarfile, zipfile
ROOT = pathlib.Path(__file__).resolve().parents[1]
TARGETS = {'darwin-arm64': ('darwin','arm64'), 'darwin-x86_64': ('darwin','amd64'), 'windows-x86_64': ('windows','amd64'), 'linux-x86_64': ('linux','amd64'), 'linux-aarch64': ('linux','arm64')}
def native():
    system = platform.system().lower()
    arch = {'aarch64':'arm64','AMD64':'x86_64','amd64':'x86_64'}.get(platform.machine(), platform.machine())
    return f'{system}-' + ('aarch64' if system == 'linux' and arch == 'arm64' else arch)
def build(target):
    goos, goarch = TARGETS[target]
    src = ROOT/'executas/mini-notes'
    manifest = json.loads((src/'manifest.json').read_text())
    stage = ROOT/'dist'/target
    (stage/'bin').mkdir(parents=True, exist_ok=True)
    entry = 'bin/mini-notes' + ('.exe' if goos == 'windows' else '')
    binary = stage/entry
    subprocess.run(['go','build','-trimpath','-ldflags=-s -w','-o',str(binary),'.'],cwd=src,env={**os.environ,'GOOS':goos,'GOARCH':goarch,'CGO_ENABLED':'0'},check=True)
    binary.chmod(0o755)
    manifest['runtime']['binary'] = {'entrypoint':entry, 'permissions':{entry:'0o755'}}
    (stage/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    name = f'mini-notes-{manifest["version"]}-{target}'
    archive = ROOT/'dist'/(name+('.zip' if goos=='windows' else '.tar.gz'))
    if goos == 'windows':
        with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as out:
            for item in ('manifest.json', entry): out.write(stage/item, item)
    else:
        with tarfile.open(archive,'w:gz') as out:
            for item in ('manifest.json', entry): out.add(stage/item,arcname=item)
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    archive.with_name(archive.name+'.sha256').write_text(f'{digest}  {archive.name}\n')
    print(archive)
if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--platform', choices=TARGETS, default=native()); args=parser.parse_args()
    if args.platform not in TARGETS: parser.error('Unsupported host; pass --platform explicitly')
    build(args.platform)
