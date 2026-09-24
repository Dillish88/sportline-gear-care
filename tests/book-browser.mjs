// Isolated end-to-end test: actual PostgreSQL via PGlite, mock Auth, no live customer data.
import fs from 'node:fs';import path from 'node:path';import http from 'node:http';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);const {chromium}=require('playwright');
const {PGlite}=await import(pathToFileURL(process.env.PILOT_PGLITE));const db=new PGlite();
const root=process.cwd();const uid='00000000-0000-4000-8000-000000000001';
await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public to anon,authenticated;`);
await db.exec(fs.readFileSync('db/pilot.sql','utf8'));await db.exec(fs.readFileSync('db/pilot-catalogue.sql','utf8'));await db.exec(fs.readFileSync('db/pilot-maintenance.sql','utf8'));
await db.exec(fs.readFileSync('db/pilot-booking-v3.sql','utf8'));
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
   const fn=url.pathname.split('/').pop();const args={pilot_is_staff:[],pilot_queue_v2:[],pilot_track_booking_v2:['p_token'],pilot_available_slots:['p_date'],pilot_create_booking_v2:['p_request','p_key'],pilot_record_payment_v3:['p_order','p_amount','p_method','p_kind','p_key'],pilot_create_booking:['p_request','p_key'],pilot_track_booking:['p_token'],pilot_public_catalogue:[],pilot_marketing_consent:['p_order','p_opt_in'],pilot_withdraw_offers:['p_phone'],pilot_queue:[],pilot_update_order:['p_id','p_expected','p_action','p_amount']}[fn];
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
    if(fn==='pilot_create_booking_v2'&&loseFirstResponse){loseFirstResponse=false;return json(503,{});}
    return json(200,result);
   }catch(e){return json(400,{code:e.code,message:e.message});}
  }
  let file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
  if(file!==root&&!file.startsWith(root+path.sep))return json(403,{});
  if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
  if(!fs.existsSync(file))return json(404,{});
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp'}[path.extname(file)]||'application/octet-stream'));
  res.end(fs.readFileSync(file));
 }catch(e){json(500,{message:e.message});}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 const customer=await browser.newPage({viewport:{width:390,height:844}}),staff=await browser.newPage();const errors=[];for(const p of [customer,staff])p.on('pageerror',e=>errors.push(e.message));
 await customer.goto(base+'/book/');await customer.evaluate(()=>document.fonts.ready);await customer.screenshot({path:path.resolve('../archive-review/approved-carousel-mobile.png'),fullPage:true});
 await customer.getByRole('button',{name:'Next service',exact:true}).click();await customer.waitForFunction(()=>document.querySelector('[data-slide="1"]').getAttribute('aria-current')==='true');
 await customer.locator('[data-slide="0"]').click();await customer.locator('[data-go="badminton"]').click();await customer.locator('#days input').first().waitFor();await customer.locator('#days input').nth(1).check();await customer.locator('#slots input:not([disabled])').first().check();
 await customer.locator('#nm').fill('Pilot Test Customer');await customer.locator('#ph').fill('9876543210');await customer.locator('#rk').fill('Yonex Test');
 assert.equal(await customer.locator('#slots input').count(),20);assert.equal(await customer.locator('#slots input[value="14:00"]').count(),0);
 await customer.locator('input[name="colour"][value="Other"]').check();await customer.locator('#colOther').fill('<img src=x onerror=alert(1)>');
 for(const width of [320,390,1280]){await customer.setViewportSize({width,height:844});assert(await customer.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+width);}
 await customer.screenshot({path:path.resolve('../archive-review/approved-booking-form.png'),fullPage:true});
 await customer.locator('#submit').click();await customer.locator('#err').waitFor({state:'visible'});await customer.locator('#submit').click();await customer.locator('#done').waitFor({state:'visible'});const code=await customer.locator('#dCode').innerText();assert.match(code,/^SL-/);
 const link=await customer.locator('#dOpen').getAttribute('href');await customer.goto(link);await customer.locator('.code').waitFor({state:'visible'});assert.equal(await customer.locator('.code').innerText(),code);
 await staff.goto(base+'/book/staff.html');await staff.locator('#email').fill('staff@example.test');await staff.locator('#password').fill('test-password');await staff.locator('#signin').click();await staff.locator('.job').waitFor();assert.equal(await staff.locator('.job').count(),1);await staff.locator('[data-open]').click();
 staff.on('dialog',d=>d.accept());await staff.evaluate(()=>window.print=()=>{});await staff.getByRole('button',{name:'Print slip',exact:true}).click();assert.equal(await staff.locator('#slip img').count(),0);assert.match(await staff.locator('#slip').textContent(),/<img src=x/);
 await staff.locator('[id^="price-"]').fill('550');await staff.getByRole('button',{name:'Accept job',exact:true}).click();await staff.getByRole('button',{name:'Start work',exact:true}).waitFor();
 const updateLink=new URL(await staff.getByRole('link',{name:'WhatsApp update',exact:true}).getAttribute('href'));assert.match(updateLink.searchParams.get('text'),new RegExp(code));assert.match(updateLink.searchParams.get('text'),/Status: https?:.*status.html#t=/);
 await staff.getByRole('button',{name:'Take payment',exact:true}).click();await staff.locator('[id^="amt-"]').fill('200');await staff.locator('#reload').click();assert.equal(await staff.locator('[id^="amt-"]').inputValue(),'200');await staff.getByRole('button',{name:'Record',exact:true}).click();await staff.getByText('₹200 paid',{exact:true}).waitFor();
 await staff.setViewportSize({width:390,height:844});await staff.screenshot({path:path.resolve('../archive-review/approved-staff-payment.png'),fullPage:true});assert(await staff.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await staff.getByRole('button',{name:'Start work',exact:true}).click();await staff.getByRole('button',{name:'Mark ready',exact:true}).click();await staff.getByRole('button',{name:'Take payment',exact:true}).click();await staff.getByRole('button',{name:'Record',exact:true}).click();await staff.getByRole('button',{name:'Handed over',exact:true}).click();
 await customer.locator('#refresh').click();await customer.getByText('Collected. Thanks for choosing Sportline.').waitFor();
 await staff.locator('#signout').click();assert.equal(await staff.locator('.job').count(),0);
 assert.deepEqual(errors,[]);await db.exec('reset role');assert.equal((await db.query('select count(*)::integer n from pilot_orders')).rows[0].n,1);console.log('PASS: carousel, responsive layouts, booking retry, 20-slot form, private tracker, escaped slip, refresh preserves payment, staff partial payments through collection, sign-out clears data. No live data used.');
}finally{await browser.close();await new Promise(r=>server.close(r));await db.close();}
