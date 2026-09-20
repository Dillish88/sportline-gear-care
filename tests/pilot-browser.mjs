// Isolated end-to-end test: actual PostgreSQL via PGlite, mock Auth, no live customer data.
import fs from 'node:fs';import path from 'node:path';import http from 'node:http';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);const {chromium}=require('playwright');
const {PGlite}=await import(pathToFileURL(process.env.PILOT_PGLITE));const db=new PGlite();
const root=process.cwd();const uid='00000000-0000-4000-8000-000000000001';
await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public to anon,authenticated;`);
await db.exec(fs.readFileSync('db/pilot.sql','utf8'));await db.exec(fs.readFileSync('db/pilot-catalogue.sql','utf8'));
await db.query('insert into auth.users values($1)',[uid]);await db.query('insert into public.pilot_staff(user_id) values($1)',[uid]);
let serial=Promise.resolve(),loseFirstResponse=true;
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
 try{
  if(url.pathname==='/pilot/config.js'){res.setHeader('Content-Type','text/javascript');res.end(`window.PILOT_CONFIG={enabled:true,key:'test-only',url:'http://127.0.0.1:${server.address().port}'};`);return;}
  if(req.method==='POST'){
   let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw||'{}');
   if(url.pathname==='/auth/v1/token'){
    if(body.email==='staff@example.test'&&body.password==='test-password')return json(200,{access_token:'test-staff',refresh_token:'test-refresh',expires_in:3600});
    return json(400,{error_code:'invalid_credentials'});
   }
   if(url.pathname==='/auth/v1/logout')return json(200,{});
   const fn=url.pathname.split('/').pop();const args={pilot_create_booking:['p_request','p_key'],pilot_track_booking:['p_token'],pilot_queue:[],pilot_update_order:['p_id','p_expected','p_action','p_amount']}[fn];
   if(!args)return json(404,{});
   const execute=async()=>{
    await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[req.headers.authorization==='Bearer test-staff'?uid:'']);
    await db.exec(req.headers.authorization==='Bearer test-staff'?'set role authenticated':'set role anon');
    const values=args.map(k=>typeof body[k]==='object'&&body[k]!==null?JSON.stringify(body[k]):body[k]);
    return (await db.query(`select public.${fn}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as result`,values)).rows[0].result;
   };
   const work=serial.then(execute);serial=work.catch(()=>{});
   try{
    const result=await work;
    // Simulate a response lost after the database successfully committed.
    if(fn==='pilot_create_booking'&&loseFirstResponse){loseFirstResponse=false;return json(503,{});}
    return json(200,result);
   }catch(e){return json(400,{code:e.code,message:e.message});}
  }
  let file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
  if(!file.startsWith(root+path.sep))return json(403,{});
  if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
  if(!fs.existsSync(file))return json(404,{});
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp'}[path.extname(file)]||'application/octet-stream'));
  res.end(fs.readFileSync(file));
 }catch(e){json(500,{message:e.message});}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 const customer=await browser.newPage({viewport:{width:390,height:844}});const staff=await browser.newPage();const errors=[];
 for(const page of [customer,staff])page.on('pageerror',e=>errors.push(e.message));
 await customer.goto(base+'/pilot/?shop=5th&src=counter-5th');
 await customer.locator('#next').click();await customer.locator('#name').fill('Pilot Test Customer');await customer.locator('#phone').fill('9876543210');
 await customer.locator('#next').click();await customer.locator('#next').click();
 await customer.locator('#error').waitFor({state:'visible'});
 assert(!customer.url().includes('track.html'));
 await customer.locator('#next').click();await customer.waitForURL('**/track.html#*');
 await customer.locator('#job').waitFor({state:'visible'});
 const code=await customer.locator('#code').innerText();assert.match(code,/^SL-/);
 const statusLink=customer.url();await customer.reload();await customer.locator('#job').waitFor({state:'visible'});assert.equal(await customer.locator('#code').innerText(),code);
 await staff.goto(base+'/pilot/staff.html');await staff.locator('#email').fill('staff@example.test');await staff.locator('#password').fill('test-password');await staff.locator('#signin').click();
 await staff.locator('.job-card').waitFor();assert.equal(await staff.locator('.job-card').count(),1);
 assert.match(await staff.locator('.job-card').innerText(),/5th Avenue/);
 await staff.locator('.job-card input[type=number]').fill('550');await staff.getByRole('button',{name:'Accept job',exact:true}).click();
 await staff.getByRole('button',{name:'Start work',exact:true}).click();await staff.getByRole('button',{name:'Mark ready',exact:true}).click();
 await staff.getByRole('button',{name:'Record payment',exact:true}).waitFor();
 await customer.locator('#refresh').click();await customer.getByText('Your gear is ready. Collect it at your selected shop.').waitFor();
 staff.on('dialog',dialog=>dialog.accept());await staff.getByRole('button',{name:'Record payment',exact:true}).click();await staff.getByRole('button',{name:'Handed back',exact:true}).click();
 await staff.getByText('No jobs in this view.').waitFor();await customer.locator('#refresh').click();await customer.getByText('Your gear has been collected. See you on court!').waitFor();
 await staff.locator('#logout').click();assert(await staff.locator('#login').isVisible());assert.equal(await staff.locator('.job-card').count(),0);
 assert.deepEqual(errors,[]);
 await customer.screenshot({path:path.resolve('../archive-review/pilot-receipt.png'),fullPage:true});
 await db.exec('reset role');assert.equal((await db.query('select count(*)::integer n from public.pilot_orders')).rows[0].n,1);
 console.log('PASS: mobile QR booking, lost-response retry creates one job, persistent receipt, staff sign-in, agreed price, full repair/payment/collection workflow, customer status refresh and sign-out. Isolated local database only.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));await db.close();}
