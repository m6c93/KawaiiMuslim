import {assignReview,emptyTree,validate} from './model.mjs';
import {JUZ_RANGES} from '../coran/juz-data.mjs';

// Entirely fictional fixtures; never imported into student or family accounts.
export function demoClasses(index,now=Date.now()){
 const groups=[
  {name:'Les petites pousses',level:'Premiers versets · Juz’ 30',names:['Inès','Amine','Lina','Ibrahim','Sofia','Ismaïl'],surahs:[112,113,114,108],juz:[30]},
  {name:'Les oliviers',level:'En progression · Juz’ 30',names:['Maryam','Adam','Yasmine','Youssef','Hafsa','Omar'],surahs:[112,113,114,108,110,109,111,107],juz:[30]},
  {name:'Les grands cèdres',level:'Consolidation · Juz’ 29 et 30',names:['Aïcha','Bilal','Salma','Ilyas','Nour','Zakariya'],surahs:[112,113,114,108,110,109,111,107,67,68,69],juz:[29,30]}
 ];
 return groups.map((g,gi)=>({id:`demo-v2-class-${gi}`,demo:true,name:`${g.name} · Démonstration`,description:g.level,juz:g.juz,surahs:[],students:g.names.map((name,si)=>{
  const student={id:`demo-v2-student-${gi}-${si}`,name,trees:{}};
  const started=gi===0?si:gi===1?3+si:6+si;
  g.surahs.slice(0,started).forEach((id,ti)=>{
   const total=index.find(s=>s.id===id).count,t=emptyTree();
   const completed=gi===0?ti<si-2:ti<started-2;
   const count=completed?total:Math.max(1,Math.min(total-1,Math.floor(total*([.2,.5,.8][(si+ti)%3]))));
   const old=(si+ti)%4===0;
   validate(t,1,count,total,'Mme Sarah · Démonstration',new Date(now-(old?10:2)*86400000-ti*3600000).toISOString());
   t.requested=!completed&&(si+ti)%2===0;t.review=old;
   t.messages=[{text:completed?`${name}, tu as récité cette sourate avec beaucoup de soin. Continue à la revoir tranquillement.`:`${name}, tes premiers versets sont bien installés. Reprends doucement le verset ${Math.min(count+1,total)} ; nous l’écouterons ensemble au prochain cours.`,author:'Mme Sarah · Démonstration',at:new Date(now-86400000-si*3600000).toISOString()}];
   for(const r of JUZ_RANGES.find(s=>s.surah===id).ranges){const localIndex=Object.values(student.trees).filter(x=>x.positions[r.juz]).length;t.positions[r.juz]={x:22+(localIndex%3)*28,y:38+Math.floor(localIndex/3)*18};}
   student.trees[id]=t;
  });
  return student;
 })}));
}

// Keep the default presentation pupil visually rich without touching real accounts.
// Existing fictional data is preserved; only missing showcase trees are added.
export function enrichDemoJuzAmmaShowcase(db,index,now=Date.now()){
 const student=db.classes?.find(c=>c.id==='demo-v2-class-1')?.students?.find(s=>s.name==='Maryam');
 if(!student)return false;
 const teacher='Mme Sarah · Démonstration';
 const fixtures=[
  {id:108,count:'complete',message:'Maryam, cette sourate est très bien installée. Bravo pour ta régularité !'},
  {id:110,count:'complete',message:'Maryam, ta récitation est fluide et soignée. Continue ainsi.'},
  {id:109,count:.67,message:'Tu avances très bien. Continue avec les derniers versets à ton rythme.'},
  {id:111,count:.4,review:[3,4],message:'Les premiers versets sont acquis. Reprends doucement les versets 3 et 4.'},
  {id:107,count:.43,message:'Tes premiers versets sont bien installés. Nous poursuivrons ensemble.'}
 ];
 let changed=false;
 for(const [offset,fixture] of fixtures.entries()){
  if(student.trees[fixture.id])continue;
  const chapter=index.find(s=>s.id===fixture.id);if(!chapter)continue;
  const tree=emptyTree(),validated=fixture.count==='complete'?chapter.count:Math.max(1,Math.min(chapter.count-1,Math.round(chapter.count*fixture.count)));
  const at=new Date(now-(offset+2)*86400000).toISOString();
  validate(tree,1,validated,chapter.count,teacher,at);
  if(fixture.review)assignReview(tree,fixture.review[0],fixture.review[1],chapter.count,teacher,fixture.message,new Date(now-86400000).toISOString());
  tree.messages=[{text:fixture.message,author:teacher,at}];
  const positionIndex=Object.values(student.trees).filter(t=>t.positions?.[30]).length;
  tree.positions[30]={x:22+(positionIndex%3)*28,y:38+Math.floor(positionIndex/3)*18};
  student.trees[fixture.id]=tree;changed=true;
 }
 return changed;
}
