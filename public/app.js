import {videoEmbed} from './lesson-media.js';

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
function coverImage(course){
 const source=course.has_cover?'/api/courses/'+Number(course.id)+'/cover':'/proteccion-civil.png';
 return `<img class="course-cover${course.has_cover?'':' course-cover-default'}" src="${source}" alt="" width="1200" height="675" loading="lazy">`;
}
function shareCourse(course){
 const url=new URL('/curso/'+Number(course.id),location.origin).href;
 const whatsapp='https://wa.me/?'+new URLSearchParams({text:course.title+' '+url});
 const facebook='https://www.facebook.com/sharer/sharer.php?'+new URLSearchParams({u:url});
 return `<details class="course-share">
  <summary aria-label="Compartir ${safe(course.title)}">Compartir</summary>
  <div class="course-share-links">
   <a href="${safe(whatsapp)}" target="_blank" rel="noopener noreferrer">WhatsApp</a>
   <a href="${safe(facebook)}" target="_blank" rel="noopener noreferrer">Facebook</a>
   <button type="button" data-action="copy-course-link" data-id="${Number(course.id)}">Copiar enlace</button>
  </div>
 </details>`;
}
function cards(courses){
 return courses.length?`<div class="grid">${courses.map(c=>`<article class="card course-card">${coverImage(c)}<span class="category">${safe(c.category)}</span><h3>${safe(c.title)}</h3><p class="muted">${safe(c.description)}</p>${Number(c.activities)>0?progressLabel(Number(c.completed),Number(c.activities)):''}${button(c.activities!==undefined?'Continuar curso':'Ver curso','#curso/'+c.id)}${c.activities===undefined?shareCourse(c):''}</article>`).join('')}</div>`:'<p class="muted">Aquí aparecerán los cursos disponibles.</p>';
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
       <p class="welcome-label">Dirección de Protección Civil Táchira</p>
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
   ${courses ? cards(courses.toSorted((a,b)=>b.id-a.id).slice(0,4)) : '<p role="status">El catálogo no está disponible en este momento.</p>'}
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
function passwordRecovery(token=''){
 const resetting=Boolean(token);
 return section(resetting?'Elige una nueva contraseña':'Recuperar contraseña',`<div class="panel narrow">
  <form data-form="${resetting?'resetPassword':'forgotPassword'}">
   ${resetting?`
    <input type="hidden" name="token" value="${safe(token)}">
    ${field('Nueva contraseña','password','password','required minlength="10" maxlength="200" autocomplete="new-password"')}
    ${field('Confirma la nueva contraseña','confirmation','password','required minlength="10" maxlength="200" autocomplete="new-password"')}
   `:field('Correo electrónico de tu cuenta','email','email','required maxlength="254" autocomplete="email"')}
   <button class="primary">${resetting?'Cambiar contraseña':'Enviar enlace de recuperación'}</button>
  </form>
  <p><a href="${resetting?'#recuperar':'#ingresar'}">${resetting?'Solicitar otro enlace':'Volver a iniciar sesión'}</a></p>
 </div>`);
}
function login(register){
 return section(register?'Crear cuenta':'Entrar al aula',`<div class="panel narrow"><form data-form="${register?'register':'login'}">${register?field('Nombre completo','name','text','required autocomplete="name"'):''}${field('Correo electrónico','email','email','required autocomplete="email"')}${field('Contraseña','password','password',register?'required minlength="10" autocomplete="new-password"':'required autocomplete="current-password"')}<button class="primary">${register?'Crear cuenta':'Iniciar sesión'}</button></form><p>${register?'<a href="#ingresar">Ya tengo cuenta</a>':'<a href="#recuperar">Olvidé mi contraseña</a> · <a href="#registro">Crear cuenta de estudiante</a>'}</p></div>`);
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
function questionEditor(question={}) {
 const type=question.type ?? 'single';
 return `<fieldset class="question"><legend>Pregunta</legend>
  <label class="field">Tipo<select name="type">${Object.entries(types).map(([key,label])=>`<option value="${key}"${key===type?' selected':''}>${label}</option>`).join('')}</select></label>
  ${field('Enunciado','prompt','text',`required value="${safe(question.prompt)}"`)}
  ${field('Puntos','points','number',`required min="1" max="100" step="1" value="${question.points??1}"`)}
  <div data-options>${editorFields(type,question)}</div>
  <button type="button" class="secondary" data-action="removeQuestion">Quitar pregunta</button>
 </fieldset>`;
}
function editorFields(type, question={}) {
 const {answer, options=[]}=question;
 if(type==='boolean') return `<label class="field">Respuesta correcta<select name="correct"><option value="1">Verdadero</option><option value="2"${answer?.[0]===1?' selected':''}>Falso</option></select></label>`;
 if(type==='numeric') return field('Respuesta correcta','correct','number',`required step="any" value="${safe(answer)}"`);
 if(type==='text') return `<label class="field">Respuestas aceptadas, una por línea<textarea name="correct" required>${safe((answer??[]).join('\n'))}</textarea></label>`;
 const labels={single:'Número de la opción correcta',multiple:'Números de las opciones correctas separados por comas',ordering:'Números de todas las opciones en orden correcto, separados por comas'};
 return `<label class="field">Opciones, una por línea<textarea name="options" required>${safe(options.join('\n'))}</textarea></label>`
  +field(labels[type],'correct','text',`required value="${(answer??[]).map(i=>i+1).join(', ')}"`);
}
function quizEditor(courseId, quiz) {
 return `<details><summary>${quiz?'Editar evaluación':'Crear evaluación'}</summary>
  <form class="stack" data-form="quiz" data-course="${courseId}" data-quiz="${quiz?.id??''}">
   ${field('Título de la evaluación','title','text',`required value="${safe(quiz?.title)}"`)}
   ${field('Porcentaje mínimo de aprobación','passingScore','number',`required min="1" max="100" step="1" value="${quiz?.passing_score??70}"`)}
   <div data-questions>${quiz?quiz.questions.map(questionEditor).join(''):questionEditor()}</div>
   <div class="actions"><button type="button" class="secondary" data-action="addQuestion">Agregar pregunta</button><button>Guardar evaluación</button></div>
  </form></details>`;
}
function quizInputs(q,i){
 const name='q'+i;
 if(q.type==='text'||q.type==='numeric')return field('Tu respuesta',name,q.type==='text'?'text':'number',q.type==='text'?'required':'required step="any"');
 if(q.type==='ordering')return q.options.map((option,j)=>`<label class="field">${safe(option)}<select name="${name}" data-position="${j}" required><option value="">Selecciona su posición</option>${q.options.map((_,k)=>`<option value="${k}">${k+1}</option>`).join('')}</select></label>`).join('');
 return q.options.map((option,j)=>`<label class="choice"><input type="${q.type==='multiple'?'checkbox':'radio'}" name="${name}" value="${j}" ${q.type==='multiple'?'':'required'}> ${safe(option)}</label>`).join('');
}
function lessonMaterials(courseId, lesson) {
 const embed = videoEmbed(lesson.video_url);
 const file = '/api/courses/' + courseId + '/file/' + lesson.id;
 const pdf = /\.pdf$/i.test(lesson.file || '');
 const video = embed ? `<section class="lesson-resource">
  <h3>Video de la lección</h3>
  <iframe class="lesson-video" loading="lazy" src="${safe(embed)}" title="Video · ${safe(lesson.title)}" referrerpolicy="strict-origin-when-cross-origin" allow="fullscreen; picture-in-picture" allowfullscreen></iframe>
  <a href="${safe(lesson.video_url)}" target="_blank" rel="noopener noreferrer">Abrir video en su plataforma</a>
 </section>` : '';
 const document = lesson.file ? `<section class="lesson-resource">
  <h3>Material de estudio</h3>
  ${pdf ? `<iframe class="lesson-pdf" loading="lazy" src="${file}?preview=1" title="PDF · ${safe(lesson.file)}"></iframe>
  <a href="${file}?preview=1" target="_blank" rel="noopener">Abrir PDF en otra pestaña</a>` : ''}
  <a href="${file}" download>Descargar ${safe(lesson.file)}</a>
 </section>` : '';
 return video + document;
}

function lessonResourceEditor(courseId, lesson) {
 return `<details class="lesson-resource-editor"><summary>Editar materiales</summary>
  <form class="stack" data-form="lesson" data-course="${courseId}" data-lesson="${lesson.id}">
   ${field('Subir o reemplazar archivo (hasta 8 MB)','file','file','')}
   ${field('Enlace de YouTube o Vimeo','videoUrl','url',`value="${safe(lesson.video_url)}"`)}
   <button>Guardar materiales</button>
  </form>
 </details>`;
}

function progressLabel(completed, activities) {
 return `<label class="course-progress">${completed} de ${activities} actividades completadas
  <progress value="${completed}" max="${activities}"></progress></label>`;
}

function courseOutline(course) {
 if (!course.lessons.length) return '';
 const activities = course.lessons.length + course.quizzes.length;
 const completed = course.lessons.filter(lesson => lesson.done).length
  + course.quizzes.filter(quiz => quiz.passed).length;
 return `<aside class="panel course-outline" aria-label="Contenido del curso">
  <h2>Contenido del curso</h2>
  ${course.enrolled ? progressLabel(completed,activities) : ''}
  <ol class="course-steps">
   ${course.lessons.map(lesson => `<li><button type="button" data-action="jump" data-id="lesson-${lesson.id}">${safe(lesson.title)}</button>${lesson.done ? '<span>Completada</span>' : ''}</li>`).join('')}
   ${course.quizzes.map((quiz,index) => `<li><button type="button" data-action="jump" data-id="quiz-${quiz.id}">${safe(quiz.title || ("Evaluación "+(index+1)))}</button>${quiz.passed ? '<span>Aprobada</span>' : ''}</li>`).join('')}
  </ol>
 </aside>`;
}

function courseReport(course) {
 if (!course.staff) return '';
 return `<details class="panel course-report">
  <summary>Seguimiento de estudiantes (${course.learners.length})</summary>
  ${course.learners.length ? `<ul class="list">${course.learners.map(learner=>`<li>
   <strong>${safe(learner.name)}</strong> · ${Number(learner.lessons)}/${course.lessons.length} clases · ${Number(learner.quizzes)}/${course.quizzes.length} evaluaciones aprobadas
  </li>`).join('')}</ul>` : '<p class="muted">Aún no hay estudiantes inscritos.</p>'}
 </details>`;
}

function courseCoverEditor(course){
 return `<details class="panel course-cover-editor">
  <summary>Imagen de portada</summary>
  ${coverImage(course)}
  <form class="stack" data-form="cover" data-course="${Number(course.id)}">
   ${field('Seleccionar imagen de portada','image','file','required accept="image/jpeg,image/png,image/webp"')}
   <p class="muted">JPG, PNG o WebP de hasta 8 MB. La tarjeta usa un recorte horizontal de 16:9.</p>
   <button>Guardar portada</button>
  </form>
 </details>`;
}

async function course(id){
 const c=await api('courses/'+id);
 const editor=c.staff&&!c.published?`<section class="panel"><h2>Preparar el curso</h2><details><summary>Subir clase</summary><form class="stack" data-form="lesson" data-course="${id}"><div>${field('Título','title')}${area('Contenido','content','')}${field('Material de estudio (PDF u otro archivo, hasta 8 MB)','file','file','')}${field('Enlace de YouTube o Vimeo','videoUrl','url','placeholder="https://…"')}<button>Guardar clase</button></div></form></details>${quizEditor(id)}<p><button class="primary" data-action="publish" data-course="${id}">Publicar curso</button></p></section>`:'';
 const ready=c.lessons.length&&c.quizzes.length&&c.lessons.every(l=>l.done)&&c.quizzes.every(q=>q.passed);
 return section(safe(c.title),`<div class="category">${safe(c.category)}</div><p>${safe(c.description)}</p>${!c.enrolled&&!c.staff?(user?'<button class="primary" data-action="enroll" data-course="'+id+'">Inscribirme</button>':button('Inicia sesión para inscribirte','#ingresar','primary')):''}${c.staff?courseCoverEditor(c):''}${editor}${courseReport(c)}<div class="course-layout">${courseOutline(c)}<div class="stack course-activities">${c.lessons.map(l=>`<article class="panel" id="lesson-${l.id}" tabindex="-1"><h2>${safe(l.title)}</h2><p class="lesson-text">${safe(l.content)}</p>${lessonMaterials(id,l)}${c.staff?lessonResourceEditor(id,l):''}${c.enrolled?(l.done?'<span class="tag">Clase completada</span>':`<button data-action="complete" data-course="${id}" data-id="${l.id}">Marcar como completada</button>`):''}</article>`).join('')}${c.quizzes.map((q,i)=>`<article class="panel" id="quiz-${q.id}" tabindex="-1"><h2>${safe(q.title || ("Evaluación "+(i+1)))}</h2><p class="muted">Aprobación mínima: ${Number(q.passing_score)} %</p>${c.staff&&!c.published?quizEditor(id,q):''}${q.passed?'<p class="tag">Evaluación aprobada</p>':''}${c.enrolled?`<form data-form="submit" data-course="${id}" data-id="${q.id}" data-types="${q.questions.map(x=>x.type).join(',')}">${q.questions.map((x,j)=>`<fieldset class="question"><legend>${safe(x.prompt)}</legend><p class="muted">${types[x.type]} · ${x.points ?? 1} puntos</p>${quizInputs(x,j)}</fieldset>`).join('')}<button>Enviar respuestas</button></form>`:`<ul class="list">${q.questions.map(x=>`<li>${safe(x.prompt)} · ${types[x.type]}</li>`).join('')}</ul>`}</article>`).join('')}${c.enrolled?`<section class="panel"><h2>Certificado</h2>${ready?`<button class="primary" data-action="certificate" data-course="${id}">Obtener certificado</button>`:'<p>Completa todas las clases y aprueba las evaluaciones para obtener tu certificado.</p>'}</section>`:''}</div></div>`);
}
function linkedInCertificate(certificate) {
 const url=new URL('/?verify='+certificate.code,location.origin).href;
 return `<details class="panel certificate-linkedin no-print">
  <summary>Agregar a LinkedIn</summary>
  <p>Abre «Licencias y certificaciones» y completa los campos con estos datos.</p>
  <dl>
   <dt>Nombre de la certificación</dt><dd>${safe(certificate.title)}</dd>
   <dt>Organización emisora</dt><dd>Instituto Autónomo de Protección Civil del Estado Táchira</dd>
   <dt>Emisión</dt><dd>${dateFmt.format(new Date(certificate.issued))}</dd>
   <dt>Vencimiento</dt><dd>${dateFmt.format(new Date(certificate.expires))}</dd>
   <dt>ID de la credencial</dt><dd><code>${safe(certificate.code)}</code></dd>
   <dt>URL de la credencial</dt><dd><a href="${safe(url)}">${safe(url)}</a></dd>
  </dl>
  <div class="actions">
   <a class="btn primary" href="https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME" target="_blank" rel="noopener noreferrer">Abrir LinkedIn</a>
   <button type="button" data-action="copy-certificate-link" data-id="${safe(certificate.code)}">Copiar URL de verificación</button>
  </div>
 </details>`;
}
async function verify(code){
 let result='';
 if(code){
  try{
   const c=await api('verify/'+encodeURIComponent(code.toLowerCase()));
   result=`<section class="panel certificate"><img class="certificate-emblem" src="/proteccion-civil.png" alt="Escudo de Protección Civil"><p class="certificate-institution">Protección Civil Táchira</p><h2>Certificado de aprobación</h2><p>Se otorga el presente certificado a</p><h3>${safe(c.name)}</h3><p>Por haber aprobado el curso</p><strong class="certificate-course">${safe(c.title)}</strong><div class="certificate-meta"><div><span>Emisión</span><strong>${dateFmt.format(new Date(c.issued))}</strong></div><div><span>Vigencia hasta</span><strong>${dateFmt.format(new Date(c.expires))}</strong><span class="${c.valid?'tag':'expired'}">${c.valid?'Vigente':'Vencido'}</span></div><div><span>Verificación</span><code>${c.code}</code></div><img class="certificate-qr" src="/api/verify/${c.code}/qr" alt="Código QR para verificar el certificado"></div></section><div class="actions certificate-actions no-print"><a class="btn primary" href="/api/verify/${c.code}/pdf" download>Descargar PDF</a><button data-action="share-certificate" data-id="${c.code}">Compartir enlace</button><button data-action="print">Imprimir</button></div>${linkedInCertificate(c)}<section class="panel certificate-program stack"><h2>Contenido programático</h2><strong>${safe(c.title)}</strong>${c.program.summary?'<p>'+safe(c.program.summary)+'</p>':''}${c.program.topics.length?'<ol class="list">'+c.program.topics.map(topic=>'<li>'+safe(topic)+'</li>').join('')+'</ol>':'<p class="muted">Temario no disponible en el registro del curso.</p>'}</section>`;
  }catch(error){result=`<p class="panel expired" role="alert">${safe(error.message)}</p>`;}
 }
 return section('Verificar certificado',`<div class="narrow"><form class="panel no-print" data-form="verify">${field('Código del certificado','code','text',`required pattern="[0-9a-fA-F]{32}" maxlength="32" value="${safe(code)}"`)}<button class="primary">Consultar certificado</button></form>${result}</div>`);
}
async function render(){
 const current=++revision;
 const route=location.hash.slice(1)||(/^\/curso\/[1-9]\d{0,9}$/.test(location.pathname)?location.pathname.slice(1):''), code=new URLSearchParams(location.search).get('verify');
 navigation();
 try{
  let html;
  if(!route&&code) html=await verify(code);
  else if(route==='cursos')html=section('Catálogo de cursos',cards(await api('catalog')));
  else if(route==='ingresar'||route==='registro')html=login(route==='registro');
  else if(route==='recuperar')html=passwordRecovery();
  else if(/^restablecer\/[1-9]\d{0,9}\.\d{13}\.[a-f0-9]{64}$/.test(route))html=passwordRecovery(route.split('/')[1]);
  else if(route.startsWith('restablecer/'))html=section('Enlace no válido',button('Solicitar otro enlace','#recuperar'));
  else if(route==='aula')html=await dashboard();
  else if(route==='panel')html=await panel();
  else if(route==='verificar')html=await verify('');
  else if(/^curso\/\d+$/.test(route))html=await course(route.split('/')[1]);
  else html=await home();
  if(current!==revision)return;
  root.innerHTML=html;
  if(route==='contacto') document.getElementById('contacto')?.scrollIntoView();
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
  if(action==='jump'){
   const activity=document.getElementById(id);
   activity?.focus({preventScroll:true});
   activity?.scrollIntoView({block:'start'});
   return;
  }
  if(action==='copy-course-link'||action==='copy-certificate-link'){
   const certificate=action==='copy-certificate-link';
   const url=new URL(certificate?'/?verify='+id:'/curso/'+id,location.origin).href;
   const label=certificate?'del certificado':'del curso';
   try{await navigator.clipboard.writeText(url);message('Enlace '+label+' copiado.');}
   catch{window.prompt('Copia el enlace '+label,url);}
   return;
  }
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
   return;
  }
  if(action==='removeQuestion'){
   const question=control.closest('fieldset');
   if(question.parentElement.children.length<=1)throw Error('La evaluación necesita al menos una pregunta.');
   question.remove();return;
  }
  if(action==='publish'&&!confirm('¿Publicar el curso? Podrás actualizar los materiales de las clases publicadas.'))return;
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
  if(kind==='forgotPassword'){
   await api('password/forgot',{email:data.email});
   form.innerHTML='<p role="status">Si el correo está registrado, recibirás un enlace para cambiar tu contraseña. Revisa también la carpeta de correo no deseado.</p>';
   return;
  }
  if(kind==='resetPassword'){
   if(data.password!==data.confirmation)throw Error('Las contraseñas deben coincidir.');
   await api('password/reset',{token:data.token,password:data.password});
   user=null;
   history.replaceState(null,'','#ingresar');
   await render();
   message('Contraseña actualizada. Ya puedes iniciar sesión.');
   return;
  }
  if(kind==='login'||kind==='register'){
   user=await api(kind,data);location.hash=user.role==='student'?'aula':'panel';return;
  }
  if(kind==='teacher'){await api('staff',data);message('Cuenta docente creada.');}
  if(kind==='createCourse'){const result=await api('courses',data);location.hash='curso/'+result.id;return;}
  if(kind==='cover'){
   const file=data.image;
   if(!file?.size||file.size>8*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type)) {
    throw Error('Selecciona una imagen JPG, PNG o WebP de hasta 8 MB.');
   }
   const image=await createImageBitmap(file).catch(()=>{throw Error('No se pudo abrir la imagen.');});
   const canvas=document.createElement('canvas');
   canvas.width=1200; canvas.height=675;
   const context=canvas.getContext('2d',{alpha:false});
   const width=Math.min(image.width,image.height*16/9);
   const height=Math.min(image.height,image.width*9/16);
   context.fillStyle='#fff';
   context.fillRect(0,0,1200,675);
   context.drawImage(image,(image.width-width)/2,(image.height-height)/2,width,height,0,0,1200,675);
   image.close();
   const bytes=canvas.toDataURL('image/jpeg',0.86).split(',')[1];
   await api('courses/'+id+'/cover',{bytes});
   message('Portada guardada.');
  }
  if(kind==='lesson'){
   const file=data.file;
   if(file.size>8*1024*1024)throw Error('El archivo excede 8 MB.');
   const lesson=form.dataset.lesson;
   await api('courses/'+id+'/lessons'+(lesson?'/'+lesson:''),{title:data.title,content:data.content,videoUrl:data.videoUrl,file:file.name,bytes:file.size?await encodeFile(file):null});
   message(lesson?'Materiales guardados.':'Clase guardada.');
  }
  if(kind==='quiz'){
   const questions=Array.from(form.querySelectorAll('fieldset'),node=>{
    const value=name=>node.querySelector('[name="'+name+'"]')?.value;
    const type=value('type'), correct=value('correct');
    const answer=type==='text'?lines(correct):type==='numeric'?Number(correct):correct.split(',').map(index=>Number(index.trim())-1);
    return {type,prompt:value('prompt'),options:value('options')?lines(value('options')):[],answer,points:Number(value('points'))};
   });
   const quiz=form.dataset.quiz;
   await api('courses/'+id+'/quizzes'+(quiz?'/'+quiz:''),{questions,title:data.title,passingScore:Number(data.passingScore)});message('Evaluación guardada.');
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
   message(`Resultado: ${result.score} %. ${result.passed?'Aprobaste.':`Necesitas al menos ${result.passingScore} %. Puedes volver a intentarlo.`}`);
  }
  await render();
 }catch(error){message(error.message);}finally{if(submitter)submitter.disabled=false;}
});
window.addEventListener('hashchange',()=>{render();window.scrollTo(0,0);});
try{user=await api('me');}catch(error){message(error.message);}
await render();
