# RoboNeo TikTok Video Studio

Local Electron desktop app for creating TikTok-ready videos through the RoboNeo CLI. The app has no online backend: projects, encrypted keys, copied assets, process logs, and downloaded outputs stay on the user's machine.

## Stack

- Electron + electron-vite
- React + TypeScript
- Tailwind CSS with shadcn-style components
- Zustand persist
- Node `child_process.spawn`
- Electron `safeStorage`, with encrypted local-file fallback

## Prerequisites

- Node.js 20 or newer
- npm
- RoboNeo CLI:

```bash
npm install -g roboneo-cli
roboneo --version
```

## Install and run

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run dist
```

Build artifacts are written to `release/`.

## Local data

Projects and copied inputs:

```text
~/RoboNeoTikTokStudio/projects/<projectId>/
```

Default downloaded outputs:

```text
~/RoboNeoTikTokStudio/outputs/<projectId>/
```

Settings and encrypted key records use Electron's per-app `userData/config` directory. Keys are never returned to the renderer after being saved. The UI only receives masked values.

## Workflow

1. Add one or more RoboNeo keys in **API Keys**.
2. Validate a key with `roboneo user-info`.
3. Create a project and select a character image, optional second image, and optional motion video.
4. Enter a brief and generate the prompt pack.
5. Review or edit the final prompt.
6. Run RoboNeo and monitor realtime stdout/stderr.
7. The app creates a room, sends the prompt/assets, polls `history-detail`, handles follow-up replies, and downloads artifacts when complete.
8. Preview the MP4 or open its local folder.

## Generation modes

The studio provides four workflows. RoboNeo CLI exposes these capabilities through the same natural-language `chat` command; the app changes the optimized prompt and attachments:

- **Motion Reference**: character image + optional second image + required motion video
- **Text to Image**: prompt only, downloads and previews JPG/PNG/WebP/GIF artifacts
- **Text to Video**: prompt only, downloads and previews video artifacts
- **Image to Video**: one required source image and an optional second reference image

All modes use:

```text
create-room -> chat -> history-detail polling -> download
```

## Carrot credits

The **API Keys** page can load one key's balance or refresh all keys. Credit lookup uses the locally stored key as the Meitu `Access-Token`, resolves the account UID, then reads `parameter.total_amount` from RoboNeo's `vipshow` response.

Cookies, browser refresh tokens, and copied browser-session tracking values are not stored or required by the app. Only the carrot balance, refresh time, and a possible error message are persisted.

## Asset limits

- Images: JPG/JPEG/PNG, maximum 20MB each
- Video: MP4/MOV, maximum 500MB
- The current UI supports up to two images and one video

## Security notes

- Jobs receive the selected key through `ROBONEO_ACCESS_KEY`.
- Commands are spawned directly with argument arrays and do not use a shell.
- Keys are redacted from terminal output.
- Writing a key to `~/.roboneo/credentials.json` only happens through the explicit **Save to CLI** action.
- The app does not bypass quota, captcha, or RoboNeo limits.

## Useful scripts

```bash
npm run typecheck
npm run build
npm run preview
```

## Debugging Electron

Start development mode:

```bash
npm run dev
```

In development, Chromium DevTools opens automatically. Use its **Console** for React/renderer errors and **Network** for Meitu/RoboNeo requests.

Main-process output and renderer console messages are also printed in the terminal that runs `npm run dev`. Persistent logs are written to:

```text
~/Library/Application Support/roboneo-tiktok-video-studio/logs/main.log
```

Watch the file live on macOS:

```bash
tail -f "$HOME/Library/Application Support/roboneo-tiktok-video-studio/logs/main.log"
```

To attach the VS Code Node debugger to Electron's main process:

```bash
npm run dev:inspect
```

Then attach VS Code to port `5858`.
