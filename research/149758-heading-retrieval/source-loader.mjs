// Research-only resolution adapter. It does not change imported source bytes.
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = resolve(process.env.OPENCLAW_SOURCE ?? '../openclaw-memory');
registerHooks({
  resolve(specifier, context, nextResolve) {
    let target;
    if (specifier.startsWith('@openclaw/normalization-core/')) {
      target = resolve(root, 'packages/normalization-core/src', specifier.split('/').at(-1) + '.ts');
    } else if (specifier === 'openclaw/plugin-sdk/memory-core-host-engine-indexing') {
      target = resolve(root, 'src/plugin-sdk/memory-core-host-engine-indexing.ts');
    } else if (specifier === 'openclaw/plugin-sdk/string-coerce-runtime') {
      target = fileURLToPath(new URL('./string-source-facade.mjs', import.meta.url));
    } else if (specifier === 'openclaw/plugin-sdk/memory-core-host-engine-storage') {
      // Hybrid ranking imports one runtime constant from this broad facade.
      // Resolve that unchanged constant at its actual owner, avoiding database boot.
      target = resolve(root, 'packages/memory-host-sdk/src/host/curated-annotations.ts');
    } else if (specifier.startsWith('.') && specifier.endsWith('.js') && context.parentURL?.startsWith('file:')) {
      const candidate = fileURLToPath(new URL(specifier.slice(0, -3) + '.ts', context.parentURL));
      if (existsSync(candidate)) target = candidate;
    }
    if (target) return { url: pathToFileURL(target).href, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
