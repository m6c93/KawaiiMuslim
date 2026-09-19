// Legacy public links lead only to the teacher/pupil demonstration.
// Never mount private platform administration from a demo URL.
export function publicDemoUrl(source) {
 const current=new URL(source),target=new URL('/presentation-coran/',current);
 for(const key of ['student','class','class-id','student-id']){
  if(current.searchParams.has(key))target.searchParams.set(key,current.searchParams.get(key));
 }
 if(!target.searchParams.has('student')&&!target.searchParams.has('student-id'))target.searchParams.set('view','teacher');
 return target.href;
}
if(typeof window!=='undefined')window.location.replace(publicDemoUrl(window.location.href));
