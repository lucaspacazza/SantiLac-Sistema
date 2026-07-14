import {api} from './api.js';
import {renderOverview} from '../modules/overview/frontend/index.js';
import {renderIncidents} from '../modules/incidents/frontend/index.js';
import {renderInfrastructure} from '../modules/infrastructure/frontend/index.js';
import {renderRecords} from '../modules/records/frontend/index.js';
import {renderSettings} from '../modules/settings/frontend/index.js';

const app=document.querySelector('#app');
const modules={overview:{label:'Visão geral',render:renderOverview},incidents:{label:'Incidentes',render:renderIncidents},infrastructure:{label:'Infraestrutura',render:renderInfrastructure},records:{label:'Registros',render:renderRecords},settings:{label:'Configuração',render:renderSettings}};
let user=null;
const route=()=>location.hash.replace('#/','')||'overview';

function loginScreen(error=''){
  app.innerHTML=`<main class="login"><form class="login-panel"><img src="/assets/logo.png" alt="SantiLac"><span class="eyebrow">ADMINISTRAÇÃO</span><h1>Acesso restrito</h1><label>Usuário<input name="login" autocomplete="username" required></label><label>Senha<input name="password" type="password" autocomplete="current-password" required></label><p class="error">${escapeHtml(error)}</p><button>Entrar</button></form></main>`;
  app.querySelector('form').onsubmit=async event=>{event.preventDefault();const data=new FormData(event.currentTarget);try{user=await api.login(data.get('login'),data.get('password'));shell()}catch(e){loginScreen(e.message)}};
}
function shell(){
  app.innerHTML=`<div class="admin-shell"><button class="menu-toggle" id="menu-toggle" aria-label="Abrir menu" aria-expanded="false">☰</button><button class="sidebar-backdrop" id="sidebar-backdrop" aria-label="Fechar menu"></button><aside id="sidebar"><div class="sidebar-head"><img src="/assets/logo.png" alt="SantiLac"><button class="menu-close" id="menu-close" aria-label="Fechar menu">×</button></div><span class="eyebrow">SUBSISTEMA ADMIN</span><nav>${Object.entries(modules).map(([key,item])=>`<a href="#/${key}" data-route="${key}">${item.label}</a>`).join('')}</nav><footer><strong>${escapeHtml(user.nome)}</strong><button id="logout">Sair</button></footer></aside><main><header><div><span class="eyebrow">SANTILAC</span><h1 id="page-title"></h1></div><button id="refresh">Atualizar</button></header><section id="screen" aria-live="polite"></section></main></div>`;
  const setMenu=open=>{app.querySelector('.admin-shell').classList.toggle('menu-open',open);app.querySelector('#menu-toggle').setAttribute('aria-expanded',String(open))};
  app.querySelector('#menu-toggle').onclick=()=>setMenu(true);
  app.querySelector('#menu-close').onclick=()=>setMenu(false);
  app.querySelector('#sidebar-backdrop').onclick=()=>setMenu(false);
  app.querySelector('nav').onclick=event=>{if(event.target.closest('a'))setMenu(false)};
  app.querySelector('#logout').onclick=async()=>{await api.logout().catch(()=>null);user=null;loginScreen()};
  app.querySelector('#refresh').onclick=renderRoute;
  renderRoute();
}
async function renderRoute(){const key=modules[route()]?route():'overview';document.querySelectorAll('[data-route]').forEach(link=>link.classList.toggle('active',link.dataset.route===key));app.querySelector('#page-title').textContent=modules[key].label;const screen=app.querySelector('#screen');screen.innerHTML='<div class="loading">Carregando…</div>';try{await modules[key].render(screen,{api,navigate:path=>location.hash=`#/${path}`})}catch(e){screen.innerHTML=`<div class="notice error">${escapeHtml(e.message)}</div>`}}
export const escapeHtml=value=>String(value??'').replace(/[&<>"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]));
window.addEventListener('hashchange',()=>user&&renderRoute());
api.me().then(value=>{user=value;shell()}).catch(()=>loginScreen());
