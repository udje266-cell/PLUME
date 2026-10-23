// Mobile two-user check against the real local UI, backend and database.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import assert from 'node:assert/strict';
const { chromium }=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:3000';
for(const url of [base,process.env.DATABASE_URL])assert(['localhost','127.0.0.1'].includes(new URL(url).hostname),'Local fixtures only');
const db=new PrismaClient(),id='chat-ui-'+Date.now(),peer=id+'-peer',book=id+'-book',names=['LéaLectrice','Chlo03'];
const token=userId=>jwt.sign({userId},process.env.JWT_SECRET||'plume_secret_dev_change_later',{expiresIn:'20m'});
const api=async(userId,method,path,body)=>{const r=await fetch(base+path,{method,headers:{Authorization:'Bearer '+token(userId),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});assert(r.ok,`${method} ${path} ${r.status}`);return r.json();};
const share=data=>'[plume-share]'+JSON.stringify(data);
let browser;
try{
 for(const [i,userId]of [id,peer].entries())await db.user.create({data:{id:userId,username:names[i]+id.slice(-4),email:userId+'@example.invalid',birthDate:new Date('1995-01-01'),emailVerified:true,role:'Auteur'}});
 await db.story.create({data:{id:book,title:'L’Archipel des brumes',genre:'Fantasy',description:'Une île apparaît chaque nuit. Une jeune cartographe décide de la retrouver.',authorId:peer,status:'PUBLIE'}});
 await db.chapter.create({data:{id:book,storyId:book,title:'La carte oubliée',order:1,content:'La mer avait emporté tous les noms.\n\nSauf le sien.',isPublished:true}});
 await db.conversation.create({data:{id,participants:{connect:[{id},{id:peer}]}}});
 const parent=await db.message.create({data:{id:id+'-parent',senderId:peer,conversationId:id,content:'Tu as une lecture à me conseiller ? 📚',createdAt:new Date(Date.now()-120000)}});
 await db.message.create({data:{id:id+'-book',senderId:id,conversationId:id,content:share({kind:'book',storyId:book}),createdAt:new Date(Date.now()-90000)}});
 const spoiler=await db.message.create({data:{id:id+'-spoiler',senderId:peer,conversationId:id,content:'||Le capitaine est sa sœur||',createdAt:new Date(Date.now()-60000)}});
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const errors=[];
 const open=async(userId,other)=>{
  const me=await api(userId,'GET','/api/auth/me'),context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
  await context.addCookies([{name:'plume_token',value:token(userId),url:base,httpOnly:true}]);
  await context.addInitScript(me=>{localStorage.setItem('plume_current_user',JSON.stringify(me));localStorage.setItem('plume_is_logged_in','true');localStorage.setItem('plume_dark_mode','true');},me);
  const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.dismiss());
  await page.goto(base);await page.locator('#nav-tab-messages').click();await page.getByRole('button',{name:`Ouvrir la discussion avec ${other+id.slice(-4)}`,exact:true}).click();await page.getByRole('textbox',{name:'Votre message',exact:true}).waitFor();
  return{page,context};
 };
 const a=await open(id,names[1]),b=await open(peer,names[0]),p=a.page;
 assert.equal(await p.getByText('Le capitaine est sa sœur',{exact:true}).count(),0);
 await p.getByRole('button',{name:'Toucher pour révéler le spoiler',exact:true}).click();await p.getByText('Le capitaine est sa sœur',{exact:true}).waitFor();
 assert.equal(await b.page.getByText('Le capitaine est sa sœur',{exact:true}).count(),0);
 await p.getByRole('region',{name:'Livre partagé : L’Archipel des brumes'}).waitFor();
 await p.locator(`[data-message-id="${parent.id}"]`).click({button:'right'});await p.getByRole('button',{name:'Réagir 💜',exact:true}).click();
 await b.page.locator(`[data-message-id="${parent.id}"]`).getByRole('button',{name:'Réaction 💜 : 1',exact:true}).waitFor();
 await p.locator(`[data-message-id="${parent.id}"]`).getByRole('button',{name:'Réaction 💜 : 1',exact:true}).waitFor();
 await p.locator(`[data-message-id="${parent.id}"]`).click({button:'right'});await p.getByRole('button',{name:'Répondre',exact:true}).click();
 const input=p.getByRole('textbox',{name:'Votre message',exact:true});await input.fill('Celui-ci devrait te plaire 💜');await p.getByRole('button',{name:'Envoyer le message',exact:true}).click();await b.page.locator('[data-message-id]').getByText('Celui-ci devrait te plaire 💜',{exact:true}).waitFor();
 const reply=await db.message.findFirst({where:{senderId:id,content:'Celui-ci devrait te plaire 💜'}});assert.equal(reply.replyToId,parent.id);
 // An API failure must preserve the draft for retry.
 await p.route('**/api/messages',route=>route.request().method()==='POST'?route.fulfill({status:503,contentType:'application/json',body:'{"error":"Test indisponibilité"}'}):route.continue());
 await input.fill('Brouillon à conserver');await p.getByRole('button',{name:'Envoyer le message',exact:true}).click();await p.getByRole('alert').waitFor();assert.equal(await input.inputValue(),'Brouillon à conserver');await p.unroute('**/api/messages');await input.fill('');
 await p.getByRole('button',{name:'Ajouter une pièce jointe',exact:true}).click();await p.getByRole('group',{name:'Ajouter à la conversation'}).getByRole('button',{name:'Livres',exact:true}).click();
 const picker=p.getByRole('dialog',{name:'Partager un livre'});await picker.getByRole('searchbox').fill('Archipel');await picker.getByRole('button').filter({hasText:'L’Archipel des brumes'}).click();await p.getByRole('button',{name:'Envoyer le message',exact:true}).click();
 await b.page.getByRole('region',{name:'Livre partagé : L’Archipel des brumes'}).nth(1).waitFor();
 // Invalid file types are rejected before upload, with no lost text.
 await input.fill('Ma note');await p.getByLabel('Choisir un document',{exact:true}).setInputFiles({name:'execute.html',mimeType:'text/html',buffer:Buffer.from('<html>')});await p.getByRole('alert').waitFor();assert.equal(await input.inputValue(),'Ma note');await input.fill('');
 for(const width of [320,390,768,1440]){await p.setViewportSize({width,height:844});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow ${width}`);}
 await p.setViewportSize({width:390,height:844});await p.reload();await p.locator('#nav-tab-messages').click();await p.getByRole('button',{name:`Ouvrir la discussion avec ${names[1]+id.slice(-4)}`,exact:true}).click();
 assert.equal(await p.getByText('Le capitaine est sa sœur',{exact:true}).count(),0);
 await p.getByRole('button',{name:'Options de la conversation',exact:true}).click();const menu=p.getByRole('dialog',{name:'Options de la conversation'});for(const name of ['Bloquer cette personne','Signaler cette personne','Supprimer la conversation'])await menu.getByRole('button',{name,exact:true}).waitFor();await menu.getByRole('button',{name:'Fermer les options',exact:true}).click();
 await p.screenshot({path:process.env.CHAT_SCREENSHOT_PATH||'/workspace/artifacts/conversation-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS: real two-user mobile chat, independent spoiler reveal, live reactions, replies, book sharing, failed-send draft retention, invalid attachments, menu and responsive widths.');
}finally{await browser?.close();await db.conversation.deleteMany({where:{id}});await db.story.deleteMany({where:{id:book}});await db.user.deleteMany({where:{id:{in:[id,peer]}}});await db.$disconnect();}
