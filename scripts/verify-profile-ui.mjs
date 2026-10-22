// Optional browser regression check. Start the local dev server first.
// Use PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs when installed outside this repo.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Local server required');
assert(['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname), 'Local database required');
const db=new PrismaClient(),id='profile-ui-'+Date.now(),peer=id+'-reader',writer=id+'-writer';
let browser;
const tokenFor=userId=>jwt.sign({userId},process.env.JWT_SECRET||'plume_secret_dev_change_later');
const api=async(userId,path,body,method='GET')=>{const response=await fetch(base+path,{method,headers:{Authorization:'Bearer '+tokenFor(userId),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}); assert(response.ok,`${path}: ${response.status}`);return response.json();};
try {
 for(const [userId,username,role] of [[id,'aboywholovesreading','Auteur'],[peer,'LecteurEnDirect','Lecteur'],[writer,'AuteurExemple','Auteur']]) {
  await db.user.create({data:{id:userId,username:username+id.slice(-4),email:userId+'@example.invalid',role,bio:'Nouvelle plume littéraire. Explorant les archipels de la pensée.',favoriteGenres:JSON.stringify(['Fantasy','Thriller','Science-fiction']),emailVerified:true,birthDate:new Date('1995-01-01'),readerXp:89,authorXp:62,showBooksRead:false,showPalmares:true}});
 }
 const me=await api(id,'/api/auth/me'),peerMe=await api(peer,'/api/auth/me');
 await db.story.create({data:{id,title:'Une lecture personnelle',genre:'Fantasy',description:'Test',authorId:writer,status:'PUBLIE'}});
 await db.chapter.create({data:{id,title:'Le premier chapitre',content:'Paragraphe un.\n\nParagraphe deux.',order:1,storyId:id,isPublished:true}});
 await db.readingProgress.create({data:{userId:peer,storyId:id,chapterId:id,progressPercent:12}});
 await db.readingListEntry.create({data:{userId:id,storyId:id,list:'currently'}});
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const ctx=await browser.newContext({viewport:{width:390,height:844}});
 await ctx.addCookies([{name:'plume_token',value:tokenFor(id),url:base,httpOnly:true}]);
 await ctx.addInitScript(me=>{localStorage.setItem('plume_current_user',JSON.stringify(me));localStorage.setItem('plume_is_logged_in','true');localStorage.setItem('plume_dark_mode','true');},me);
 const page=await ctx.newPage(),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.dismiss());
 await page.goto(base);await page.locator('#nav-tab-profile').click();
 const sharing=page.getByRole('region',{name:'Partage de lecture en direct'}),switcher=sharing.getByRole('switch');
 await page.getByRole('heading',{name:me.username,exact:true}).waitFor();
 assert.equal(await switcher.getAttribute('aria-checked'),'false');assert.equal(await sharing.locator('[data-sharing-status]').getAttribute('data-sharing-status'),'disabled');
 await page.getByText(me.bio,{exact:true}).waitFor();await page.getByText('Science-fiction',{exact:true}).waitFor();
 const journey=page.getByRole('region',{name:'Mon parcours'});
 assert.equal(await journey.getByRole('progressbar',{name:'Progression Auteur'}).getAttribute('aria-valuenow'),'62');
 await journey.getByText('Encore 38 XP avant le niveau 2.',{exact:true}).waitFor();
 const details=journey.locator('details');assert.equal(await details.getAttribute('open'),null);
 for(const width of [320,390,768,1024,1440]) {
  await page.setViewportSize({width,height:950});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow at ${width}`);
  if(width===390) await page.screenshot({path:process.env.PROFILE_SCREENSHOT_PATH || '/tmp/plume-profile.png',fullPage:true});
 }
 await page.setViewportSize({width:390,height:844});
 await journey.getByText('Voir mes trophées et légendes',{exact:true}).click();assert.notEqual(await details.getAttribute('open'),null);
 await journey.getByRole('button',{name:'Tous mes trophées et leurs légendes'}).click();await page.getByRole('heading',{name:"Palmarès des Accomplissements de l'Archipel",exact:true}).waitFor();await page.getByRole('button',{name:'Fermer les trophées',exact:true}).click();
 await journey.getByText('Voir mes trophées et légendes',{exact:true}).click();
 await page.getByRole('tab',{name:'Mes lectures',exact:true}).click();await page.getByRole('tabpanel').getByText('Une lecture personnelle',{exact:true}).waitFor();
 await page.getByRole('tab',{name:'Mes écrits (0)',exact:true}).click();
 await page.getByRole('button',{name:'Écrire mon premier chapitre',exact:true}).click();
 await page.getByRole('heading',{name:'Atelier de Création PLUME',exact:true}).waitFor();
 await page.locator('#nav-tab-profile').click();
 await page.getByRole('button',{name:'Modifier mon profil',exact:true}).click();await page.getByRole('heading',{name:'Mon Compte',exact:true}).waitFor();await page.getByRole('button',{name:'Fermer',exact:true}).click();
 // Offline write must roll back both status and persisted permission.
 await ctx.setOffline(true);await switcher.click();await sharing.getByRole('alert').waitFor();assert.equal(await switcher.getAttribute('aria-checked'),'false');await ctx.setOffline(false);
 // Keep previous status while the server has not acknowledged the save.
 await page.route(`**/api/users/${id}`,async route=>{if(route.request().method()==='PUT') await new Promise(resolve=>setTimeout(resolve,700));await route.continue();});
 await switcher.click();await sharing.getByText('Enregistrement…',{exact:true}).waitFor();assert.equal(await sharing.locator('[data-sharing-status]').getAttribute('data-sharing-status'),'disabled');
 await sharing.getByText('Partage activé',{exact:true}).waitFor();assert.equal((await db.user.findUnique({where:{id}})).showBooksRead,true);
 await page.unroute(`**/api/users/${id}`);
 await page.reload();await page.locator('#nav-tab-profile').click();await sharing.getByText('Partage activé',{exact:true}).waitFor();
 await sharing.getByRole('button',{name:'Gérer le partage des lectures'}).click();await page.getByText('Partager mes lectures',{exact:true}).waitFor();
 const privateSwitch=page.locator('div').filter({has:page.locator('label').filter({hasText:/^Profil privé$/})}).filter({has:page.getByRole('checkbox')}).last().getByRole('checkbox');
 await privateSwitch.check();await page.getByRole('button',{name:'Fermer',exact:true}).click();
 await sharing.getByText('Partage désactivé',{exact:true}).waitFor();assert.equal(await switcher.isDisabled(),true);assert.equal(await sharing.locator('[data-sharing-status]').getAttribute('data-sharing-status'),'disabled');
 // Search and visit a different reader; never display the visitor's library.
 await page.locator('#nav-tab-home').click();
 await page.getByRole('searchbox').fill(peerMe.username);await page.getByRole('searchbox').press('Enter');
 await page.locator(`[id="search-profile-${peer}"]`).click();
 await page.getByRole('heading',{name:peerMe.username,exact:true}).waitFor();
 assert.equal(await sharing.getByRole('switch').count(),0);await sharing.getByText('Partage désactivé',{exact:true}).waitFor();
 await page.getByRole('tab',{name:'Ses lectures',exact:true}).click();await page.getByRole('tabpanel').getByText('Ce lecteur ne partage pas ses lectures.',{exact:true}).waitFor();assert.equal(await page.getByRole('tabpanel').getByText('Une lecture personnelle',{exact:true}).count(),0);
 await api(peer,`/api/users/${peer}`,{...peerMe,showBooksRead:true},'PUT');
 await page.reload();await page.locator('#nav-tab-home').click();await page.getByRole('searchbox').fill(peerMe.username);await page.getByRole('searchbox').press('Enter');await page.locator(`[id="search-profile-${peer}"]`).click();
 const progress=sharing.getByRole('progressbar');await progress.waitFor();assert.equal(await progress.getAttribute('value'),'12');
 await api(peer,`/api/chapters/${id}/progress`,{progressPercent:58},'POST');
 await page.waitForFunction(()=>document.querySelector('[aria-label="Partage de lecture en direct"] progress')?.value===58,null,{timeout:5000});
 await api(peer,`/api/stories/${id}/read`,{chapterId:id},'POST');await journey.getByText('99/100 XP',{exact:true}).waitFor({timeout:5000});
 await api(peer,`/api/users/${peer}`,{...peerMe,showBooksRead:false},'PUT');
 await page.waitForFunction(()=>document.querySelector('[data-sharing-status]')?.getAttribute('data-sharing-status')==='disabled',null,{timeout:5000});assert.equal(await sharing.getByRole('progressbar').count(),0);
 const readerContext=await browser.newContext({viewport:{width:390,height:844}});
 await readerContext.addCookies([{name:'plume_token',value:tokenFor(peer),url:base,httpOnly:true}]);
 await readerContext.addInitScript(me=>{localStorage.setItem('plume_current_user',JSON.stringify(me));localStorage.setItem('plume_is_logged_in','true');},peerMe);
 const readerPage=await readerContext.newPage();readerPage.setDefaultTimeout(10000);
 await readerPage.goto(base);await readerPage.locator('#nav-tab-profile').click();
 await readerPage.getByRole('button',{name:'Écrire mon premier chapitre',exact:true}).click();
 await readerPage.getByRole('heading',{name:'Mon Compte',exact:true}).waitFor();
 await readerPage.getByRole('button',{name:'Confirmer la modification unique',exact:true}).waitFor();
 assert.equal((await db.user.findUnique({where:{id:peer}})).role,'Lecteur');
 await readerContext.close();
 assert.deepEqual(errors,[]);
 console.log('PASS profile browser: responsive 320/390/768/1024/1440, bio/genres, actual XP, tap legends, personal tabs, write CTA, account editor, sharing persistence, pending and failed saves, private profile, different-reader privacy and real-time 12→58%, XP 89→99, sharing revocation.');
} finally {await browser?.close();await db.story.deleteMany({where:{id}});await db.user.deleteMany({where:{id:{in:[id,peer,writer]}}});await db.$disconnect();}
