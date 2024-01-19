@echo off
setlocal

set "source=C:\Users\dd200\Documents\Dev Plugins\.obsidian\plugins\obsidian-quick-plugin-switcher"
set "destination=/sdcard/documents/volt/.obsidian/plugins/quick-plugin-switcher"

adb push "%source%\manifest.json" "%destination%"
adb push "%source%\main.js" "%destination%"

pause