import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const root=resolve(process.env.OPENCLAW_SOURCE??'../openclaw-memory');
const {prepareMemoryIndexChunks}=await import(pathToFileURL(resolve(root,'extensions/memory-core/src/memory/manager-index-preparation.ts')));
const {chunkMarkdown, remapChunkLines}=await import(pathToFileURL(resolve(root,'packages/memory-host-sdk/src/host/markdown-chunks.ts')));
const corpusText=readFileSync('corpus.json','utf8');
const corpus=JSON.parse(corpusText);
const protocol=JSON.parse(readFileSync('protocol.json','utf8'));
assert.equal(execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),protocol.sourceSha);
assert.equal(createHash('sha256').update(corpusText).digest('hex'),protocol.corpusSha256);
const headingOnly=text=>text.split('\n').filter(line=>line.trim()).every(line=>/^#{1,6}(?:\s|$)/u.test(line));
const baseline=[];
for(const doc of corpus.documents){
  const prepared=prepareMemoryIndexChunks({
    entry:{path:doc.path,mtimeMs:1700000000000},source:'memory',content:doc.content,
    pathClassification:{curatedRoot:doc.curatedRoot,originClass:doc.originClass},
    chunking:protocol.chunking,provider:{id:'local',maxInputTokens:8192},hardMaxInputTokens:8192,
  });
  for(const chunk of prepared.chunks){
    const id=doc.path+':'+chunk.startLine+'-'+chunk.endLine;
    const relevantFacts=corpus.facts.filter(f=>f.path===doc.path && chunk.startLine<=f.startLine && chunk.endLine>=f.endLine).map(f=>f.id);
    baseline.push({id,path:doc.path,...chunk,headingOnly:headingOnly(chunk.text),relevantFacts});
  }
}
const experiment=baseline.filter(chunk=>!chunk.headingOnly);
// This policy only filters: every retained byte, citation, annotation and provenance must match.
for(const retained of experiment) assert.deepEqual(retained,baseline.find(chunk=>chunk.id===retained.id));
for(const fact of corpus.facts.filter(f=>f.kind==='body')) assert(experiment.some(chunk=>chunk.relevantFacts.includes(fact.id)),fact.id+' must remain retrievable');
const beta=experiment.find(chunk=>chunk.relevantFacts.includes('beta-region'));
const alpha=experiment.find(chunk=>chunk.relevantFacts.includes('alpha-region'));
assert.equal(beta.projectKey,'github.com/example/beta');
assert.equal(beta.importance,9);
assert.equal(beta.triggers,'Beta deployment');
assert.equal(alpha.projectKey,'github.com/example/alpha');
assert.equal(alpha.importance,4);
assert.equal(alpha.triggers,'Alpha deployment');
assert(!beta.text.includes('Alpha deployment'));
assert(!alpha.text.includes('Beta deployment'));
assert.equal(beta.provenance.originClass,'owner');
assert.equal(beta.provenance.observedAt,1700000000000);
// Additional actual-source checks: fragmented entries retain their annotation boundaries;
// session source line maps and the source-kind provenance policy are unchanged.
const longContent='## Scope\n- '+('Synthetic Beta retained fact. '.repeat(180))+' <!-- project: github.com/example/beta -->\n- Tiny alpha. <!-- project: github.com/example/alpha -->';
const long=prepareMemoryIndexChunks({entry:{path:'MEMORY.md',mtimeMs:42},source:'memory',content:longContent,pathClassification:{curatedRoot:true,originClass:'owner'},chunking:{tokens:40,overlap:4},hardMaxInputTokens:8192});
const longKept=long.chunks.filter(c=>!headingOnly(c.text));
assert(longKept.filter(c=>c.projectKey==='github.com/example/beta').length>5);
assert(longKept.every(c=>c.entryStartLine===2 || c.entryStartLine===3));
assert.equal(longKept.at(-1).projectKey,'github.com/example/alpha');
const mapped=chunkMarkdown('First line\nSecond line',{tokens:400,overlap:0});
remapChunkLines(mapped,[10,30]);
assert.equal(mapped[0].startLine,10);assert.equal(mapped[0].endLine,30);
const receipt={sourceSha:protocol.sourceSha,corpusSha256:protocol.corpusSha256,baselineChunks:baseline.length,experimentChunks:experiment.length,removed:baseline.filter(c=>c.headingOnly).map(c=>({id:c.id,text:c.text,relevantFacts:c.relevantFacts})),retainedExactMatch:true,bodyFactsPreserved:corpus.facts.filter(f=>f.kind==='body').length,projectTriggerImportancePreserved:true,provenancePreserved:true,longEntryFragmentCount:longKept.length,sourceLineRemapPreserved:true,limits:'Assertions cover supplied synthetic fixtures and unchanged retained objects. They do not prove semantic policy safety; deliberately meaningful heading-only facts are removed.'};
writeFileSync('chunks.json',JSON.stringify({baseline,experiment},null,2)+'\n');
writeFileSync('preparation-receipt.json',JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt,null,2));
