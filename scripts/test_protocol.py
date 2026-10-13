#!/usr/bin/env python3
"""Act as a host, log both directions, and assert real reverse-RPC behavior."""
import argparse, json, pathlib, queue, subprocess, threading, uuid
ROOT=pathlib.Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--binary');args=parser.parse_args()
command=[str(pathlib.Path(args.binary).resolve())] if args.binary else ['go','run','.']
p=subprocess.Popen(command,cwd=ROOT/'executas/mini-notes',stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,bufsize=1)
frames=queue.Queue();errors=[]
def reader():
    for line in p.stdout: frames.put(line)
def stderr():
    for line in p.stderr: errors.append(line)
threading.Thread(target=reader,daemon=True).start();threading.Thread(target=stderr,daemon=True).start()
(ROOT/'evidence').mkdir(exist_ok=True)
log=(ROOT/'evidence/protocol.jsonl').open('w')
def record(direction,frame): log.write(json.dumps({'direction':direction,'frame':frame},ensure_ascii=False)+'\n');log.flush()
def send(frame): record('host -> tool',frame);p.stdin.write(json.dumps(frame)+'\n');p.stdin.flush()
def receive():
    frame=json.loads(frames.get(timeout=45));record('tool -> host',frame);assert frame['jsonrpc']=='2.0';return frame
def request(i,method,params=None): send({'jsonrpc':'2.0','id':i,'method':method,'params':params or {}})
def invoke(i): request(i,'invoke',{'tool':'summarize','arguments':{'text':'明天跟进客户\n修复登录 bug'},'context':{'invoke_id':f'audit-{i}'}})
try:
    invoke(0);assert receive()['error']['code']==-32008
    request(1,'initialize',{'protocolVersion':'2.0'});r=receive();assert r['result']['client_capabilities']['sampling']=={}
    request(2,'describe');r=receive();assert r['result']['name']=='tool-mini-notes-summarizer';assert isinstance(r['result']['tools'][0]['parameters'],list)
    invoke(3);first=receive();assert first['method']=='sampling/createMessage';assert first['params']['metadata']['executa_invoke_id']=='audit-3';assert '修复登录 bug' in first['params']['messages'][0]['content']['text']
    # A second invoke and health must work while sampling #1 is pending.
    invoke(4);second=receive();request(5,'health');assert receive()['id']==5
    sentinel='HOST-ONLY-'+str(uuid.uuid4())
    send({'jsonrpc':'2.0','id':second['id'],'result':{'content':{'type':'text','text':sentinel},'model':'test-host'}})
    r=receive();assert r['id']==4 and r['result']['data']['summary']==sentinel
    send({'jsonrpc':'2.0','id':first['id'],'error':{'code':-32009,'message':'user denied','data':{'audit':True}}})
    r=receive();assert r['id']==3 and r['error']['code']==-32009 and r['error']['data']['audit']
    request(6,'invoke',{'tool':'summarize','arguments':{'text':' '}});assert receive()['error']['code']==-32602
    request(7,'initialize',{'protocolVersion':'1.1'});assert 'sampling' not in receive()['result']['client_capabilities']
    invoke(8);assert receive()['error']['code']==-32008
    p.stdin.write('{broken\n');p.stdin.flush();assert receive()['error']['code']==-32700
    request(9,'describe');assert receive()['id']==9
    p.stdin.close();assert p.wait(timeout=10)==0
    print('PASS: initialize, bare describe, concurrent reverse sampling, verbatim response, errors, v1 rejection, malformed input, continued service, EOF')
    print('Evidence: evidence/protocol.jsonl')
finally:
    if p.poll() is None: p.kill();p.wait()
    log.close()
