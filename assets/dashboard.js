const paths = {
  activities: './data/atividades.json',
  sleep: './data/sono.json',
  config: './data/configuracoes.json'
};

const state = { period: '4w', filter: 'all', sort: 'desc', charts: {} };
const colors = { grid:'#eeede8', muted:'#888', blue:'#2a78d6', green:'#1baf7a', orange:'#d88c00', red:'#d64545', purple:'#7c3aed', cyan:'#0891b2' };

try {
  const [activities, sleep, config] = await Promise.all(Object.values(paths).map(loadJson));
  validateActivities(activities);
  activities.sort((a,b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id));
  initialise(activities, sleep, config);
} catch (error) {
  const box = document.getElementById('errorState');
  box.hidden = false;
  box.textContent = `Não foi possível montar o dashboard: ${error.message}`;
  document.getElementById('updatedAt').textContent = 'Falha ao carregar os dados';
}

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path} respondeu com status ${response.status}`);
  return response.json();
}

function validateActivities(items) {
  if (!Array.isArray(items) || !items.length) throw new Error('Nenhuma atividade encontrada.');
  const ids = new Set();
  items.forEach((item,index) => {
    for (const field of ['id','data','categoria','atividade','duracao']) {
      if (!item[field]) throw new Error(`Campo ${field} ausente na atividade ${index + 1}.`);
    }
    if (ids.has(item.id)) throw new Error(`ID duplicado: ${item.id}.`);
    ids.add(item.id);
  });
}

function initialise(activities, sleep, config) {
  const model = buildModel(activities, sleep, config);
  state.period = config.periodo_padrao || '4w';
  document.getElementById('goalTitle').textContent = `${config.meta_12_min_metros.toLocaleString('pt-BR')} m em 12 min`;
  document.getElementById('updatedAt').textContent = `Dados até ${formatFullDate(model.lastDate)}`;
  document.getElementById('lthrNote').textContent = `LTHR histórico: ${config.lthr_historico.map(item => `${item.valor_bpm} bpm`).join(' → ')}`;
  renderSleep(sleep);
  bindControls(model);
  render(model);
}

function buildModel(activities, sleep, config) {
  const firstDate = activities[0].data;
  const lastDate = activities.at(-1).data;
  const daily = fillDailySeries(firstDate,lastDate,activities);
  calculateForm(daily,config.constantes_carga);
  return { activities, sleep, config, daily, firstDate, lastDate };
}

function fillDailySeries(first,last,activities) {
  const grouped = new Map();
  activities.forEach(item => {
    if (!grouped.has(item.data)) grouped.set(item.data,[]);
    grouped.get(item.data).push(item);
  });
  const result = [];
  for (let cursor = parseDate(first), end = parseDate(last); cursor <= end; cursor = addDays(cursor,1)) {
    const date = isoDate(cursor);
    const items = grouped.get(date) || [];
    result.push({
      date,
      activities:items,
      tsi:items.reduce((sum,item) => sum + (item.tsi || 0),0),
      runKm:sumDistance(items,'corrida'),
      walkKm:sumDistance(items,'caminhada')
    });
  }
  return result;
}

function calculateForm(daily,{ ctl_dias, atl_dias }) {
  const ctlAlpha = 1 - Math.exp(-1 / ctl_dias);
  const atlAlpha = 1 - Math.exp(-1 / atl_dias);
  let ctl = 0, atl = 0;
  daily.forEach(day => {
    ctl += ctlAlpha * (day.tsi - ctl);
    atl += atlAlpha * (day.tsi - atl);
    day.ctl = ctl;
    day.atl = atl;
    day.tsb = ctl - atl;
  });
}

function bindControls(model) {
  document.querySelectorAll('.period-btn').forEach(button => button.addEventListener('click',() => {
    state.period = button.dataset.period;
    setActive('.period-btn',button);
    render(model);
  }));
  document.querySelectorAll('.filter-btn').forEach(button => button.addEventListener('click',() => {
    state.filter = button.dataset.filter;
    setActive('.filter-btn',button);
    renderTable(model);
  }));
  document.querySelectorAll('.sort-btn').forEach(button => button.addEventListener('click',() => {
    state.sort = button.dataset.sort;
    setActive('.sort-btn',button);
    renderTable(model);
  }));
  const defaultButton = document.querySelector(`.period-btn[data-period="${state.period}"]`);
  if (defaultButton) setActive('.period-btn',defaultButton);
}

function setActive(selector,activeButton) {
  document.querySelectorAll(selector).forEach(button => {
    const active = button === activeButton;
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
  });
}

function render(model) {
  const range = selectedRange(model);
  renderKpis(model,range);
  renderSummary(model,range);
  renderSuggestion(model);
  renderCharts(model,range);
  renderTable(model);
  document.getElementById('periodStatus').textContent = `Exibindo ${formatDate(range.start)} a ${formatDate(range.end)} · forma calculada com todo o histórico`;
}

function selectedRange(model) {
  const days = { '7d':7, '4w':28, '12w':84 }[state.period];
  const end = model.lastDate;
  const start = days ? isoDate(addDays(parseDate(end),-(days - 1))) : model.firstDate;
  return { start:start < model.firstDate ? model.firstDate : start, end };
}

function inRange(date,range) { return date >= range.start && date <= range.end; }

function renderKpis(model,range) {
  const activities = model.activities.filter(item => inRange(item.data,range));
  const runs = activities.filter(item => item.categoria === 'corrida');
  const tsi = activities.reduce((sum,item) => sum + (item.tsi || 0),0);
  const runKm = runs.reduce((sum,item) => sum + (item.distancia_km || 0),0);
  const best = bestTwelveMinuteEstimate(model.activities);
  const form = model.daily.filter(day => day.date <= range.end).at(-1);
  setText('totalTsi',tsi.toLocaleString('pt-BR'));
  setText('activityCount',`${activities.length} atividade${activities.length === 1 ? '' : 's'}`);
  setText('runKm',`${formatNumber(runKm,2)} km`);
  setText('runCount',`${runs.length} corrida${runs.length === 1 ? '' : 's'}`);
  setText('best12min',best ? `${formatNumber(best.metres / 1000,2)} km` : 'Sem dados');
  setText('goalProgress',best ? `${formatNumber(best.metres / model.config.meta_12_min_metros * 100,1)}% da meta · faltam ${Math.max(0,Math.round(model.config.meta_12_min_metros - best.metres))} m` : 'É necessária uma corrida de pelo menos 12 min');
  setText('currentForm',`TSB ${formatSigned(form.tsb)}`);
  setText('currentFormStatus',formStatus(form.tsb,model.config.faixas_tsb));
  document.getElementById('formExplanation').innerHTML = `<strong>Último cálculo (${formatDate(form.date)}):</strong> CTL ${formatNumber(form.ctl,1)} · ATL ${formatNumber(form.atl,1)} · TSB ${formatSigned(form.tsb)} — ${formStatus(form.tsb,model.config.faixas_tsb)}.<br><br><strong>Como ler:</strong> CTL representa a adaptação de longo prazo, ATL a carga recente e TSB = CTL − ATL. Os dias sem treino também entram no cálculo.`;
}

function renderSummary(model,range) {
  const activities = model.activities.filter(item => inRange(item.data,range));
  const missing = activities.filter(item => item.fc_media_bpm == null);
  const activeDates = [...new Set(activities.map(item => item.data))];
  let longest = 0;
  for (let i=1;i<activeDates.length;i++) longest = Math.max(longest,(parseDate(activeDates[i]) - parseDate(activeDates[i-1])) / 86400000 - 1);
  const messages = [`${activeDates.length} dias com atividade no período.`];
  if (longest > 0) messages.push(`Maior intervalo sem registro: ${longest} dia${longest === 1 ? '' : 's'}.`);
  messages.push(`${missing.length} atividade${missing.length === 1 ? '' : 's'} sem FC.`);
  document.getElementById('activitySummary').textContent = messages.join(' ');
  const alert = document.getElementById('sensorAlert');
  alert.textContent = missing.length ? `⚠️ ${missing.length} atividade${missing.length === 1 ? '' : 's'} do período não possuem FC; IS e TSI podem ficar indisponíveis.` : '✓ Todas as atividades do período possuem dados de frequência cardíaca.';
}

function renderSuggestion(model) {
  const current = model.daily.at(-1);
  const status = formStatus(current.tsb,model.config.faixas_tsb);
  let suggestion;
  if (status === 'fadiga elevada') suggestion = ['Descanso','—','Priorizar recuperação; caminhada leve apenas se estiver sem dor.'];
  else if (current.tsb < 0) suggestion = ['Corrida leve ou descanso ativo','25–35 min','Ritmo confortável em Z2, sem tiros; interromper em caso de dor.'];
  else if (current.tsb <= model.config.faixas_tsb.equilibrado_ate) suggestion = ['Corrida contínua moderada','30–40 min','Manter esforço controlado e terminar com sensação de reserva.'];
  else suggestion = ['Treino de qualidade','30–45 min','Aquecimento, bloco principal controlado e desaquecimento.'];
  setText('nextWorkoutType',suggestion[0]); setText('nextWorkoutDuration',suggestion[1]); setText('nextWorkoutPlan',suggestion[2]);
  setText('nextWorkoutBasis',`Sugestão para ${formatFullDate(isoDate(addDays(parseDate(model.lastDate),1)))} · baseada no TSB ${formatSigned(current.tsb)} e nos registros até ${formatFullDate(model.lastDate)}`);
}

function renderSleep(sleep) {
  const container = document.getElementById('sleepKpis');
  const summary = document.getElementById('sleepSummary');
  if (!Array.isArray(sleep) || !sleep.length) {
    container.innerHTML = '';
    summary.textContent = 'Sem registros em data/sono.json. Quando as noites forem adicionadas, médias, último registro e noites abaixo de 7 horas aparecerão automaticamente.';
    return;
  }
  const sorted = [...sleep].sort((a,b) => a.data.localeCompare(b.data));
  const recent = sorted.slice(-28);
  const average = recent.reduce((sum,item) => sum + item.duracao_minutos,0) / recent.length;
  const below = recent.filter(item => item.duracao_minutos < 420).length;
  const last = sorted.at(-1);
  container.innerHTML = `${sleepCard('Média recente',formatMinutes(average),`${recent.length} noites`)}${sleepCard('Último registro',formatMinutes(last.duracao_minutos),formatFullDate(last.data))}${sleepCard('Noites abaixo de 7h',String(below),'no período recente')}`;
  summary.textContent = `Dados de sono disponíveis até ${formatFullDate(last.data)}.`;
}

function renderCharts(model,range) {
  const days = model.daily.filter(day => inRange(day.date,range));
  const activities = model.activities.filter(item => inRange(item.data,range));
  const rolling = model.daily.map((day,index,array) => array.slice(Math.max(0,index-6),index+1).reduce((sum,item) => sum + item.tsi,0));
  const rollingByDate = new Map(model.daily.map((day,index) => [day.date,rolling[index]]));
  drawChart('tsiChart',{ data:{ labels:days.map(day => formatDate(day.date)), datasets:[{type:'bar',label:'TSI diário',data:days.map(day => day.tsi),backgroundColor:colors.blue,borderRadius:4,yAxisID:'y'},{type:'line',label:'Carga de 7 dias',data:days.map(day => rollingByDate.get(day.date)),borderColor:colors.orange,backgroundColor:'transparent',borderWidth:2,tension:.25,pointRadius:2,yAxisID:'y1'}]}, options:chartOptions(true,false,true) });
  drawChart('kmChart',{ type:'bar',data:{labels:days.map(day => formatDate(day.date)),datasets:[{label:'Corrida',data:days.map(day => day.runKm),backgroundColor:colors.blue,borderRadius:4},{label:'Caminhada',data:days.map(day => day.walkKm),backgroundColor:colors.green,borderRadius:4}]},options:chartOptions(true,true) });
  const withHr = activities.filter(item => item.fc_media_bpm != null);
  drawChart('hrChart',{ type:'line',data:{labels:withHr.map(item => `${formatDate(item.data)} · ${item.atividade}`),datasets:[{label:'FC média',data:withHr.map(item => item.fc_media_bpm),borderColor:colors.green,backgroundColor:colors.green,pointRadius:3,tension:.2},{label:'FC máxima',data:withHr.map(item => item.fc_maxima_bpm),borderColor:colors.red,backgroundColor:colors.red,pointRadius:3,tension:.2},{label:'LTHR',data:withHr.map(item => lthrForDate(item.data,model.config)),borderColor:colors.orange,borderDash:[5,4],pointRadius:0,stepped:true}]},options:chartOptions(true) });
  drawChart('fitnessChart',{ type:'line',data:{labels:days.map(day => formatDate(day.date)),datasets:[{label:'CTL (fitness)',data:days.map(day => day.ctl),borderColor:colors.blue,pointRadius:0,tension:.25},{label:'ATL (fadiga)',data:days.map(day => day.atl),borderColor:colors.red,pointRadius:0,tension:.25}]},options:chartOptions(true) });
  drawChart('tsbChart',{ type:'bar',data:{labels:days.map(day => formatDate(day.date)),datasets:[{label:'TSB (forma)',data:days.map(day => day.tsb),backgroundColor:days.map(day => tsbColor(day.tsb,model.config.faixas_tsb)),borderRadius:2}]},options:chartOptions(false) });
}

function drawChart(id,config) { if (state.charts[id]) state.charts[id].destroy(); state.charts[id] = new Chart(document.getElementById(id),config); }
function chartOptions(legend,stacked=false,dualAxis=false) { return { responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{display:legend,position:'top',labels:{boxWidth:12,color:'#666',font:{size:11}}},tooltip:{callbacks:{label:context => `${context.dataset.label}: ${formatNumber(context.parsed.y,1)}`}}},scales:{x:{stacked,ticks:{color:colors.muted,font:{size:9},maxTicksLimit:16},grid:{display:false}},y:{stacked,beginAtZero:false,ticks:{color:colors.muted,font:{size:10}},grid:{color:colors.grid}},y1:{display:dualAxis,position:'right',grid:{drawOnChartArea:false},ticks:{color:colors.orange,font:{size:10}}}}}; }

function renderTable(model) {
  const range = selectedRange(model);
  let items = model.activities.filter(item => inRange(item.data,range));
  if (state.filter === 'nohr') items = items.filter(item => item.fc_media_bpm == null);
  else if (state.filter !== 'all') items = items.filter(item => item.categoria === state.filter);
  items.sort((a,b) => (state.sort === 'desc' ? -1 : 1) * (a.data.localeCompare(b.data) || a.id.localeCompare(b.id)));
  document.querySelector('#activityTable tbody').innerHTML = items.map(activityRow).join('');
  setText('filterStatus',`${items.length} atividade${items.length === 1 ? '' : 's'} · ${state.sort === 'desc' ? 'mais recentes primeiro' : 'mais antigas primeiro'}`);
}

function activityRow(item) { const badge = {corrida:'run',musculacao:'gym',caminhada:'walk',bike:'bike'}[item.categoria] || 'other'; return `<tr><td>${formatDate(item.data)}</td><td><span class="badge ${badge}" title="${escapeHtml(item.observacoes || '')}">${escapeHtml(item.atividade)}</span></td><td>${escapeHtml(item.duracao)}</td><td>${item.distancia_km == null ? '<span class="na">—</span>' : formatNumber(item.distancia_km,2)}</td><td>${item.fc_media_bpm == null ? '<span class="na">sem dados</span>' : `${item.fc_media_bpm} bpm`}</td><td>${item.intensidade_percentual == null ? '<span class="na">—</span>' : `${item.intensidade_percentual}%`}</td><td>${item.tsi == null ? '<span class="na">—</span>' : `<strong>${item.tsi}</strong>`}</td></tr>`; }
function bestTwelveMinuteEstimate(items) { return items.filter(item => (item.categoria === 'corrida' || item.atividade.toUpperCase().includes('TAF')) && durationSeconds(item.duracao) >= 720 && item.distancia_km).map(item => ({...item,metres:item.distancia_km * 1000 * 720 / durationSeconds(item.duracao)})).sort((a,b) => b.metres-a.metres)[0] || null; }
function durationSeconds(value) { const parts=value.split(':').map(Number); return parts.reduce((total,part) => total*60+part,0); }
function lthrForDate(date,config) { return config.lthr_historico.find(item => date >= item.inicio && (!item.fim || date <= item.fim))?.valor_bpm ?? null; }
function formStatus(value,limits) { if (value <= limits.fadiga_elevada_ate) return 'fadiga elevada'; if (value < 0) return 'fadiga leve/moderada'; if (value <= limits.equilibrado_ate) return 'equilibrado'; return 'descansado'; }
function tsbColor(value,limits) { const status=formStatus(value,limits); return status==='fadiga elevada'?'rgba(214,69,69,.7)':status==='fadiga leve/moderada'?'rgba(216,140,0,.7)':status==='equilibrado'?'rgba(148,163,184,.7)':'rgba(27,175,122,.7)'; }
function sumDistance(items,category) { return items.filter(item => item.categoria===category).reduce((sum,item) => sum+(item.distancia_km||0),0); }
function sleepCard(label,value,sub) { return `<article class="kpi"><span class="kpi-label">${label}</span><strong class="kpi-value">${value}</strong><span class="kpi-sub">${sub}</span></article>`; }
function formatMinutes(value) { const minutes=Math.round(value); return `${Math.floor(minutes/60)}h${String(minutes%60).padStart(2,'0')}`; }
function parseDate(value) { return new Date(`${value}T00:00:00Z`); }
function addDays(date,days) { const copy=new Date(date); copy.setUTCDate(copy.getUTCDate()+days); return copy; }
function isoDate(date) { return date.toISOString().slice(0,10); }
function formatDate(value) { return parseDate(value).toLocaleDateString('pt-BR',{timeZone:'UTC',day:'2-digit',month:'2-digit'}); }
function formatFullDate(value) { return parseDate(value).toLocaleDateString('pt-BR',{timeZone:'UTC'}); }
function formatNumber(value,digits=1) { return Number(value).toLocaleString('pt-BR',{minimumFractionDigits:digits,maximumFractionDigits:digits}); }
function formatSigned(value) { return `${value < 0 ? '−' : ''}${formatNumber(Math.abs(value),1)}`; }
function setText(id,value) { document.getElementById(id).textContent=value; }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g,char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char])); }
