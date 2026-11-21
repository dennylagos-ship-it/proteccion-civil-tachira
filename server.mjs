import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {createHmac, randomBytes, scryptSync, timingSafeEqual} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {buffer} from 'node:stream/consumers';
import {connectPostgres} from './database.mjs';
import QRCode from 'qrcode';
import PDFDocument from 'pdfkit';
import nodemailer from 'nodemailer';
import {demoCourses} from './demo-courses.mjs';
import {renderCertificatePdf} from './certificate-pdf.mjs';
import {videoEmbed} from './public/lesson-media.js';

// Netlify bundles this module into netlify/server/index.mjs, but keeps public at the project root.
const sourceAssets = new URL('./public/', import.meta.url);
const publicAssets = existsSync(new URL('index.html', sourceAssets))
  ? sourceAssets
  : new URL('../../public/', import.meta.url);

function connectSqlite() {
const dataDirectory=process.env.DATA_DIR||'data';
mkdirSync(dataDirectory, {recursive:true});
const db = new DatabaseSync(join(dataDirectory,'aula.sqlite'));
db.exec(`
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT, email TEXT UNIQUE, password TEXT, role TEXT);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, uid INTEGER REFERENCES users(id), expiry INTEGER);
CREATE TABLE IF NOT EXISTS courses(id INTEGER PRIMARY KEY, owner INTEGER REFERENCES users(id), title TEXT, description TEXT, category TEXT, published INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS course_covers(course INTEGER PRIMARY KEY REFERENCES courses(id) ON DELETE CASCADE, bytes BLOB NOT NULL);
CREATE TABLE IF NOT EXISTS lessons(id INTEGER PRIMARY KEY, course INTEGER REFERENCES courses(id), title TEXT, content TEXT, file TEXT, bytes BLOB);
CREATE TABLE IF NOT EXISTS quizzes(id INTEGER PRIMARY KEY, course INTEGER REFERENCES courses(id), questions TEXT);
CREATE TABLE IF NOT EXISTS enrollments(uid INTEGER REFERENCES users(id), course INTEGER REFERENCES courses(id), PRIMARY KEY(uid,course));
CREATE TABLE IF NOT EXISTS progress(uid INTEGER, lesson INTEGER, PRIMARY KEY(uid,lesson));
CREATE TABLE IF NOT EXISTS passes(uid INTEGER, quiz INTEGER, PRIMARY KEY(uid,quiz));
CREATE TABLE IF NOT EXISTS certificates(code TEXT PRIMARY KEY, uid INTEGER REFERENCES users(id), course INTEGER REFERENCES courses(id), name TEXT, title TEXT, issued TEXT, expires TEXT, UNIQUE(uid,course));
`);
const get=(sql,...args)=>db.prepare(sql).get(...args);
const all=(sql,...args)=>db.prepare(sql).all(...args);
const run=(sql,...args)=>db.prepare(sql).run(...args);
if (!all('PRAGMA table_info(courses)').some(column => column.name === 'program')) {
 db.exec("ALTER TABLE courses ADD COLUMN program TEXT NOT NULL DEFAULT ''");
}
if (!all('PRAGMA table_info(lessons)').some(column => column.name === 'video_url')) {
 db.exec("ALTER TABLE lessons ADD COLUMN video_url TEXT NOT NULL DEFAULT ''");
}
const quizColumns=all('PRAGMA table_info(quizzes)').map(column=>column.name);
if(!quizColumns.includes('title')) db.exec("ALTER TABLE quizzes ADD COLUMN title TEXT NOT NULL DEFAULT ''");
if(!quizColumns.includes('passing_score')) db.exec('ALTER TABLE quizzes ADD COLUMN passing_score INTEGER NOT NULL DEFAULT 70 CHECK(passing_score BETWEEN 1 AND 100)');
return {get, all, run, async transaction(action) {
 db.exec('BEGIN IMMEDIATE');
 try { const result=await action(); db.exec('COMMIT'); return result; }
 catch(error) { db.exec('ROLLBACK'); throw error; }
}};
}
const database=process.env.DATABASE_URL ? await connectPostgres(process.env.DATABASE_URL) : connectSqlite();
const {get,all,run}=database;

