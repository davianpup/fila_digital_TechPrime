// ================= CONFIG =================
const API_BASE = window.location.origin;

// ================= ESTABELECIMENTO (nome dinâmico) =================
(function syncNomeEstab() {
  const ja = localStorage.getItem("nomeEstabelecimento");
  if (ja && ja.trim()) return;

  const n =
    localStorage.getItem("estabelecimento_nome") ||
    localStorage.getItem("nome_estabelecimento") ||
    localStorage.getItem("estab_nome");

  if (n && n.trim()) localStorage.setItem("nomeEstabelecimento", n.trim());
})();

function renderEstabNome(nome) {
  const finalNome =
    (nome ||
      localStorage.getItem("nomeEstabelecimento") ||
      localStorage.getItem("estabelecimento_nome") ||
      "—"
    ).trim();

  const el = document.getElementById("nomeEstabelecimento");
  const header = document.getElementById("estabHeader");

  if (el) el.textContent = finalNome;
  if (header) header.title = `Estabelecimento: ${finalNome}`;
}

// ================= ELEMENTOS UI =================
const sidebar = document.getElementById("sidebar");
const backdrop = document.getElementById("backdrop");
const menuBtn = document.getElementById("menuBtn");

const totalFilaEl = document.getElementById("totalFila");
const atendendoAgoraEl = document.getElementById("atendendoAgora");
const proxNomeEl = document.getElementById("proxNome");
const proxPosEl = document.getElementById("proxPosicao");
const proxBadgeEl = document.getElementById("proxBadge");
const tempoMedioEl = document.getElementById("tempoMedio");

const btnChamar = document.getElementById("btnChamar");
const btnFinalizar = document.getElementById("btnFinalizar");
const btnCancelar = document.getElementById("btnCancelar");
const btnPular = document.getElementById("btnPular");

const callModal = document.getElementById("callModal");
const callNome = document.getElementById("callNome");
const callPosicao = document.getElementById("callPosicao");

// ✅ Modal de finalizado (overlay grande)
const finishOverlay = document.getElementById("finishOverlay");
const finishSub = document.getElementById("finishSub");
const finishTip = document.getElementById("finishTip");
const finishOkBtn = document.getElementById("finishOkBtn");

const filaSelect = document.getElementById("filaSelect");
const filaInfo = document.getElementById("filaInfo");

// ================= SIDEBAR (mobile) =================
function openSidebar() {
  if (!sidebar || !backdrop) return;
  sidebar.classList.add("open");
  backdrop.classList.add("show");
}
function closeSidebar() {
  if (!sidebar || !backdrop) return;
  sidebar.classList.remove("open");
  backdrop.classList.remove("show");
}
menuBtn?.addEventListener("click", openSidebar);
backdrop?.addEventListener("click", closeSidebar);

// ================= HELPERS =================
function pad3(n) { return String(n).padStart(3, "0"); }

function setButtons({ canChamar=false, canFinalizar=false, canCancelar=false, canPular=false }) {
  if (btnChamar) btnChamar.disabled = !canChamar;
  if (btnFinalizar) btnFinalizar.disabled = !canFinalizar;
  if (btnCancelar) btnCancelar.disabled = !canCancelar;
  if (btnPular) btnPular.disabled = !canPular;
}

// ✅ Modal pequeno ("Chamando cliente")
function showCallModalCliente({ nome="—", posicao=1, titulo="Chamando cliente" }) {
  if (!callModal || !callNome || !callPosicao) return;

  callNome.textContent = nome;
  callPosicao.textContent = `${titulo} • Posição #${pad3(posicao || 1)}`;

  callModal.classList.add("show");
  setTimeout(() => callModal.classList.remove("show"), 1800);
}

// ✅ Modal grande (finishOverlay)
function openFinishOverlay({ nome="Cliente" } = {}) {
  if (!finishOverlay) return;

  if (finishSub) finishSub.textContent = `${nome} atendido com sucesso.`;
  if (finishTip) finishTip.textContent = "Você pode chamar o próximo cliente.";

  finishOverlay.classList.add("show");
  finishOverlay.setAttribute("aria-hidden", "false");
}

function closeFinishOverlay() {
  if (!finishOverlay) return;
  finishOverlay.classList.remove("show");
  finishOverlay.setAttribute("aria-hidden", "true");
}

