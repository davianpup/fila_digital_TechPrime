// ================= CONFIG =================
const API_BASE = window.location.origin;

// ================= HELPERS =================
function fmt2(n){ return String(n).padStart(2,"0"); }
function horaAgora(){
  const d = new Date();
  return `${fmt2(d.getHours())}:${fmt2(d.getMinutes())}:${fmt2(d.getSeconds())}`;
}
function pad3(n){ return String(n).padStart(3,"0"); }

function showToast(msg){
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(()=>toast.classList.remove("show"), 1400);
}

function getFilaId(){
  return new URLSearchParams(location.search).get("filaId");
}

function getClienteNome(filaId){
  let nome = localStorage.getItem("CLIENTE_NOME");
  if (!nome && filaId) nome = localStorage.getItem(`cliente_nome_${filaId}`);
  if (nome && filaId) localStorage.setItem(`cliente_nome_${filaId}`, nome);
  return (nome || "").trim();
}

// ================= ELEMENTOS =================
const elPos = document.getElementById("posicao");
const elFrente = document.getElementById("aFrente");
const elTempoMedio = document.getElementById("tempoMedio");
const elEstimativa = document.getElementById("estimativa");

const elDist = document.getElementById("distancia");
const elCoordsStatus = document.getElementById("coordsStatus");
const elPillRaio = document.getElementById("pillRaio");

const elFilaNome = document.getElementById("filaNome");
const elFilaRaio = document.getElementById("filaRaio");
const elUlt = document.getElementById("ultimaAtualizacao");

const btnGeo = document.getElementById("btnGeo");
const btnAtualizar = document.getElementById("btnAtualizar");
const btnSair = document.getElementById("btnSair");

// ================= Estado =================
const filaId = getFilaId();
if (!filaId){
  alert("Link inválido: falta filaId. Acesse pela leitura do QR Code.");
  window.location.replace(`${window.location.origin}/templates/saiu.html`);
  throw new Error("Sem filaId");
}

const SESSION_KEY = `cliente_session_${filaId}`;
let clienteId = Number(localStorage.getItem(SESSION_KEY) || 0);

// ✅ novo: precisamos do fila_cliente_id para identificar o “meu” atendimento
let filaClienteIdAtual = 0;

// ✅ novo: trava tudo quando finaliza
let atendimentoEncerrado = false;

