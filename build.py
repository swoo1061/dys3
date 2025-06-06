#!/usr/bin/env python3
"""
건축 현장 업무 검수 시스템 빌드 스크립트 (스탠드얼론 exe용)
Next.js 앱과 Python 서버 관리자를 Node.js 런타임을 포함한 하나의 exe 파일로 패키징합니다.
"""

import os
import sys
import subprocess
import shutil
import json
import zipfile
import requests
from pathlib import Path
import tempfile

def run_command(cmd, cwd=None, shell=True):
    """명령어 실행"""
    print(f"실행 중: {cmd}")
    try:
        result = subprocess.run(cmd, shell=shell, cwd=cwd, check=True, 
                              capture_output=True, text=True)
        print(f"성공: {result.stdout}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"오류: {e}")
        print(f"출력: {e.stdout}")
        print(f"에러: {e.stderr}")
        return False

def check_dependencies():
    """필요한 도구들이 설치되어 있는지 확인"""
    print("=== 의존성 확인 ===")
    
    # Node.js 확인
    if not shutil.which('node'):
        print("❌ Node.js가 설치되어 있지 않습니다.")
        print("https://nodejs.org에서 Node.js를 설치해주세요.")
        return False
    else:
        print("✅ Node.js 발견")
    
    # npm 확인
    if not shutil.which('npm'):
        print("❌ npm이 설치되어 있지 않습니다.")
        return False
    else:
        print("✅ npm 발견")
    
    # Python 패키지 확인
    try:
        import tkinter
        import PIL
        import pystray
        import psutil
        print("✅ Python 패키지들 확인됨")
    except ImportError as e:
        print(f"❌ Python 패키지 누락: {e}")
        print("pip install -r requirements.txt 를 실행해주세요.")
        return False
    
    # PyInstaller 확인
    try:
        import PyInstaller
        print("✅ PyInstaller 확인됨")
    except ImportError:
        print("❌ PyInstaller가 설치되어 있지 않습니다.")
        print("pip install pyinstaller 를 실행해주세요.")
        return False
    
    return True

def download_nodejs_portable():
    """Node.js 포터블 버전 다운로드"""
    print("\n=== Node.js 포터블 버전 다운로드 ===")
    
    # Node.js 버전 설정
    node_version = "v20.11.0"  # LTS 버전
    
    # 플랫폼별 다운로드 URL
    if sys.platform == "win32":
        if sys.maxsize > 2**32:
            # 64-bit
            node_url = f"https://nodejs.org/dist/{node_version}/node-{node_version}-win-x64.zip"
            node_folder = f"node-{node_version}-win-x64"
        else:
            # 32-bit
            node_url = f"https://nodejs.org/dist/{node_version}/node-{node_version}-win-x86.zip"
            node_folder = f"node-{node_version}-win-x86"
    elif sys.platform == "darwin":
        node_url = f"https://nodejs.org/dist/{node_version}/node-{node_version}-darwin-x64.tar.gz"
        node_folder = f"node-{node_version}-darwin-x64"
    else:
        # Linux
        node_url = f"https://nodejs.org/dist/{node_version}/node-{node_version}-linux-x64.tar.xz"
        node_folder = f"node-{node_version}-linux-x64"
    
    # 다운로드 디렉토리 생성
    download_dir = Path("temp_nodejs")
    download_dir.mkdir(exist_ok=True)
    
    node_archive = download_dir / f"nodejs{Path(node_url).suffix}"
    
    # 이미 다운로드된 경우 건너뛰기
    if node_archive.exists():
        print(f"Node.js 아카이브가 이미 존재합니다: {node_archive}")
    else:
        print(f"Node.js 다운로드 중: {node_url}")
        try:
            response = requests.get(node_url, stream=True)
            response.raise_for_status()
            
            with open(node_archive, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            print(f"✅ Node.js 다운로드 완료: {node_archive}")
        except Exception as e:
            print(f"❌ Node.js 다운로드 실패: {e}")
            return None
    
    # 압축 해제
    extracted_dir = download_dir / node_folder
    if extracted_dir.exists():
        print(f"Node.js가 이미 압축 해제되어 있습니다: {extracted_dir}")
    else:
        print("Node.js 압축 해제 중...")
        try:
            if node_archive.suffix == '.zip':
                with zipfile.ZipFile(node_archive, 'r') as zip_ref:
                    zip_ref.extractall(download_dir)
            elif node_archive.suffix in ['.tar', '.gz', '.xz']:
                import tarfile
                with tarfile.open(node_archive, 'r:*') as tar_ref:
                    tar_ref.extractall(download_dir)
            print(f"✅ Node.js 압축 해제 완료: {extracted_dir}")
        except Exception as e:
            print(f"❌ Node.js 압축 해제 실패: {e}")
            return None
    
    return extracted_dir

def prepare_nodejs_binaries(nodejs_dir):
    """Node.js 바이너리 파일들을 빌드에 필요한 위치로 복사"""
    print("\n=== Node.js 바이너리 준비 ===")
    
    # 빌드 디렉토리 생성
    build_bin_dir = Path("build_binaries")
    build_bin_dir.mkdir(exist_ok=True)
    
    if sys.platform == "win32":
        # Windows
        node_exe = nodejs_dir / "node.exe"
        npm_cmd = nodejs_dir / "npm.cmd"
        npx_cmd = nodejs_dir / "npx.cmd"
        
        # node_modules 폴더도 필요
        node_modules = nodejs_dir / "node_modules"
        
        if node_exe.exists():
            shutil.copy2(node_exe, build_bin_dir / "node.exe")
            print(f"✅ node.exe 복사됨")
        
        if npm_cmd.exists():
            shutil.copy2(npm_cmd, build_bin_dir / "npm.cmd")
            print(f"✅ npm.cmd 복사됨")
        
        if npx_cmd.exists():
            shutil.copy2(npx_cmd, build_bin_dir / "npx.cmd")
            print(f"✅ npx.cmd 복사됨")
        
        # npm을 위한 node_modules 복사
        if node_modules.exists():
            dest_node_modules = build_bin_dir / "node_modules"
            if dest_node_modules.exists():
                shutil.rmtree(dest_node_modules)
            shutil.copytree(node_modules, dest_node_modules)
            print(f"✅ node_modules 복사됨")
    
    else:
        # macOS/Linux
        node_bin = nodejs_dir / "bin" / "node"
        npm_bin = nodejs_dir / "bin" / "npm"
        npx_bin = nodejs_dir / "bin" / "npx"
        
        # lib 폴더도 필요
        lib_dir = nodejs_dir / "lib"
        
        if node_bin.exists():
            shutil.copy2(node_bin, build_bin_dir / "node")
            print(f"✅ node 복사됨")
        
        if npm_bin.exists():
            shutil.copy2(npm_bin, build_bin_dir / "npm")
            print(f"✅ npm 복사됨")
        
        if npx_bin.exists():
            shutil.copy2(npx_bin, build_bin_dir / "npx")
            print(f"✅ npx 복사됨")
        
        # npm을 위한 lib 복사
        if lib_dir.exists():
            dest_lib = build_bin_dir / "lib"
            if dest_lib.exists():
                shutil.rmtree(dest_lib)
            shutil.copytree(lib_dir, dest_lib)
            print(f"✅ lib 복사됨")
    
    return build_bin_dir

def build_nextjs():
    """Next.js 프로젝트 빌드"""
    print("\n=== Next.js 프로젝트 빌드 ===")
    
    # package.json 확인
    if not os.path.exists('package.json'):
        print("❌ package.json 파일을 찾을 수 없습니다.")
        return False
    
    # node_modules 설치
    if not os.path.exists('node_modules'):
        print("npm 패키지 설치 중...")
        if not run_command('npm install'):
            return False
    
    # Next.js 빌드
    print("Next.js 프로젝트 빌드 중...")
    if not run_command('npm run build'):
        return False
    
    print("✅ Next.js 빌드 완료")
    return True

def create_pyinstaller_spec(binaries_dir):
    """PyInstaller spec 파일 생성"""
    print("\n=== PyInstaller spec 파일 생성 ===")
    
    # 플랫폼별 바이너리 파일 목록
    if sys.platform == "win32":
        node_files = [
            (str(binaries_dir / "node.exe"), "."),
            (str(binaries_dir / "npm.cmd"), "."),
            (str(binaries_dir / "npx.cmd"), "."),
        ]
        # node_modules 폴더 추가
        node_modules_dir = binaries_dir / "node_modules"
        if node_modules_dir.exists():
            node_files.append((str(node_modules_dir), "node_modules"))
    else:
        node_files = [
            (str(binaries_dir / "node"), "."),
            (str(binaries_dir / "npm"), "."),
            (str(binaries_dir / "npx"), "."),
        ]
        # lib 폴더 추가
        lib_dir = binaries_dir / "lib"
        if lib_dir.exists():
            node_files.append((str(lib_dir), "lib"))
    
    spec_content = f'''# -*- mode: python ; coding: utf-8 -*-

import sys  # sys 모듈 추가

block_cipher = None

# Next.js 프로젝트 파일들
nextjs_files = []

# .next 빌드 폴더
import os
if os.path.exists('.next'):
    nextjs_files.append(('.next', '.next'))

# public 폴더
if os.path.exists('public'):
    nextjs_files.append(('public', 'public'))

# package.json
if os.path.exists('package.json'):
    nextjs_files.append(('package.json', '.'))

# app 폴더
if os.path.exists('app'):
    nextjs_files.append(('app', 'app'))

# components 폴더
if os.path.exists('components'):
    nextjs_files.append(('components', 'components'))

# 설정 파일들
config_files = []
for config in ['next.config.mjs', 'postcss.config.mjs', 'tailwind.config.js', 'server_config.json']:
    if os.path.exists(config):
        config_files.append((config, '.'))

# Node.js 바이너리들
node_binaries = {node_files}

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=node_binaries,
    datas=nextjs_files + config_files,
    hiddenimports=[
        'tkinter',
        'tkinter.ttk',
        'PIL._tkinter_finder',
        'pystray._win32' if sys.platform == 'win32' else 'pystray._linux',
        'psutil._pswindows' if sys.platform == 'win32' else 'psutil._pslinux'
    ],
    hookspath=[],
    hooksconfig={{}},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

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
)
'''
    
    with open('standalone.spec', 'w', encoding='utf-8') as f:
        f.write(spec_content)
    
    print("✅ PyInstaller spec 파일 생성 완료")
    return True

def build_exe():
    """PyInstaller로 exe 파일 생성"""
    print("\n=== EXE 파일 빌드 ===")
    
    # PyInstaller 실행
    if not run_command('pyinstaller standalone.spec --clean'):
        return False
    
    print("✅ EXE 파일 생성 완료")
    return True

def create_installer_script():
    """간단한 설치 스크립트 생성"""
    print("\n=== 설치 스크립트 생성 ===")
    
    installer_script = '''@echo off
echo 건축 현장 업무 검수 시스템 설치 중...

:: 프로그램 폴더 생성
if not exist "%PROGRAMFILES%\\InspectionSystem" (
    mkdir "%PROGRAMFILES%\\InspectionSystem"
)

:: 파일 복사
copy "InspectionSystemManager.exe" "%PROGRAMFILES%\\InspectionSystem\\"

:: 바탕화면 바로가기 생성
powershell "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%USERPROFILE%\\Desktop\\건축 현장 업무 검수 시스템.lnk'); $Shortcut.TargetPath = '%PROGRAMFILES%\\InspectionSystem\\InspectionSystemManager.exe'; $Shortcut.Save()"

:: 시작 메뉴 바로가기 생성
powershell "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\건축 현장 업무 검수 시스템.lnk'); $Shortcut.TargetPath = '%PROGRAMFILES%\\InspectionSystem\\InspectionSystemManager.exe'; $Shortcut.Save()"

echo 설치가 완료되었습니다!
pause
'''
    
    os.makedirs('dist', exist_ok=True)
    with open('dist/install.bat', 'w', encoding='cp949') as f:
        f.write(installer_script)
    
    print("✅ 설치 스크립트 생성 완료")

def cleanup_temp_files():
    """임시 파일들 정리"""
    print("\n=== 임시 파일 정리 ===")
    
    temp_dirs = ['temp_nodejs', 'build_binaries', 'build', '__pycache__']
    temp_files = ['standalone.spec']
    
    for temp_dir in temp_dirs:
        if os.path.exists(temp_dir):
            try:
                shutil.rmtree(temp_dir)
                print(f"✅ {temp_dir} 삭제됨")
            except Exception as e:
                print(f"⚠️ {temp_dir} 삭제 실패: {e}")
    
    for temp_file in temp_files:
        if os.path.exists(temp_file):
            try:
                os.remove(temp_file)
                print(f"✅ {temp_file} 삭제됨")
            except Exception as e:
                print(f"⚠️ {temp_file} 삭제 실패: {e}")

def main():
    """메인 빌드 프로세스"""
    print("🏗️ 건축 현장 업무 검수 시스템 스탠드얼론 빌드 시작")
    print("=" * 60)
    
    try:
        # 1. 의존성 확인
        if not check_dependencies():
            print("❌ 빌드 실패: 의존성 문제")
            return False
        
        # 2. Node.js 포터블 버전 다운로드
        nodejs_dir = download_nodejs_portable()
        if not nodejs_dir:
            print("❌ 빌드 실패: Node.js 다운로드 오류")
            return False
        
        # 3. Node.js 바이너리 준비
        binaries_dir = prepare_nodejs_binaries(nodejs_dir)
        if not binaries_dir:
            print("❌ 빌드 실패: Node.js 바이너리 준비 오류")
            return False
        
        # 4. Next.js 빌드
        if not build_nextjs():
            print("❌ 빌드 실패: Next.js 빌드 오류")
            return False
        
        # 5. PyInstaller spec 파일 생성
        if not create_pyinstaller_spec(binaries_dir):
            print("❌ 빌드 실패: spec 파일 생성 오류")
            return False
        
        # 6. EXE 파일 생성
        if not build_exe():
            print("❌ 빌드 실패: EXE 생성 오류")
            return False
        
        # 7. 설치 스크립트 생성
        create_installer_script()
        
        print("\n" + "=" * 60)
        print("🎉 스탠드얼론 빌드 완료!")
        print("📁 생성된 파일:")
        print("   - dist/InspectionSystemManager.exe (Node.js 런타임 포함)")
        print("   - dist/install.bat")
        print("\n✨ 특징:")
        print("   - Node.js 설치 불필요")
        print("   - 완전한 스탠드얼론 실행 파일")
        print("   - 모든 의존성 포함")
        print("\n사용법:")
        print("1. InspectionSystemManager.exe를 직접 실행하거나")
        print("2. install.bat을 관리자 권한으로 실행하여 시스템에 설치")
        
        return True
        
    except KeyboardInterrupt:
        print("\n사용자에 의해 빌드가 중단되었습니다.")
        return False
    except Exception as e:
        print(f"\n예상치 못한 오류 발생: {e}")
        return False
    finally:
        # 임시 파일 정리 (선택사항)
        print("\n임시 파일을 정리하시겠습니까? (y/N): ", end="")
        try:
            if input().lower().startswith('y'):
                cleanup_temp_files()
        except:
            pass

if __name__ == '__main__':
    success = main()
    if not success:
        sys.exit(1)