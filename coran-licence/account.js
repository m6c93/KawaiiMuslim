const ACCOUNT_KEY='km-coran-pro-account-v1';
const signupTab=document.querySelector('#signupTab');
const loginTab=document.querySelector('#loginTab');
const signupForm=document.querySelector('#signupForm');
const loginForm=document.querySelector('#loginForm');
const plans={enseignant:'Enseignant',ecole:'École',reseau:'Réseau'};
const params=new URLSearchParams(location.search);
const chosenPlan=plans[params.get('plan')]||'Enseignant';
document.querySelector('#selectedPlan').textContent=chosenPlan;
function showMode(mode){const login=mode==='login';signupForm.hidden=login;loginForm.hidden=!login;signupTab.setAttribute('aria-selected',String(!login));loginTab.setAttribute('aria-selected',String(login));history.replaceState(null,'',login?'?mode=login':`?plan=${Object.keys(plans).find(key=>plans[key]===chosenPlan)||'enseignant'}`)}
signupTab.addEventListener('click',()=>showMode('signup'));loginTab.addEventListener('click',()=>showMode('login'));if(params.get('mode')==='login')showMode('login');
signupForm.addEventListener('submit',event=>{event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget));const status=document.querySelector('#signupStatus');if(data.password!==data.confirmPassword){status.textContent='Les deux mots de passe ne correspondent pas.';return}const account={id:crypto.randomUUID?.()||String(Date.now()),firstName:data.firstName.trim(),lastName:data.lastName.trim(),organization:data.organization.trim(),email:data.email.trim().toLowerCase(),plan:chosenPlan,classes:[],createdAt:new Date().toISOString()};localStorage.setItem(ACCOUNT_KEY,JSON.stringify(account));location.href='interface.html?welcome=1'});
loginForm.addEventListener('submit',event=>{event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget));const account=JSON.parse(localStorage.getItem(ACCOUNT_KEY)||'null');const status=document.querySelector('#loginStatus');if(!account||account.email!==data.email.trim().toLowerCase()){status.textContent='Aucun compte pilote trouvé avec cet e-mail sur cet appareil.';return}location.href='interface.html'});
