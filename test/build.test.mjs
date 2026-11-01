import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { strFromU8, unzipSync } from 'fflate';
import { buildWidget, uploadWidget } from '../lib/build.mjs';
import { parseWidgetManifest } from '../lib/manifest.mjs';

const fixture = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixture');
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'miti-widget-'));

/** A copy of the fixture widget with some of its files replaced. */
function widget(files = {}) {
  const folder = temp();
  fs.cpSync(fixture, folder, { recursive: true });
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(folder, name), text);
  return folder;
}

test('builds a package MITI imports: manifest, one module reading MITI’s shared modules, README', async () => {
  const outDir = temp();
  const { file, manifest } = await buildWidget(fixture, { outDir });
  assert.equal(path.basename(file), 'test.fixture-0.1.0.miti-widget');
  assert.equal(manifest.main, 'index.js');

  const files = unzipSync(fs.readFileSync(file));
  assert.deepEqual(Object.keys(files).sort(), ['README.md', 'index.js', 'manifest.json']);
  assert.deepEqual(JSON.parse(strFromU8(files['manifest.json'])), {
    id: 'test.fixture',
    name: 'Fixture',
    version: '0.1.0',
    main: 'index.js',
    miti: { apiVersion: 1 },
  });
  const code = strFromU8(files['index.js']);
  // The minifier may write window.__MITI_MODULES__["react"] as window.__MITI_MODULES__.react.
  for (const name of ['react', 'react/jsx-runtime', '@miti/sdk'])
    assert.ok(
      code.includes(`__MITI_MODULES__[${JSON.stringify(name)}]`) ||
        code.includes(`__MITI_MODULES__.${name}`),
      name
    );
  // Everything else, e.g. the lucide-react icon, is bundled: the module imports nothing.
  assert.doesNotMatch(code, /\bimport\s*[{*\w]|\bfrom\s*["']/);
  assert.match(code, /export\s*\{/);
});

test('reports what is wrong with the manifest or the code', async () => {
  await assert.rejects(
    buildWidget(widget({ 'manifest.json': '{"id": "Bad", "name": "x", "version": "1.0.0"}' })),
    /manifest\.json: "id" must be lowercase/
  );
  await assert.rejects(
    buildWidget(
      widget({
        'manifest.json': '{"id": "a", "name": "A", "version": "1.0.0", "miti": {"apiVersion": 2}}',
      })
    ),
    /needs widget API 2/
  );
  const client = widget();
  fs.writeFileSync(
    path.join(client, 'src', 'index.tsx'),
    "import { createRoot } from 'react-dom/client';\nexport default createRoot;\n"
  );
  await assert.rejects(buildWidget(client), /react-dom\/client cannot be used/);
  const broken = widget();
  fs.writeFileSync(path.join(broken, 'src', 'index.tsx'), 'export default {');
  await assert.rejects(buildWidget(broken), /index\.tsx:1:/);
});

test('manifest checks match MITI’s', () => {
  assert.throws(() => parseWidgetManifest({ id: 'a', name: 'A', version: '1.0.0' }), /apiVersion/);
  assert.throws(
    () =>
      parseWidgetManifest({
        id: 'a',
        name: 'A',
        version: '1.0.0',
        main: '../x.js',
        miti: { apiVersion: 1 },
      }),
    /"main"/
  );
  assert.throws(
    () =>
      parseWidgetManifest({
        id: 'a',
        name: 'A',
        version: '1.0.0',
        homepage: 'javascript:alert(1)',
        miti: { apiVersion: 1 },
      }),
    /"homepage"/
  );
});

test('imports a package into MITI as the Widgets view does', async (t) => {
  const received = [];
  const server = http.createServer((request, response) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      received.push({
        url: request.url,
        type: request.headers['content-type'],
        size: Buffer.concat(chunks).length,
      });
      const ok = request.headers['content-type'] === 'application/octet-stream';
      response.writeHead(ok ? 201 : 415, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(ok ? { id: 'test.fixture' } : { error: 'wrong type' }));
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const { archive } = await buildWidget(fixture, { outDir: temp() });
  const url = `http://127.0.0.1:${server.address().port}`;
  assert.deepEqual(await uploadWidget(url, archive), { id: 'test.fixture' });
  assert.deepEqual(received, [
    { url: '/api/widgets', type: 'application/octet-stream', size: archive.byteLength },
  ]);
  await assert.rejects(uploadWidget('http://127.0.0.1:9', archive), /MITI is not answering/);
});
