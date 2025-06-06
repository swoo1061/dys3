#!/usr/bin/env python3
"""
건축 현장 업무 검수 시스템 빌드 스크립트
Next.js 앱과 Python 서버 관리자를 하나의 exe 파일로 패키징합니다.
"""

import os
import sys
import subprocess
import shutil
import json
from pathlib import Path

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

def create_portable_package():
    """포터블 패키지 생성"""
    print("\n=== 포터블 패키지 생성 ===")
    
    # 출력 디렉토리 생성
    dist_dir = Path('dist')
    dist_dir.mkdir(exist_ok=True)
    
    # 필요한 파일들 복사
    essential_files = [
        'package.json',
        'next.config.mjs',
        'postcss.config.mjs',
        'tailwind.config.js'
    ]
    
    essential_dirs = [
        '.next',
        'public',
        'app',
        'components'
    ]
    
    # 파일 복사
    for file in essential_files:
        if os.path.exists(file):
            shutil.copy2(file, dist_dir / file)
            print(f"복사됨: {file}")
    
    # 디렉토리 복사
    for dir_name in essential_dirs:
        if os.path.exists(dir_name):
            dest_dir = dist_dir / dir_name
            if dest_dir.exists():
                shutil.rmtree(dest_dir)
            shutil.copytree(dir_name, dest_dir)
            print(f"복사됨: {dir_name}/")
    
    # 최소한의 node_modules 복사
    node_modules_src = Path('node_modules')
    node_modules_dest = dist_dir / 'node_modules'
    
    if node_modules_src.exists():
        print("필수 Node.js 모듈 복사 중...")
        essential_modules = [
            'next',
            'react',
            'react-dom',
            'styled-jsx',
            '.bin'
        ]
        
        node_modules_dest.mkdir(exist_ok=True)
        
        for module in essential_modules:
            module_src = node_modules_src / module
            if module_src.exists():
                module_dest = node_modules_dest / module
                if module_dest.exists():
                    shutil.rmtree(module_dest)
                shutil.copytree(module_src, module_dest)
                print(f"복사됨: node_modules/{module}")
    
    return True

def build_exe():
    """PyInstaller로 exe 파일 생성"""
    print("\n=== EXE 파일 빌드 ===")
    
    # PyInstaller 명령어
    cmd = [
        'pyinstaller',
        '--onefile',  # 단일 exe 파일로 생성
        '--windowed',  # 콘솔 창 숨김
        '--name=InspectionSystemManager',
        '--add-data=.next;.next',
        '--add-data=public;public',
        '--add-data=package.json;.',
        '--add-data=app;app',
        '--add-data=components;components',
        '--hidden-import=tkinter',
        '--hidden-import=tkinter.ttk',
        '--hidden-import=PIL._tkinter_finder',
        '--hidden-import=pystray._win32',
        '--hidden-import=psutil._pswindows',
        'main.py'
    ]
    
    # Node.js 바이너리 추가 (가능한 경우)
    node_path = shutil.which('node')
    if node_path:
        cmd.append(f'--add-binary="{node_path}":.')
    
    npm_path = shutil.which('npm') or shutil.which('npm.cmd')
    if npm_path:
        cmd.append(f'--add-binary="{npm_path}":.')
    
    # 아이콘 파일이 있다면 추가
    if os.path.exists('icon.ico'):
        cmd.extend(['--icon=icon.ico'])
    
    # PyInstaller 실행
    if not run_command(' '.join(cmd)):
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
    
    with open('dist/install.bat', 'w', encoding='cp949') as f:
        f.write(installer_script)
    
    print("✅ 설치 스크립트 생성 완료")

def main():
    """메인 빌드 프로세스"""
    print("🏗️ 건축 현장 업무 검수 시스템 빌드 시작")
    print("=" * 50)
    
    # 1. 의존성 확인
    if not check_dependencies():
        print("❌ 빌드 실패: 의존성 문제")
        return False
    
    # 2. Next.js 빌드
    if not build_nextjs():
        print("❌ 빌드 실패: Next.js 빌드 오류")
        return False
    
    # 3. 포터블 패키지 생성
    if not create_portable_package():
        print("❌ 빌드 실패: 패키지 생성 오류")
        return False
    
    # 4. EXE 파일 생성
    if not build_exe():
        print("❌ 빌드 실패: EXE 생성 오류")
        return False
    
    # 5. 설치 스크립트 생성
    create_installer_script()
    
    print("\n" + "=" * 50)
    print("🎉 빌드 완료!")
    print("📁 생성된 파일:")
    print("   - dist/InspectionSystemManager.exe")
    print("   - dist/install.bat")
    print("\n사용법:")
    print("1. InspectionSystemManager.exe를 직접 실행하거나")
    print("2. install.bat을 관리자 권한으로 실행하여 시스템에 설치")
    
    return True

if __name__ == '__main__':
    success = main()
    if not success:
        sys.exit(1)