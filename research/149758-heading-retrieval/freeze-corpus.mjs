// All content is synthetic. Run before embedding; never adapt it to observed scores.
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const sections = [
  ['Travel', [
    ['travel-seat','For overnight flights, Mira prefers an aisle seat away from the lavatory.','Which seat should I choose for Mira on a red-eye flight?','paraphrase'],
    ['travel-hotel','During Berlin visits, Mira stays at the Lindenhof Hotel near the east station.','Where does Mira usually stay in Berlin?','fact'],
    ['travel-id','The luggage service booking reference is 48392017.','48392017','numeric'],
  ]],
  ['Project Atlas', [
    ['atlas-owner','The Atlas migration owner is Devon Chen; questions about the cutover go to Devon.','Who owns the Atlas migration?','fact'],
    ['atlas-date','Atlas production cutover is scheduled for 2026-11-08 at 02:00 UTC.','When is the production switchover for Atlas?','paraphrase'],
    ['atlas-port','Atlas staging listens on TCP port 7419.','7419','numeric'],
  ]],
  ['Finance', [
    ['finance-map','Invoices from Northstar Hosting map to account 6210 for the synthetic Acorn account.','Which account should Northstar Hosting invoices use for Acorn?','fact'],
    ['finance-terms','Blue Finch Studio invoices are due forty-five days after their issue date.','How long do we have to pay Blue Finch Studio?','paraphrase'],
    ['finance-code','The bookkeeping export code for Blue Finch Studio is BF-029184.','BF-029184','identifier'],
  ]],
  ['Accessibility', [
    ['access-captions','Sam needs captions enabled for every remote meeting because speech alone is difficult to follow.','What meeting accommodation does Sam need?','paraphrase'],
    ['access-motion','Sam prefers reduced motion and no autoplaying animations in the dashboard.','Which animation preference should we use for Sam?','fact'],
    ['access-contrast','Use the high-contrast interface theme for Sam during screen sharing.','What theme does Sam want for screen sharing?','fact'],
  ]],
  ['Incident response', [
    ['incident-recovery','For a stalled Oriole import, pause its scheduler before retrying the failed batch once.','How should I recover a stuck Oriole import?','paraphrase'],
    ['incident-escalation','If the Oriole import fails twice, escalate to the data platform on-call instead of retrying again.','Who gets an Oriole import that failed twice?','fact'],
    ['incident-id','The synthetic Oriole outage incident number is 90715264.','90715264','numeric'],
  ]],
  ['Food preferences', [
    ['food-diet','Priya is vegan and does not eat honey.','Can I order a honey dessert for Priya?','paraphrase'],
    ['food-drink','Priya drinks decaffeinated coffee after noon.','What coffee does Priya want in the afternoon?','paraphrase'],
    ['food-allergy','Priya is allergic to cashews.','Which nut must Priya avoid?','fact'],
  ]],
  ['Release process', [
    ['release-check','The Juniper release checklist requires a canary deployment followed by a fifteen-minute error-rate check.','What validation follows a Juniper canary deploy?','paraphrase'],
    ['release-owner','Taylor is responsible for approving Juniper production releases.','Who approves a Juniper release?','fact'],
    ['release-tag','The synthetic Juniper rollback reference is release-2037-amber.','release-2037-amber','identifier'],
  ]],
  ['Support routing', [
    ['support-priority','A customer unable to export their records gets priority two unless data is being lost.','How urgent is a blocked record export without data loss?','paraphrase'],
    ['support-hours','The North team covers support from 07:00 to 15:00 UTC on weekdays.','When is the North support team available?','fact'],
    ['support-code','Support queue ticket 58273016 belongs to the North team.','58273016','numeric'],
  ]],
  ['Short facts', [
    ['short-timezone','TZ: UTC.','What is the saved timezone?','short_fact'],
    ['short-language','Locale: de-AT.','What is the saved locale?','short_fact'],
    ['short-size','Size: XS.','What clothing size is saved?','short_fact'],
  ]],
];
const lines = ['# Curated memory', ''];
const facts = [];
const queries = [];
for (const [heading, rows] of sections) {
  lines.push('## ' + heading, '');
  for (const [id, text, query, category] of rows) {
    const annotations = id.startsWith('atlas-') ? ' <!-- project: github.com/example/atlas --> <!-- importance: 7 -->' : '';
    const startLine = lines.length + 1;
    lines.push('- ' + text + annotations);
    facts.push({ id, path: 'MEMORY.md', startLine, endLine: startLine, kind: 'body' });
    queries.push({ id: 'q-' + id, text: query, relevantFacts: [id], category });
  }
}
// Meaningful heading-only text is a deliberate negative control, not labelled noise.
for (const [id, heading, body, question] of [
  ['heading-deadline','Cedar deadline: 2026-10-19','Cedar is coordinated by Ada.','When is Cedar due?'],
  ['heading-status','Birch status: CANCELLED','Do not schedule further Birch work.','What is the status of Birch?'],
  ['heading-id','Warehouse pickup code: 61820473','Show the code at reception.','61820473'],
]) {
  const startLine = lines.length + 1;
  lines.push('## ' + heading, '- ' + body);
  facts.push({ id, path: 'MEMORY.md', startLine, endLine: startLine, kind: 'heading' });
  queries.push({ id: 'q-' + id, text: question, relevantFacts: [id], category: 'heading_fact' });
}
lines.push('### Project: github.com/example/beta', '', '<!-- openclaw-memory-promotion:memory:beta -->');
const annotatedStart = lines.length + 1;
lines.push('- Beta deployment uses region eu-north-1. <!-- project: github.com/example/beta --> <!-- trigger: Beta deployment --> <!-- importance: 9 -->');
lines.push('- Alpha deployment uses region us-west-2. <!-- project: github.com/example/alpha --> <!-- trigger: Alpha deployment --> <!-- importance: 4 -->');
facts.push({id:'beta-region',path:'MEMORY.md',startLine:annotatedStart,endLine:annotatedStart,kind:'body'});
facts.push({id:'alpha-region',path:'MEMORY.md',startLine:annotatedStart+1,endLine:annotatedStart+1,kind:'body'});
queries.push({id:'q-beta-region',text:'Which region hosts Beta deployment?',relevantFacts:['beta-region'],category:'annotation'});
queries.push({id:'q-alpha-region',text:'Which region hosts Alpha deployment?',relevantFacts:['alpha-region'],category:'annotation'});
const documents = [{path:'MEMORY.md',content:lines.join('\n')+'\n',curatedRoot:true,originClass:'owner'}];
for (const [path, content, id, question, category] of [
  ['USER.md','## Personal preference\n- Replies in German.\n','user-language','In which language should I reply?','short_fact'],
  ['memory/standalone.md','## Fire exit: north stairwell\n','standalone-heading','Where is the fire exit?','heading_fact'],
  ['memory/ordinary.md','## Retention policy\nThe synthetic archive keeps exports for fourteen days and then removes them.\n','ordinary-prose','How long does the synthetic archive retain exports?','ordinary'],
  ['memory/code.md','```markdown\n# heading inside a code example\n```\nThe markdown sample is the documented test fixture.\n','code-example','What is in the documented Markdown fixture?','ordinary'],
]) {
  documents.push({path,content,curatedRoot:path==='USER.md',originClass:'owner'});
  facts.push({id,path,startLine:path==='USER.md'?2:1,endLine:content.trimEnd().split('\n').length,kind:path.includes('standalone')?'heading':'body'});
  queries.push({id:'q-'+id,text:question,relevantFacts:[id],category});
}
// Out-of-corpus questions measure header distraction only; they are excluded from recall/MRR.
for (const [i,text] of ['How do I repair a bicycle chain?','What is the boiling point of ethanol?','87261903','Who composed this piano sonata?'].entries()) {
  queries.push({id:'q-unanswerable-'+i,text,relevantFacts:[],category:'unanswerable'});
}
const corpus={schemaVersion:1,documents,facts,queries};
const serialized=JSON.stringify(corpus,null,2)+'\n';
mkdirSync('corpus',{recursive:true});
for (const doc of documents) {mkdirSync('corpus/'+doc.path.split('/').slice(0,-1).join('/'),{recursive:true});writeFileSync('corpus/'+doc.path,doc.content);}
writeFileSync('corpus.json',serialized);
const protocol={
  frozenAt:new Date().toISOString(),sourceSha:process.env.SOURCE_SHA,
  corpusSha256:createHash('sha256').update(serialized).digest('hex'),
  chunking:{tokens:400,overlap:40},
  experiment:'Filter only chunks whose nonblank lines all match ATX headings; do not merge or edit retained chunks. This is a policy experiment, not a product patch. Known heading-fact negative controls are included.',
  models:[{name:'qwen3-embedding:0.6b',modes:['bare','instruct']},{name:'nomic-embed-text:latest',modes:['search prefixes']}],
  queryInstruction:'Given a search query, retrieve relevant personal memory passages that answer the query',
  metrics:['recall@1','recall@3','recall@5','MRR','heading-only share@3','irrelevant heading-only share@3'],
  controls:['short factual notes','heading-only facts','numeric identifiers','ordinary prose','code fence','per-entry project/trigger/importance annotations','citation ranges','provenance'],
  selection:'Manually authored synthetic corpus and judgments, frozen before embedding. No tuning after outcomes. One relevant fact per answerable query. No claim to reproduce reporter corpus or exact runtime.',
};
writeFileSync('protocol.json',JSON.stringify(protocol,null,2)+'\n');
console.log(JSON.stringify({documents:documents.length,facts:facts.length,queries:queries.length,...protocol},null,2));
