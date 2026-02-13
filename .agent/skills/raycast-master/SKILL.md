# Raycast Extensions Mastery Skill

## Trigger Keywords
Raycast extension, create command, build List view, useFetch hook, manifest.json, npm run dev.

## Master Principles (from developers.raycast.com)
- **Tech Stack**: TypeScript + React + Node.js. Use npm ecosystem. [page:0]
- **Workflow**: `npx create-raycast-extension@latest my-ext` → `npm i && npm run dev` (hot-reload). Build: `npm run build`. [page:2]
- **UI Components**: List (searchable), Detail (markdown/HTML), Form (inputs), ActionPanel. Consistent pixels handled by Raycast. [page:0]
- **Data Hooks**: useFetch (REST/JSON), useLocalStorage, useNavigation. For local: Node fs/module. [page:0]
- **Manifest (raycast-extension.json)**: Defines name, commands, mode (view/no-view), preferences, entitlements. [page:3]

## Build Patterns
- **Simple Script**: No UI, just Action.
- **Static UI**: Hardcoded Detail.
- **Dynamic List**: Fetch → map to List.Item (keywords, accessories).
- **Teams/Private**: Select org in create command.

## Pro Tips
- Error Handling: Try-catch in async, show Toast.
- Performance: Lazy-load heavy deps.
- Submit: PR to github.com/raycast/extensions.
- Examples: Clone disk-usage for fs stats List.

## Resources
- Docs: developers.raycast.com/basics/create-your-first-extension
- API Ref: developers.raycast.com/reference/*