finishOkBtn?.addEventListener("click", closeFinishOverlay);
finishOverlay?.addEventListener("click", (e) => {
  if (e.target === finishOverlay) closeFinishOverlay();
});

// ================= FETCH =================
async function getJSON(path) {
  const res = await fetch(API_BASE + path);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Erro HTTP ${res.status}`);
  return data;
}

async function postJSON(path, body = {}) {
  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Erro HTTP ${res.status}`);
  return data;
}

// ================= AUTH / ESTAB =================
const estabId = Number(localStorage.getItem("estabelecimento_id") || 0);
const estabNomeLS = (localStorage.getItem("estabelecimento_nome") || "").trim();

if (!estabId) {
  alert("Você precisa estar logado como estabelecimento.");
  window.location.replace("/templates/LoginCnpj.html");
  throw new Error("Sem estabelecimento_id");
}

// ================= FILA SELECIONADA =================
const FILA_SELECIONADA_KEY = "filaSelecionadaId";
let filaIdAtual = Number(localStorage.getItem(FILA_SELECIONADA_KEY) || 0);

// caches para modal
let atualCache = null; // { fila_cliente_id, nome }
let proxCache = null;  // { fila_cliente_id, nome, posicao }

// ================= WEBSOCKET =================
let ws = null;
let wsRetryTimer = null;

function wsUrlForFila(filaId) {
  const proto = (location.protocol === "https:") ? "wss" : "ws";
  return `${proto}://${location.host}/ws/fila/${filaId}`;
}

function stopWS() {
  try { ws?.close(); } catch {}
  ws = null;
  clearTimeout(wsRetryTimer);
}

function startWS(filaId) {
  stopWS();
  if (!filaId) return;

  ws = new WebSocket(wsUrlForFila(filaId));

  ws.onmessage = async (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg?.type !== "fila_update") return;

      const action = (msg.action || "").toUpperCase();
      const p = msg.payload || {};

      if (action === "ATENDIMENTO_FINALIZADO" || action === "FINALIZOU") {
        openFinishOverlay({ nome: p.nome || atualCache?.nome || "Cliente" });
      }

      await refreshAtendimento();
    } catch {}
  };

  ws.onclose = () => {
    clearTimeout(wsRetryTimer);
    wsRetryTimer = setTimeout(() => startWS(filaId), 2500);
  };
}

// ================= API: STATUS ATENDIMENTO =================
async function refreshAtendimento() {
  if (!filaIdAtual) {
    if (totalFilaEl) totalFilaEl.textContent = "0";
    if (atendendoAgoraEl) atendendoAgoraEl.textContent = "Selecione uma fila";
    if (proxNomeEl) proxNomeEl.textContent = "—";
    if (proxPosEl) proxPosEl.textContent = "—";
    if (proxBadgeEl) proxBadgeEl.textContent = "—";
    if (filaInfo) filaInfo.textContent = "";
    atualCache = null;
    proxCache = null;
    setButtons({});
    return;
  }

  const data = await getJSON(`/api/filas/${filaIdAtual}/atendimento/status`);

  if (filaInfo) {
    const statusTxt = (data.fila_status || "").toUpperCase() === "ABERTA" ? "Ativa" : "Inativa";
    filaInfo.textContent = `${statusTxt} • ID: ${data.fila_id}`;
  }

  if (totalFilaEl) totalFilaEl.textContent = String(data.aguardando_total ?? 0);
  if (tempoMedioEl) tempoMedioEl.textContent = String(data.tempo_medio_min ?? 15);

  const atual = data.atual || null;
  atualCache = atual;

  if (atual) {
    if (atendendoAgoraEl) atendendoAgoraEl.textContent = atual.nome || "—";
  } else {
    if (atendendoAgoraEl) atendendoAgoraEl.textContent = "Nenhum cliente sendo atendido";
  }

  const prox = data.proximo || null;
  proxCache = prox;

  if (prox) {
    if (proxNomeEl) proxNomeEl.textContent = prox.nome || "—";
    if (proxPosEl) proxPosEl.textContent = `Posição #${pad3(prox.posicao || 1)}`;
    if (proxBadgeEl) proxBadgeEl.textContent = "Aguardando";
  } else {
    if (proxNomeEl) proxNomeEl.textContent = "—";
    if (proxPosEl) proxPosEl.textContent = "Sem próximo";
    if (proxBadgeEl) proxBadgeEl.textContent = "—";
  }

  const temAtual = !!atual;
  const temProx = !!prox;

  setButtons({
    canChamar: !temAtual && temProx,
    canFinalizar: temAtual,
    canCancelar: temAtual,
    canPular: !temAtual && (data.aguardando_total ?? 0) > 1,
  });

  if (btnChamar) btnChamar.title = temAtual ? "Finalize/cancele antes de chamar outro" : "";
}

