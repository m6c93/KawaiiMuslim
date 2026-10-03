from pathlib import Path
import hashlib, re
root=Path(__file__).resolve().parents[1]
base=root/'applications/mimi'
p=base/'_next/static/chunks/app/page-e874ce20b7a4b742.js'
s=p.read_text()
current=re.search(r'page-[a-f0-9]+\.js',(base/'index.html').read_text())[0]
def replace(a,b):
 global s
 assert s.count(a)==1,(a,s.count(a))
 s=s.replace(a,b)
replace('function w(){',(base/'iphone-viewport-source.js').read_text()+'\nfunction w(){')
replace('let x=Math.min(window.devicePixelRatio||1,2);a.width=360*x,a.height=640*x,i.setTransform(x,0,0,x,0,0);','const viewport=createMimiViewport(a,i);')
replace('.width<880;', '.width<Math.max(880,viewport.width+300);')
replace('for(let l of(i.save(),e.shake>0', 'for(let l of(i.save(),viewport.immersive&&viewport.begin(e.distance,w.current),i.translate(viewport.worldX,viewport.worldY),e.shake>0')
replace('((e,t)=>{i.fillStyle=s,i.fillRect(-10,-10,380,660);','((e,t)=>{if(viewport.immersive)return;i.fillStyle=s,i.fillRect(-10,-10,380,660);')
replace('i.restore()}i.fillStyle=o,i.textAlign="center",i.font="900 34px', 'i.restore()}i.save(),i.translate((viewport.width-360)/2-viewport.worldX,viewport.hudY-viewport.worldY),i.fillStyle=o,i.textAlign="center",i.font="900 34px')
replace('i.restore()),"ready"===e.status&&', 'i.restore()),i.restore(),i.save(),i.translate((viewport.width-360)/2-viewport.worldX,0),"ready"===e.status&&')
replace(')),e.flash>0&&', ')),i.restore(),e.flash>0&&')
replace('i.fillRect(0,0,360,640)),i.restore()', 'i.fillRect(-viewport.worldX,-viewport.worldY,viewport.width,viewport.height)),i.restore()')
replace('()=>cancelAnimationFrame(y)', '()=>{cancelAnimationFrame(y);viewport.dispose()}')
new='page-'+hashlib.sha256(s.encode()).hexdigest()[:16]+'.js'
(base/'_next/static/chunks/app'/new).write_text(s)
changed=[]
for f in base.rglob('*'):
 if f.is_file() and f.suffix in ('.html','.txt'):
  original=f.read_text()
  if current in original:
   f.write_text(original.replace(current,new));changed.append(str(f.relative_to(root)))
print('\n'.join(changed+[str((base/'_next/static/chunks/app'/new).relative_to(root))]))
print(new,changed)
