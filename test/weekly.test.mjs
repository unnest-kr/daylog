import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createWeeklyPublisher,WEEKLY_PAGE_ID,normalizeWeeklyMarkdown} from '../server/weekly.mjs';
const conversation={id:'test-conversation',messages:[{role:'assistant',content:'## 부서별 업무\n가상 보고서입니다. [R1]',sources:[{reference:'R1',id:'source-1',department:'개발팀',title:'가상 주간보고',report_date:'2026-10-23',sha256:'source-digest'}]}]};
function setup(t,invokeFlow){const dir=mkdtempSync(join(tmpdir(),'daylog-weekly-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));return {dir,publish:createWeeklyPublisher({env:{NOTION_WEEKLY_FLOW_URL:'https://platform.example/api/v1/run/flow',WEEKLY_JOBS_DIR:dir},getSettings:()=>({apiKey:'private-server-key',mcpUrl:'existing-review-flow'}),invokeFlow:(...args)=>invokeFlow(dir,...args)})};}
test('Notion publication requires matching saved readback evidence; a model success claim alone fails',async t=>{
 const {publish}=setup(t,async()=> '게시 성공');
 await assert.rejects(publish(conversation),/실제 저장 결과/);
});
test('publication binds immutable source content and destination, then reuses a verified receipt',async t=>{
 let calls=0;
 const {publish,dir}=setup(t,async(directory,settings,input)=>{
  calls++;assert.equal(settings.apiKey,'private-server-key');
  const id=input.match(/[a-f0-9]{64}/)[0];const job=JSON.parse(readFileSync(join(directory,`${id}.json`)));
  assert.equal(job.pageId,WEEKLY_PAGE_ID);assert.match(job.markdown,/source-digest/);assert.match(job.markdown,/가상 보고서/);
  writeFileSync(join(directory,`${id}.receipt.json`),JSON.stringify({verified:true,jobId:id,pageId:job.pageId,pageUrl:job.pageUrl,contentSha256:job.contentSha256}));return '도구 확인 완료';
 });
 const first=await publish(conversation);assert.equal(first.verified,true);
 const second=await publish(conversation);assert.equal(second.alreadyPublished,true);assert.equal(calls,1);
 const file=join(dir,`${first.jobId}.receipt.json`);const r=JSON.parse(readFileSync(file));r.pageId='other-page';writeFileSync(file,JSON.stringify(r));
 await assert.rejects(publish(conversation),/일치하지/);
});
test('empty or ungrounded review cannot be published',async t=>{
 const {publish}=setup(t,async()=>assert.fail('must not invoke provider'));
 await assert.rejects(publish({...conversation,messages:[]}),/근거가 있는/);
});
test('Notion tables have contiguous rows while code examples remain unchanged',()=>{
 const table='| 부서 | 현황 |\n\n|---|---|\n\n| 개발 | 8/10 |';
 assert.equal(normalizeWeeklyMarkdown(table),'| 부서 | 현황 |\n|---|---|\n| 개발 | 8/10 |');
 assert.equal(normalizeWeeklyMarkdown('```\n'+table+'\n```\nend'),'```\n'+table+'\n```\nend');
});
