import fs from 'node:fs';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';import {randomUUID} from 'node:crypto';
const {PGlite}=await import(pathToFileURL(process.env.PILOT_PGLITE));const db=new PGlite();
try{
await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public to anon,authenticated;`);
for(const f of ['pilot.sql','pilot-catalogue.sql','pilot-maintenance.sql','pilot-booking-v3.sql','pilot-booking-v3.sql'])await db.exec(fs.readFileSync('db/'+f,'utf8'));
const uid=randomUUID();await db.query('insert into auth.users values($1)',[uid]);await db.query('insert into pilot_staff(user_id) values($1)',[uid]);
const date=(await db.query("select ((now() at time zone 'Asia/Kolkata')::date+1)::text as d")).rows[0].d;
const call=async(fn,args=[]) =>(await db.query(`select public.${fn}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as r`,args)).rows[0].r;
await db.exec('set role anon');const slots=await call('pilot_available_slots',[date]);assert.equal(slots.slots.length,20);assert(!slots.slots.some(s=>s.start==='14:00'));assert.equal(slots.slots.at(-1).end,'21:00');
const req={name:'Test',phone:'9876543210',sport:'badminton',shop:'6th',gear:'Test racket',payment:'UPI',string_key:'Yonex|BG65',colour:'Turquoise',mains:'24',crosses:'26',knots:'2',slot_date:date,slot_start:'10:30'};
const key=randomUUID(),receipt=await call('pilot_create_booking_v2',[req,key]);assert.deepEqual(await call('pilot_create_booking_v2',[req,key]),receipt);assert.equal(receipt.ready_by,'11:00');
await assert.rejects(call('pilot_create_booking_v2',[{...req,phone:'9876543211'},randomUUID()]),/slot/);
await assert.rejects(call('pilot_create_booking_v2',[{...req,slot_start:'14:00'},randomUUID()]),/slot/);
await assert.rejects(call('pilot_create_booking',[{...req,slot_start:'10:45'},randomUUID()]),/slot/);
await assert.rejects(db.query('select * from pilot_payments'),/permission denied/);
await db.exec('reset role;set role authenticated');await assert.rejects(call('pilot_queue'),/Staff access/);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);const o=(await call('pilot_queue'))[0];
const paymentKey=randomUUID();const pay=[o.id,200,'Cash','advance',paymentKey];const partial=await call('pilot_record_payment_v3',pay);assert.equal(partial.balance,350);await call('pilot_record_payment_v3',pay);await assert.rejects(call('pilot_update_order',[o.id,'Requested','accept',100]),/below/);await call('pilot_update_order',[o.id,'Requested','accept',550]);assert.equal((await call('pilot_queue'))[0].paid_total,200);
await assert.rejects(call('pilot_record_payment_v3',[o.id,351,'UPI','balance',randomUUID()]),/balance/);
await assert.rejects(call('pilot_update_order',[o.id,'Accepted','cancel',null]),/unpaid/);
await call('pilot_update_order',[o.id,'Accepted','start',null]);await call('pilot_update_order',[o.id,'At the bench','ready',null]);await assert.rejects(call('pilot_update_order',[o.id,'Ready','collect',null]),/payment/);
await call('pilot_record_payment_v3',[o.id,350,'Card','balance',randomUUID()]);await call('pilot_update_order',[o.id,'Ready','collect',null]);
await db.exec('reset role;set role anon');const tracked=await call('pilot_track_booking',[receipt.token]);assert.equal(tracked.paid_total,550);assert.equal(tracked.status,'Collected');for(const k of ['phone','customer_name','request_data','gear','receipt_token'])assert(!(k in tracked));
for(let i=1;i<20;i++)await call('pilot_create_booking_v2',[{...req,phone:String(9000000000+i),slot_start:slots.slots[i].start},randomUUID()]);const full=await call('pilot_available_slots',[date]);assert.equal(full.day_left,0);assert(full.slots.every(s=>!s.free));
await call('pilot_create_booking_v2',[{name:'Shoe Test',phone:'9888888888',sport:'shoe',shop:'6th',payment:'Cash',note:'Sole repair'},randomUUID()]);
console.log('PASS: 20 slots, break, capacity, server validation, booking retry, access controls, partial payment retry, overpayment/cancellation/collection guards, tracker privacy and shoe quote.');
}finally{await db.close();}