async function certificateProgram(course) {
 const {description, program}=await get('SELECT description,program FROM courses WHERE id=?',course);
 const topics=program
  ? program.split(/\r?\n/).map(topic=>topic.trim()).filter(Boolean)
  : (await all('SELECT title FROM lessons WHERE course=? ORDER BY id',course)).map(lesson=>lesson.title);
 return {summary:description,topics};
}
const hash=(password,salt=randomBytes(16).toString('hex'))=>salt+':'+scryptSync(password,salt,64).toString('hex');
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const escapeHtml=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function courseMetadata(course, origin) {
 const url=origin+'/curso/'+course.id;
 const image=origin+(course.has_cover?'/api/courses/'+course.id+'/cover':'/proteccion-civil.png');
 const openGraph={
  'og:type':'website',
  'og:site_name':'Protección Civil Táchira',
  'og:title':course.title,
  'og:description':course.description,
  'og:url':url,
  'og:image':image,
  'og:locale':'es_VE'
 };
 return '<link rel="canonical" href="'+escapeHtml(url)+'">'+
  Object.entries(openGraph).map(([key,value])=>'<meta property="'+key+'" content="'+escapeHtml(value)+'">').join('')+
  '<meta name="twitter:card" content="summary_large_image">';
}
function coverBytes(value) {
 if(typeof value!=='string'||!value.length||value.length>1_398_104||value.length%4!==0||/[^A-Za-z0-9+/=]/.test(value)) fail(400,'Selecciona una imagen válida de hasta 1 MB.');
 const bytes=Buffer.from(value,'base64');
 if(bytes.length>1_048_576||bytes.length<10||bytes.toString('base64')!==value||
    bytes[0]!==0xff||bytes[1]!==0xd8||bytes[2]!==0xff||bytes.at(-2)!==0xff||bytes.at(-1)!==0xd9) fail(400,'La portada debe ser una imagen JPEG válida de hasta 1 MB.');
 return bytes;
}
const str=(v,max=500)=>typeof v==='string'?v.trim().slice(0,max):'';
const email=v=>str(v,254).toLowerCase();
async function addUser(input, role) {
  const name=str(input.name,120), address=email(input.email), password=str(input.password,200);
  if(!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) || password.length<10) fail(400,'Indica nombre, correo válido y contraseña de al menos 10 caracteres.');
  if(await get('SELECT id FROM users WHERE email=?',address)) fail(409,'El correo ya está registrado.');
  return (await get('INSERT INTO users(name,email,password,role) VALUES (?,?,?,?) RETURNING id',name,address,hash(password),role)).id;
}
if(process.env.ADMIN_PASSWORD && !await get("SELECT id FROM users WHERE role='admin'")) {
  await addUser({name:'Administración',email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD},'admin');
}
const publicOrigin=process.env.PUBLIC_URL ? new URL(process.env.PUBLIC_URL).origin : '';
const resetSecret=process.env.PASSWORD_RESET_SECRET;
const resetSender=process.env.PASSWORD_RESET_FROM;
const resendKey=process.env.RESEND_API_KEY;
const gmailUser=email(process.env.GMAIL_USER);
const gmailPassword=process.env.GMAIL_APP_PASSWORD?.replace(/\s/g,'');
const gmail=gmailUser&&gmailPassword ? nodemailer.createTransport({
 service:'gmail',auth:{user:gmailUser,pass:gmailPassword},
 connectionTimeout:5000,greetingTimeout:5000,socketTimeout:8000
}) : null;
const resetConfigured=publicOrigin.startsWith('https://')&&resetSecret?.length>=32&&(gmail||(resetSender&&resendKey));
const resetWindow=15*60*1000;
const gmailRequests=new Map();
const resetSignature=(account,expires)=>createHmac('sha256',resetSecret)
 .update(JSON.stringify(['password-reset',account.id,account.password,expires])).digest('hex');

