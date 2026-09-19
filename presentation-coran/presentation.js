import {mountClassroom} from '../applications/classroom/classroom.mjs';

const root=document.querySelector('#demoRoot');
const params=new URLSearchParams(location.search);
function updatePresentation({studentView,classId,studentId,studentName}) {
  const currentSpace=studentView?'student':'teacher';
  for(const link of document.querySelectorAll('[data-space]')) {
    if(link.dataset.space===currentSpace)link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  }
  document.querySelector('#demo-title').textContent=studentView?'Découvrez le côté élève.':'Découvrez le côté professeur.';
  document.querySelector('#demo-hint').textContent=studentView
    ?`Explorez le jardin de ${studentName}, touchez un arbre pour retrouver les messages du professeur, puis découvrez Coran et Réciter.`
    :'Ouvrez une classe, choisissez un élève et découvrez son jardin, ses consignes et ses progrès.';
  const teacherParams=new URLSearchParams({view:'teacher'});
  if(classId)teacherParams.set('class-id',classId);
  document.querySelector('[data-space="teacher"]').href='?'+teacherParams;
  const studentParams=studentId&&classId?new URLSearchParams({'class-id':classId,'student-id':studentId}):new URLSearchParams({student:'Maryam'});
  document.querySelector('[data-space="student"]').href='?'+studentParams;
}
try {
  await mountClassroom(root,{
    id:'standalone-presentation-demo-v1',
    role:'admin',
    full_name:'Professeur · Démonstration'
  },{
    studentName:params.get('student'),
    className:'Les oliviers',
    studentId:params.get('student-id'),
    classId:params.get('class-id'),
    previewPath:location.pathname,
    onViewChange:updatePresentation
  });
} catch(error) {
  console.error('Démonstration indisponible',error);
  root.innerHTML='<section class="demo-error" role="alert"><h2>La démonstration n’a pas pu se charger.</h2><p>Vérifiez votre connexion, puis réessayez.</p><a href="">Réessayer</a></section>';
} finally {
  root.setAttribute('aria-busy','false');
}
