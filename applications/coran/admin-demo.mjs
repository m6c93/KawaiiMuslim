const DAY=86400000;

export const ADMIN_DEMO_LAYOUT={
  108:{x:18,y:70},
  109:{x:34,y:43},
  110:{x:50,y:72},
  112:{x:66,y:42},
  113:{x:81,y:70},
  114:{x:50,y:27}
};

const DEMO_TREES={
  108:[1,2],
  109:[1,2,3],
  110:[1],
  112:[1,2,3,4],
  113:[1,2,3,4,5],
  114:[1,2,3,4,5,6]
};

export function withAdminDemoProgress(progress,index,now=Date.now()){
  const validCounts=new Map(index.map(s=>[s.id,s.count]));
  const earned=new Set(progress.treeEarned||[]),completed={...(progress.completed||{})},review={...(progress.treeReview||{})};
  for(const[surahText,verses]of Object.entries(DEMO_TREES)){
    const surah=Number(surahText),count=validCounts.get(surah)||0;
    for(const verse of verses){
      if(verse>count)continue;
      const id=`${surah}:${verse}`,needsReview=surah===113;
      earned.add(id);
      if(!completed[id])completed[id]={times:1,last:needsReview?now-10*DAY:now,due:needsReview?now-DAY:now+7*DAY};
      if(needsReview)review[id]=now-10*DAY;
      else if(!Number.isFinite(review[id]))review[id]=now;
    }
  }
  return{...progress,completed,treeEarned:[...earned],treeReview:review,lastRead:{surah:113,verse:1}};
}
