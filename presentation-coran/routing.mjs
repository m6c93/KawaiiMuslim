// Named presentation personas always use the local fictional demonstration.
// An explicit capability in the fragment still takes precedence.
export function useSavedTeacher(params){
 return !params.has('local')&&!params.has('student')&&!params.has('school-teacher')&&params.get('view')!=='school';
}
export function requestedPupil(classes,params){
 const id=params.get('student-id');if(!id)return null;
 const matches=classes.flatMap(c=>c.students.map(s=>({classId:c.id,studentId:s.id})))
  .filter(s=>s.studentId===id&&(!params.has('class-id')||s.classId===params.get('class-id')));
 if(matches.length!==1)throw Error('Ce compte élève est introuvable ou a expiré. Revenez à votre classe pour créer un nouveau lien.');
 return matches[0];
}
