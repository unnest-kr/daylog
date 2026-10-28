import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';

export const WEEKLY_PAGE_ID = '4054587c9925805da1bfeb84deae06ab';
export const WEEKLY_PAGE_URL = `https://app.notion.com/p/${WEEKLY_PAGE_ID}`;
const digest = value => createHash('sha256').update(value).digest('hex');
export function normalizeWeeklyMarkdown(value) {
 const lines=value.replace(/^```(?:markdown|md)?\s*\n([\s\S]*)\n```\s*$/,'$1').split('\n');
 const out=[];let fence=null;
 for(let i=0;i<lines.length;i++){
  const line=lines[i];const marker=line.match(/^ {0,3}(`{3,}|~{3,})/);
  if(marker){if(!fence)fence={char:marker[1][0],length:marker[1].length};else if(new RegExp(`^ {0,3}${fence.char}{${fence.length},}\\s*$`).test(line))fence=null;}
  if(!fence&&!line.trim()&&/^\s*\|.*\|\s*$/.test(out.at(-1)??'')){
   let next=i+1;while(next<lines.length&&!lines[next].trim())next++;
   if(/^\s*\|.*\|\s*$/.test(lines[next]??''))continue;
  }
  out.push(line);
 }
 return out.join('\n');
}

// The local connector reads this exact saved document. The Agent cannot change
// its content, destination or source references by supplying tool arguments.
export function createWeeklyJob(conversation, directory) {
 const answer=conversation.messages?.findLast(m=>m.role==='assistant');
 if(!answer?.content?.trim() || !answer.sources?.length) throw Error('근거가 있는 검토 결과가 필요합니다.');
 const jobId=digest(JSON.stringify({formatVersion:2,pageId:WEEKLY_PAGE_ID,conversationId:conversation.id,answer:answer.content,sources:answer.sources}));
 const dates=answer.sources.map(s=>s.report_date).sort();
 const period=dates[0]===dates.at(-1)?dates[0]:`${dates[0]} ~ ${dates.at(-1)}`;
 const sourceLines=answer.sources.map(s=>`- [${s.reference}] ${s.department} · ${s.report_date} · ${s.title} · 문서 ID ${s.id} · SHA-256 ${s.sha256}`);
 const markdown=`\n---\n\n## Daylog 주간보고 통합 검수\n\n보고서 기준일 ${period} · ${answer.sources.length}개 문서 · Unnestflow 검토 결과\n\n${normalizeWeeklyMarkdown(answer.content)}\n\n### 검토 근거와 실행 기록\n\n${sourceLines.join('\n')}\n\nDaylog 대화 ID ${conversation.id}\n\n연계 검증 ID DAYLOG-WEEKLY-${jobId}\n`;
 const job={jobId,pageId:WEEKLY_PAGE_ID,pageUrl:WEEKLY_PAGE_URL,conversationId:conversation.id,markdown,contentSha256:digest(markdown),sourceIds:answer.sources.map(s=>s.id),createdAt:new Date().toISOString()};
 mkdirSync(directory,{recursive:true});
 const file=join(directory,`${jobId}.json`);
 if(!existsSync(file))writeFileSync(file,JSON.stringify(job,null,2),{flag:'wx'});
 return job;
}

export function createWeeklyPublisher({env,invokeFlow,getSettings}) {
 const directory=resolve(env.WEEKLY_JOBS_DIR || join(env.DATA_DIR || '.data','weekly-jobs'));
 const running=new Set();
 return async conversation=>{
  if(!env.NOTION_WEEKLY_FLOW_URL) throw Object.assign(Error('Notion 주간보고 Flow를 서버에 설정해 주세요.'),{status:503});
  const job=createWeeklyJob(conversation,directory);
  const receiptFile=join(directory,`${job.jobId}.receipt.json`);
  const readReceipt=()=>{
   if(!existsSync(receiptFile))return null;
   const r=JSON.parse(readFileSync(receiptFile,'utf8'));
   if(r.verified!==true || r.jobId!==job.jobId || r.pageId!==job.pageId || r.contentSha256!==job.contentSha256)throw Error('Notion 게시 증빙이 검토 결과와 일치하지 않습니다.');
   return r;
  };
  const existing=readReceipt();if(existing)return {...existing,alreadyPublished:true};
  if(running.has(job.jobId))throw Object.assign(Error('같은 검토 결과를 게시하고 있습니다.'),{status:409});
  running.add(job.jobId);
  try{
   const answer=await invokeFlow({...getSettings(),mcpUrl:env.NOTION_WEEKLY_FLOW_URL},`승인된 주간보고 작업 ${job.jobId} 를 publish_weekly_report 도구로 게시해 주세요. job_id를 정확히 전달하고, 도구가 확인한 결과만 한국어로 알려 주세요.`, `weekly-${job.jobId}`);
   const receipt=readReceipt();
   if(!receipt)throw Error('Notion의 실제 저장 결과가 확인되지 않았습니다. 재시도하면 같은 결과의 중복 게시를 확인합니다.');
   return {...receipt,answer};
  }finally{running.delete(job.jobId);}
 };
}
