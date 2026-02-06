// Sidebar mobile (apenas para esta página)
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

// Range (raio em metros)
const rangeMeters = document.getElementById("rangeMeters");
const rangeValue = document.getElementById("rangeValue");

function setRangeLabel(v){
  if (!rangeValue) return;
  rangeValue.textContent = `${v}m`;
}

if (rangeMeters){
  setRangeLabel(rangeMeters.value);
  rangeMeters.addEventListener("input", (e) => {
    setRangeLabel(e.target.value);
  });
}

// ===============================
// CRIAR FILA
// ===============================

// inputs
const nomeFila = document.getElementById("nomeFila");
const enderecoFila = document.getElementById("enderecoFila");
const tempoMedio = document.getElementById("tempoMedio");
const capacidade = document.getElementById("capacidade");
const toggleAtiva = document.getElementById("toggleAtiva");
const msgBoasVindas = document.getElementById("msgBoasVindas");
const horario = document.getElementById("horario");
const observacoes = document.getElementById("observacoes");

const btnSalvar = document.getElementById("btnSalvarFila");
const listaFilas = document.getElementById("listaFilas");

const STORAGE_KEY = "filasCriadas";

// helper: evita quebrar se localStorage estiver com JSON inválido
function obterFilas(){
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function salvarFilas(filas){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filas));
}

function gerarID(){
  return "fila_" + Math.random().toString(36).slice(2,8).toUpperCase();
}

// render lado direito
function renderFilas(){
  if (!listaFilas) return;

  const filas = obterFilas();
  listaFilas.innerHTML = "";

  if (!filas.length){
    listaFilas.innerHTML = `<p style="opacity:.5;font-size:12px">Nenhuma fila criada ainda</p>`;
    return;
  }

  filas.forEach(fila => {
    const item = document.createElement("div");
    item.className = "queue-item";

    item.innerHTML = `
      <div class="queue-left">
        <div class="queue-title">${fila.nome}</div>
        <div class="queue-sub">${fila.endereco}</div>
        <div class="queue-sub">ID: ${fila.id}</div>
      </div>
      <span class="badge ${fila.ativa ? "badge-on" : ""}">
        ${fila.ativa ? "Ativa" : "Inativa"}
      </span>
    `;

    listaFilas.appendChild(item);
  });
}

// salvar nova fila
if (btnSalvar){
  btnSalvar.addEventListener("click", () => {

    const nome = (nomeFila?.value || "").trim();
    const endereco = (enderecoFila?.value || "").trim();
    const tempo = Number(tempoMedio?.value);

    if (!nome || !endereco || !Number.isFinite(tempo) || tempo <= 0){
      alert("Preencha os campos obrigatórios (Nome, Endereço e Tempo médio).");
      return;
    }

    const novaFila = {
      id: gerarID(),
      nome,
      endereco,
      raio: rangeMeters ? Number(rangeMeters.value) : 500,
      tempoMedio: tempo,
      capacidade: capacidade?.value ? Number(capacidade.value) : null,
      ativa: !!toggleAtiva?.checked,
      mensagem: (msgBoasVindas?.value || "").trim(),
      horario: (horario?.value || "").trim(),
      observacoes: (observacoes?.value || "").trim(),
      criadaEm: Date.now()
    };

    const filas = obterFilas();
    filas.push(novaFila);
    salvarFilas(filas);

    renderFilas();

    // limpa form (mantém raio e ativa como estão)
    if (nomeFila) nomeFila.value = "";
    if (enderecoFila) enderecoFila.value = "";
    if (msgBoasVindas) msgBoasVindas.value = "";
    if (horario) horario.value = "";
    if (observacoes) observacoes.value = "";
    if (capacidade) capacidade.value = "";
  });
}

// init
renderFilas();
