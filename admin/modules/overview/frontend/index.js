export async function renderOverview(root,{api,navigate}){
  const data=await api.get('/api/overview');
  root.innerHTML=`<div class="summary-line"><div><strong>${data.incidentes.abertos}</strong><span>Incidentes abertos</span></div><div><strong>${data.incidentes.criticos}</strong><span>Críticos</span></div><div><strong>${data.incidentes.total}</strong><span>Total registrado</span></div></div><section class="panel"><div class="panel-head"><h2>Prioridade agora</h2><button id="all-incidents">Abrir incidentes</button></div>${data.prioritarios.length?data.prioritarios.map(item=>`<article class="row"><div><strong>${text(item.titulo)}</strong><span class="muted">${text(item.modulo)} · ${item.ocorrencias} ocorrência(s)</span></div><span class="badge ${item.severidade}">${text(item.severidade)}</span></article>`).join(''):'<div class="notice">Nenhum incidente aberto.</div>'}</section>`;
  root.querySelector('#all-incidents').onclick=()=>navigate('incidents');
}
const text=value=>String(value??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
