const root=document.querySelector('#main');
const nav=document.querySelector('#nav');
const notice=document.querySelector('#notice');
const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(label,href,style='')=>`<a class="btn ${style}" href="${href}">${label}</a>`;
const field=(label,name,type='text',extra='required')=>`<label class="field">${label}<input name="${name}" type="${type}" ${extra}></label>`;
const area=(label,name,extra='required')=>`<label class="field">${label}<textarea name="${name}" ${extra}></textarea></label>`;
const section=(title,html)=>`<section class="section wrap"><h1>${title}</h1>${html}</section>`;
const dateFmt=new Intl.DateTimeFormat('es-VE',{dateStyle:'long',timeZone:'America/Caracas'});
const types={single:'Selección única',multiple:'Selección múltiple',boolean:'Verdadero o falso',text:'Respuesta corta',numeric:'Respuesta numérica',ordering:'Ordenamiento'};
let user, revision=0, timer;
async function api(path,data){
 const response=await fetch('/api/'+path,data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
 const result=await response.json();
 if(!response.ok) throw Error(result.error);
 return result;
}
function message(text){
 clearTimeout(timer);notice.textContent=text;notice.hidden=false;
 timer=setTimeout(()=>notice.hidden=true,5000);
}
function navigation(){
 nav.innerHTML=user
  ? `<a class="portal-action portal-primary" href="#aula">Mi aula</a>${user.role!=='student'?'<a class="portal-action" href="#panel">Panel de gestión</a>':''}<button class="portal-action" data-action="logout">Salir</button>`
  : '<a class="portal-action portal-primary" href="#ingresar">Aula virtual</a>';
}
function cards(courses){
 return courses.length?`<div class="grid">${courses.map(c=>`<article class="card"><span class="icon" aria-hidden="true">▤</span><span class="category">${safe(c.category)}</span><h3>${safe(c.title)}</h3><p class="muted">${safe(c.description)}</p>${button('Ver curso','#curso/'+c.id)}</article>`).join('')}</div>`:'<p class="muted">Aquí aparecerán los cursos disponibles.</p>';
}
async function home(){
 const courses=await api('catalog').catch(()=>null);
 return `
 <section class="hero">
   <div class="wrap">
     <div>
       <h1>Protección Civil Táchira</h1>
       <p>Instituto Autónomo de Protección Civil del Estado Táchira. Prevención, atención de emergencias y formación para nuestras comunidades.</p>
       <div class="actions">
         ${button('Explorar cursos','#cursos','primary')}
         ${button(user?'Ir a mi aula':'Entrar al aula',user?'#aula':'#ingresar','secondary')}
       </div>
     </div>
     <div class="hero-art hero-watermark"><img class="hero-logo" src="/proteccion-civil.png" width="300" height="300" alt="Emblema de Protección Civil y Administración de Desastres de Venezuela"></div>
   </div>
   <fondo-operativos></fondo-operativos>
 </section>
 <section class="section wrap" aria-labelledby="welcome-title">
   <div class="welcome-panel">
     <div class="welcome-copy">
       <p class="welcome-label">Dirección de Protección Civil Táchira · Mensaje propuesto</p>
       <h2 id="welcome-title">Bienvenidos a Protección Civil Táchira</h2>
       <p>Este portal está al servicio de quienes quieren prepararse para una emergencia y ayudar a su comunidad. Aquí pueden conocer nuestra historia, consultar los canales de atención y acceder al aula virtual para formarse en prevención y gestión del riesgo.</p>
       <p>Les invitamos a llevar lo aprendido a sus hogares, escuelas y lugares de trabajo. Una comunidad que sabe cómo actuar está mejor preparada para cuidar a su gente.</p>
       ${button('Explorar el aula virtual',user?'#aula':'#cursos','primary')}
     </div>
     <figure class="welcome-portrait">
       <img src="/yesnardo-canal-campo.png" width="335" height="597" alt="Yesnardo Canal con uniforme de Protección Civil en exteriores">
       <figcaption>
         <strong>Yesnardo Canal</strong>
         <span>Director de Protección Civil Táchira</span>
       </figcaption>
     </figure>
   </div>
 </section>
 <section class="section wrap" aria-labelledby="home-courses">
   <div class="home-section-heading"><h2 id="home-courses">Cursos disponibles</h2><a href="#cursos">Ver catálogo completo</a></div>
   ${courses ? cards(courses.slice(0,4)) : '<p role="status">El catálogo no está disponible en este momento.</p>'}
 </section>
 <section class="home-directory" aria-label="Institución y contacto">
   <div class="wrap section home-directory-grid">
     <div class="home-institution">
       <h2>Conoce al INAPROCET</h2>
       <p>El instituto estadal desarrolla programas de educación y autoprotección y coordina la atención ante emergencias y desastres en el Táchira.</p>
       <div class="grid">
         <article class="card"><h3>Institución</h3><p class="muted">Misión, visión y redes institucionales.</p>${button('Conocer al instituto','/institucion.html')}</article>
         <article class="card"><h3>Historia</h3><p class="muted">El memorial de Defensa Civil y Protección Civil Táchira.</p>${button('Leer el memorial','/historia.html')}</article>
       </div>
     </div>
     <section id="contacto" class="panel home-contact" aria-labelledby="contact-title">
       <h2 id="contact-title">Contacto</h2>
       <p>Protección Civil Táchira · San Cristóbal</p>
       <ul>
         <li><span>Línea PCASIST</span><a href="tel:08007227478">0800-722-7478</a></li>
         <li><span>Teléfono local</span><a href="tel:+582763539133">0276-353-9133</a></li>
       </ul>
       <a href="https://www.tachiranews.com/proteccion-civil-tachira-continua-con-el-proceso-de-desinfeccion/">Fuente de los teléfonos</a>
     </section>
   </div>
 </section>`;
}
function login(register){
 return section(register?'Crear cuenta':'Entrar al aula',`<div class="panel narrow"><form data-form="${register?'register':'login'}">${register?field('Nombre completo','name','text','required autocomplete="name"'):''}${field('Correo electrónico','email','email','required autocomplete="email"')}${field('Contraseña','password','password',register?'required minlength="10" autocomplete="new-password"':'required autocomplete="current-password"')}<button class="primary">${register?'Crear cuenta':'Iniciar sesión'}</button></form><p>${register?'<a href="#ingresar">Ya tengo cuenta</a>':'<a href="#registro">Crear cuenta de estudiante</a>'}</p></div>`);
}
async function dashboard(){
 if(!user)return login(false);
 const data=await api('mine');
 return section('Mi aula',`<p>Hola, ${safe(user.name)}.</p>${cards(data.courses)}<div class="panel stack"><h2>Mis certificados</h2>${data.certificates.length?`<ul class="list">${data.certificates.map(c=>`<li><a href="/?verify=${c.code}">${safe(c.title)}</a> · vence el ${dateFmt.format(new Date(c.expires))}</li>`).join('')}</ul>`:'<p class="muted">Tus certificados aparecerán cuando los emitas.</p>'}</div>`);
}
async function panel(){
 if(!user)return login(false);
 const {courses,users}=await api('staff');
 return section(user.role==='admin'?'Administración':'Panel docente',`<div class="stack"><section class="panel"><h2>Gestionar cursos</h2><ul class="list">${courses.map(c=>`<li><a href="#curso/${c.id}">${safe(c.title)}</a> · ${c.published?'Publicado':'Borrador'}${c.teacher?' · '+safe(c.teacher):''}</li>`).join('')}</ul><details${courses.length?'':' open'}><summary>Crear curso</summary><form class="stack" data-form="createCourse"><div>${field('Título','title')}${field('Categoría','category')}${area('Descripción','description')}<label class="field">Contenido programático para el certificado (un tema por línea)<textarea name="program" maxlength="10000"></textarea></label><button class="primary">Crear borrador</button></div></form></details></section>${user.role==='admin'?`<section class="panel"><h2>Usuarios</h2><ul class="list">${users.map(u=>`<li>${safe(u.name)} · ${safe(u.email)} · ${{admin:'Administración',teacher:'Docente',student:'Estudiante'}[u.role]}</li>`).join('')}</ul><details><summary>Crear cuenta docente</summary><form class="stack" data-form="teacher"><div>${field('Nombre completo','name')}${field('Correo electrónico','email','email')}${field('Contraseña','password','password','required minlength="10" autocomplete="new-password"')}<button>Crear docente</button></div></form></details></section>`:''}</div>`);
}
function questionEditor(){
 return `<fieldset class="question"><legend>Pregunta</legend><label class="field">Tipo<select name="type">${Object.entries(types).map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</select></label>${field('Enunciado','prompt')}<div data-options></div><button type="button" class="secondary" data-action="removeQuestion">Quitar pregunta</button></fieldset>`;
}
function editorFields(type){
 if(type==='boolean')return '<label class="field">Respuesta correcta<select name="correct"><option value="1">Verdadero</option><option value="2">Falso</option></select></label>';
 if(type==='numeric')return field('Respuesta correcta','correct','number','required step="any"');
 if(type==='text')return area('Respuestas aceptadas, una por línea','correct');
 const labels={single:'Número de la opción correcta',multiple:'Números de las opciones correctas separados por comas',ordering:'Números de todas las opciones en orden correcto, separados por comas'};
 return area('Opciones, una por línea','options')+field(labels[type],'correct');
}
function quizInputs(q,i){
 const name='q'+i;
 if(q.type==='text'||q.type==='numeric')return field('Tu respuesta',name,q.type==='text'?'text':'number',q.type==='text'?'required':'required step="any"');
 if(q.type==='ordering')return q.options.map((option,j)=>`<label class="field">${safe(option)}<select name="${name}" data-position="${j}" required><option value="">Selecciona su posición</option>${q.options.map((_,k)=>`<option value="${k}">${k+1}</option>`).join('')}</select></label>`).join('');
 return q.options.map((option,j)=>`<label class="choice"><input type="${q.type==='multiple'?'checkbox':'radio'}" name="${name}" value="${j}" ${q.type==='multiple'?'':'required'}> ${safe(option)}</label>`).join('');
}
async function course(id){
 const c=await api('courses/'+id);
 const editor=c.staff&&!c.published?`<section class="panel"><h2>Preparar el curso</h2><details><summary>Subir clase</summary><form class="stack" data-form="lesson" data-course="${id}"><div>${field('Título','title')}${area('Contenido','content','')}${field('Material descargable (hasta 8 MB)','file','file','')}<button>Guardar clase</button></div></form></details><details><summary>Crear evaluación</summary><form class="stack" data-form="quiz" data-course="${id}"><div data-questions>${questionEditor()}</div><div class="actions"><button type="button" class="secondary" data-action="addQuestion">Agregar pregunta</button><button>Guardar evaluación</button></div></form></details><p><button class="primary" data-action="publish" data-course="${id}">Publicar curso</button></p></section>`:'';
 const ready=c.lessons.length&&c.quizzes.length&&c.lessons.every(l=>l.done)&&c.quizzes.every(q=>q.passed);
 return section(safe(c.title),`<div class="category">${safe(c.category)}</div><p>${safe(c.description)}</p>${!c.enrolled&&!c.staff?(user?'<button class="primary" data-action="enroll" data-course="'+id+'">Inscribirme</button>':button('Inicia sesión para inscribirte','#ingresar','primary')):''}<div class="stack">${editor}${c.lessons.map(l=>`<article class="panel"><h2>${safe(l.title)}</h2><p class="lesson-text">${safe(l.content)}</p>${l.file?`<p><a href="/api/courses/${id}/file/${l.id}">Descargar ${safe(l.file)}</a></p>`:''}${c.enrolled?(l.done?'<span class="tag">Clase completada</span>':`<button data-action="complete" data-course="${id}" data-id="${l.id}">Marcar como completada</button>`):''}</article>`).join('')}${c.quizzes.map((q,i)=>`<article class="panel"><h2>Evaluación ${i+1}</h2>${q.passed?'<p class="tag">Evaluación aprobada</p>':''}${c.enrolled?`<form data-form="submit" data-course="${id}" data-id="${q.id}" data-types="${q.questions.map(x=>x.type).join(',')}">${q.questions.map((x,j)=>`<fieldset class="question"><legend>${safe(x.prompt)}</legend><p class="muted">${types[x.type]}</p>${quizInputs(x,j)}</fieldset>`).join('')}<button>Enviar respuestas</button></form>`:`<ul class="list">${q.questions.map(x=>`<li>${safe(x.prompt)} · ${types[x.type]}</li>`).join('')}</ul>`}</article>`).join('')}${c.enrolled?`<section class="panel"><h2>Certificado</h2>${ready?`<button class="primary" data-action="certificate" data-course="${id}">Obtener certificado</button>`:'<p>Completa todas las clases y aprueba las evaluaciones para obtener tu certificado.</p>'}</section>`:''}</div>`);
}
async function verify(code){
 let result='';
 if(code){
  try{
   const c=await api('verify/'+encodeURIComponent(code.toLowerCase()));
   result=`<section class="panel certificate stack"><h2>Certificado de aprobación</h2><div>Protección Civil Táchira</div><h3>${safe(c.name)}</h3><strong>${safe(c.title)}</strong><div class="${c.valid?'tag':'expired'}">${c.valid?'Vigente':'Vencido'}</div><div>Emitido el ${dateFmt.format(new Date(c.issued))}<br>Vence el ${dateFmt.format(new Date(c.expires))}</div><img src="/api/verify/${c.code}/qr" alt="Código QR para verificar el certificado"><code>${c.code}</code><div class="actions no-print"><a class="btn primary" href="/api/verify/${c.code}/pdf" download>Descargar PDF</a><button data-action="share-certificate" data-id="${c.code}">Compartir enlace</button><button data-action="print">Imprimir</button></div></section><section class="panel certificate-program stack"><h2>Contenido programático</h2>${c.program.summary?'<p>'+safe(c.program.summary)+'</p>':''}${c.program.topics.length?'<ol class="list">'+c.program.topics.map(topic=>'<li>'+safe(topic)+'</li>').join('')+'</ol>':'<p class="muted">Temario no disponible en el registro del curso.</p>'}</section>`;
  }catch(error){result=`<p class="panel expired" role="alert">${safe(error.message)}</p>`;}
 }
 return section('Verificar certificado',`<div class="narrow"><form class="panel no-print" data-form="verify">${field('Código del certificado','code','text',`required pattern="[0-9a-fA-F]{32}" maxlength="32" value="${safe(code)}"`)}<button class="primary">Consultar certificado</button></form>${result}</div>`);
}
async function render(){
 const current=++revision;
 const route=location.hash.slice(1), code=new URLSearchParams(location.search).get('verify');
 navigation();
 try{
  let html;
  if(!route&&code) html=await verify(code);
  else if(route==='cursos')html=section('Catálogo de cursos',cards(await api('catalog')));
  else if(route==='ingresar'||route==='registro')html=login(route==='registro');
  else if(route==='aula')html=await dashboard();
  else if(route==='panel')html=await panel();
  else if(route==='verificar')html=await verify('');
  else if(/^curso\/\d+$/.test(route))html=await course(route.split('/')[1]);
  else html=await home();
  if(current!==revision)return;
  root.innerHTML=html;
  if(route==='contacto') document.getElementById('contacto')?.scrollIntoView();
  root.querySelectorAll('[data-options]').forEach(e=>e.innerHTML=editorFields('single'));
 }catch(error){if(current===revision)root.innerHTML=section('Página no disponible',`<p role="alert">${safe(error.message)}</p>`);}
}
const lines=value=>value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
function encodeFile(file){
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onload=()=>resolve(reader.result.split(',')[1]);
  reader.onerror=()=>reject(Error('No se pudo leer el archivo.'));
  reader.readAsDataURL(file);
 });
}
root.addEventListener('change',event=>{
 if(event.target.name==='type')event.target.closest('fieldset').querySelector('[data-options]').innerHTML=editorFields(event.target.value);
});
document.addEventListener('click',async event=>{
 const control=event.target.closest('[data-action]');
 if(!control)return;
 const {action,course,id}=control.dataset;
 try{
  if(action==='print'){window.print();return;}
  if(action==='share-certificate'){
   const url=new URL('/?verify='+id,location.origin).href;
   if(navigator.share){
    try{await navigator.share({title:'Certificado de Protección Civil Táchira',url});return;}
    catch(error){if(error.name==='AbortError')return;}
   }
   try{await navigator.clipboard.writeText(url);message('Enlace del certificado copiado.');}
   catch{window.prompt('Copia el enlace del certificado',url);}
   return;
  }
  if(action==='addQuestion'){
   const container=control.form.querySelector('[data-questions]');
   if(container.children.length>=50)throw Error('La evaluación admite hasta 50 preguntas.');
   container.insertAdjacentHTML('beforeend',questionEditor());
   container.lastElementChild.querySelector('[data-options]').innerHTML=editorFields('single');return;
  }
  if(action==='removeQuestion'){
   const question=control.closest('fieldset');
   if(question.parentElement.children.length<=1)throw Error('La evaluación necesita al menos una pregunta.');
   question.remove();return;
  }
  if(action==='publish'&&!confirm('¿Publicar el curso? Después de publicarlo se cerrará su contenido.'))return;
  control.disabled=true;
  if(action==='logout'){await api('logout',{});user=null;location.hash='inicio';await render();return;}
  const data=await api('courses/'+course+'/'+action+(id?'/'+id:''),{});
  if(action==='certificate'){location.href='/?verify='+data.code;return;}
  message({publish:'Curso publicado.',enroll:'Inscripción registrada.',complete:'Clase completada.'}[action]);
  await render();
 }catch(error){message(error.message);}finally{control.disabled=false;}
});
root.addEventListener('submit',async event=>{
 event.preventDefault();
 const form=event.target, kind=form.dataset.form, id=form.dataset.course;
 const fields=new FormData(form), data=Object.fromEntries(fields), submitter=event.submitter;
 if(submitter)submitter.disabled=true;
 try{
  if(kind==='verify'){location.href='/?verify='+encodeURIComponent(data.code.trim());return;}
  if(kind==='login'||kind==='register'){
   user=await api(kind,data);location.hash=user.role==='student'?'aula':'panel';return;
  }
  if(kind==='teacher'){await api('staff',data);message('Cuenta docente creada.');}
  if(kind==='createCourse'){const result=await api('courses',data);location.hash='curso/'+result.id;return;}
  if(kind==='lesson'){
   const file=data.file;
   if(file.size>8*1024*1024)throw Error('El archivo excede 8 MB.');
   await api('courses/'+id+'/lessons',{title:data.title,content:data.content,file:file.name,bytes:file.size?await encodeFile(file):null});
   message('Clase guardada.');
  }
  if(kind==='quiz'){
   const questions=Array.from(form.querySelectorAll('fieldset'),node=>{
    const value=name=>node.querySelector('[name="'+name+'"]')?.value;
    const type=value('type'), correct=value('correct');
    const answer=type==='text'?lines(correct):type==='numeric'?Number(correct):correct.split(',').map(index=>Number(index.trim())-1);
    return {type,prompt:value('prompt'),options:value('options')?lines(value('options')):[],answer};
   });
   await api('courses/'+id+'/quizzes',{questions});message('Evaluación guardada.');
  }
  if(kind==='submit'){
   const answers=form.dataset.types.split(',').map((type,i)=>{
    const entries=fields.getAll('q'+i);
    if(type==='text'||type==='numeric')return entries[0];
    if(!entries.length)throw Error('Selecciona al menos una respuesta por pregunta.');
    const values=entries.map(Number);
    if(type!=='ordering')return values;
    if(new Set(values).size!==values.length)throw Error('Usa cada posición una sola vez.');
    return values.map((_,position)=>values.indexOf(position));
   });
   const result=await api('courses/'+id+'/submit/'+form.dataset.id,{answers});
   message(`Resultado: ${result.score} %. ${result.passed?'Aprobaste.':'Necesitas al menos 70 %. Puedes volver a intentarlo.'}`);
  }
  await render();
 }catch(error){message(error.message);}finally{if(submitter)submitter.disabled=false;}
});
window.addEventListener('hashchange',()=>{render();window.scrollTo(0,0);});
try{user=await api('me');}catch(error){message(error.message);}
await render();
