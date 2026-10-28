// Dedicated read-only MCP adapter for the explicitly requested Notion report area.
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema, McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { readBridgeConfig } from './runtime.mjs';
const ids=new Set([
 '3f94587c9925839a92b501acc6675a38', // requested weekly reporting root
 '0292686402b24485b38f1de445fadb31', // CEO
 'efd3939406604eac9adc5e8fb7f001f4', // development
 '25e2e5e60f7b4aae9146dc4b693f53ec', // business
 '45a8bbeeb7c6493c885142f746cc642d', // human resources
 'e688ca559de5446bb068c023aee7eb52', // submission status DB
 'a458ce823d494112be97e1ea81509bff', // report archive
 '1f016d8d902f4a9f92f6189041d2be00', // submission status data source
]);
const config=readBridgeConfig();
const remote=new Client({name:'Unnestflow Notion read-only adapter',version:'1.0'},{capabilities:{}});
const remoteTransport=new StdioClientTransport({...config,env:{...process.env,...config.env},stderr:'inherit'});
await remote.connect(remoteTransport,{timeout:120000});
const upstream=new Server({name:'unnest-notion-report-readonly',version:'1.0'},{capabilities:{tools:{}}});
const fetchTool=(await remote.listTools()).tools.find(t=>t.name==='notion-fetch');
if(!fetchTool)throw Error('Notion fetch tool unavailable');
upstream.setRequestHandler(ListToolsRequestSchema,async()=>({tools:[fetchTool]}));
upstream.setRequestHandler(CallToolRequestSchema,async request=>{
 if(request.params.name!=='notion-fetch')throw new McpError(ErrorCode.InvalidParams,'Only the read-only notion-fetch tool is enabled');
 const value=request.params.arguments?.id;
 if(typeof value!=='string')throw new McpError(ErrorCode.InvalidParams,'A Notion page or database identifier is required');
 let identifier=value.replace(/-/g,'').toLowerCase();
 if(!/^[0-9a-f]{32}$/.test(identifier)){
   let url;
   try{url=new URL(value);}catch{throw new McpError(ErrorCode.InvalidParams,'Invalid Notion identifier');}
   if(url.protocol==='collection:')identifier=url.hostname.replace(/-/g,'').toLowerCase();
   else{
     if(url.protocol!=='https:'||!['app.notion.com','notion.com','www.notion.com','notion.so','www.notion.so'].includes(url.hostname))throw new McpError(ErrorCode.InvalidParams,'Only official Notion page URLs are allowed');
     identifier=url.pathname.replace(/-/g,'').toLowerCase().match(/([0-9a-f]{32})\/?$/)?.[1]??'';
   }
 }
 if(!ids.has(identifier))throw new McpError(ErrorCode.InvalidParams,'Read access is limited to the requested weekly report area');
 return remote.callTool({name:'notion-fetch',arguments:request.params.arguments},undefined,{timeout:90000});
});
await upstream.connect(new StdioServerTransport());
const close=async()=>{await upstream.close().catch(()=>{});await remote.close().catch(()=>{});await remoteTransport.close().catch(()=>{});process.exit(0);};
process.once('SIGINT',close);process.once('SIGTERM',close);
process.stdin.once('end',close);
