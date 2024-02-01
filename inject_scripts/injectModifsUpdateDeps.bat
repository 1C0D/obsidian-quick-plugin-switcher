@echo off

REM to root dir
set "ROOT_DIR=."

IF NOT EXIST "..\%ROOT_DIR%\package.json" (
  echo package.json cannot be found in the root directory.
  exit /b
)

echo Installing missing modules

call npm i -D tsx dedent dotenv fs-extra semver @types/fs-extra readline @types/semver path json-stringify-pretty-compact

echo Running inject.mjs

node inject.mjs

pause