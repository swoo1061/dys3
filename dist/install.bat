@echo off
echo ���� ���� ���� �˼� �ý��� ��ġ ��...

:: ���α׷� ���� ����
if not exist "%PROGRAMFILES%\InspectionSystem" (
    mkdir "%PROGRAMFILES%\InspectionSystem"
)

:: ���� ����
copy "InspectionSystemManager.exe" "%PROGRAMFILES%\InspectionSystem\"

:: ����ȭ�� �ٷΰ��� ����
powershell "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%USERPROFILE%\Desktop\���� ���� ���� �˼� �ý���.lnk'); $Shortcut.TargetPath = '%PROGRAMFILES%\InspectionSystem\InspectionSystemManager.exe'; $Shortcut.Save()"

:: ���� �޴� �ٷΰ��� ����
powershell "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%APPDATA%\Microsoft\Windows\Start Menu\Programs\���� ���� ���� �˼� �ý���.lnk'); $Shortcut.TargetPath = '%PROGRAMFILES%\InspectionSystem\InspectionSystemManager.exe'; $Shortcut.Save()"

echo ��ġ�� �Ϸ�Ǿ����ϴ�!
pause
