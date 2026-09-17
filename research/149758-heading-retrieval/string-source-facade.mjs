// Research-only lightweight facade; all implementations come from current source.
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=resolve(process.env.OPENCLAW_SOURCE??'../openclaw-memory');
const coerce=await import(pathToFileURL(resolve(root,'packages/normalization-core/src/string-coerce.ts')));
const normalization=await import(pathToFileURL(resolve(root,'packages/normalization-core/src/string-normalization.ts')));
export const normalizeLowercaseStringOrEmpty=coerce.normalizeLowercaseStringOrEmpty;
export const normalizeStringEntries=normalization.normalizeStringEntries;
