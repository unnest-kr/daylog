// Dedicated append-only MCP connector for the single page authorized by user.
import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {ListToolsRequestSchema,CallToolRequestSchema,McpError,ErrorCode} from '@modelcontextprotocol/sdk/types.js';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {WEEKLY_PAGE_ID,WEEKLY_PAGE_URL} from '../server/weekly.mjs';
import {join} from 'node:path';
import {readBridgeConfig,jobsDirectory,evidenceDirectory} from './runtime.mjs';
const config=readBridgeConfig();
config.args=config.args.filter((v,i,a)=>v!=='--ignore-tool'&&a[i-1]!=='--ignore-tool');
const transport=new StdioClientTransport({...config,env:{...process.env,...config.env},stderr:'inherit'});
const remote=new Client({name:'Daylog authorized weekly report writer',version:'1.0'},{capabilities:{}});
await remote.connect(transport,{timeout:120000});
const server=new Server({name:'daylog-weekly-append-only',version:'1.0'},{capabilities:{tools:{}}});
const textResult=value=>({content:[{type:'text',text:JSON.stringify(value)}]});
const body=result=>(result.content??[]).filter(x=>x.type==='text').map(x=>x.text).join('\n');
const unwrap=result=>{if(result.isError)throw Error(body(result));const raw=body(result);try{return JSON.parse(raw);}catch{return {text:raw};}};
server.setRequestHandler(ListToolsRequestSchema,async()=>({tools:[{
 name:'publish_weekly_report',description:'Daylog 서버가 저장한 주간보고를 승인된 Notion 페이지에 추가합니다. 같은 대화의 수정본은 이 도구가 전에 작성한 영역만 교체합니다. 대상과 본문은 고정되며 저장을 재조회하고 중복 추가하지 않습니다.',
 inputSchema:{type:'object',properties:{job_id:{type:'string',pattern:'^[0-9a-f]{64}$'}},required:['job_id'],additionalProperties:false}
}]}));
server.setRequestHandler(CallToolRequestSchema,async request=>{
 try{
  if(request.params.name!=='publish_weekly_report')throw Error('Unsupported tool');
  const args=request.params.arguments;
  if(Object.keys(args??{}).some(k=>k!=='job_id') || !/^[0-9a-f]{64}$/.test(args?.job_id??''))throw Error('A saved Daylog job ID is required');
  const id=args.job_id;
  const job=JSON.parse(readFileSync(join(jobsDirectory,`${id}.json`),'utf8'));
  if(job.jobId!==id || job.pageId!==WEEKLY_PAGE_ID || createHash('sha256').update(job.markdown).digest('hex')!==job.contentSha256)throw Error('Saved job integrity check failed');
  const marker=`DAYLOG-WEEKLY-${id}`;
  const before=unwrap(await remote.callTool({name:'notion-fetch',arguments:{id:WEEKLY_PAGE_ID}},undefined,{timeout:90000}));
  if(before.truncated || before.unknown_block_count>0)throw Error('Target page content is incomplete');
  const beforeText=before.text??'';
  let alreadyPublished=beforeText.includes(marker);
  let update;let replacedJobId=null;
  let previous;
   for(const match of beforeText.matchAll(/연계 검증 ID DAYLOG-WEEKLY-([a-f0-9]{64})/g)){
    if(match[1]===id)continue;
    try{const old=JSON.parse(readFileSync(join(jobsDirectory,`${match[1]}.json`),'utf8'));if(old.conversationId===job.conversationId){
     const start=beforeText.lastIndexOf('## Daylog 주간보고 통합 검수',match.index);
     const end=match.index+match[0].length;
     const text=beforeText.slice(start,end);
     if(start>=0&&text.includes(`Daylog 대화 ID ${job.conversationId}`)&&!/<(?:page|database)\s+url=/.test(text))previous={text,jobId:old.jobId};
    }}catch{}
   }
  if(!alreadyPublished||previous){
   // Read the provider contract before using its Markdown write tool.
   unwrap(await remote.callTool({name:'notion-fetch',arguments:{id:'notion://docs/notion-flavored-markdown-spec'}},undefined,{timeout:90000}));
   const arguments_={page_id:WEEKLY_PAGE_ID,allow_async:false,...(previous?{command:'update_content',content_updates:[{old_str:previous.text,new_str:alreadyPublished?'':job.markdown.replace(/^\s*---\s*/, '').trim()}]}:{command:'insert_content',content:job.markdown,position:{type:'end'}})};
   update=unwrap(await remote.callTool({name:'notion-update-page',arguments:arguments_},undefined,{timeout:120000}));
   if(previous)replacedJobId=previous.jobId;
   if(update.type==='async_task' || update.async_task || update.task_id)throw Error('Notion queued this update. Wait for completion and retry to verify; do not blindly append again.');
  }
  // Verify the remote marker, source IDs and preserved links before recording a receipt.
  const afterResult=await remote.callTool({name:'notion-fetch',arguments:{id:WEEKLY_PAGE_ID}},undefined,{timeout:90000});
  const after=unwrap(afterResult);const saved=after.text??'';
  if(after.truncated || after.unknown_block_count>0)throw Error('Saved Notion page is truncated');
  if(!saved.includes(marker)||job.sourceIds.some(source=>!saved.includes(source)))throw Error('Notion readback lacks the job marker or report sources');
  const oldLinks=[...beforeText.matchAll(/<(?:page|database)\s+url="([^"]+)"/g)].map(m=>m[1]);
  if(oldLinks.some(url=>!saved.includes(url)))throw Error('Existing child page or database references changed');
  const receipt={verified:true,jobId:id,pageId:WEEKLY_PAGE_ID,pageUrl:WEEKLY_PAGE_URL,contentSha256:job.contentSha256,sourceCount:job.sourceIds.length,alreadyPublished,replacedJobId,tool:'publish_weekly_report',upstreamTools:['notion-fetch',...(update?['notion-update-page'] : []),'notion-fetch'],existingChildLinksPreserved:oldLinks.length,verifiedAt:new Date().toISOString(),warnings:update?.warnings??[]};
  writeFileSync(join(jobsDirectory,`${id}.receipt.json`),JSON.stringify(receipt,null,2));
  mkdirSync(evidenceDirectory,{recursive:true});
  writeFileSync(join(evidenceDirectory,`${id}.notion.json`),JSON.stringify(afterResult,null,2));
  return textResult(receipt);
 }catch(error){return {isError:true,content:[{type:'text',text:error.message}]};}
});
await server.connect(new StdioServerTransport());
const close=async()=>{await server.close().catch(()=>{});await remote.close().catch(()=>{});await transport.close().catch(()=>{});process.exit(0);};
process.stdin.once('end',close);process.once('SIGTERM',close);process.once('SIGINT',close);
