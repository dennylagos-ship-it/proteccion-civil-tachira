import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes, scryptSync, timingSafeEqual} from 'node:crypto';
import {mkdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {connectPostgres} from './database.mjs';
import QRCode from 'qrcode';
import {demoCourses} from './demo-courses.mjs';
import {renderCertificatePdf} from './certificate-pdf.mjs';

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
  return {type:q.type,prompt:str(q.prompt),options,answer};
 });
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
     await run('INSERT INTO lessons(course,title,content,file,bytes) VALUES (?,?,?,?,?)',
       id,title,content,isLast?'Actividad-practica.txt':'',isLast?Buffer.from(course.activity,'utf8'):null);
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
 res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
 const json=(data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
 const token=req.headers.cookie?.match(/(?:^|; )session=([a-f0-9]+)/)?.[1]||'';
 const user=await get('SELECT u.id,u.name,u.email,u.role FROM users u JOIN sessions s ON s.uid=u.id WHERE s.token=? AND s.expiry>?',token,Date.now());
 const auth=(roles)=>{if(!user) fail(401,'Inicia sesión para continuar.');if(roles&&!roles.includes(user.role)) fail(403,'No tienes acceso a esta acción.');};
 const staff=course=>user?.role==='admin'||(user?.role==='teacher'&&user.id===course.owner);
 const enrolled=async course=>user && await get('SELECT 1 FROM enrollments WHERE uid=? AND course=?',user.id,course.id);
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
 if(method==='GET'&&path==='/api/catalog') return json(await all('SELECT id,title,description,category FROM courses WHERE published=1 ORDER BY id'));
 if(method==='GET'&&path==='/api/mine'){
  auth();
  return json({
   courses:await all('SELECT c.id,c.title,c.description,c.category FROM courses c JOIN enrollments e ON e.course=c.id WHERE e.uid=?',user.id),
   certificates:await all('SELECT code,title,issued,expires FROM certificates WHERE uid=? ORDER BY issued DESC',user.id)
  });
 }
 if(path==='/api/staff'){
  auth(['teacher','admin']);
  if(method==='GET') return json({courses:user.role==='admin'?await all('SELECT c.*,u.name AS teacher FROM courses c JOIN users u ON u.id=c.owner'):await all('SELECT * FROM courses WHERE owner=?',user.id),users:user.role==='admin'?await all('SELECT id,name,email,role FROM users ORDER BY id'):[]});
  if(method==='POST'){auth(['admin']);const data=await body(req);return json({id:await addUser(data,'teacher')},201);}
 }
 if(method==='POST'&&path==='/api/courses'){
  auth(['teacher','admin']);
  const data=await body(req),title=str(data.title,140),description=str(data.description,2000),category=str(data.category,80);
  if(!title||!description||!category) fail(400,'Completa el título, la categoría y la descripción.');
  const program=str(data.program,10000);
  return json({id:(await get('INSERT INTO courses(owner,title,description,category,program) VALUES (?,?,?,?,?) RETURNING id',user.id,title,description,category,program)).id},201);
 }
 const match=path.match(/^\/api\/courses\/(\d+)(?:\/(enroll|publish|lessons|quizzes|certificate|complete|submit|file)(?:\/(\d+))?)?$/);
 if(match){
  const id=Number(match[1]),action=match[2],item=Number(match[3]);
  const course=await get('SELECT * FROM courses WHERE id=?',id);
  if(!course||(!course.published&&!staff(course))) fail(404,'Curso no disponible.');
  if(method==='GET'&&!action){
   const access=staff(course)||await enrolled(course);
   return json({...course,staff:!!staff(course),enrolled:!!(await enrolled(course)),
    lessons:access?await all('SELECT id,title,content,file,EXISTS(SELECT 1 FROM progress WHERE uid=? AND lesson=lessons.id) AS done FROM lessons WHERE course=? ORDER BY id',user.id,id):[],
    quizzes:access?(await all('SELECT id,questions,EXISTS(SELECT 1 FROM passes WHERE uid=? AND quiz=quizzes.id) AS passed FROM quizzes WHERE course=? ORDER BY id',user.id,id)).map(row=>({...row,questions:JSON.parse(row.questions).map(({answer,...q})=>q)})):[]});
  }
  if(method==='POST'&&action==='enroll'){
   auth(['student']);
   await run('INSERT INTO enrollments VALUES (?,?) ON CONFLICT DO NOTHING',user.id,id);return json({});
  }
  if(method==='POST'&&['publish','lessons','quizzes'].includes(action)){
   auth(['teacher','admin']);
   if(!staff(course)) fail(403,'Este curso pertenece a otro docente.');
   if(course.published) fail(409,'El curso ya está publicado y su contenido está cerrado.');
   if(action==='publish'){
    if(!await get('SELECT 1 FROM lessons WHERE course=?',id)||!await get('SELECT 1 FROM quizzes WHERE course=?',id)) fail(400,'Agrega una clase y una evaluación antes de publicar.');
    await run('UPDATE courses SET published=1 WHERE id=?',id);
   }
   if(action==='lessons'){
    const data=await body(req),title=str(data.title,140),content=str(data.content,18000),file=str(data.file,180);
    if((await get('SELECT published FROM courses WHERE id=?',id)).published) fail(409,'El curso ya está publicado.');
    const bytes=typeof data.bytes==='string'&&file?Buffer.from(data.bytes,'base64'):null;
    if(!title||(!content&&!bytes?.length)) fail(400,'Agrega un título y el contenido de la clase.');
    if(bytes?.length>8*1024*1024) fail(413,'El archivo excede 8 MB.');
    await run('INSERT INTO lessons(course,title,content,file,bytes) VALUES (?,?,?,?,?)',id,title,content,bytes?.length?file:'',bytes);
   }
   if(action==='quizzes'){
    const questions=checkQuestions((await body(req)).questions);
    if((await get('SELECT published FROM courses WHERE id=?',id)).published) fail(409,'El curso ya está publicado.');
    await run('INSERT INTO quizzes(course,questions) VALUES (?,?)',id,JSON.stringify(questions));
   }
   return json({});
  }
  if(method==='GET'&&action==='file'){
   auth();if(!staff(course)&&!(await enrolled(course))) fail(403,'Inscríbete para descargar el material.');
   const lesson=await get('SELECT file,bytes FROM lessons WHERE id=? AND course=?',item,id);
   if(!lesson?.bytes) fail(404,'Archivo no disponible.');
   res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(lesson.file).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16))});
   return res.end(lesson.bytes);
  }
  if(method==='POST'&&['complete','submit','certificate'].includes(action)){
   auth(['student']);if(!(await enrolled(course))) fail(403,'Debes inscribirte primero.');
   if(action==='complete'){
    if(!await get('SELECT id FROM lessons WHERE course=? AND id=?',id,item)) fail(404,'Clase no disponible.');
    await run('INSERT INTO progress VALUES (?,?) ON CONFLICT DO NOTHING',user.id,item);return json({});
   }
   if(action==='submit'){
    const quiz=await get('SELECT questions FROM quizzes WHERE course=? AND id=?',id,item);
    if(!quiz) fail(404,'Evaluación no disponible.');
    const {answers}=await body(req), questions=JSON.parse(quiz.questions);
    if(!Array.isArray(answers)||answers.length!==questions.length) fail(400,'Responde todas las preguntas.');
    const correct=questions.filter((q,i)=>grades(q,answers[i])).length;
    const passed=correct*100>=questions.length*70;
    const score=Number((100*correct/questions.length).toFixed(2));
    if(passed) await run('INSERT INTO passes VALUES (?,?) ON CONFLICT DO NOTHING',user.id,item);
    return json({score,passed});
   }
   if((await all('SELECT id FROM lessons WHERE course=? AND id NOT IN (SELECT lesson FROM progress WHERE uid=?)',id,user.id)).length||(await all('SELECT id FROM quizzes WHERE course=? AND id NOT IN (SELECT quiz FROM passes WHERE uid=?)',id,user.id)).length) fail(409,'Completa todas las clases y aprueba las evaluaciones con al menos 70 %.');
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
   const emblem=readFileSync(new URL('public/proteccion-civil.png',import.meta.url));
   const pdf=await renderCertificatePdf({...cert,program:await certificateProgram(course)},png,emblem);
   res.writeHead(200,{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="certificado-${cert.code}.pdf"`});
   return res.end(pdf);
  }
  return json({...cert,program:await certificateProgram(course),valid:Date.now()<Date.parse(cert.expires)});
 }
 if(method==='GET'&&(['/','/styles.css','/portal.css','/app.js','/tema.js','/institucion.html','/historia.html','/institucion.css','/proteccion-civil.png','/proteccion-civil-tachira.png','/defensa-civil-tachira.png','/defensa-civil-tachira.gif','/sima-tachira.jpg','/yesnardo-canal-campo.png'].includes(path)||/^\/operativos\/(?:0[1-9]|1[0-2])\.png$/.test(path))){
  const file=path==='/'?'index.html':path.slice(1);
  const contentType={
   '.html':'text/html; charset=utf-8',
   '.css':'text/css; charset=utf-8',
   '.js':'text/javascript; charset=utf-8',
   '.png':'image/png',
   '.gif':'image/gif',
   '.jpg':'image/jpeg',
  }[file.slice(file.lastIndexOf('.'))];
  const source=readFileSync(new URL('public/'+file,import.meta.url));
  const content=file.endsWith('.html')
   ? source.toString('utf8')
    .replace('<!-- portal-header -->',()=>readFileSync(new URL('public/encabezado.html',import.meta.url),'utf8'))
    .replace('<!-- portal-footer -->',()=>readFileSync(new URL('public/pie.html',import.meta.url),'utf8'))
   : source;
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
