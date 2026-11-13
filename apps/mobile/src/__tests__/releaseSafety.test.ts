/**
 * Release safety: demo fixtures (placeholder, unlicensed scripture) must be reachable only behind the DEMO_MODE build constant.
 * The bundle check in docs/ANDROID_BLOCKING.md confirms the same on a real non-demo Metro bundle.
 */
import * as fs from 'fs';
import * as path from 'path';

const src = path.join(__dirname, '..');
const files: string[] = [];
const walk = (d: string) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(e.name)) files.push(p);
  }
};
walk(src);
const isTest = (f: string) => /\.test\.tsx?$/.test(f) || f.includes('__tests__');
const rel = (f: string) => path.relative(src, f).replace(/\\/g, '/');

describe('demo code isolation', () => {
  it('only demo files import the scripture fixtures', () => {
    const offenders = files.filter((f) => !isTest(f) && !rel(f).startsWith('demo/') && /from ['"][./]*(\.\.\/)*demo\/fixtures['"]/.test(fs.readFileSync(f, 'utf8')));
    expect(offenders.map(rel)).toEqual([]);
  });

  it('the app reaches demo parts only through a require guarded by the DEMO_MODE constant', () => {
    const importers = files.filter((f) => !isTest(f) && !rel(f).startsWith('demo/') && /demo\/demoParts/.test(fs.readFileSync(f, 'utf8')));
    expect(importers.map(rel)).toEqual(['services.tsx']);
    const text = fs.readFileSync(path.join(src, 'services.tsx'), 'utf8');
    expect(text).toMatch(/if \(process\.env\.DEMO_MODE === '1'\) \{\s*\n\s*\/\/ eslint-disable-next-line[^\n]*\n\s*const \{ createDemoParts \} = require\('\.\/demo\/demoParts'\)/);
  });

  it('DEMO_MODE is a build time constant that is off unless the environment says 1', () => {
    expect(fs.readFileSync(path.join(src, 'services.tsx'), 'utf8')).toContain("export const DEMO_MODE = process.env.DEMO_MODE === '1';");
  });

  it('demo fixtures carry the DEV ONLY licence label', () => {
    expect(fs.readFileSync(path.join(src, 'demo/fixtures.ts'), 'utf8')).toMatch(/DEV ONLY/);
  });
});