// ================= CARREGAR FILAS =================
async function carregarFilas() {
  const filas = await getJSON(`/api/filas?estabelecimento_id=${estabId}`);

  if (!filaSelect) return;

  filaSelect.innerHTML = "";

  if (!Array.isArray(filas) || !filas.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Nenhuma fila criada";
    filaSelect.appendChild(opt);

    filaIdAtual = 0;
    localStorage.removeItem(FILA_SELECIONADA_KEY);
    await refreshAtendimento();
    stopWS();
    return;
  }

  filas.sort((a, b) => {
    const aa = (a.status === "ABERTA") ? 0 : 1;
    const bb = (b.status === "ABERTA") ? 0 : 1;
    if (aa !== bb) return aa - bb;
    return (b.idFila || b.id || 0) - (a.idFila || a.id || 0);
  });

  for (const f of filas) {
    const id = Number(f.idFila || f.id || 0);
    const nome = (f.nome || `Fila #${id}`).trim();
    const ativa = (f.status || "").toUpperCase() === "ABERTA";

    const opt = document.createElement("option");
    opt.value = String(id);
    opt.textContent = ativa ? nome : `${nome} (inativa)`;
    filaSelect.appendChild(opt);
  }

  const existe = filas.some(f => Number(f.idFila || f.id) === Number(filaIdAtual));
  filaIdAtual = existe ? Number(filaIdAtual) : Number(filas[0].idFila || filas[0].id);

  filaSelect.value = String(filaIdAtual);
  localStorage.setItem(FILA_SELECIONADA_KEY, String(filaIdAtual));

  startWS(filaIdAtual);
  await refreshAtendimento();
}

filaSelect?.addEventListener("change", async () => {
  filaIdAtual = Number(filaSelect.value || 0);
  localStorage.setItem(FILA_SELECIONADA_KEY, String(filaIdAtual || ""));
  startWS(filaIdAtual);
  await refreshAtendimento();
});

// ================= AÇÕES =================
btnChamar?.addEventListener("click", async () => {
  if (!filaIdAtual) return;
  try {
    const r = await postJSON(`/api/filas/${filaIdAtual}/atendimento/chamar`);
    showCallModalCliente({
      nome: r?.cliente?.nome || proxCache?.nome || "Cliente",
      posicao: r?.cliente?.posicao || 1,
      titulo: "Chamando cliente"
    });
    await refreshAtendimento();
  } catch (e) {
    alert(e.message || "Erro ao chamar");
  }
});

btnFinalizar?.addEventListener("click", async () => {
  if (!filaIdAtual) return;
  try {
    const nome = atualCache?.nome || "Cliente";
    await postJSON(`/api/filas/${filaIdAtual}/atendimento/finalizar`);
    openFinishOverlay({ nome });
    await refreshAtendimento();
  } catch (e) {
    alert(e.message || "Erro ao finalizar");
  }
});

btnCancelar?.addEventListener("click", async () => {
  if (!filaIdAtual) return;
  try {
    await postJSON(`/api/filas/${filaIdAtual}/atendimento/cancelar`);
    await refreshAtendimento();
  } catch (e) {
    alert(e.message || "Erro ao cancelar");
  }
});

btnPular?.addEventListener("click", async () => {
  if (!filaIdAtual) return;
  try {
    await postJSON(`/api/filas/${filaIdAtual}/atendimento/pular`);
    await refreshAtendimento();
  } catch (e) {
    alert(e.message || "Erro ao pular");
  }
});

// ================= INIT =================
(async () => {
  // ✅ renderiza de cara com o que tem no storage
  renderEstabNome(estabNomeLS);

  // ✅ tenta pegar do banco e atualizar (opcional)
  try {
    const est = await getJSON(`/api/estabelecimentos/${estabId}`);
    if (est?.nome) {
      localStorage.setItem("estabelecimento_nome", est.nome);
      localStorage.setItem("nomeEstabelecimento", est.nome);
      renderEstabNome(est.nome);
    }
  } catch {}

  await carregarFilas();
})();