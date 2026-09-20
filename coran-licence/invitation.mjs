import {client,portal,page,message} from '../applications/classroom/live-client.mjs';
const $=s=>document.querySelector(s),status=$('#invitation-status'),accept=$('#accept-invitation'),form=$('#activation-form');
const fragment=location.hash.slice(1),parts=new URLSearchParams(fragment);
const token=parts.get('invitation')||(/^[a-f0-9]{64}$/.test(fragment)?fragment:sessionStorage.getItem('km-coran-invitation'));
let proof=parts.get('proof'),type=parts.get('type'),busy=false;
let setup=parts.get('setup')==='1'||sessionStorage.getItem('km-coran-setup')===token;
if(fragment){history.replaceState(null,'',location.pathname);if(token)sessionStorage.setItem('km-coran-invitation',token)}
async function info(){const {data,error}=await client().rpc('quran_invitation_info',{token});if(error)throw error;return data}
async function finish(){
 const result=await portal('accept_invite',{token});
 sessionStorage.removeItem('km-coran-invitation');sessionStorage.removeItem('km-coran-setup');
 const destination=result.student?'interface.html?student-id='+encodeURIComponent(result.student):result.organization?'interface.html?organization='+encodeURIComponent(result.organization):'interface.html';
 location.replace(page(destination));
}
async function run(work){if(busy)return;busy=true;accept.disabled=true;form.querySelector('fieldset').disabled=true;status.textContent='Un instant…';try{await work()}catch(e){status.textContent=message(e)}finally{busy=false;accept.disabled=false;form.querySelector('fieldset').disabled=false}}
function password(){
 sessionStorage.setItem('km-coran-setup',token);accept.hidden=true;form.hidden=false;
 form.querySelector('fieldset').disabled=false;status.textContent='Votre adresse est vérifiée. Choisissez votre mot de passe pour terminer.';
}
form.onsubmit=e=>{e.preventDefault();const f=Object.fromEntries(new FormData(form));run(async()=>{
 if(f.password.length<10)throw Error('Choisissez au moins 10 caractères.');
 if(f.password!==f.confirm)throw Error('Les mots de passe ne correspondent pas.');
 if(!(await info()).matches)throw Error('Rouvrez le lien reçu dans votre e-mail pour activer le bon compte.');
 const {error}=await client().auth.updateUser({password:f.password});if(error)throw error;
 form.reset();setup=false;sessionStorage.removeItem('km-coran-setup');await finish();
})};
accept.onclick=()=>run(async()=>{
 if(proof){
  // Visiting a link is not enough to consume it; the recipient must click.
  const {error}=await client().auth.verifyOtp({token_hash:proof,type});if(error)throw Error('Ce lien d’activation a expiré ou a déjà été utilisé. Demandez au responsable de renvoyer l’invitation.');
  proof=null;
 }
 if(!(await info()).matches)throw Error('Ce compte ne correspond pas à l’invitation. Ouvrez le lien reçu dans votre e-mail.');
 if(setup)password();else await finish();
});
$('#switch-account').onclick=()=>run(async()=>{await client().auth.signOut({scope:'local'});location.href=page('inscription.html?mode=login')});
async function start(){
 if(!/^[a-f0-9]{64}$/.test(token||''))throw Error('Ouvrez le lien personnel reçu par e-mail.');
 const invitation=await info();
 if(proof&&['invite','magiclink'].includes(type)){
  accept.hidden=false;accept.textContent=setup?'Créer mon compte':'Activer mon accès';
  status.textContent='Votre accès est prêt. Continuez avec l’adresse destinataire de cet e-mail. Si un autre compte est ouvert, cette activation changera de compte sur cet appareil.';return;
 }
 const {data}=await client().auth.getUser();
 if(data.user&&invitation.matches){if(setup)password();else{accept.hidden=false;status.textContent='Vous êtes connecté avec l’adresse invitée. Vous pouvez rejoindre votre espace.'}return}
 $('#invitation-login').hidden=false;
 if(data.user){$('#switch-account').hidden=false;$('#invitation-login').hidden=true;status.textContent=`Un autre compte est ouvert (${data.user.email}). Connectez-vous avec l’adresse invitée, ou utilisez le bouton « Créer mon compte » de l’e-mail reçu.`}
 else status.textContent='Première connexion ? Utilisez le bouton « Créer mon compte » dans votre e-mail d’invitation. Vous avez déjà un compte ? Connectez-vous ci-dessous.';
}
start().catch(e=>{status.textContent=message(e)});
