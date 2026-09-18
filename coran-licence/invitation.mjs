import {client,portal,page,message} from '../applications/classroom/live-client.mjs';
const status=document.querySelector('#invitation-status'),accept=document.querySelector('#accept-invitation');
const token=location.hash.slice(1)||sessionStorage.getItem('km-coran-invitation');
if(location.hash){sessionStorage.setItem('km-coran-invitation',token);history.replaceState(null,'',location.pathname)}
if(!token||!/^[a-f0-9]{64}$/.test(token))status.textContent='Ouvrez le lien personnel fourni par votre professeur ou votre responsable.';
else{const {data}=await client().auth.getUser();if(!data.user){status.textContent='Une connexion est nécessaire pour protéger votre compte.';document.querySelector('#invitation-login').hidden=false}else{status.textContent=`Connecté avec ${data.user.email}. Ce lien doit être destiné à cette adresse.`;accept.hidden=false;accept.onclick=async()=>{accept.disabled=true;try{await portal('accept_invite',{token});sessionStorage.removeItem('km-coran-invitation');location.replace(page('interface.html'))}catch(e){status.textContent=message(e);accept.disabled=false}}}}
