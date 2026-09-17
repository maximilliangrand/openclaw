import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
const root=resolve(process.env.OPENCLAW_SOURCE??'../openclaw-memory');
const {mergeHybridResults}=await import(pathToFileURL(resolve(root,'extensions/memory-core/src/memory/hybrid.ts')));
const {buildFtsQuery,bm25RankToScore}=await import(pathToFileURL(resolve(root,'extensions/memory-core/src/memory/keyword-query.ts')));
const corpus=JSON.parse(readFileSync('corpus.json','utf8'));
const chunks=JSON.parse(readFileSync('chunks.json','utf8'));
const protocol=JSON.parse(readFileSync('protocol.json','utf8'));
const qwen=JSON.parse(readFileSync('embeddings-qwen.json','utf8'));
const nomic=JSON.parse(readFileSync('embeddings-nomic.json','utf8'));
assert.equal(execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),protocol.sourceSha);
assert.equal(createHash('sha256').update(readFileSync('corpus.json')).digest('hex'),protocol.corpusSha256);
for(const cached of [qwen,nomic]) {
  assert.equal(cached.sourceSha,protocol.sourceSha);
  assert.equal(cached.corpusSha256,protocol.corpusSha256);
}
const cosine=(a,b)=>{let dot=0,aa=0,bb=0;for(let i=0;i<a.length;i++){dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i];}return dot/Math.sqrt(aa*bb);};
const variants=[['qwen_bare',qwen,'bare_queries'],['qwen_instruct',qwen,'instruct_queries'],['nomic_prefixes',nomic,'queries']];
const cells=[];
for(const [modelLabel,embedding,queryGroup] of variants){
  for(const policy of ['baseline','experiment']){
    const selected=chunks[policy];
    const db=new DatabaseSync(':memory:');
    db.exec('CREATE VIRTUAL TABLE chunks_fts USING fts5(id UNINDEXED,text,tokenize="unicode61")');
    const insert=db.prepare('INSERT INTO chunks_fts(id,text) VALUES (?,?)');
    for(const c of selected) insert.run(c.id,c.text);
    const allRows=[];
    for(let qi=0;qi<corpus.queries.length;qi++){
      const query=corpus.queries[qi];
      const vectors=selected.map(chunk=>{
        const index=chunks.baseline.findIndex(c=>c.id===chunk.id);
        return {chunk,score:cosine(embedding.groups[queryGroup].vectors[qi],embedding.groups.documents.vectors[index])};
      }).sort((a,b)=>b.score-a.score||a.chunk.id.localeCompare(b.chunk.id));
      const exactFts=buildFtsQuery(query.text);
      const textRows=exactFts?db.prepare('SELECT id,bm25(chunks_fts) AS rank FROM chunks_fts WHERE chunks_fts MATCH ? ORDER BY rank LIMIT 20').all(exactFts):[];
      const toSearch=(chunk,score)=>({id:chunk.id,path:chunk.path,startLine:chunk.startLine,endLine:chunk.endLine,source:'memory',snippet:chunk.text,vectorScore:score,...(chunk.importance!==null?{importance:chunk.importance}:{}),...(chunk.projectKey?{projectKey:chunk.projectKey}:{}),...(chunk.triggers?{triggers:chunk.triggers}:{}),provenance:chunk.provenance});
      const keyword=textRows.map(row=>({...toSearch(selected.find(c=>c.id===row.id),0),textScore:bm25RankToScore(row.rank),hasBodyMatch:true}));
      const hybrid=await mergeHybridResults({vector:vectors.slice(0,20).map(({chunk,score})=>toSearch(chunk,score)),keyword,vectorWeight:.7,textWeight:.3,mmr:{enabled:false},temporalDecay:{enabled:false},nowMs:1700000000000});
      const rankings={dense:vectors.map(({chunk,score})=>({chunk,score})),hybrid:hybrid.map(row=>({chunk:selected.find(c=>c.path===row.path&&c.startLine===row.startLine&&c.endLine===row.endLine),score:row.score}))};
      for(const [ranking,rows] of Object.entries(rankings)){
        const relevant=row=>row.chunk.relevantFacts.some(f=>query.relevantFacts.includes(f));
        const first=rows.findIndex(relevant);
        const top3=rows.slice(0,3);
        allRows.push({id:query.id,text:query.text,category:query.category,answerable:query.relevantFacts.length>0,ranking,rank:first<0?null:first+1,recall1:first>=0&&first<1?1:0,recall3:first>=0&&first<3?1:0,recall5:first>=0&&first<5?1:0,rr:first<0?0:1/(first+1),headingShare3:top3.filter(r=>r.chunk.headingOnly).length/3,irrelevantHeadingShare3:top3.filter(r=>r.chunk.headingOnly&&!relevant(r)).length/3,top5:rows.slice(0,5).map(({chunk,score})=>({id:chunk.id,text:chunk.text,score,headingOnly:chunk.headingOnly,relevant:relevant({chunk})}))});
      }
    }
    const summaries=[];
    for(const ranking of ['dense','hybrid']){
      for(const group of ['all_answerable','body_only','heading_fact','short_fact','numeric','identifier','paraphrase','unanswerable']){
        const rows=allRows.filter(r=>r.ranking===ranking&&(group==='all_answerable'?r.answerable:group==='body_only'?r.answerable&&r.category!=='heading_fact':r.category===group));
        const mean=key=>rows.length?rows.reduce((n,row)=>n+row[key],0)/rows.length:null;
        summaries.push({ranking,group,n:rows.length,recall1:group==='unanswerable'?null:mean('recall1'),recall3:group==='unanswerable'?null:mean('recall3'),recall5:group==='unanswerable'?null:mean('recall5'),mrr:group==='unanswerable'?null:mean('rr'),headingShare3:mean('headingShare3'),irrelevantHeadingShare3:mean('irrelevantHeadingShare3'),...(group==='unanswerable'?{note:'No relevant item exists. Recall/MRR are undefined. Ranking always returns candidates without a score gate, so this is not an abstention or false-positive-rate measurement.'}:{})});
      }
    }
    cells.push({model:modelLabel,policy,summaries,queries:allRows});
    db.close();
  }
}
const results={sourceSha:protocol.sourceSha,corpusSha256:protocol.corpusSha256,completedAt:new Date().toISOString(),method:{dense:'Cosine ranking of actual locally generated embeddings; all chunks considered.',hybrid:'Actual current mergeHybridResults and keyword-query helpers; real in-memory SQLite FTS5 BM25;20 candidates per channel;.7 vector/.3 text;MMR and decay disabled;no active project boost;no score threshold. This is an isolated ranking experiment, not the full search RPC/runtime. Path matching, query expansion, triggers, sqlite-vec approximation and assistant answers are not exercised.'},cells};
writeFileSync('results.json',JSON.stringify(results,null,2)+'\n');
const header='model\tpolicy\tranking\tgroup\tn\tR@1\tR@3\tR@5\tMRR\theading@3\tirrelevant_heading@3';
const rows=cells.flatMap(cell=>cell.summaries.map(s=>[cell.model,cell.policy,s.ranking,s.group,s.n,...['recall1','recall3','recall5','mrr','headingShare3','irrelevantHeadingShare3'].map(k=>s[k]?.toFixed(4)??'NA')].join('\t')));
writeFileSync('metrics.tsv',[header,...rows].join('\n')+'\n');
console.log([header,...rows.filter(row=>row.includes('all_answerable')||row.includes('body_only')||row.includes('heading_fact'))].join('\n'));
