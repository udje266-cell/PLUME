// Optional Playwright regression check against a local dev server and database.
// PLAYWRIGHT_MODULE may point to a Playwright installation outside this repository.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Local server required');
assert(['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname), 'Local database required');
const db=new PrismaClient(),prefix='messages-ui-'+Date.now(),suffix=prefix.slice(-5);
const ids=Object.fromEntries(['me','hyde','chlo','request','request2','outgoing','read','friend'].map(name=>[name,prefix+'-'+name]));
const names={me:'Lucie'+suffix,hyde:'hyde'+suffix,chlo:'Chlo03'+suffix,request:'Éla'+suffix,request2:'Noé'+suffix,outgoing:'Clara'+suffix,read:'Sacha'+suffix,friend:'Amie'+suffix};
const tokenFor=userId=>jwt.sign({userId},process.env.JWT_SECRET||'plume_secret_dev_change_later',{expiresIn:'15m'});
const api=async(userId,method,path,body)=>{const response=await fetch(base+path,{method,headers:{Authorization:'Bearer '+tokenFor(userId),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});assert(response.ok,`${method} ${path}: ${response.status} ${await response.clone().text()}`);return response.status===204?null:response.json();};
let browser;
try {
 for(const [key,id] of Object.entries(ids)) await db.user.create({data:{id,username:names[key],email:id+'@example.invalid',role:'Lecteur',bio:'Lectures et découvertes',birthDate:new Date('1995-01-01'),emailVerified:true}});
 for(const [index,key] of ['hyde','chlo','request','request2','outgoing','read'].entries()) {
  const date=new Date(Date.now()-(index+1)*60_000);
  await db.conversation.create({data:{id:ids[key],participants:{connect:[{id:ids.me},{id:ids[key]}]},requestStatus:['request','request2','outgoing'].includes(key)?'PENDING':'NONE',requesterId:key==='outgoing'?ids.me:['request','request2'].includes(key)?ids[key]:null,updatedAt:date}});
  await db.message.create({data:{id:ids[key]+'-message',conversationId:ids[key],senderId:key==='outgoing'?ids.me:ids[key],content:{hyde:'Tu as lu le dernier chapitre ?',chlo:'Je te partage ma dernière découverte 📚',request:'Bonjour, on parle de Fantasy ?',request2:'Une nouvelle demande',outgoing:'Une demande envoyée',read:'Merci pour la recommandation !'}[key],isRead:['request2','read'].includes(key),createdAt:date}});
 }
 await db.message.create({data:{id:ids.hyde+'-older',conversationId:ids.hyde,senderId:ids.hyde,content:'Une lecture à partager',createdAt:new Date(Date.now()-90_000)}});
 await db.conversationPin.create({data:{userId:ids.me,conversationId:ids.hyde}});
 await db.follow.createMany({data:[{followerId:ids.me,followingId:ids.friend},{followerId:ids.friend,followingId:ids.me}]});
 await db.readingGroup.create({data:{id:prefix,name:'Les voyageurs de l’imaginaire',description:'Une histoire, plusieurs regards.',creatorId:ids.me,members:{connect:[{id:ids.me},{id:ids.hyde}]},memberships:{create:[{userId:ids.me,role:'owner'},{userId:ids.hyde,role:'member'}]},messages:{create:{id:prefix,senderId:ids.hyde,content:'Bienvenue au club !'}}}});
 const me=await api(ids.me,'GET','/api/auth/me');
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const openContext=async()=>{
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.addCookies([{name:'plume_token',value:tokenFor(ids.me),url:base,httpOnly:true}]);
  await context.addInitScript(me=>{localStorage.setItem('plume_current_user',JSON.stringify(me));localStorage.setItem('plume_is_logged_in','true');localStorage.setItem('plume_dark_mode','true');},me);
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('dialog',dialog=>dialog.dismiss());
  await page.goto(base);await page.locator('#nav-tab-messages').click();await page.getByRole('heading',{name:'Messages',exact:true}).waitFor();
  return {context,page};
 };
 const {context,page}=await openContext(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 const inbox=page.getByRole('region',{name:'Boîte de réception'}), filters=inbox.getByRole('group',{name:'Filtrer les échanges'});
 await inbox.locator('article').nth(5).waitFor();
 assert.equal(await inbox.locator('article').count(),6);
 await filters.getByRole('button',{name:'Non lus 4 messages non lus',exact:true}).waitFor();
 await filters.getByRole('button',{name:'Demandes 2 demandes reçues',exact:true}).waitFor();
 await filters.getByRole('button',{name:/^Demandes/}).click();assert.equal(await inbox.locator('article').count(),2);
 assert.equal(await inbox.locator(`[data-conversation-id="${ids.outgoing}"]`).count(),0);
 await filters.getByRole('button',{name:/^Non lus/}).click();assert.equal(await inbox.locator('article').count(),3);
 await inbox.getByRole('searchbox',{name:'Rechercher une conversation'}).fill('ela');assert.equal(await inbox.locator('article').count(),1);
 await inbox.getByRole('button',{name:'Effacer la recherche'}).click();await filters.getByRole('button',{name:'Tous',exact:true}).click();
 for(const width of [320,390,768,1024,1440]){
  await page.setViewportSize({width,height:950});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow ${width}`);
  const brand=page.locator('[data-header-logo]:visible');const brandBox=await brand.boundingBox();assert.equal(brandBox.width,104);assert.equal(brandBox.height,36);
  if(width===390) await page.screenshot({path:process.env.MESSAGES_SCREENSHOT_PATH||'/tmp/plume-messages.png',fullPage:true});
 }
 await page.setViewportSize({width:390,height:844});
 await page.getByTitle('Passer en mode clair',{exact:true}).click();assert.equal(await page.locator('html').evaluate(node=>node.classList.contains('dark')),false);
 await page.getByTitle('Passer en mode sombre',{exact:true}).click();
 await inbox.getByRole('button',{name:`Épingler la discussion avec ${names.chlo}`,exact:true}).click();
 await page.waitForFunction(id=>document.querySelector(`[data-conversation-id="${id}"] button[aria-pressed]`)?.getAttribute('aria-pressed')==='true',ids.chlo);
 assert.equal((await db.conversationPin.count({where:{userId:ids.me}})),2);
 await context.setOffline(true);await inbox.getByRole('button',{name:`Désépingler la discussion avec ${names.chlo}`,exact:true}).click();await inbox.getByRole('alert').waitFor();assert.equal(await inbox.getByRole('region',{name:'Discussions épinglées'}).locator('article').count(),2);await context.setOffline(false);
 await page.reload();await page.locator('#nav-tab-messages').click();await inbox.getByRole('region',{name:'Discussions épinglées'}).locator('article').nth(1).waitFor();
 const second=await openContext();const secondInbox=second.page.getByRole('region',{name:'Boîte de réception'});
 await secondInbox.getByRole('region',{name:'Discussions épinglées'}).locator('article').nth(1).waitFor();
 await inbox.getByRole('button',{name:`Désépingler la discussion avec ${names.chlo}`,exact:true}).click();
 await secondInbox.getByRole('button',{name:`Épingler la discussion avec ${names.chlo}`,exact:true}).waitFor();
 assert.equal((await api(ids.hyde,'GET','/api/conversations')).find(conversation=>conversation.id===ids.hyde).isPinned,false);
 console.log('PASS list, filters, search, light/dark, 320–1440px, pin failure/persistence/isolation and live synchronization across devices.');
 // A real incoming message updates counters immediately without displacing pins.
 const received=await api(ids.chlo,'POST','/api/messages',{conversationId:ids.chlo,content:'Un nouveau message en direct'});
 await inbox.getByText('Un nouveau message en direct',{exact:true}).waitFor();
 assert.equal(await inbox.locator('article').first().getAttribute('data-conversation-id'),ids.hyde);
 await inbox.getByRole('button',{name:`Ouvrir la discussion avec ${names.chlo}`,exact:true}).click();
 await page.getByPlaceholder('Rédiger votre message...').waitFor();
 await secondInbox.locator(`[data-conversation-id="${ids.chlo}"]`).getByLabel('2 messages non lus',{exact:true}).waitFor({state:'hidden'});
 assert.equal((await db.message.findUnique({where:{id:received.id}})).isRead,true);
 await page.getByPlaceholder('Rédiger votre message...').fill('Merci, reçu et lu 💜');await page.locator('#send-message-chat-btn').click();
 await page.getByText('Merci, reçu et lu 💜',{exact:true}).waitFor();
 // Leave the thread for a profile while its selection remains in App.
 await page.locator(`img[alt="${names.chlo}"]`).first().click();await page.getByRole('heading',{name:names.chlo,exact:true}).waitFor();
 const hidden=await api(ids.chlo,'POST','/api/messages',{conversationId:ids.chlo,content:'À lire au retour dans la discussion'});
 await secondInbox.getByText('À lire au retour dans la discussion',{exact:true}).waitFor();
 assert.equal((await db.message.findUnique({where:{id:hidden.id}})).isRead,false);
 await page.locator('#nav-tab-messages').click();await page.getByPlaceholder('Rédiger votre message...').waitFor();
 await secondInbox.locator(`[data-conversation-id="${ids.chlo}"]`).getByLabel('1 messages non lus',{exact:true}).waitFor({state:'hidden'});
 await page.getByTitle('Retour à la liste',{exact:true}).click();
 // Clubs are separate, their actual unread count clears on entry; a hidden DM stays unread.
 await inbox.getByRole('region',{name:'Vos clubs de lecture'}).getByRole('button',{name:'Ouvrir le club Les voyageurs de l’imaginaire',exact:true}).click();
 await page.getByPlaceholder('Message de groupe...').waitFor();
 const duringClub=await api(ids.chlo,'POST','/api/messages',{conversationId:ids.chlo,content:'Pendant la lecture du club'});
 await secondInbox.getByText('Pendant la lecture du club',{exact:true}).waitFor();
 assert.equal((await db.message.findUnique({where:{id:duringClub.id}})).isRead,false);
 assert.equal((await api(ids.me,'GET','/api/groups')).find(group=>group.id===prefix).unreadCount,0);
 await page.getByTitle('Retour à la liste',{exact:true}).click();
 await inbox.getByRole('tab',{name:'Clubs de lecture (1)',exact:true}).click();await inbox.getByRole('button',{name:'Créer un club',exact:true}).waitFor();assert.equal(await filters.getByRole('button',{name:/Demandes/}).count(),0);
 await inbox.getByRole('button',{name:'Créer un club',exact:true}).click();const clubDialog=page.getByRole('dialog',{name:'Créer un club de lecture'});await clubDialog.getByRole('textbox',{name:'Nom du club'}).fill('Nouveau club '+suffix);await clubDialog.getByRole('button',{name:'Créer le cercle de lecture',exact:true}).click();await page.getByPlaceholder('Message de groupe...').waitFor();await page.getByTitle('Retour à la liste',{exact:true}).click();await inbox.getByRole('tab',{name:'Clubs de lecture (2)',exact:true}).waitFor();
 await inbox.getByRole('tab',{name:'Discussions',exact:true}).click();
 console.log('PASS real messages, read acknowledgements on another device, hidden-profile/club unread correctness and club shortcuts.');
 // A failed request response must not make the request disappear.
 await filters.getByRole('button',{name:/^Demandes/}).click();await inbox.getByRole('button',{name:`Ouvrir la discussion avec ${names.request}`,exact:true}).click();
 await page.getByRole('button',{name:'Accepter',exact:true}).waitFor();await context.setOffline(true);await page.getByRole('button',{name:'Accepter',exact:true}).click();await page.getByRole('button',{name:'Accepter',exact:true}).waitFor();assert.equal((await db.conversation.findUnique({where:{id:ids.request}})).requestStatus,'PENDING');await context.setOffline(false);
 await page.getByRole('button',{name:'Accepter',exact:true}).click();await page.getByRole('button',{name:'Accepter',exact:true}).waitFor({state:'hidden'});
 await page.getByTitle('Retour à la liste',{exact:true}).click();await filters.getByRole('button',{name:'Demandes 1 demandes reçues',exact:true}).waitFor();
 await filters.getByRole('button',{name:'Tous',exact:true}).click();
 await inbox.getByRole('button',{name:'Démarrer une discussion',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Nouvelle discussion'});await dialog.getByRole('textbox',{name:'Rechercher un destinataire'}).fill(names.friend);await dialog.getByRole('button').filter({hasText:names.friend}).click();await page.getByPlaceholder('Rédiger votre message...').fill('Bonjour depuis le bouton crayon');await page.locator('#send-message-chat-btn').click();
 await secondInbox.getByText('Vous : Bonjour depuis le bouton crayon',{exact:true}).waitFor();
 assert.equal(await db.message.count({where:{senderId:ids.me,content:'Bonjour depuis le bouton crayon'}}),1);
 assert.deepEqual(errors,[]);
 console.log('PASS requests acceptance/failure and pencil-to-message flow. No browser runtime errors.');
 await second.context.close();
} finally {
 await browser?.close();
 await db.conversation.deleteMany({where:{OR:[{id:{in:Object.values(ids)}},{participants:{some:{id:ids.me}}}]}});
 await db.readingGroup.deleteMany({where:{id:prefix}});
 await db.user.deleteMany({where:{id:{in:Object.values(ids)}}});await db.$disconnect();
}