async function sendResetEmail(address){
 const account=await get('SELECT id,email,password FROM users WHERE email=?',address);
 if(!account) return;
 // Keep requests within each time window identical so Resend deduplicates repeated emails.
 const expires=(Math.floor(Date.now()/resetWindow)+2)*resetWindow;
 const token=[account.id,expires,resetSignature(account,expires)].join('.');
 const link=publicOrigin+'/#restablecer/'+token;
 const subject='Restablecer tu contraseña del Aula Virtual';
 const text='Para elegir una nueva contraseña, abre este enlace durante los próximos 15 minutos:\n\n'+link+'\n\nSi no lo solicitaste, puedes ignorar este mensaje.';
 if(gmail){
  const now=Date.now();
  for(const [id,until] of gmailRequests) if(until<=now) gmailRequests.delete(id);
  if(gmailRequests.has(account.id)||gmailRequests.size>=100) return;
  gmailRequests.set(account.id,now+resetWindow);
  try{
   await gmail.sendMail({from:{name:'Aula PC Táchira',address:gmailUser},to:account.email,subject,text});
  }catch(error){
   gmailRequests.delete(account.id);
   console.error('Gmail no pudo enviar el correo de recuperación.',error.code||'SMTP');
  }
  return;
 }
 try {
  const result=await fetch('https://api.resend.com/emails',{
   method:'POST',
   headers:{Authorization:'Bearer '+resendKey,'Content-Type':'application/json','Idempotency-Key':'aula-reset/'+token},
   body:JSON.stringify({
    from:resetSender,to:[account.email],subject,text
   }),
   signal:AbortSignal.timeout(8000)
  });
  if(!result.ok) console.error('El proveedor rechazó el correo de recuperación.',result.status);
 } catch {
  console.error('No se pudo contactar al proveedor de correo de recuperación.');
 }
}
const types=['single','multiple','boolean','text','numeric','ordering'];
const normalized=value=>str(value,500).normalize('NFC').toLocaleLowerCase('es');
function grades(q,a){
 if(q.type==='text') return q.answer.some(value=>normalized(value)===normalized(a));
 if(q.type==='numeric') return (typeof a==='string'||typeof a==='number') && String(a).trim()!=='' && Number.isFinite(Number(a)) && Number(a)===q.answer;
 if(!Array.isArray(a)||a.some(n=>!Number.isInteger(n))) return false;
 const order=v=>q.type==='ordering'?v:[...v].sort((x,y)=>x-y);
 return JSON.stringify(order(a))===JSON.stringify(order(q.answer));
}
function checkQuestions(questions){
 if(!Array.isArray(questions)||questions.length<1||questions.length>50) fail(400,'Incluye de 1 a 50 preguntas.');
 return questions.map(q=>{
  if(!q || !types.includes(q.type)||!str(q.prompt)) fail(400,'Completa el enunciado y tipo de cada pregunta.');
  const points=q.points===undefined?1:Number(q.points);
  if(!Number.isInteger(points)||points<1||points>100) fail(400,'Asigna de 1 a 100 puntos por pregunta.');
  const options=q.type==='boolean'?['Verdadero','Falso']:Array.isArray(q.options)?q.options.map(o=>str(o,300)):[];
  let answer=q.answer;
  if(q.type==='text'){
   if(!Array.isArray(answer)||!answer.length||answer.some(v=>!str(v))) fail(400,'Indica las respuestas de texto aceptadas.');
   answer=answer.map(v=>str(v));
  } else if(q.type==='numeric'){
   if(typeof answer!=='number'||!Number.isFinite(answer)) fail(400,'Indica un número válido.');
  } else {
   const limit=options.length;
   if(limit<2||limit>20||options.some(o=>!o)||new Set(options).size!==limit||!Array.isArray(answer)||!answer.length||new Set(answer).size!==answer.length||answer.some(i=>!Number.isInteger(i)||i<0||i>=limit)||(q.type==='ordering'&&answer.length!==limit)||(['single','boolean'].includes(q.type)&&answer.length!==1)) fail(400,'Revisa las opciones y los índices de las respuestas.');
  }
  return {type:q.type,prompt:str(q.prompt),options,answer,points};
 });
}
function demoWorksheet(course) {
 const pdf=new PDFDocument({size:'A4',margin:54,info:{Title:course.title,Author:'Protección Civil Táchira'}});
 const result=buffer(pdf);
 pdf.fillColor('#122345').font('Helvetica-Bold').fontSize(12).text('Protección Civil Táchira · Aula virtual');
 pdf.moveDown().fontSize(22).text(course.title);
 pdf.moveDown().fontSize(15).text('Actividad práctica');
 pdf.moveDown().font('Helvetica').fontSize(12).text(course.activity,{lineGap:4});
 pdf.end();
 return result;
}

