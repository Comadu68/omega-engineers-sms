# Release Guide

## Development
```bash
npm install
npm run dev
```

After the first successful dependency install, commit `package-lock.json` so the team has reproducible versions.

## Production build
```bash
npm run build
npm run dist
```

Expected output under `release/` or electron-builder's configured output folder:
```text
Omega Engineers Service Station Setup 1.0.0.exe
win-unpacked/
```

## Client/demo PC
The user should only need to run the Setup EXE.
They should not need to separately install Node.js, React, SQLite, or a database server.

## Before final demo
- create a stable Git tag
- backup demo database
- test installer on a clean PC/profile
- test with internet disconnected
- do not upgrade dependencies on demo day
- keep the previous stable installer as fallback

## Windows SmartScreen
An unsigned academic installer may display an Unknown Publisher/SmartScreen warning. This is expected unless the app is code-signed.
