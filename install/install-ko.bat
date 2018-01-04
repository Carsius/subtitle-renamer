@echo off
MKDIR %appdata%\subtitle-renamer\
COPY subtitle-renamer.exe %appdata%\subtitle-renamer\subtitle-renamer.exe
REG ADD "HKEY_CLASSES_ROOT\Directory\Background\shell\SubtitleRenamer" /ve /t REG_SZ /d "자막 파일 이름 바꾸기" /f
REG ADD "HKEY_CLASSES_ROOT\Directory\Background\shell\SubtitleRenamer\command" /ve /t REG_SZ /d "%appdata%\\subtitle-renamer\\subtitle-renamer.exe" /f

if errorlevel 1 (
   echo **주의: 관리자 권한으로 실행시켜주세요!!!**
)
PAUSE