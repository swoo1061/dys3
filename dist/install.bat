@echo off
echo 건축 현장 업무 검수 시스템 설치 중...

:: 프로그램 폴더 생성
if not exist "%PROGRAMFILES%\InspectionSystem" (
    mkdir "%PROGRAMFILES%\InspectionSystem"
)

:: 파일 복사
copy "InspectionSystemManager.exe" "%PROGRAMFILES%\InspectionSystem\"

:: 바탕화면 바로가기 생성
powershell "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%USERPROFILE%\Desktop\건축 현장 업무 검수 시스템.lnk'); $Shortcut.TargetPath = '%PROGRAMFILES%\InspectionSystem\InspectionSystemManager.exe'; $Shortcut.Save()"

:: 시작 메뉴 바로가기 생성
powershell "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%APPDATA%\Microsoft\Windows\Start Menu\Programs\건축 현장 업무 검수 시스템.lnk'); $Shortcut.TargetPath = '%PROGRAMFILES%\InspectionSystem\InspectionSystemManager.exe'; $Shortcut.Save()"

echo 설치가 완료되었습니다!
pause
