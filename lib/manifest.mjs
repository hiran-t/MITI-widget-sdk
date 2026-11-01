// The checks MITI runs on a widget's manifest.json when it imports the widget
// (src/lib/widgets/manifest.ts in MITI); kept the same here so a package that builds also imports.

/** The widget API these tools build for. */
export const WIDGET_API_VERSION = 1;
export const WIDGET_FILE_EXTENSION = '.miti-widget';

const ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const SEGMENT = /^[\w@+-][\w.@+-]*$/;

/** A path inside a package: relative, with plain names, and never leaving the package. */
export function isSafeRelativePath(value) {
  if (typeof value !== 'string' || !value || value.length > 200) return false;
  return value.split('/').every((part) => SEGMENT.test(part) && part !== '..' && part !== '.');
}

function text(value, field, max, required = false) {
  if (value === undefined && !required) return undefined;
  if (typeof value !== 'string' || !value.trim()) throw new Error(`"${field}" must be a text`);
  if (value.length > max) throw new Error(`"${field}" is longer than ${max} characters`);
  return value.trim();
}

/** The manifest, checked; throws an Error that says what is wrong. */
export function parseWidgetManifest(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('manifest.json must hold an object');
  const id = text(value.id, 'id', 100, true);
  if (!ID.test(id))
    throw new Error('"id" must be lowercase words joined by dots or dashes, e.g. acme.vision');
  const version = text(value.version, 'version', 50, true);
  if (!VERSION.test(version)) throw new Error('"version" must look like 1.0.0');
  const main = value.main ?? 'index.js';
  if (!isSafeRelativePath(main) || !/\.m?js$/.test(main))
    throw new Error('"main" must be a .js file inside the package');
  const homepage = text(value.homepage, 'homepage', 300);
  if (homepage && !/^https?:\/\//.test(homepage))
    throw new Error('"homepage" must be an http or https address');
  const apiVersion = value.miti?.apiVersion;
  if (typeof apiVersion !== 'number' || !Number.isInteger(apiVersion))
    throw new Error('"miti.apiVersion" must be a whole number');
  if (apiVersion !== WIDGET_API_VERSION)
    throw new Error(
      `the widget needs widget API ${apiVersion}; these tools build for API ${WIDGET_API_VERSION}`
    );
  return {
    id,
    name: text(value.name, 'name', 80, true),
    version,
    description: text(value.description, 'description', 500),
    author: text(value.author, 'author', 200),
    homepage,
    license: text(value.license, 'license', 100),
    main,
    miti: { apiVersion },
  };
}
