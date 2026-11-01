// Checks that a MITI checkout gives widgets everything index.d.ts declares, with types that fit.
// MITI's TypeScript compiles a file that assigns MITI's src/sdk to the type of this package:
//
//   node scripts/check-miti.mjs [MITI folder]     (default ../MITI; run `npm ci` there first)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sdk = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const miti = path.resolve(process.argv[2] ?? path.join(sdk, '..', 'MITI'));
const fail = (message) => {
  console.error(`check-miti: ${message}`);
  process.exit(1);
};
if (!fs.existsSync(path.join(miti, 'src', 'sdk', 'index.ts')))
  fail(`${miti} has no src/sdk/index.ts, so it does not load widgets yet`);
const tsc = path.join(miti, 'node_modules', 'typescript', 'bin', 'tsc');
if (!fs.existsSync(tsc)) fail(`${miti} has no node_modules: run npm ci there first`);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'miti-sdk-check-'));
try {
  fs.writeFileSync(
    path.join(dir, 'check.ts'),
    [
      `import * as implementation from ${JSON.stringify(path.join(miti, 'src', 'sdk', 'index'))};`,
      `import type * as declared from ${JSON.stringify(path.join(sdk, 'index'))};`,
      '// Every export @miti/sdk declares must exist in MITI, with a type that fits the declaration.',
      'export const check: typeof declared = implementation;',
      '',
    ].join('\n')
  );
  const types = path.join(miti, 'node_modules', '@types');
  fs.writeFileSync(
    path.join(dir, 'tsconfig.json'),
    JSON.stringify(
      {
        extends: path.join(miti, 'tsconfig.json'),
        compilerOptions: {
          noEmit: true,
          incremental: false,
          typeRoots: [types],
          // MITI's paths, and one React for both sides.
          paths: {
            '@/*': [path.join(miti, 'src', '*')],
            react: [path.join(types, 'react')],
            'react/*': [path.join(types, 'react', '*')],
          },
        },
        files: [path.join(dir, 'check.ts')],
        // Only what the check imports, not the rest of MITI.
        include: [],
      },
      null,
      2
    )
  );
  const result = spawnSync(process.execPath, [tsc, '-p', path.join(dir, 'tsconfig.json')], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    console.error(result.stdout || result.stderr);
    fail(`MITI at ${miti} does not provide @miti/sdk as index.d.ts declares it`);
  }
  console.log(
    `MITI at ${miti} provides everything @miti/sdk ${JSON.parse(fs.readFileSync(path.join(sdk, 'package.json'), 'utf8')).version} declares.`
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
