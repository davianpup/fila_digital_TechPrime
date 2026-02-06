const API_BASE = "http://192.168.205.226:8000";

function fmt2(n){ return String(n).padStart(2,"0"); }
function horaAgora(){
  const d = new Date();
  return `${fmt2(d.getHours())}:${fmt2(d.getMinutes())}:${fmt2(d.getSeconds())}`;
}
function pad3(n){ return String(n).padStart(3,"0"); }

function showToast(msg){
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(()=>toast.classList.remove("show"), 1400);
}

function getFilaId(){
  return new URLSearchParams(location.search).get("filaId");
}

// ===== ELEMENTOS =====
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

// ===== Estado =====
const filaId = getFilaId();
if (!filaId){
  alert("Link inválido: falta filaId");
}

const SESSION_KEY = `cliente_session_${filaId}`;
let clienteId = Number(localStorage.getItem(SESSION_KEY) || 0);

// ===== Render =====
function renderStatus(payload){
  // payload: {fila_nome, cliente:{...}, a_frente, tempo_medio_min, estimativa_min}
  const aFrente = payload.a_frente ?? 0;
  const tempoMedioMin = payload.tempo_medio_min ?? 15;

  // Se estiver aguardando, posição = a_frente + 1. Se atendendo, mostra como #001 (ou mantém)
  const pos = (payload.cliente?.status === "aguardando") ? (aFrente + 1) : 1;

  elPos.textContent = `#${pad3(pos)}`;
  elFrente.textContent = `${aFrente} pessoas à frente`;

  elTempoMedio.textContent = `${tempoMedioMin} min`;
  elEstimativa.textContent = `~${payload.estimativa_min ?? (aFrente * tempoMedioMin)} min`;

  elFilaNome.textContent = payload.fila_nome || "Fila";
  elUlt.textContent = horaAgora();

  // raio (se você quiser mostrar o raio real do banco, precisamos colocar no endpoint)
  // por enquanto mantemos o que já existe no layout:
  // elFilaRaio.textContent = "500m";
}

async function atualizarStatus(){
  if (!filaId || !clienteId) return;

  const res = await fetch(`${API_BASE}/api/filas/${filaId}/cliente/${clienteId}/status`);
  if (!res.ok){
    showToast("Erro ao atualizar");
    return;
  }
  const data = await res.json();

  // mostra raio se vier (se você adicionar no endpoint)
  // ex: data.fila_raio_m
  if (data.fila_raio_m) elFilaRaio.textContent = `${data.fila_raio_m}m`;

  renderStatus(data);
  showToast("Atualizado!");
}

async function entrarNaFila(){
  if (!filaId) return;

  // se já tem sessão salva, só atualiza
  if (clienteId){
    await atualizarStatus();
    return;
  }

  // pede nome (sem mexer no design)
  let nome = prompt("Digite seu nome para entrar na fila:");
  if (!nome) nome = "Cliente";

  const res = await fetch(`${API_BASE}/api/filas/${filaId}/entrar`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ nome })
  });

  if (!res.ok){
    const err = await res.json().catch(()=>({detail:"Erro"}));
    alert(err.detail || "Erro ao entrar na fila");
    return;
  }

  const data = await res.json(); // {cliente_id, senha_num, senha_codigo, pessoas_a_frente}

  clienteId = Number(data.cliente_id);
  localStorage.setItem(SESSION_KEY, String(clienteId));

  // Mostra uma mensagem com a senha (sem mudar o layout)
  showToast(`Sua senha: ${data.senha_codigo}`);

  // Agora busca status completo e renderiza
  await atualizarStatus();
}

// ===== GEO (mantive igual seu mock) =====
function setRaioStatus(ok){
  elPillRaio.classList.toggle("ok", ok);
  elPillRaio.classList.toggle("bad", !ok);
  elPillRaio.innerHTML = ok
    ? `<i class="bi bi-check2-circle"></i><span>Dentro do raio</span>`
    : `<i class="bi bi-x-circle"></i><span>Fora do raio</span>`;
}

async function atualizarLocalizacao(){
  if (!navigator.geolocation){
    elCoordsStatus.textContent = "Indisponível";
    elCoordsStatus.classList.add("danger");
    showToast("Geolocalização indisponível.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    () => {
      elCoordsStatus.textContent = "Ativa";
      elCoordsStatus.classList.remove("danger");

      const km = (Math.random() * 0.8).toFixed(1);
      elDist.textContent = `${km} km`;

      const dentro = Number(km) <= 0.5;
      setRaioStatus(dentro);

      showToast("Localização atualizada!");
    },
    () => {
      elCoordsStatus.textContent = "Permissão negada";
      elCoordsStatus.classList.add("danger");
      setRaioStatus(true);
      showToast("Permissão de localização negada.");
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

// ===== Botões =====
btnGeo?.addEventListener("click", atualizarLocalizacao);
btnAtualizar?.addEventListener("click", atualizarStatus);

btnSair?.addEventListener("click", async () => {
  const ok = confirm("Tem certeza que deseja sair da fila?");
  if (!ok) return;

  if (filaId && clienteId){
    // precisa do endpoint /sair (patch abaixo)
    await fetch(`${API_BASE}/api/filas/${filaId}/cliente/${clienteId}/sair`, { method: "POST" })
      .catch(() => {});
  }

  localStorage.removeItem(SESSION_KEY);
  showToast("Você saiu da fila.");
  setTimeout(() => window.location.href = "index.html", 600);
});

// Init
entrarNaFila().catch(err => {
  console.error(err);
  showToast("Erro ao entrar");
});
