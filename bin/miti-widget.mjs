#!/usr/bin/env node
// miti-widget: build a MITI widget into a .miti-widget package, or keep it built and imported
// into a running MITI while you work on it.
//
//   miti-widget build [folder] [--out <folder>]
//   miti-widget dev [folder] [--miti http://localhost:3000] [--out <folder>]
import fs from 'node:fs';
import path from 'node:path';
import { buildWidget, uploadWidget, watchWidget } from '../lib/build.mjs';

const USAGE = `Usage:
  miti-widget build [folder] [--out <folder>]
      Build the widget in folder (default: here) into <folder>/dist/<id>-<version>.miti-widget.
  miti-widget dev [folder] [--miti <url>] [--out <folder>]
      Build again on every change and import the result into the MITI at <url>
      (default http://localhost:3000); reload MITI's page to see it.
  miti-widget --version`;

const [command, ...rest] = process.argv.slice(2);
const option = (name, fallback) => {
  const index = rest.indexOf(`--${name}`);
  return index >= 0 && rest[index + 1] ? rest[index + 1] : fallback;
};
const folder = path.resolve(
  rest.find((arg, index) => !arg.startsWith('--') && !rest[index - 1]?.startsWith('--')) ?? '.'
);
const outDir = path.resolve(option('out', path.join(folder, 'dist')));
const size = (archive) => `${(archive.byteLength / 1024).toFixed(1)} KB`;
const shown = (file) => path.relative(process.cwd(), file) || file;

async function main() {
  if (command === '--version' || command === '-v') {
    const own = new URL('../package.json', import.meta.url);
    console.log(JSON.parse(fs.readFileSync(own, 'utf8')).version);
  } else if (command === 'build') {
    const { file, manifest, archive } = await buildWidget(folder, { outDir });
    console.log(`${shown(file)} (${size(archive)}): ${manifest.name} ${manifest.version}`);
  } else if (command === 'dev') {
    const miti = option('miti', 'http://localhost:3000');
    await watchWidget(folder, {
      outDir,
      onPackage: async ({ file, manifest, archive }) => {
        const time = new Date().toLocaleTimeString();
        try {
          await uploadWidget(miti, archive);
          console.log(
            `${time} ${manifest.name} ${manifest.version} imported into ${miti} (${size(archive)})`
          );
        } catch (error) {
          console.error(`${time} built ${shown(file)}, not imported: ${error.message}`);
        }
      },
      onError: (error) => console.error(`${new Date().toLocaleTimeString()} ${error.message}`),
    });
    console.log(`Watching ${shown(folder) === '' ? '.' : shown(folder)}; Ctrl+C stops.`);
  } else {
    console.log(USAGE);
    process.exitCode = command && command !== 'help' && command !== '--help' ? 2 : 0;
  }
}

main().catch((error) => {
  console.error(`miti-widget: ${error.message}`);
  process.exit(1);
});
