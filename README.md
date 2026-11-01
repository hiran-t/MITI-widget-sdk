# MITI SDK

Types and build tools for **MITI widgets**: panels that are imported into [MITI](https://github.com/hiran-t/MITI) as one `.miti-widget` file, with no change to MITI itself. A widget is written in TypeScript and React against `@miti/sdk`, and talks to the robot through foxglove_bridge like MITI's own panels.

To start a widget, use the template [MITI-widget-dev](https://github.com/hiran-t/MITI-widget-dev). This repository is what it depends on:

| Part                     | What it is                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `index.d.ts`             | The API MITI gives widgets, version 1: panels, `useTopic`, `useTF`, `ImageCanvas`, settings fields, the robot connection |
| `miti-widget` (`bin/`)   | Builds a widget into a `.miti-widget` file, or keeps it built and imported into a running MITI while you work            |
| `lib/manifest.mjs`       | The checks MITI runs on a widget's `manifest.json`                                                                       |
| `scripts/check-miti.mjs` | Checks that a MITI checkout provides everything `index.d.ts` declares                                                    |

## Install

In a widget's folder:

```bash
npm install --save-dev "@miti/sdk@github:hiran-t/MITI-sdk" react @types/react typescript
```

`react` and `@types/react` are for types and for packages that expect React; the widget uses the React MITI runs.

## Build a widget

A widget's folder holds `manifest.json` and `src/index.tsx`, whose default export is `defineWidget({ panels: [...] })`:

```bash
npx miti-widget build              # dist/<id>-<version>.miti-widget
npx miti-widget dev --miti http://localhost:3000
```

`dev` builds again on every change to the code or the manifest and imports the result into the MITI at `--miti`; reload MITI's page to see it. `build` and `dev` take the widget's folder as an argument when it is not the current one, and `--out <folder>` for another output folder.

The build bundles the widget into one ES module. Its imports of `react`, `react-dom`, `react/jsx-runtime` and `@miti/sdk` read the copies MITI runs (`window.__MITI_MODULES__`), so its hooks and components work together with MITI's; other parts of React, such as `react-dom/client`, cannot be imported. Any other npm package it imports is bundled in. The package holds `manifest.json`, `index.js`, and the widget's `README.md`, `LICENSE` and `CHANGELOG.md` when they exist.

## manifest.json

```json
{
  "id": "acme.vision",
  "name": "Acme Vision",
  "version": "1.0.0",
  "description": "Detections over the camera image",
  "author": "Acme",
  "miti": { "apiVersion": 1 }
}
```

| Field                              | Required | Value                                                                                    |
| ---------------------------------- | -------- | ---------------------------------------------------------------------------------------- |
| `id`                               | Yes      | Lowercase words joined by dots or dashes; never changes; its panels' types start with it |
| `name`                             | Yes      | At most 80 characters                                                                    |
| `version`                          | Yes      | `major.minor.patch`, optionally `-prerelease`                                            |
| `miti.apiVersion`                  | Yes      | `1`                                                                                      |
| `description`, `author`, `license` | No       | Shown in MITI's Widgets view                                                             |
| `homepage`                         | No       | An `http` or `https` address                                                             |

## Versions

The package's major version is the widget API version. MITI imports widgets of its own API version only; within a version, what `index.d.ts` declares keeps working and new things are only added. The API is described in MITI's manual under _Widget SDK_.

CI checks that MITI provides everything `index.d.ts` declares (`npm run check-miti -- <MITI folder>`), against MITI's `main` branch or the branch or tag in the repository variable `MITI_REF`.

## Develop

```bash
npm ci
npm test                       # type tests (test/*.test-d.tsx) and build tests
npm run check-miti -- ../MITI  # a MITI checkout with npm ci done
```

## License

[MIT](LICENSE).
