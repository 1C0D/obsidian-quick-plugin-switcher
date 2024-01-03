@echo off

node inject.mjs

REM to root dir
set ROOT_DIR=%~dp0..

IF NOT EXIST %ROOT_DIR%\package.json (
    echo package.json cannot be found in the root directory.
    exit /b
)

echo Installing missing modules

cd /d %ROOT_DIR%
npm i -D tsx dedent dotenv fs-extra semver @types/fs-extra readline @types/semver