if(process.env.SEED_DEMO==='1') {
 const owner=await get("SELECT id FROM users WHERE role='admin' ORDER BY id LIMIT 1");
 if(!owner) throw new Error('SEED_DEMO requiere una cuenta administradora.');
 await database.transaction(async()=>{
  if(!await get('SELECT id FROM courses LIMIT 1')) {
   for(const course of demoCourses) {
    const program=course.lessons.map(([title])=>title).join('\n');
    const id=(await get('INSERT INTO courses(owner,title,description,category,published,program) VALUES (?,?,?,?,1,?) RETURNING id',
      owner.id,'Demostración · '+course.title,course.description,course.category,program)).id;
    for(const [index,[title,content]] of course.lessons.entries()) {
     const isLast=index===course.lessons.length-1;
     await run('INSERT INTO lessons(course,title,content,file,bytes,video_url) VALUES (?,?,?,?,?,?)',
       id,title,content,isLast?'Actividad-practica.pdf':'',isLast?await demoWorksheet(course):null,
       index===0?(course.videoUrl??''):'');
    }
    await run('INSERT INTO quizzes(course,questions) VALUES (?,?)',id,JSON.stringify(checkQuestions(course.questions)));
   }
  }
 });
}
async function body(req){
 const parts=[]; let size=0;
 for await(const part of req){size+=part.length;if(size>11_500_000) fail(413,'El archivo excede 8 MB.');parts.push(part);}
 try {const value=JSON.parse(Buffer.concat(parts));if(!value||typeof value!=='object'||Array.isArray(value)) throw Error();return value;}
 catch {fail(400,'Solicitud inválida.');}
}
const secure=publicOrigin.startsWith('https:')?'; Secure':'';
const cookie=(token,age)=>'session='+token+'; HttpOnly; SameSite=Lax; Path=/; Max-Age='+age+secure;
function expiry(date){
 const end=new Date(date), day=end.getUTCDate();
 end.setUTCDate(1);
 end.setUTCFullYear(end.getUTCFullYear()+2);
 const month=end.getUTCMonth();
 end.setUTCDate(day);
 if(end.getUTCMonth()!==month) end.setUTCDate(0);
 return end.toISOString();
}
function withPortalLayout(html) {
 return html.replace('<!-- portal-header -->',()=>readFileSync(new URL('encabezado.html',publicAssets),'utf8'))
  .replace('<!-- portal-footer -->',()=>readFileSync(new URL('pie.html',publicAssets),'utf8'));
}
export const server=createServer(async(req,res)=>{
 try{
 const url=new URL(req.url,'http://localhost'), path=url.pathname, method=req.method;
 if(method==='POST' && req.headers.origin){
  const allowed=publicOrigin||'http://'+req.headers.host;
  if(req.headers.origin!==allowed) fail(403,'El origen de la solicitud no está autorizado.');
 }
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Referrer-Policy','same-origin');
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; style-src 'self'; frame-src 'self' https://www.youtube-nocookie.com https://player.vimeo.com; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
 const json=(data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
 const token=req.headers.cookie?.match(/(?:^|; )session=([a-f0-9]+)/)?.[1]||'';
 const user=await get('SELECT u.id,u.name,u.email,u.role FROM users u JOIN sessions s ON s.uid=u.id WHERE s.token=? AND s.expiry>?',token,Date.now());
 const auth=(roles)=>{if(!user) fail(401,'Inicia sesión para continuar.');if(roles&&!roles.includes(user.role)) fail(403,'No tienes acceso a esta acción.');};
 const staff=course=>user?.role==='admin'||(user?.role==='teacher'&&user.id===course.owner);
 const enrolled=async course=>user && await get('SELECT 1 FROM enrollments WHERE uid=? AND course=?',user.id,course.id);
 if(method==='POST'&&path==='/api/password/forgot'){
  if(!resetConfigured) fail(503,'El restablecimiento por correo aún no está disponible.');
  const data=await body(req);
  // A uniform response keeps this endpoint from revealing whether an account exists.
  await sendResetEmail(email(data.email));
  return json({});
 }
 if(method==='POST'&&path==='/api/password/reset'){
  if(!resetConfigured) fail(503,'El restablecimiento por correo aún no está disponible.');
  const data=await body(req), password=str(data.password,200);
  const invalid=()=>fail(400,'El enlace ya se usó o venció. Solicita otro enlace.');
  if(password.length<10) fail(400,'Usa una contraseña de al menos 10 caracteres.');
  const match=typeof data.token==='string'&&data.token.match(/^([1-9]\d{0,9})\.(\d{13})\.([a-f0-9]{64})$/);
  if(!match||Number(match[2])<=Date.now()||Number(match[1])>2147483647) invalid();
  const id=Number(match[1]), expires=Number(match[2]);
  const account=await get('SELECT id,password FROM users WHERE id=?',id);
  if(!account||!timingSafeEqual(Buffer.from(match[3],'hex'),Buffer.from(resetSignature(account,expires),'hex'))) invalid();
  const updatedPassword=hash(password);
  await database.transaction(async()=>{
   if(expires<=Date.now()) invalid();
   const updated=await get('UPDATE users SET password=? WHERE id=? AND password=? RETURNING id',updatedPassword,id,account.password);
   if(!updated) invalid();
   await run('DELETE FROM sessions WHERE uid=?',id);
  });
  res.setHeader('Set-Cookie',cookie('',0));
  return json({});
 }
 if(method==='POST' && (path==='/api/login'||path==='/api/register')){
   const data=await body(req);
   if(path.endsWith('/register')) await addUser(data,'student');
   const account=await get('SELECT * FROM users WHERE email=?',email(data.email));
   const stored=account?.password||'0'.repeat(32)+':'+ '0'.repeat(128);
   const candidate=hash(str(data.password,200),stored.split(':')[0]);
   if(!timingSafeEqual(Buffer.from(candidate),Buffer.from(stored))||!account) fail(401,'Correo o contraseña incorrectos.');
   const session=randomBytes(32).toString('hex');
   await run('DELETE FROM sessions WHERE expiry<=? OR token=?',Date.now(),token);
   await run('INSERT INTO sessions VALUES (?,?,?)',session,account.id,Date.now()+604800000);
   res.setHeader('Set-Cookie',cookie(session,604800));
   return json({name:account.name,role:account.role});
 }
 if(method==='POST'&&path==='/api/logout'){
  await run('DELETE FROM sessions WHERE token=?',token);
  res.setHeader('Set-Cookie',cookie('',0));return json({});
 }
 if(method==='GET'&&path==='/api/me') return json(user||null);
 if(method==='GET'&&path==='/api/catalog') return json(await all('SELECT id,title,description,category,EXISTS(SELECT 1 FROM course_covers WHERE course=courses.id) AS has_cover FROM courses WHERE published=1 ORDER BY id'));
 if(method==='GET'&&path==='/api/mine'){
  auth();
  return json({
   courses:await all(`SELECT c.id,c.title,c.description,c.category,
    EXISTS(SELECT 1 FROM course_covers WHERE course=c.id) AS has_cover,
    (SELECT count(*) FROM lessons WHERE course=c.id)+(SELECT count(*) FROM quizzes WHERE course=c.id) AS activities,
    (SELECT count(*) FROM lessons l JOIN progress p ON p.lesson=l.id AND p.uid=e.uid WHERE l.course=c.id)
    +(SELECT count(*) FROM quizzes q JOIN passes p ON p.quiz=q.id AND p.uid=e.uid WHERE q.course=c.id) AS completed
    FROM courses c JOIN enrollments e ON e.course=c.id WHERE e.uid=? ORDER BY c.id`,user.id),
   certificates:await all('SELECT code,title,issued,expires FROM certificates WHERE uid=? ORDER BY issued DESC',user.id)
  });
 }
 if(path==='/api/staff'){
  auth(['teacher','admin']);
  if(method==='GET') return json({courses:user.role==='admin'?await all('SELECT c.*,u.name AS teacher FROM courses c JOIN users u ON u.id=c.owner'):await all('SELECT * FROM courses WHERE owner=?',user.id),users:user.role==='admin'?await all('SELECT id,name,email,role FROM users ORDER BY id'):[]});
  if(method==='POST'){auth(['admin']);const data=await body(req);return json({id:await addUser(data,'teacher')},201);}
 }
 if(method==='POST'&&path==='/api/staff/promote'){
  auth(['admin']);
  const {userId}=await body(req);
  if(!Number.isInteger(userId)||userId<1||userId>2147483647) fail(400,'Selecciona una cuenta válida.');
  await database.transaction(async()=>{
   const updated=await get("UPDATE users SET role='admin' WHERE id=? AND role IN ('student','teacher') RETURNING id",userId);
   if(!updated) fail(409,'La cuenta ya es administradora o no está disponible.');
   await run('DELETE FROM sessions WHERE uid=?',userId);
  });
  return json({});
 }
 if(method==='POST'&&path==='/api/courses'){
  auth(['teacher','admin']);
  const data=await body(req),title=str(data.title,140),description=str(data.description,2000),category=str(data.category,80);
  if(!title||!description||!category) fail(400,'Completa el título, la categoría y la descripción.');
  const program=str(data.program,10000);
  return json({id:(await get('INSERT INTO courses(owner,title,description,category,program) VALUES (?,?,?,?,?) RETURNING id',user.id,title,description,category,program)).id},201);
 }
 const match=path.match(/^\/api\/courses\/(\d+)(?:\/(enroll|publish|lessons|quizzes|certificate|complete|submit|file|cover)(?:\/(\d+))?)?$/);
 if(match){
  const id=Number(match[1]),action=match[2],item=Number(match[3]);
  const course=await get('SELECT * FROM courses WHERE id=?',id);
  if(!course||(!course.published&&!staff(course))) fail(404,'Curso no disponible.');
  if(action==='cover'&&!Number.isInteger(item)){
   if(method==='GET'){
    const cover=await get('SELECT bytes FROM course_covers WHERE course=?',id);
    if(!cover) fail(404,'Este curso no tiene portada.');
    res.writeHead(200,{'Content-Type':'image/jpeg'});
    return res.end(cover.bytes);
   }
   if(method==='POST'){
    auth(['teacher','admin']);
    if(!staff(course)) fail(403,'Este curso pertenece a otro docente.');
    const data=await body(req);
    const bytes=coverBytes(data.bytes);
    await run('INSERT INTO course_covers(course,bytes) VALUES (?,?) ON CONFLICT(course) DO UPDATE SET bytes=excluded.bytes',id,bytes);
    return json({});
   }
  }
  if(method==='GET'&&!action){
   const access=staff(course)||await enrolled(course);
   const learners=staff(course)?await all(`SELECT u.name,
    (SELECT count(*) FROM lessons l JOIN progress p ON p.lesson=l.id AND p.uid=e.uid WHERE l.course=e.course) AS lessons,
    (SELECT count(*) FROM quizzes q JOIN passes p ON p.quiz=q.id AND p.uid=e.uid WHERE q.course=e.course) AS quizzes
    FROM enrollments e JOIN users u ON u.id=e.uid WHERE e.course=? ORDER BY u.name, u.id`,id):undefined;
   return json({...course,has_cover:!!await get('SELECT 1 FROM course_covers WHERE course=?',id),staff:!!staff(course),enrolled:!!(await enrolled(course)),learners,
    lessons:access?await all('SELECT id,title,content,file,video_url,EXISTS(SELECT 1 FROM progress WHERE uid=? AND lesson=lessons.id) AS done FROM lessons WHERE course=? ORDER BY id',user.id,id):[],
    quizzes:access?(await all('SELECT id,title,passing_score,questions,EXISTS(SELECT 1 FROM passes WHERE uid=? AND quiz=quizzes.id) AS passed FROM quizzes WHERE course=? ORDER BY id',user.id,id)).map(row=>{
     const questions=JSON.parse(row.questions);
     return {...row,questions:staff(course)&&!course.published?questions:questions.map(({answer,...q})=>q)};
    }):[]});
  }
  if(method==='POST'&&action==='enroll'){
   auth(['student']);
   await run('INSERT INTO enrollments VALUES (?,?) ON CONFLICT DO NOTHING',user.id,id);return json({});
  }
  if(method==='POST'&&['publish','lessons','quizzes'].includes(action)){
   auth(['teacher','admin']);
   if(!staff(course)) fail(403,'Este curso pertenece a otro docente.');
   const editingMaterials=action==='lessons'&&Number.isInteger(item);
   if(course.published&&!editingMaterials) fail(409,'El curso ya está publicado.');
   if(action==='publish'){
    if(!await get('SELECT 1 FROM lessons WHERE course=?',id)||!await get('SELECT 1 FROM quizzes WHERE course=?',id)) fail(400,'Agrega una clase y una evaluación antes de publicar.');
    await run('UPDATE courses SET published=1 WHERE id=?',id);
   }
   if(action==='lessons'){
    const data=await body(req),title=str(data.title,140),content=str(data.content,18000),file=str(data.file,180);
    const bytes=typeof data.bytes==='string'&&file?Buffer.from(data.bytes,'base64'):null;
    const videoUrl=str(data.videoUrl,2048);
    if(videoUrl&&!videoEmbed(videoUrl)) fail(400,'Pega un enlace HTTPS de YouTube o Vimeo.');
    if(bytes?.length>8*1024*1024) fail(413,'El archivo excede 8 MB.');
    if(/\.pdf$/i.test(file)&&bytes?.subarray(0,5).toString()!=='%PDF-') fail(400,'El archivo no es un PDF válido.');
    if(editingMaterials){
     const lesson=await get('SELECT content,file FROM lessons WHERE id=? AND course=?',item,id);
     if(!lesson) fail(404,'Clase no disponible.');
     if(!lesson.content&&!lesson.file&&!bytes?.length&&!videoUrl) fail(400,'La clase debe conservar algún material.');
     if(bytes?.length) await run('UPDATE lessons SET file=?,bytes=?,video_url=? WHERE id=? AND course=?',file,bytes,videoUrl,item,id);
     else await run('UPDATE lessons SET video_url=? WHERE id=? AND course=?',videoUrl,item,id);
     return json({});
    }
    if((await get('SELECT published FROM courses WHERE id=?',id)).published) fail(409,'El curso ya está publicado.');
    if(!title||(!content&&!bytes?.length&&!videoUrl)) fail(400,'Agrega un título y texto, un archivo o un video.');
    await run('INSERT INTO lessons(course,title,content,file,bytes,video_url) VALUES (?,?,?,?,?,?)',id,title,content,bytes?.length?file:'',bytes,videoUrl);
   }
   if(action==='quizzes'){
    const data=await body(req);
    const questions=checkQuestions(data.questions);
    const title=str(data.title,140);
    const passingScore=data.passingScore===undefined?70:Number(data.passingScore);
    if(!Number.isInteger(passingScore)||passingScore<1||passingScore>100) fail(400,'El porcentaje de aprobación debe ser un número entre 1 y 100.');
    if((await get('SELECT published FROM courses WHERE id=?',id)).published) fail(409,'El curso ya está publicado.');
    if(Number.isInteger(item)){
     const updated=await get(`UPDATE quizzes SET questions=?,title=?,passing_score=?
      WHERE id=? AND course=? AND EXISTS(SELECT 1 FROM courses WHERE id=? AND published=0) RETURNING id`,
      JSON.stringify(questions),title,passingScore,item,id,id);
     if(!updated) fail(409,'La evaluación ya no se puede editar.');
     return json({});
    }
    await run('INSERT INTO quizzes(course,questions,title,passing_score) VALUES (?,?,?,?)',id,JSON.stringify(questions),title,passingScore);
   }
   return json({});
  }
  if(method==='GET'&&action==='file'){
   auth();if(!staff(course)&&!(await enrolled(course))) fail(403,'Inscríbete para descargar el material.');
   const lesson=await get('SELECT file,bytes FROM lessons WHERE id=? AND course=?',item,id);
   if(!lesson?.bytes) fail(404,'Archivo no disponible.');
   const preview=url.searchParams.get('preview')==='1'&&/\.pdf$/i.test(lesson.file)
     &&Buffer.from(lesson.bytes.subarray(0,5)).toString()==='%PDF-';
   if(preview) res.setHeader('Content-Security-Policy',"frame-ancestors 'self'");
   res.writeHead(200,{'Content-Type':preview?'application/pdf':'application/octet-stream','Content-Disposition':(preview?'inline':'attachment')+"; filename*=UTF-8''"+encodeURIComponent(lesson.file).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16))});
   return res.end(lesson.bytes);
  }
  if(method==='POST'&&['complete','submit','certificate'].includes(action)){
   auth(['student']);if(!(await enrolled(course))) fail(403,'Debes inscribirte primero.');
   if(action==='complete'){
    if(!await get('SELECT id FROM lessons WHERE course=? AND id=?',id,item)) fail(404,'Clase no disponible.');
    await run('INSERT INTO progress VALUES (?,?) ON CONFLICT DO NOTHING',user.id,item);return json({});
   }
   if(action==='submit'){
    const quiz=await get('SELECT questions,passing_score FROM quizzes WHERE course=? AND id=?',id,item);
    if(!quiz) fail(404,'Evaluación no disponible.');
    const {answers}=await body(req), questions=JSON.parse(quiz.questions);
    if(!Array.isArray(answers)||answers.length!==questions.length) fail(400,'Responde todas las preguntas.');
    const total=questions.reduce((sum,q)=>sum+(q.points??1),0);
    const earned=questions.reduce((sum,q,i)=>sum+(grades(q,answers[i])?(q.points??1):0),0);
    const passed=earned*100>=total*quiz.passing_score;
    const score=Number((100*earned/total).toFixed(2));
    if(passed) await run('INSERT INTO passes VALUES (?,?) ON CONFLICT DO NOTHING',user.id,item);
    return json({score,passed,passingScore:quiz.passing_score});
   }
   if((await all('SELECT id FROM lessons WHERE course=? AND id NOT IN (SELECT lesson FROM progress WHERE uid=?)',id,user.id)).length||(await all('SELECT id FROM quizzes WHERE course=? AND id NOT IN (SELECT quiz FROM passes WHERE uid=?)',id,user.id)).length) fail(409,'Completa todas las clases y aprueba todas las evaluaciones.');
   const issued=new Date();
   await run('INSERT INTO certificates VALUES (?,?,?,?,?,?,?) ON CONFLICT DO NOTHING',randomBytes(16).toString('hex'),user.id,id,user.name,course.title,issued.toISOString(),expiry(issued));
   return json(await get('SELECT code FROM certificates WHERE uid=? AND course=?',user.id,id));
  }
 }
 const verify=path.match(/^\/api\/verify\/([a-f0-9]{32})(?:\/(qr|pdf))?$/);
 if(method==='GET'&&verify){
  const record=await get('SELECT code,name,title,issued,expires,course FROM certificates WHERE code=?',verify[1]);
  if(!record) fail(404,'No encontramos un certificado con ese código.');
  const {course,...cert}=record;
  const target=(publicOrigin||'http://localhost:'+port)+'/?verify='+cert.code;
  if(verify[2]){
   const png=await QRCode.toBuffer(target,{width:240});
   if(verify[2]==='qr'){
    res.writeHead(200,{'Content-Type':'image/png'});return res.end(png);
   }
   const emblem=readFileSync(new URL('proteccion-civil.png',publicAssets));
   const pdf=await renderCertificatePdf({...cert,program:await certificateProgram(course)},png,emblem);
   res.writeHead(200,{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="certificado-${cert.code}.pdf"`});
   return res.end(pdf);
  }
  return json({...cert,program:await certificateProgram(course),valid:Date.now()<Date.parse(cert.expires)});
 }
 const sharedCourseMatch=path.match(/^\/curso\/([1-9]\d{0,9})$/);
 if((method==='GET'||method==='HEAD')&&sharedCourseMatch){
  const id=Number(sharedCourseMatch[1]);
  if(id>2147483647) fail(404,'Curso no disponible.');
  const course=await get('SELECT id,title,description,EXISTS(SELECT 1 FROM course_covers WHERE course=courses.id) AS has_cover FROM courses WHERE id=? AND published=1',id);
  if(!course) fail(404,'Curso no disponible.');
  const origin=publicOrigin||'http://localhost:'+port;
  const shell=readFileSync(new URL('index.html',publicAssets),'utf8')
   .replace(/<title>.*?<\/title>/,()=>'<title>'+escapeHtml(course.title)+' | Protección Civil Táchira</title>')
   .replace(/<meta name="description" content="[^"]*">/,()=>'<meta name="description" content="'+escapeHtml(course.description)+'">')
   .replace('</head>',()=>courseMetadata(course,origin)+'</head>');
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
  return res.end(method==='HEAD'?undefined:withPortalLayout(shell));
 }
 if(method==='GET'&&(['/','/styles.css','/portal.css','/app.js','/lesson-media.js','/tema.js','/institucion.html','/historia.html','/institucion.css','/proteccion-civil.png','/proteccion-civil-tachira.png','/defensa-civil-tachira.png','/defensa-civil-tachira.gif','/sima-tachira.jpg','/yesnardo-canal-campo.png'].includes(path)||/^\/operativos\/(?:0[1-9]|1[0-2])\.png$/.test(path))){
  const file=path==='/'?'index.html':path.slice(1);
  const contentType={
   '.html':'text/html; charset=utf-8',
   '.css':'text/css; charset=utf-8',
   '.js':'text/javascript; charset=utf-8',
   '.png':'image/png',
   '.gif':'image/gif',
   '.jpg':'image/jpeg',
  }[file.slice(file.lastIndexOf('.'))];
  const source=readFileSync(new URL(file,publicAssets));
  const content=file.endsWith('.html')?withPortalLayout(source.toString('utf8')):source;
  res.writeHead(200,{'Content-Type':contentType});
  return res.end(content);
 }
 fail(404,'Página no encontrada.');
 }catch(error){
  if(!error.status) console.error(error);
  if(!res.headersSent) res.writeHead(error.status||500,{'Content-Type':'application/json; charset=utf-8'});
  res.end(JSON.stringify({error:error.status?error.message:'Error interno del servidor.'}));
 }
});
const port=Number(process.env.PORT||3000);
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) server.listen(port,process.env.HOST||'127.0.0.1',()=>console.log('Portal disponible en http://localhost:'+port));