// ================= MODAL FINALIZADO (CLIENTE) =================
function ensureFinalModal(){
  if (document.getElementById("finalModal")) return;

  const style = document.createElement("style");
  style.innerHTML = `
    .final-modal{
      position:fixed; inset:0; display:none; z-index:99999;
      align-items:center; justify-content:center;
      padding:16px;
    }
    .final-modal.show{ display:flex; }
    .final-overlay{
      position:absolute; inset:0;
      background:rgba(0,0,0,.75);
      backdrop-filter: blur(6px);
    }
    .final-card{
      position:relative; z-index:2;
      width:min(560px, 92vw);
      border-radius:18px;
      border:1px solid rgba(255,122,0,.25);
      background:linear-gradient(180deg, rgba(255,122,0,.12), rgba(0,0,0,.25));
      box-shadow:0 30px 90px rgba(0,0,0,.85);
      padding:28px 26px;
      text-align:center;
      color:#fff;
      animation:pop .22s ease;
    }
    @keyframes pop{from{opacity:0; transform:scale(.95)} to{opacity:1; transform:scale(1)}}
    .final-title{
      font-weight:900; letter-spacing:-.4px;
      font-size:28px; margin:0 0 8px;
    }
    .final-sub{opacity:.85; margin:0 0 18px; font-size:14px; line-height:1.4}
    .final-pill{
      display:inline-flex; align-items:center; gap:10px;
      padding:10px 14px; border-radius:999px;
      border:1px solid rgba(255,255,255,.12);
      background:rgba(0,0,0,.18);
      font-weight:800;
      margin:10px 0 18px;
    }
    .final-actions{display:flex; justify-content:center; gap:12px; flex-wrap:wrap}
    .final-btn{
      border-radius:14px; border:1px solid rgba(255,255,255,.14);
      background:rgba(255,255,255,.06);
      color:#fff; padding:12px 16px;
      font-weight:900; cursor:pointer;
      min-width:200px;
    }
    .final-btn.primary{
      background:#ff7a00; color:#0b0c0e;
      border-color:rgba(255,122,0,.55);
      box-shadow:0 14px 30px rgba(255,122,0,.18);
    }
  `;
  document.head.appendChild(style);

  const modal = document.createElement("div");
  modal.id = "finalModal";
  modal.className = "final-modal";
  modal.innerHTML = `
    <div class="final-overlay"></div>
    <div class="final-card" role="dialog" aria-modal="true" aria-label="Atendimento finalizado">
      <div class="final-title">Atendimento finalizado!</div>
      <p class="final-sub">
        Seu atendimento foi concluído com sucesso.<br>
        Você já pode sair desta página.
      </p>
      <div class="final-pill" id="finalPill">ANDALOGO • 2026</div>
      <div class="final-actions">
        <button class="final-btn primary" id="finalBtnSair">Sair</button>
      </div>
      <div style="margin-top:14px; opacity:.7; font-size:12px">(Você pode fechar esta página.)</div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById("finalBtnSair")?.addEventListener("click", () => {
    // sai sem confirmar
    forceExitToSaiu();
  });
}

function showFinalizadoModal(clienteNome){
  ensureFinalModal();
  const modal = document.getElementById("finalModal");
  const pill = document.getElementById("finalPill");
  if (pill) pill.textContent = clienteNome ? `Cliente: ${clienteNome}` : "Atendimento concluído";
  modal?.classList.add("show");
}

function forceExitToSaiu(){
  const target = `${window.location.origin}/templates/saiu.html`;

  // corta WS e timers
  atendimentoEncerrado = true;
  try { ws?.close(); } catch {}
  ws = null;
  clearInterval(wsPingTimer);
  clearTimeout(wsRetryTimer);

  // limpa sessão e nome
  try {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem("CLIENTE_NOME");
    localStorage.removeItem(`cliente_nome_${filaId}`);
  } catch {}

  window.location.replace(target);
  setTimeout(() => window.location.replace(target), 250);
}

// ================= Render =================
function renderStatus(payload){
  const stRaw = payload?.cliente?.status ?? payload?.status ?? "aguardando";
  const st = String(stRaw).toLowerCase(); // "aguardando" | "chamado" | "em_atendimento" | ...

  const aFrente = Number(payload.a_frente ?? 0);
  const pos = Number(payload.posicao ?? (aFrente + 1));

  // ✅ Se estiver em atendimento: não mostra posição/fila, mostra status
  if (st === "em_atendimento" || st === "em atendimento") {

  if (elPos){
    elPos.textContent = "Em atendimento";
    elPos.classList.add("em-atendimento");
  }

  if (elFrente){
    elFrente.textContent = "Você está sendo atendido agora";
    elFrente.classList.add("em-atendimento");
  }

}
else {

  if (elPos){
    elPos.textContent = `#${pad3(pos)}`;
    elPos.classList.remove("em-atendimento");
  }

  if (elFrente){
    elFrente.textContent = `${aFrente} pessoas à frente`;
    elFrente.classList.remove("em-atendimento");
  }

}

  // tempo médio sempre pode aparecer
  const tempoMedioMin = Number(payload.tempo_medio_min ?? 12);
  if (elTempoMedio) elTempoMedio.textContent = `${tempoMedioMin} min`;

  if (elFilaNome) elFilaNome.textContent = payload.fila_nome || "Fila";
  if (elUlt) elUlt.textContent = horaAgora();
  if (payload.fila_raio_m && elFilaRaio) elFilaRaio.textContent = `${payload.fila_raio_m}m`;
}

async function atualizarStatus(){
  if (!filaId || !clienteId) return;
  if (atendimentoEncerrado) return;

  const res = await fetch(`${API_BASE}/api/filas/${filaId}/cliente/${clienteId}/status`);
  if (!res.ok){
    // se deu 404 porque não está mais ativo, mostra finalizado e deixa sair
    if (res.status === 404){
      atendimentoEncerrado = true;
      showFinalizadoModal(getClienteNome(filaId));
      return;
    }
    showToast("Erro ao atualizar");
    return;
  }

  const data = await res.json();
  renderStatus(data);
  showToast("Atualizado!");
}

async function entrarNaFila(){
  if (!filaId) return;

  if (clienteId){
    await atualizarStatus();
    return;
  }

  const nome = getClienteNome(filaId);

  if (!nome){
    const url = new URL("/templates/login.html", window.location.origin);
    url.searchParams.set("next", "Fila_cliente.html");
    url.searchParams.set("filaId", String(filaId));
    window.location.replace(url.toString());
    return;
  }

  const res = await fetch(`${API_BASE}/api/fila/${filaId}/entrar`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ nome })
  });

  if (!res.ok){
    const err = await res.json().catch(()=>({detail:"Erro"}));
    alert(err.detail || "Erro ao entrar na fila");
    return;
  }

  const data = await res.json();

  clienteId = Number(data.cliente_id || 0);
  if (clienteId) localStorage.setItem(SESSION_KEY, String(clienteId));

  showToast(`Sua senha: ${data.senha_codigo || "OK"}`);
  await atualizarStatus();
}

// ================= GEO (mantido) =================
function setRaioStatus(ok){
  if (!elPillRaio) return;
  elPillRaio.classList.toggle("ok", ok);
  elPillRaio.classList.toggle("bad", !ok);
  elPillRaio.innerHTML = ok
    ? `<i class="bi bi-check2-circle"></i><span>Dentro do raio</span>`
    : `<i class="bi bi-x-circle"></i><span>Fora do raio</span>`;
}

