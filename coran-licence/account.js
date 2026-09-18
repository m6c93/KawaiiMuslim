import {client,portal,page,message} from '../applications/classroom/live-client.mjs';
const $=s=>document.querySelector(s),params=new URLSearchParams(location.search),status=$('#authStatus');
const invitation=sessionStorage.getItem('km-coran-invitation');
const recovery=params.get('recovery')==='1';
function mode(name){$('#loginForm').hidden=name!=='login';$('#signupForm').hidden=name!=='signup';$('#recoveryForm').hidden=name!=='recovery';$('#loginTab').setAttribute('aria-selected',String(name==='login'));$('#signupTab').setAttribute('aria-selected',String(name==='signup'))}
$('#loginTab').onclick=()=>mode('login');$('#signupTab').onclick=()=>mode('signup');
$('#organizationField').hidden=Boolean(invitation);$('#signupForm [name="organization"]').required=!invitation;
mode(recovery?'recovery':params.get('mode')==='login'?'login':'signup');
async function enter(){location.href=page(invitation?'invitation.html':'interface.html')}
async function submit(form,work){const button=form.querySelector('button');button.disabled=true;status.textContent='Un instant…';try{await work()}catch(e){status.textContent=message(e)}finally{button.disabled=false}}
$('#loginForm').onsubmit=e=>{e.preventDefault();submit(e.currentTarget,async()=>{const f=Object.fromEntries(new FormData(e.target));const {error}=await client().auth.signInWithPassword({email:f.email.trim(),password:f.password});if(error)throw error;await enter()})};
$('#signupForm').onsubmit=e=>{e.preventDefault();submit(e.currentTarget,async()=>{const f=Object.fromEntries(new FormData(e.target));if(f.password!==f.confirm)throw Error('Les mots de passe ne correspondent pas.');const {data,error}=await client().auth.signUp({email:f.email.trim(),password:f.password,options:{emailRedirectTo:page(invitation?'invitation.html':'interface.html'),data:{full_name:f.name.trim(),...(!invitation?{quran_organization:f.organization.trim(),quran_plan:({enseignant:'class',ecole:'school',reseau:'association'})[params.get('plan')]||'class'}:{})}}});if(error)throw error;e.target.reset();if(data.session)await enter();else status.textContent='Consultez votre e-mail et confirmez votre compte. Revenez ensuite vous connecter avec la même adresse.'})};
$('#forgotPassword').onclick=()=>submit($('#loginForm'),async()=>{const email=$('#loginForm [name="email"]').value.trim();if(!email)throw Error('Indiquez d’abord votre adresse e-mail.');const {error}=await client().auth.resetPasswordForEmail(email,{redirectTo:page('inscription.html?recovery=1')});if(error)throw error;status.textContent='Si ce compte existe, un lien de récupération vous sera envoyé.'});
$('#recoveryForm').onsubmit=e=>{e.preventDefault();submit(e.currentTarget,async()=>{const f=Object.fromEntries(new FormData(e.target));if(f.password!==f.confirm)throw Error('Les mots de passe ne correspondent pas.');const {error}=await client().auth.updateUser({password:f.password});if(error)throw error;await enter()})};
client().auth.onAuthStateChange(event=>{if(event==='PASSWORD_RECOVERY')mode('recovery')});
if(!recovery)client().auth.getUser().then(({data})=>{if(data.user)enter()}).catch(()=>{});
