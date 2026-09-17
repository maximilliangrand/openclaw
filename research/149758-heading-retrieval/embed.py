"""Real local embeddings only; reads the frozen synthetic corpus and chunk receipt."""
import argparse, hashlib, json, pathlib, time, urllib.request

p=argparse.ArgumentParser()
p.add_argument('--model',required=True)
p.add_argument('--label',required=True)
p.add_argument('--base-url',default='http://127.0.0.1:11439')
args=p.parse_args()
root=pathlib.Path(__file__).resolve().parent
corpus_bytes=(root/'corpus.json').read_bytes()
protocol=json.loads((root/'protocol.json').read_text())
assert hashlib.sha256(corpus_bytes).hexdigest()==protocol['corpusSha256']
corpus=json.loads(corpus_bytes)
chunks=json.loads((root/'chunks.json').read_text())['baseline']
requests=[]
if args.label=='qwen':
    docs=[c['embeddingInput']['text'] for c in chunks]
    groups={'documents':docs,'bare_queries':[q['text'] for q in corpus['queries']],
            'instruct_queries':['Instruct: '+protocol['queryInstruction']+'\nQuery:'+q['text'] for q in corpus['queries']]}
else:
    groups={'documents':['search_document: '+c['embeddingInput']['text'] for c in chunks],
            'queries':['search_query: '+q['text'] for q in corpus['queries']]}
started=time.time()
result={'model':args.model,'sourceSha':protocol['sourceSha'],'corpusSha256':protocol['corpusSha256'],'groups':{},'receipts':[]}
for group,texts in groups.items():
    vectors=[]
    for offset in range(0,len(texts),8):
        batch=texts[offset:offset+8]
        data=json.dumps({'model':args.model,'input':batch,'truncate':False,'keep_alive':'1m',
                         'options':{'num_ctx':2048,'num_thread':2}}).encode()
        req=urllib.request.Request(args.base_url+'/api/embed',data=data,headers={'Content-Type':'application/json'})
        with urllib.request.urlopen(req,timeout=120) as response: body=json.load(response)
        assert len(body['embeddings'])==len(batch)
        vectors.extend(body.pop('embeddings'))
        result['receipts'].append({'group':group,'offset':offset,'count':len(batch),**body})
        print(group,offset+len(batch),'/',len(texts),flush=True)
    result['groups'][group]={'texts':texts,'vectors':vectors}
result['elapsedSeconds']=time.time()-started
result['completedAt']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
(root/('embeddings-'+args.label+'.json')).write_text(json.dumps(result)+'\n')
print('DONE',args.label,result['elapsedSeconds'],flush=True)