async function atualizarLocalizacao(){
  if (!navigator.geolocation){
    if (elCoordsStatus){
      elCoordsStatus.textContent = "Indisponível";
      elCoordsStatus.classList.add("danger");
    }
    showToast("Geolocalização indisponível.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    () => {
      if (elCoordsStatus){
        elCoordsStatus.textContent = "Ativa";
        elCoordsStatus.classList.remove("danger");
      }

      const km = (Math.random() * 0.8).toFixed(1);
      if (elDist) elDist.textContent = `${km} km`;

      const dentro = Number(km) <= 0.5;
      setRaioStatus(dentro);

      showToast("Localização atualizada!");
    },
    () => {
      if (elCoordsStatus){
        elCoordsStatus.textContent = "Permissão negada";
        elCoordsStatus.classList.add("danger");
      }
      setRaioStatus(true);
      showToast("Permissão de localização negada.");
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

// ================= SAIR (mantido) =================
function sairDaFila(evt){
  if (evt){
    evt.preventDefault();
    evt.stopPropagation();
    if (evt.stopImmediatePropagation) evt.stopImmediatePropagation();
  }

  const ok = confirm("Tem certeza que deseja sair da fila?");
  if (!ok) return;

  const target = `${window.location.origin}/templates/saiu.html`;

  try {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem("CLIENTE_NOME");
    localStorage.removeItem(`cliente_nome_${filaId}`);
  } catch {}

  try {
    if (filaId && clienteId) {
      const url = `${API_BASE}/api/fila/${filaId}/cliente/${clienteId}/sair`;
      const blob = new Blob([JSON.stringify({})], { type: "application/json" });
      navigator.sendBeacon?.(url, blob);
    }
  } catch {}

  window.location.replace(target);
  setTimeout(() => window.location.replace(target), 250);
}

// ================= LISTENERS =================
btnGeo?.addEventListener("click", atualizarLocalizacao);
btnAtualizar?.addEventListener("click", atualizarStatus);

btnSair?.addEventListener("touchend", sairDaFila, { capture: true });
btnSair?.addEventListener("click", sairDaFila, { capture: true });

// ================= WEBSOCKET (TEMPO REAL) =================
let ws = null;
let wsPingTimer = null;
let wsRetryTimer = null;

function wsUrlForFila(filaId) {
  const proto = (location.protocol === "https:") ? "wss" : "ws";
  return `${proto}://${location.host}/ws/fila/${filaId}`;
}

function startWebSocket() {
  if (!filaId) return;
  if (atendimentoEncerrado) return;

  try { ws?.close(); } catch {}
  ws = null;

  const url = wsUrlForFila(filaId);
  ws = new WebSocket(url);

  ws.onopen = () => {
    clearInterval(wsPingTimer);
    wsPingTimer = setInterval(() => {
      try {
        if (ws?.readyState === WebSocket.OPEN) ws.send("ping");
      } catch {}
    }, 25000);
  };

  ws.onmessage = (e) => {
    if (atendimentoEncerrado) return;

    try {
      const msg = JSON.parse(e.data);

      if (msg.type === "presence") return;

      if (msg.type === "fila_update") {
        const action = (msg.action || "").toString().toUpperCase();
        const p = msg.payload || {};

        // ✅ se FINALIZOU e é o MEU cliente -> mostra modal e para tudo
        if (action === "ATENDIMENTO_FINALIZADO" || action === "FINALIZOU") {
          const payloadClienteId = Number(p.cliente_id || 0);
          const payloadFilaClienteId = Number(p.fila_cliente_id || 0);

          const ehMeu =
            (payloadClienteId && payloadClienteId === Number(clienteId)) ||
            (payloadFilaClienteId && payloadFilaClienteId === Number(filaClienteIdAtual));

          if (ehMeu) {
            atendimentoEncerrado = true;
            showFinalizadoModal(p.nome || getClienteNome(filaId));

            // corta WS / reconexão
            try { ws?.close(); } catch {}
            ws = null;
            clearInterval(wsPingTimer);
            clearTimeout(wsRetryTimer);
            return;
          }
        }

        // qualquer update normal: atualiza posição/afrente
        atualizarStatus();
      }
    } catch {
      // ignore
    }
  };

  ws.onclose = () => {
    clearInterval(wsPingTimer);
    if (atendimentoEncerrado) return;
    clearTimeout(wsRetryTimer);
    wsRetryTimer = setTimeout(startWebSocket, 2500);
  };
}

// ================= INIT =================
(async () => {
  try {
    await entrarNaFila();
    startWebSocket();
  } catch (e) {
    console.log("Init erro:", e);
  }
})();