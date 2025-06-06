# -*- mode: python ; coding: utf-8 -*-

import os
import sys
from pathlib import Path

# 프로젝트 경로
PROJECT_PATH = Path(__file__).parent

block_cipher = None

# Next.js 프로젝트 파일들
nextjs_files = []

# .next 빌드 폴더가 있다면 포함
next_build_path = PROJECT_PATH / '.next'
if next_build_path.exists():
    nextjs_files.append((str(next_build_path), '.next'))

# public 폴더 포함
public_path = PROJECT_PATH / 'public'
if public_path.exists():
    nextjs_files.append((str(public_path), 'public'))

# package.json 포함
package_json = PROJECT_PATH / 'package.json'
if package_json.exists():
    nextjs_files.append((str(package_json), '.'))

# node_modules/.bin 폴더 (npm 실행을 위해)
node_modules_bin = PROJECT_PATH / 'node_modules' / '.bin'
if node_modules_bin.exists():
    nextjs_files.append((str(node_modules_bin), 'node_modules/.bin'))

# 필요한 Node.js 모듈들
essential_modules = [
    'next',
    'react',
    'react-dom',
    'styled-jsx'
]

for module in essential_modules:
    module_path = PROJECT_PATH / 'node_modules' / module
    if module_path.exists():
        nextjs_files.append((str(module_path), f'node_modules/{module}'))

a = Analysis(
    ['main.py'],
    pathex=[str(PROJECT_PATH)],
    binaries=[],
    datas=nextjs_files + [
        ('server_config.json', '.'),  # 설정 파일
    ],
    hiddenimports=[
        'tkinter',
        'tkinter.ttk',
        'PIL._tkinter_finder',
        'pystray._win32',
        'psutil._pswindows'
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

# Node.js 실행 파일 포함 (Windows)
if sys.platform == 'win32':
    # npm과 node 실행 파일 찾기
    import shutil
    
    node_exe = shutil.which('node')
    npm_exe = shutil.which('npm') or shutil.which('npm.cmd')
    
    if node_exe:
        a.binaries.append(('node.exe', node_exe, 'BINARY'))
    
    if npm_exe:
        a.binaries.append(('npm.cmd', npm_exe, 'BINARY'))

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='InspectionSystemManager',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,  # GUI 앱이므로 콘솔 창 숨김
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='icon.ico'  # 아이콘 파일이 있다면
)