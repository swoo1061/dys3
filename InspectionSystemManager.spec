# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[('C:\\Program Files\\nodejs\\node.EXE', '.'), ('C:\\Program Files\\nodejs\\npm.CMD', '.')],
    datas=[('.next', '.next'), ('public', 'public'), ('package.json', '.'), ('app', 'app'), ('components', 'components')],
    hiddenimports=['tkinter', 'tkinter.ttk', 'PIL._tkinter_finder', 'pystray._win32', 'psutil._pswindows'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='InspectionSystemManager',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
