// Builds a widget's folder (manifest.json and src/index.tsx) into a .miti-widget package: one ES
// module whose imports of react, react-dom, react/jsx-runtime and @miti/sdk read the copies MITI
// runs (window.__MITI_MODULES__), zipped with the manifest. Any other package the widget imports
// is bundled in.
import fs from 'node:fs';
import path from 'node:path';
import esbuild from 'esbuild';
import { strToU8, zipSync } from 'fflate';
import { WIDGET_FILE_EXTENSION, parseWidgetManifest } from './manifest.mjs';

/** The modules MITI shares with widgets; MITI exposes them in src/sdk/runtime.ts. */
export const SHARED_MODULES = ['react', 'react-dom', 'react/jsx-runtime', '@miti/sdk'];
/** The largest package MITI imports. */
export const MAX_PACKAGE_BYTES = 20 * 1024 * 1024;
const EXTRA_FILES = ['README.md', 'LICENSE', 'CHANGELOG.md'];
const ENTRIES = ['index.tsx', 'index.ts', 'index.jsx', 'index.js'];

/** The widget's manifest.json, checked; `main` is always the bundle's name. */
export function readManifest(folder) {
  const file = path.join(folder, 'manifest.json');
  try {
    return parseWidgetManifest({ ...JSON.parse(fs.readFileSync(file, 'utf8')), main: 'index.js' });
  } catch (error) {
    throw new Error(`${file}: ${error.message}`);
  }
}

export function findEntry(folder) {
  const entry = ENTRIES.map((name) => path.join(folder, 'src', name)).find((file) =>
    fs.existsSync(file)
  );
  if (!entry) throw new Error(`${folder} has no src/index.tsx (or .ts, .jsx, .js)`);
  return entry;
}

const sharedModules = {
  name: 'miti-shared-modules',
  setup(build) {
    build.onResolve({ filter: /^(react|react-dom|@miti\/sdk)(\/.*)?$/ }, ({ path: name }) => {
      if (!SHARED_MODULES.includes(name))
        return {
          errors: [
            {
              text: `${name} cannot be used: a widget gets ${SHARED_MODULES.join(', ')} from MITI, and nothing else of React or @miti/sdk`,
            },
          ],
        };
      return { path: name, namespace: 'miti-shared' };
    });
    build.onLoad({ filter: /.*/, namespace: 'miti-shared' }, ({ path: name }) => ({
      contents: `module.exports = window.__MITI_MODULES__[${JSON.stringify(name)}];`,
      loader: 'js',
    }));
  },
};

const bundleOptions = (entry, plugins = []) => ({
  entryPoints: [entry],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  jsx: 'automatic',
  minify: true,
  legalComments: 'none',
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [sharedModules, ...plugins],
  write: false,
  logLevel: 'silent',
});

/** esbuild's errors as `file:line: message` lines. */
export const describeBuildError = (error) =>
  error.errors?.length
    ? error.errors
        .map((e) => `${e.location ? `${e.location.file}:${e.location.line}: ` : ''}${e.text}`)
        .join('\n')
    : error.message;

/** The package's bytes: the manifest, the bundle and the widget's README, LICENSE, CHANGELOG. */
export function packWidget(folder, manifest, code) {
  const files = {
    'manifest.json': strToU8(`${JSON.stringify(manifest, null, 2)}\n`),
    'index.js': strToU8(code),
  };
  for (const name of EXTRA_FILES) {
    const file = path.join(folder, name);
    if (fs.existsSync(file)) files[name] = new Uint8Array(fs.readFileSync(file));
  }
  const archive = zipSync(files, { level: 9 });
  if (archive.byteLength > MAX_PACKAGE_BYTES)
    throw new Error(`the package is larger than ${MAX_PACKAGE_BYTES / 1024 / 1024} MB`);
  return archive;
}

/** Write the package as `<id>-<version>.miti-widget`; returns its path. */
export function writePackage(outDir, manifest, archive) {
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `${manifest.id}-${manifest.version}${WIDGET_FILE_EXTENSION}`);
  fs.writeFileSync(file, archive);
  return file;
}

/** Build the widget in `folder` once. */
export async function buildWidget(folder, { outDir = path.join(folder, 'dist') } = {}) {
  const manifest = readManifest(folder);
  let code;
  try {
    code = (await esbuild.build(bundleOptions(findEntry(folder)))).outputFiles[0].text;
  } catch (error) {
    throw new Error(describeBuildError(error));
  }
  const archive = packWidget(folder, manifest, code);
  return { file: writePackage(outDir, manifest, archive), manifest, archive };
}

/**
 * Build the widget again whenever its code or manifest changes, calling `onPackage` with each new
 * package and `onError` with what stopped a build. Returns a function that stops watching.
 */
export async function watchWidget(
  folder,
  { outDir = path.join(folder, 'dist'), onPackage, onError }
) {
  const pack = {
    name: 'miti-pack',
    setup(build) {
      build.onEnd(async (result) => {
        if (result.errors.length) return onError(new Error(describeBuildError(result)));
        try {
          const manifest = readManifest(folder);
          const archive = packWidget(folder, manifest, result.outputFiles[0].text);
          await onPackage({ file: writePackage(outDir, manifest, archive), manifest, archive });
        } catch (error) {
          onError(error);
        }
      });
    },
  };
  const context = await esbuild.context(bundleOptions(findEntry(folder), [pack]));
  await context.watch();
  // esbuild watches the code; the manifest is read by the build, outside what it watches.
  const manifestWatcher = fs.watch(path.join(folder, 'manifest.json'), () =>
    context.rebuild().catch(() => {})
  );
  return async () => {
    manifestWatcher.close();
    await context.dispose();
  };
}

/** Import a package into the MITI at `mitiUrl`, as its Widgets view does. */
export async function uploadWidget(mitiUrl, archive) {
  const url = new URL('/api/widgets', mitiUrl);
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: archive,
    });
  } catch (error) {
    throw new Error(
      `MITI is not answering at ${url.origin} (${error.cause?.code ?? error.message})`
    );
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(body.error ?? `MITI refused the widget (HTTP ${response.status})`);
  return body;
}
