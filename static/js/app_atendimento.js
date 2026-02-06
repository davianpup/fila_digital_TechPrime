// ===== Sidebar mobile (somente nesta página) =====
const sidebar = document.getElementById("sidebar");
const backdrop = document.getElementById("backdrop");
const menuBtn = document.getElementById("menuBtn");

function openSidebar(){
  if (!sidebar || !backdrop) return;
  sidebar.classList.add("open");
  backdrop.classList.add("show");
}
function closeSidebar(){
  if (!sidebar || !backdrop) return;
  sidebar.classList.remove("open");
  backdrop.classList.remove("show");
}

if (menuBtn) menuBtn.addEventListener("click", openSidebar);
if (backdrop) backdrop.addEventListener("click", closeSidebar);

// ===== ELEMENTOS UI =====
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

// ===== Modal chamada =====
const callModal = document.getElementById("callModal");
const callNome = document.getElementById("callNome");
const callPosicao = document.getElementById("callPosicao");

// ===== Seletor de fila (novo) =====
const filaSelect = document.getElementById("filaSelect");
const filaInfo = document.getElementById("filaInfo");

// ===== STORAGE KEYS =====
const FILAS_KEY = "filasCriadas";
const FILA_SELECIONADA_KEY = "filaSelecionadaId";
const clientesKey = (filaId) => `clientesFila_${filaId}`;
const atendendoKey = (filaId) => `atendimentoFila_${filaId}`;

// ===== Estado =====
let filaAtual = null;      // objeto fila
let fila = [];             // clientes aguardando (array)
let atendendo = null;      // cliente atual (obj)

// ===== Utils =====
function pad3(n){
  return String(n).padStart(3, "0");
}

function mostrarModal(cliente){
  if (!callModal) return;
  callNome.textContent = cliente.nome;
  callPosicao.textContent = `Posição #${pad3(cliente.pos)}`;
  callModal.classList.add("show");
  setTimeout(() => callModal.classList.remove("show"), 2500);
}

function lerJSON(key, fallback){
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function salvarJSON(key, value){
  localStorage.setItem(key, JSON.stringify(value));
}

// ===== Carregar filas criadas =====
function obterFilasCriadas(){
  return lerJSON(FILAS_KEY, []);
}

function carregarFila(filaId){
  const filasCriadas = obterFilasCriadas();
  filaAtual = filasCriadas.find(f => f.id === filaId) || null;

  if (!filaAtual){
    fila = [];
    atendendo = null;
    render();
    return;
  }

  // tempo médio (se existir no HTML)
  if (tempoMedioEl && filaAtual.tempoMedio) {
    tempoMedioEl.textContent = String(filaAtual.tempoMedio);
  }

  // carrega clientes aguardando
  fila = lerJSON(clientesKey(filaAtual.id), []);

  // carrega atendimento atual (persistido por fila)
  atendendo = lerJSON(atendendoKey(filaAtual.id), null);

  render();
}

function popularSelectFilas(){
  if (!filaSelect) return;

  const filasCriadas = obterFilasCriadas();

  filaSelect.innerHTML = "";

  if (!filasCriadas.length){
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Nenhuma fila criada";
    filaSelect.appendChild(opt);

    filaAtual = null;
    fila = [];
    atendendo = null;
    render();
    return;
  }

  // Preenche opções
  filasCriadas.forEach(f => {
    const opt = document.createElement("option");
    opt.value = f.id;
    opt.textContent = `${f.nome}${f.ativa ? "" : " (inativa)"}`;
    filaSelect.appendChild(opt);
  });

  // Seleciona fila salva ou primeira
  const salvo = localStorage.getItem(FILA_SELECIONADA_KEY);
  const existe = filasCriadas.some(f => f.id === salvo);
  const selecionada = existe ? salvo : filasCriadas[0].id;

  filaSelect.value = selecionada;
  localStorage.setItem(FILA_SELECIONADA_KEY, selecionada);

  carregarFila(selecionada);
}

if (filaSelect){
  filaSelect.addEventListener("change", () => {
    const id = filaSelect.value;
    localStorage.setItem(FILA_SELECIONADA_KEY, id);
    carregarFila(id);
  });
}

// ===== Render =====
function render(){
  // Se não tem fila selecionada
  if (!filaAtual){
    totalFilaEl.textContent = "0";
    atendendoAgoraEl.textContent = "Selecione uma fila";
    proxNomeEl.textContent = "—";
    proxPosEl.textContent = "—";
    proxBadgeEl.textContent = "—";

    btnChamar.disabled = true;
    btnFinalizar.disabled = true;
    btnCancelar.disabled = true;
    btnPular.disabled = true;

    if (filaInfo) filaInfo.textContent = "";
    return;
  }

  // info da fila (opcional)
  if (filaInfo){
    const statusTxt = filaAtual.ativa ? "Ativa" : "Inativa";
    filaInfo.textContent = `${statusTxt} • ID: ${filaAtual.id}`;
  }

  // total na fila (aguardando)
  totalFilaEl.textContent = String(fila.length);

  // atendendo
  if (atendendo){
    atendendoAgoraEl.textContent = atendendo.nome;
    btnFinalizar.disabled = false;
    btnCancelar.disabled = false;

    // regra: não chamar próximo durante atendimento
    btnChamar.disabled = true;

    // tooltip
    btnChamar.title = "Finalize o atendimento atual antes de chamar outro cliente";
  } else {
    atendendoAgoraEl.textContent = "Nenhum cliente sendo atendido";
    btnFinalizar.disabled = true;
    btnCancelar.disabled = true;

    btnChamar.title = "";
    btnChamar.disabled = false;
  }

  // próximo
  const prox = fila[0];
  if (prox){
    proxNomeEl.textContent = prox.nome;
    proxPosEl.textContent = `Posição #${pad3(prox.pos)}`;
    proxBadgeEl.textContent = prox.status || "Aguardando";
    btnPular.disabled = false;

    // se não tem atendimento, pode chamar
    if (!atendendo) btnChamar.disabled = false;
  } else {
    proxNomeEl.textContent = "—";
    proxPosEl.textContent = "Sem próximo";
    proxBadgeEl.textContent = "—";
    btnPular.disabled = true;
    btnChamar.disabled = true;
  }

  // Persistir estado da fila atual (clientes + atendimento)
  salvarJSON(clientesKey(filaAtual.id), fila);
  salvarJSON(atendendoKey(filaAtual.id), atendendo);
}

// ===== Ações =====
btnChamar.addEventListener("click", () => {
  if (!filaAtual) return;
  if (atendendo) return;
  if (!fila.length) return;

  const proximo = fila.shift();
  mostrarModal(proximo);
  atendendo = proximo;

  render();
});

btnFinalizar.addEventListener("click", () => {
  if (!filaAtual) return;
  atendendo = null;
  render();
});

btnCancelar.addEventListener("click", () => {
  if (!filaAtual) return;
  if (!atendendo) return;

  // volta o cliente pro começo da fila
  fila.unshift(atendendo);
  atendendo = null;
  render();
});

btnPular.addEventListener("click", () => {
  if (!filaAtual) return;
  if (fila.length <= 1) return;

  fila.push(fila.shift());
  render();
});

// ===== INIT =====
popularSelectFilas();
