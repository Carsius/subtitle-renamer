@echo off
MKDIR %appdata%\subtitle-renamer\
COPY subtitle-renamer.exe %appdata%\subtitle-renamer\subtitle-renamer.exe
REG ADD "HKEY_CLASSES_ROOT\Directory\Background\shell\SubtitleRenamer" /ve /t REG_SZ /d "Rename Subtitles" /f
REG ADD "HKEY_CLASSES_ROOT\Directory\Background\shell\SubtitleRenamer\command" /ve /t REG_SZ /d "%appdata%\\subtitle-renamer\\subtitle-renamer.exe" /f

if errorlevel 1 (
   echo **Warning: Please run in administrator.**
)
PAUSE