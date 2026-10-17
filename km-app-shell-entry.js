(()=>{'use strict';
const sections={"/aujourd'hui.dc":"today","/aujourd-hui.dc":"today","/bibliotheque kawaii muslim.dc":"library","/atelier.dc":"workshop","/safe place.dc":"invocations","/applications.dc":"apps"};
const normalized=path=>decodeURIComponent(path).replace(/\.html$/i,'').toLowerCase();
const params=new URLSearchParams(location.search),section=sections[normalized(location.pathname)];
let parentShell=false;try{parentShell=parent!==window&&parent.location.origin===location.origin&&!!parent.KMAppShell}catch{}
if(parentShell){
 if(window.__kmAppShellBridge)return;window.__kmAppShellBridge=true;
 const send=data=>parent.postMessage(data,location.origin);
 document.addEventListener('click',event=>{if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;const a=event.target.closest('a[href]');if(!a||a.hasAttribute('download')||a.target&&a.target!=='_self')return;const u=new URL(a.href,location.href);if(u.origin!==location.origin)return;if(sections[normalized(u.pathname)]){event.preventDefault();send({type:'km-app-route',href:u.href})}else if(/\/(?:Connexion|Inscription|Compte|Profils|MFA)\.dc(?:\.html)?$/i.test(u.pathname)){event.preventDefault();send({type:'km-app-exit',href:u.href})}},true);
 addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==parent||!event.data||event.data.type!=='km-app-active')return;if(!event.data.active){document.querySelectorAll('audio,video').forEach(media=>media.pause());document.dispatchEvent(new Event('km-app-inactive'))}else{dispatchEvent(new Event('resize'));document.dispatchEvent(new Event('km-app-active'))}});
 return;
}
if(parent!==window||!section)return;
const target=new URL('/Application.dc.html',location.origin);target.searchParams.set('section',section);
let guest=params.get('guest')==='1';try{guest=guest||sessionStorage.getItem('km-guest-mode')==='1'}catch{}
if(guest)target.searchParams.set('guest','1');
if(location.hash)target.searchParams.set('anchor',location.hash.slice(1));
for(const key of ['preview','theme'])if(params.has(key))target.searchParams.set(key,params.get(key));
location.replace(target.href);
})();
