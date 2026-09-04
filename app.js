const state = {
  clients: JSON.parse(localStorage.getItem("sds-crm-clients") || "[]"),
  opportunities: JSON.parse(localStorage.getItem("sds-crm-opportunities") || "[]"),
  activities: JSON.parse(localStorage.getItem("sds-crm-activities") || "[]")
};
const stages = ["Prospecção", "Contato realizado", "Necessidade identificada", "Orçamento enviado", "Negociação", "Fechado ganho", "Fechado perdido"];
const GOOGLE_CLIENT_ID = "616497968178-8aemogkqa0kasuaa2n5tat2vfllnvmlf.apps.googleusercontent.com";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const DEFAULT_SHEETS_URL = "https://docs.google.com/spreadsheets/d/1VZCZdkhkaIX57a1Tbl60gVGprhUf44yi67ymVGqQN0I/edit?usp=sharing";
let googleTokenClient = null;
let googleAccessToken = sessionStorage.getItem("sds-google-calendar-token") || "";
const savedSheetsUrl = localStorage.getItem("sds-google-sheets-url") || DEFAULT_SHEETS_URL;
const content = document.querySelector("#app-content");
const title = document.querySelector("#page-title");
let dashboardRegion = "all";
let alertRegion = "all";
let alertLevel = "all";
const regionColors = ["blue", "green", "orange", "purple", "teal", "pink", "gold"];
const money = value => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const save = () => {
  localStorage.setItem("sds-crm-clients", JSON.stringify(state.clients));
  localStorage.setItem("sds-crm-opportunities", JSON.stringify(state.opportunities));
  localStorage.setItem("sds-crm-activities", JSON.stringify(state.activities));
};
function setGoogleStatus(connected) {
  const button = document.querySelector("#google-button");
  if (!button) return;
  button.textContent = connected ? "Google Agenda conectado" : "Conectar Google Agenda";
  button.classList.toggle("connected", connected);
}
function connectGoogleCalendar() {
  if (!window.google?.accounts?.oauth2) {
    alert("O componente de autenticação do Google ainda está carregando. Tente novamente em alguns segundos.");
    return;
  }
  if (!googleTokenClient) {
    googleTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: CALENDAR_SCOPE,
      callback: response => {
        if (response.error) {
          alert(`Não foi possível conectar ao Google Agenda: ${response.error}`);
          return;
        }
        googleAccessToken = response.access_token;
        sessionStorage.setItem("sds-google-calendar-token", googleAccessToken);
        setGoogleStatus(true);
      }
    });
  }
  googleTokenClient.requestAccessToken({ prompt: googleAccessToken ? "" : "select_account" });
}
function sheetsCsvUrl(value) {
  try {
    const url = new URL(value);
    const match = url.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
    if (!match) return "";
    const gid = url.searchParams.get("gid") || "0";
    return `https://docs.google.com/spreadsheets/d/${match[1]}/gviz/tq?tqx=out:csv&gid=${encodeURIComponent(gid)}`;
  } catch {
    return "";
  }
}
async function connectGoogleSheets() {
  const current = localStorage.getItem("sds-google-sheets-url") || DEFAULT_SHEETS_URL;
  document.body.insertAdjacentHTML("beforeend", `<div class="modal-backdrop" id="sheets-modal"><form class="modal"><h2>Conectar Google Sheets</h2><p>Cole o link compartilhado da sua planilha.</p><label>Link da planilha<input name="url" type="url" value="${escapeHtml(current)}" required placeholder="https://docs.google.com/spreadsheets/d/..."></label><div class="modal-actions"><button type="button" class="secondary-button" data-close>Cancelar</button><button class="primary-button">Carregar dados</button></div></form></div>`);
  const modal = document.querySelector("#sheets-modal");
  modal.querySelector("[data-close]").onclick = () => modal.remove();
  const form = modal.querySelector("form");
  form.onsubmit = async event => {
    event.preventDefault();
    const value = new FormData(form).get("url").toString().trim();
    const csvUrl = sheetsCsvUrl(value);
    if (!csvUrl) {
      alert("Link inválido. Use o link da planilha no formato docs.google.com/spreadsheets/d/...");
      return;
    }
    modal.remove();
    await loadGoogleSheet(value, csvUrl);
  };
}
async function loadGoogleSheet(value, csvUrl, options = {}) {
  const button = document.querySelector("#sheets-button");
  button.disabled = true;
  button.textContent = "Lendo Google Sheets...";
  try {
    const response = await fetch(csvUrl);
    if (!response.ok) throw new Error("A planilha não está acessível.");
    const rows = csvRows(await response.text());
    if (rows.length < 2) throw new Error("A planilha está vazia ou não possui cabeçalho.");
    const headers = rows.shift().map(value => value.replace(/^\uFEFF/, ""));
    const imported = rebuildClientSummary(rows.map(row => ({ headers, row })));
    if (!imported.length) throw new Error("Nenhum cliente válido foi encontrado.");
    state.clients = imported;
    localStorage.setItem("sds-google-sheets-url", value.trim());
    save();
    navigate("clients");
    if (!options.silent) alert(`${imported.length} clientes carregados do Google Sheets.`);
  } catch (error) {
    if (options.silent) {
      console.error("Não foi possível carregar a planilha padrão:", error);
    } else {
      alert(`Não foi possível ler a planilha: ${error.message} Verifique se o compartilhamento está como "Qualquer pessoa com o link".`);
    }
  } finally {
    button.disabled = false;
    button.textContent = localStorage.getItem("sds-google-sheets-url") ? "Google Sheets conectado" : "Conectar Google Sheets";
  }
}
async function createCalendarEvent(client) {
  if (!googleAccessToken) {
    connectGoogleCalendar();
    alert("Autorize o Google Agenda e clique novamente em 'Criar evento'.");
    return;
  }
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(9, 0, 0, 0);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + 30);
  const event = {
    summary: `Follow-up: ${client.name}`,
    description: `Vendas: ${client.sales}\nOrçamentos: ${client.quotes}`,
    location: `${client.city || ""} ${client.state || ""}`.trim(),
    start: { dateTime: start.toISOString(), timeZone: "America/Sao_Paulo" },
    end: { dateTime: end.toISOString(), timeZone: "America/Sao_Paulo" }
  };
  const result = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: { Authorization: `Bearer ${googleAccessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(event)
  });
  if (!result.ok) {
    sessionStorage.removeItem("sds-google-calendar-token");
    googleAccessToken = "";
    setGoogleStatus(false);
    throw new Error("A autorização expirou ou a Google Calendar API não está ativada.");
  }
  const created = await result.json();
  window.open(created.htmlLink, "_blank", "noopener");
}
const monthAge = dateText => {
  if (!dateText) return Infinity;
  const date = new Date(dateText + "T00:00:00");
  if (Number.isNaN(date.getTime())) return Infinity;
  return Math.max(0, (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24 * 30.4375));
};
const alertInfo = months => months <= 3 ? { label: "Até 3 meses", css: "green" } : months <= 6 ? { label: "Entre 3 e 6 meses", css: "yellow" } : { label: "Acima de 6 meses", css: "red" };
const csvRows = text => {
  const rows = []; let row = []; let value = ""; let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i], next = text[i + 1];
    if (char === '"' && quoted && next === '"') { value += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if ((char === ";" || char === ",") && !quoted) { row.push(value); value = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && next === "\n") i += 1; row.push(value); if (row.some(item => item.trim())) rows.push(row); row = []; value = ""; }
    else value += char;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  return rows;
};
const normalizeHeader = value => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
const field = (headers, row, names) => { const index = headers.findIndex(header => names.includes(normalizeHeader(header))); return index >= 0 ? (row[index] || "").trim() : ""; };
const rebuildClientSummary = records => {
  const clients = new Map();
  records.forEach(record => {
    const key = field(record.headers, record.row, ["cnpj_cpf", "cnpj"]) || field(record.headers, record.row, ["cliente"]);
    if (!key) return;
    const current = clients.get(key) || { name: "", cnpj: "", city: "", state: "", region: "", phone: "", email: "", lastDate: "", sales: 0, quotes: 0, contacts: 0, total: 0 };
    current.name = current.name || field(record.headers, record.row, ["cliente", "razao_social", "empresa"]);
    current.cnpj = current.cnpj || field(record.headers, record.row, ["cnpj_cpf", "cnpj"]);
    current.city = current.city || field(record.headers, record.row, ["cidade"]);
    current.state = current.state || field(record.headers, record.row, ["estado", "uf"]);
    current.region = current.region || field(record.headers, record.row, ["regiao"]);
    current.phone = current.phone || field(record.headers, record.row, ["telefone", "celular", "fone", "fone_contato", "telefone_contato"]);
    current.email = current.email || field(record.headers, record.row, ["email", "e-mail", "email_contato"]);
    const date = field(record.headers, record.row, ["data_emissao", "data_previsao"]);
    if (date && (!current.lastDate || date.split("/").reverse().join("-") > current.lastDate)) current.lastDate = date.includes("/") ? date.split("/").reverse().join("-") : date;
    const type = field(record.headers, record.row, ["tipo"]).toUpperCase();
    if (type === "ORCAMENTO") current.quotes += 1; else current.sales += 1;
    current.contacts += field(record.headers, record.row, ["contato", "fone_contato", "email_contato"]) ? 1 : 0;
    current.total += Number((field(record.headers, record.row, ["vl_total_liquido"]) || "0").replace(/\./g, "").replace(",", ".")) || 0;
    clients.set(key, current);
  });
  return [...clients.values()];
};
let currentView = "dashboard";
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
function renderDashboard() {
  const regions = [...new Set(state.clients.map(item => item.region || "Sem região"))].sort((a, b) => a.localeCompare(b));
  const dashboardClients = dashboardRegion === "all" ? state.clients : state.clients.filter(item => (item.region || "Sem região") === dashboardRegion);
  const byStage = stages.map(stage => [stage, state.opportunities.filter(item => item.stage === stage).length]);
  const max = Math.max(1, ...byStage.map(item => item[1]));
  const alertCounts = ["green", "yellow", "red"].map(css => dashboardClients.filter(item => alertInfo(monthAge(item.lastDate)).css === css).length);
  const recentClients = [...dashboardClients].sort((a, b) => (b.lastDate || "").localeCompare(a.lastDate || "")).slice(0, 5);
  content.innerHTML = `<div class="dashboard-hero"><div><span class="eyebrow">PAINEL COMERCIAL</span><h2>Bom dia, equipe!</h2><p>Acompanhe sua carteira e priorize os próximos contatos.</p></div><div class="dashboard-actions"><label class="region-filter">Região<select id="dashboard-region"><option value="all">Todas as regiões</option>${regions.map(region => `<option value="${escapeHtml(region)}" ${region === dashboardRegion ? "selected" : ""}>${escapeHtml(region)}</option>`).join("")}</select></label><button class="primary-button" data-dashboard-view="clients">Ver clientes</button></div></div>
    <div class="region-legend">${regions.map((region, index) => `<span class="region-chip region-${index % regionColors.length}"><i></i>${escapeHtml(region)}</span>`).join("")}</div>
    <div class="cards dashboard-cards"><div class="card accent-blue"><span class="card-icon">◆</span><small>Clientes na base</small><strong>${dashboardClients.length.toLocaleString("pt-BR")}</strong><span class="card-caption">${dashboardRegion === "all" ? "Todas as regiões" : escapeHtml(dashboardRegion)}</span></div>
    <div class="card accent-green"><span class="card-icon">✓</span><small>Relacionamento ativo</small><strong>${alertCounts[0].toLocaleString("pt-BR")}</strong><span class="card-caption">Atividade nos últimos 3 meses</span></div>
    <div class="card accent-yellow"><span class="card-icon">!</span><small>Precisam de atenção</small><strong>${(alertCounts[1] + alertCounts[2]).toLocaleString("pt-BR")}</strong><span class="card-caption">Sem contato recente</span></div>
    <div class="card accent-purple"><span class="card-icon">R$</span><small>Pipeline aberto</small><strong>${money(state.opportunities.reduce((sum, item) => sum + Number(item.value || 0), 0))}</strong><span class="card-caption">${state.opportunities.length} oportunidade(s)</span></div></div>
    <div class="dashboard-grid dashboard-main"><div class="panel"><div class="panel-heading"><div><span class="panel-kicker">ACOMPANHAMENTO</span><h3>Saúde da carteira</h3></div><button class="link-button" data-dashboard-view="alerts">Ver alertas</button></div><div class="health-bars">${[["green","Ativos","Últimos 3 meses",alertCounts[0]],["yellow","Atenção","3 a 6 meses",alertCounts[1]],["red","Reativar","Mais de 6 meses",alertCounts[2]]].map(([css,label,subtitle,count]) => `<div class="health-row"><div class="health-label"><span class="health-dot ${css}"></span><div><b>${label}</b><small>${subtitle}</small></div></div><strong>${count}</strong><div class="health-track"><div class="health-fill ${css}" style="width:${state.clients.length ? count / state.clients.length * 100 : 0}%"></div></div></div>`).join("")}</div></div>
    <div class="panel"><div class="panel-heading"><div><span class="panel-kicker">ATIVIDADE</span><h3>Próximos passos</h3></div><button class="link-button" data-dashboard-view="agenda">Abrir agenda</button></div>${state.activities.slice(0, 4).map(item => `<div class="activity-item"><span class="activity-dot"></span><div><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.type || "Follow-up")} · ${escapeHtml(item.date || "Sem data")}</small></div></div>`).join("") || '<p class="empty">Nenhuma atividade cadastrada ainda.</p>'}</div></div>
    <div class="dashboard-grid dashboard-bottom"><div class="panel"><div class="panel-heading"><div><span class="panel-kicker">CARTEIRA</span><h3>Clientes com atividade mais recente</h3></div><button class="link-button" data-dashboard-view="clients">Ver todos</button></div><div class="client-list">${recentClients.map(item => `<div class="client-row"><div class="client-avatar region-${regions.indexOf(item.region || "Sem região") % regionColors.length}">${escapeHtml((item.name || "?").slice(0, 1).toUpperCase())}</div><div><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.city || "Local não informado")} · ${escapeHtml(item.lastDate || "Sem atividade")}</small></div><span class="status ${alertInfo(monthAge(item.lastDate)).css}">${alertInfo(monthAge(item.lastDate)).label}</span></div>`).join("") || '<p class="empty">Importe sua planilha para visualizar clientes.</p>'}</div></div><div class="panel pipeline-panel"><div class="panel-heading"><div><span class="panel-kicker">OPORTUNIDADES</span><h3>Funil comercial</h3></div><button class="link-button" data-dashboard-view="pipeline">Ver pipeline</button></div>${byStage.map(([stage, count]) => `<div class="bar"><span>${stage}</span><div class="bar-track"><div class="bar-fill" style="width:${count / max * 100}%"></div></div><b>${count}</b></div>`).join("")}</div></div>`;
  content.querySelectorAll("[data-dashboard-view]").forEach(button => { button.onclick = () => navigate(button.dataset.dashboardView); });
  content.querySelector("#dashboard-region").onchange = event => { dashboardRegion = event.target.value; renderDashboard(); };
}
function renderClients() {
  title.textContent = "Clientes";
  const regions = [...new Set(state.clients.map(item => item.region || "Sem região"))].sort((a, b) => a.localeCompare(b));
  const filteredClients = dashboardRegion === "all" ? state.clients : state.clients.filter(item => (item.region || "Sem região") === dashboardRegion);
  content.innerHTML = `<div class="intro clients-heading"><div><h2>Clientes</h2><p>Clique em um cliente para abrir o resumo comercial atualizado.</p></div><label class="region-filter">Região<select id="clients-region"><option value="all">Todas as regiões</option>${regions.map(region => `<option value="${escapeHtml(region)}" ${region === dashboardRegion ? "selected" : ""}>${escapeHtml(region)}</option>`).join("")}</select></label></div><div class="region-legend">${regions.map((region, index) => `<span class="region-chip region-${index % regionColors.length}"><i></i>${escapeHtml(region)}</span>`).join("")}</div><div class="panel table-wrap"><table><thead><tr><th>Empresa</th><th>Alerta</th><th>Cidade</th><th>Região</th><th>Última atividade</th></tr></thead><tbody>${filteredClients.map(item => { const index = state.clients.indexOf(item); const info = alertInfo(monthAge(item.lastDate)); const regionIndex = regions.indexOf(item.region || "Sem região"); return `<tr><td><button class="link-button" data-client="${index}"><span class="client-name-mark region-${regionIndex % regionColors.length}"></span>${escapeHtml(item.name)}</button></td><td><span class="status ${info.css}">${info.label}</span></td><td>${escapeHtml(item.city || "-")}</td><td>${escapeHtml(item.region || "-")}</td><td>${escapeHtml(item.lastDate || "Não informado")}</td></tr>`; }).join("") || '<tr><td colspan="5" class="empty">Nenhum cliente encontrado nessa região.</td></tr>'}</tbody></table></div>`;
  content.querySelectorAll("[data-client]").forEach(button => { button.onclick = () => showClient(state.clients[Number(button.dataset.client)]); });
  content.querySelector("#clients-region").onchange = event => { dashboardRegion = event.target.value; renderClients(); };
}
function renderPipeline() {
  title.textContent = "Pipeline";
  content.innerHTML = `<div class="intro"><h2>Pipeline comercial</h2><p>Oportunidades organizadas por etapa.</p></div><div class="dashboard-grid">${stages.map(stage => `<div class="panel"><h3>${stage}</h3>${state.opportunities.filter(item => item.stage === stage).map(item => `<p><b>${item.title}</b><br>${money(item.value)}</p>`).join("") || '<p class="empty">Nenhuma oportunidade.</p>'}</div>`).join("")}</div>`;
}
function renderAgenda() {
  title.textContent = "Agenda";
  content.innerHTML = `<div class="intro"><h2>Agenda comercial</h2><p>Follow-ups e atividades para a equipe.</p></div><div class="panel table-wrap"><table><thead><tr><th>Atividade</th><th>Tipo</th><th>Data</th></tr></thead><tbody>${state.activities.map(item => `<tr><td>${item.title}</td><td>${item.type || "Follow-up"}</td><td>${item.date || "-"}</td></tr>`).join("") || '<tr><td colspan="3" class="empty">Nenhuma atividade cadastrada.</td></tr>'}</tbody></table></div>`;
}
function renderAlerts() {
  title.textContent = "Alertas";
  const regions = [...new Set(state.clients.map(item => item.region || "Sem região"))].sort((a, b) => a.localeCompare(b));
  const filtered = state.clients.filter(item => (alertRegion === "all" || (item.region || "Sem região") === alertRegion) && (alertLevel === "all" || alertInfo(monthAge(item.lastDate)).css === alertLevel));
  const groups = ["green", "yellow", "red"].map(css => ({ css, clients: filtered.filter(item => alertInfo(monthAge(item.lastDate)).css === css) }));
  content.innerHTML = `<div class="intro alerts-heading"><div><h2>Alertas comerciais</h2><p>Classificação baseada na última venda, orçamento ou contato encontrado na planilha.</p></div><div class="dashboard-actions"><label class="region-filter">Região<select id="alerts-region"><option value="all">Todas as regiões</option>${regions.map(region => `<option value="${escapeHtml(region)}" ${region === alertRegion ? "selected" : ""}>${escapeHtml(region)}</option>`).join("")}</select></label><label class="region-filter">Tipo de alerta<select id="alerts-level"><option value="all">Todos os alertas</option><option value="green" ${alertLevel === "green" ? "selected" : ""}>Até 3 meses</option><option value="yellow" ${alertLevel === "yellow" ? "selected" : ""}>Entre 3 e 6 meses</option><option value="red" ${alertLevel === "red" ? "selected" : ""}>Acima de 6 meses</option></select></label><button class="secondary-button" id="export-filtered">Exportar Excel</button></div></div><div class="alert-grid">${groups.map(group => `<div class="panel alert-card ${group.css}"><h3>${group.css === "green" ? "Até 3 meses" : group.css === "yellow" ? "Entre 3 e 6 meses" : "Acima de 6 meses"}</h3><strong>${group.clients.length} cliente(s)</strong><p class="empty">${group.css === "red" ? "Priorizar reativação e follow-up." : group.css === "yellow" ? "Programar novo contato." : "Relacionamento ativo."}</p></div>`).join("")}</div><div class="panel table-wrap" style="margin-top:16px"><table><thead><tr><th>Cliente</th><th>Alerta</th><th>Região</th><th>Última atividade</th><th>Vendas</th><th>Orçamentos</th><th>Mapas</th></tr></thead><tbody>${filtered.slice(0, 100).map(item => `<tr><td>${escapeHtml(item.name)}</td><td><span class="status ${alertInfo(monthAge(item.lastDate)).css}">${alertInfo(monthAge(item.lastDate)).label}</span></td><td>${escapeHtml(item.region || "-")}</td><td>${escapeHtml(item.lastDate || "Não informado")}</td><td>${item.sales}</td><td>${item.quotes}</td><td><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.city || ""} ${item.state || ""}`)}" target="_blank" rel="noopener">Google Maps</a> · <a href="https://www.openstreetmap.org/search?query=${encodeURIComponent(`${item.city || ""} ${item.state || ""}`)}" target="_blank" rel="noopener">OSM</a></td></tr>`).join("") || '<tr><td colspan="7" class="empty">Nenhum cliente encontrado com esses filtros.</td></tr>'}</tbody></table></div>`;
  content.querySelector("#alerts-region").onchange = event => { alertRegion = event.target.value; renderAlerts(); };
  content.querySelector("#alerts-level").onchange = event => { alertLevel = event.target.value; renderAlerts(); };
  content.querySelector("#export-filtered").onclick = () => exportClients(filtered, "sds-crm-alertas");
}
function exportClients(clients, filename) {
  const headers = ["Empresa", "Telefone", "E-mail", "Cidade", "Estado", "Região", "Última atividade", "Alerta", "Vendas", "Orçamentos", "Valor movimentado"];
  const csv = [headers, ...clients.map(item => [item.name, item.phone, item.email, item.city, item.state, item.region, item.lastDate, alertInfo(monthAge(item.lastDate)).label, item.sales, item.quotes, item.total])].map(row => row.map(value => `"${String(value ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `${filename}.csv`; link.click(); URL.revokeObjectURL(link.href);
}
function showClient(client) {
  if (!client) return;
  const info = alertInfo(monthAge(client.lastDate));
  const mapsQuery = encodeURIComponent(`${client.name}, ${client.city || ""}, ${client.state || ""}`);
  document.body.insertAdjacentHTML("beforeend", `<div class="modal-backdrop" id="client-modal"><div class="modal client-detail"><h2>${escapeHtml(client.name)}</h2><p>${escapeHtml(client.city || "Cidade não informada")} / ${escapeHtml(client.state || "")}</p><div class="contact-box"><b>Contato do cliente</b><span>Nome: ${escapeHtml(client.name || "Não informado")}</span><span>Telefone: ${escapeHtml(client.phone || "Não informado")}</span><span>E-mail: ${escapeHtml(client.email || "Não informado")}</span></div><div class="detail-kpis"><div class="detail-kpi"><small>Última atividade</small><strong>${escapeHtml(client.lastDate || "Não informado")}</strong></div><div class="detail-kpi"><small>Vendas</small><strong>${client.sales}</strong></div><div class="detail-kpi"><small>Valor movimentado</small><strong>${money(client.total)}</strong></div></div><p><span class="status ${info.css}">${info.label}</span></p><p>Contatos encontrados: <b>${client.contacts}</b> · Orçamentos: <b>${client.quotes}</b></p><p><a href="https://www.google.com/maps/search/?api=1&query=${mapsQuery}" target="_blank" rel="noopener">Abrir no Google Maps</a> · <a href="https://www.openstreetmap.org/search?query=${mapsQuery}" target="_blank" rel="noopener">Abrir no OpenStreetMap</a></p><div class="modal-actions"><button class="primary-button" data-calendar> Criar evento no Google Agenda</button><a class="secondary-button" href="https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Follow-up: ${client.name}`)}&details=${encodeURIComponent(`Cliente: ${client.name}`)}&location=${mapsQuery}" target="_blank" rel="noopener">Abrir formulário</a><button class="secondary-button" data-close>Fechar</button></div></div></div>`);
  document.querySelector("#client-modal [data-calendar]").onclick = async () => {
    try { await createCalendarEvent(client); } catch (error) { alert(error.message); }
  };
  document.querySelector("#client-modal [data-close]").onclick = () => document.querySelector("#client-modal").remove();
}
function navigate(view) {
  currentView = view;
  document.querySelectorAll(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.view === view));
  title.textContent = view === "dashboard" ? "Dashboard" : view[0].toUpperCase() + view.slice(1);
  ({ dashboard: renderDashboard, clients: renderClients, pipeline: renderPipeline, agenda: renderAgenda, alerts: renderAlerts }[view])();
}
function showModal(kind) {
  const labels = kind === "client" ? ["Empresa", "CNPJ", "Cidade", "Região"] : kind === "opportunity" ? ["Título", "Valor", "Etapa"] : ["Atividade", "Tipo", "Data"];
  const fields = kind === "opportunity" ? `<label>${labels[0]}<input name="title" required></label><label>${labels[1]}<input name="value" type="number" min="0" step="0.01"></label><label>${labels[2]}<select name="stage">${stages.map(stage => `<option>${stage}</option>`).join("")}</select></label>` :
    kind === "client" ? labels.map((label, index) => `<label>${label}<input name="${["name","cnpj","city","region"][index]}" ${index === 0 ? "required" : ""}></label>`).join("") :
    `<label>${labels[0]}<input name="title" required></label><label>${labels[1]}<select name="type"><option>Follow-up</option><option>Ligação</option><option>WhatsApp</option><option>Reunião</option></select></label><label>${labels[2]}<input name="date" type="date"></label>`;
  document.body.insertAdjacentHTML("beforeend", `<div class="modal-backdrop" id="modal"><form class="modal"><h2>Novo ${kind === "client" ? "cliente" : kind === "opportunity" ? "oportunidade" : "atividade"}</h2><div class="form-grid">${fields}</div><div class="modal-actions"><button type="button" class="secondary-button" data-close>Cancelar</button><button class="primary-button">Salvar</button></div></form></div>`);
  const modal = document.querySelector("#modal");
  modal.querySelector("[data-close]").onclick = () => modal.remove();
  modal.querySelector("form").onsubmit = event => {
    event.preventDefault(); const data = Object.fromEntries(new FormData(event.target));
    if (kind === "client") state.clients.unshift(data);
    if (kind === "opportunity") state.opportunities.unshift({ title: data.title, value: Number(data.value || 0), stage: data.stage });
    if (kind === "activity") state.activities.unshift({ title: data.title, type: data.type, date: data.date });
    save(); modal.remove(); navigate(currentView);
  };
}
document.querySelector("#new-button").onclick = () => showModal(currentView === "clients" ? "client" : currentView === "pipeline" ? "opportunity" : "activity");
document.querySelector("#export-button").onclick = () => {
  const clients = dashboardRegion === "all" ? state.clients : state.clients.filter(item => (item.region || "Sem região") === dashboardRegion);
  exportClients(clients, dashboardRegion === "all" ? "sds-crm-clientes" : `sds-crm-clientes-${dashboardRegion.replace(/[^a-z0-9]+/gi, "-")}`);
};
document.querySelector("#main-nav").addEventListener("click", event => { if (event.target.matches(".nav-item")) { navigate(event.target.dataset.view); document.querySelector(".sidebar").classList.remove("open"); } });
document.querySelector("#menu-toggle").addEventListener("click", () => document.querySelector(".sidebar").classList.toggle("open"));
document.querySelector("#google-button").addEventListener("click", connectGoogleCalendar);
document.querySelector("#sheets-button").addEventListener("click", connectGoogleSheets);
document.querySelector("#import-button").addEventListener("click", () => document.querySelector("#csv-input").click());
document.querySelector("#csv-input").addEventListener("change", async event => {
  const file = event.target.files[0]; if (!file) return;
  const rows = csvRows(await file.text());
  const headers = rows.shift().map(value => value.replace(/^\uFEFF/, ""));
  state.clients = rebuildClientSummary(rows.map(row => ({ headers, row })));
  save(); navigate("clients"); event.target.value = "";
});
navigate("dashboard");
setGoogleStatus(Boolean(googleAccessToken));
if (savedSheetsUrl) {
  document.querySelector("#sheets-button").textContent = "Google Sheets conectado";
  const csvUrl = sheetsCsvUrl(savedSheetsUrl);
  if (csvUrl) loadGoogleSheet(savedSheetsUrl, csvUrl, { silent: true });
}
