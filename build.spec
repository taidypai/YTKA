# build.spec
# -*- mode: python ; coding: utf-8 -*-

import sys
import os
from pathlib import Path

# В spec файле __file__ не определен, используем sys.argv[0] или os.getcwd()
current_dir = Path(sys.argv[0]).parent.absolute()
if not current_dir.exists():
    current_dir = Path(os.getcwd()).absolute()

print(f"📁 Текущая директория: {current_dir}")

# Все папки, которые нужно включить
datas = []

# Добавляем папки, если они существуют
folders_to_add = ['config', 'core', 'models', 'utils']
for folder in folders_to_add:
    folder_path = current_dir / folder
    if folder_path.exists():
        datas.append((str(folder_path), folder))
        print(f"✅ Добавлена папка: {folder}")
    else:
        print(f"⚠️ Папка не найдена: {folder}")

# Добавляем фото
photo_path = current_dir / "photo.jpg"
if photo_path.exists():
    datas.append((str(photo_path), "."))
    print(f"✅ Добавлено фото: photo.jpg")
else:
    print(f"⚠️ Фото не найдено: photo.jpg")

# Все скрытые импорты
hiddenimports = [
    'telethon',
    'telethon.client',
    'telethon.sessions',
    'aiogram',
    'aiogram.filters',
    'aiogram.types',
    'aiohttp',
    'certifi',
    'sqlite3',
    'asyncio',
    'json',
    'logging',
    'pathlib',
    'datetime',
    'config',
    'config.settings',
    'config.messages',
    'core',
    'core.bot_handler',
    'core.spam_sender',
    'core.telegram_client',
    'models',
    'models.config_models',
    'utils',
    'utils.file_manager',
    'utils.logger',
]

print(f"📊 Найдено {len(datas)} элементов для добавления")

a = Analysis(
    ['run_app.py'],
    pathex=[str(current_dir)],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=None,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=None)

# Иконка
icon_path = current_dir / "icon.ico"
if icon_path.exists():
    icon = str(icon_path)
    print(f"✅ Иконка найдена: {icon}")
else:
    icon = None
    print(f"⚠️ Иконка не найдена: icon.ico")

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='TelegramSpamer',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,  # True = с консолью, False = без
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=icon,
)

print("✅ Сборка завершена!")