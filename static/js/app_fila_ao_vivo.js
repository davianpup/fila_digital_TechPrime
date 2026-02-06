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

// ===== Elementos =====
const queueList = document.getElementById("queueList");
const queueCountLabel = document.getElementById("queueCountLabel");
const btnRefresh = document.getElementById("btnRefresh");
const filaSelect = document.getElementById("filaSelect");

// ===== Storage =====
const FILAS_KEY = "filasCriadas";
const FILA_SELECIONADA_KEY = "filaSelecionadaId";
const clientesKey = (filaId) => `clientesFila_${filaId}`;

function lerJSON(key, fallback){
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch { return fallback; }
}
function salvarJSON(key, value){
  localStorage.setItem(key, JSON.stringify(value));
}

function pad3(n){
  return String(n).padStart(3, "0");
}

function statusPill(s){
  if (s === "no_raio"){
    return `<span class="pill pill-green"><i class="bi bi-geo-alt"></i> No raio</span>`;
  }
  return `<span class="pill pill-gray"><i class="bi bi-slash-circle"></i> Fora</span>`;
}

function normalizarCliente(c){
  // aceita tanto {num,...} quanto {pos,...}
  const num = Number.isFinite(Number(c.num)) ? Number(c.num) : Number(c.pos || 0);
  return {
    num,
    nome: c.nome || "—",
    hora: c.hora || "--:--",
    tempo: c.tempo || "",
    estimativa: c.estimativa || "",
    status: c.status || "no_raio"
  };
}

let filaAtualId = "";
let clientes = [];

function obterFilasCriadas(){
  return lerJSON(FILAS_KEY, []);
}

function carregarClientes(){
  if (!filaAtualId){
    clientes = [];
    return;
  }
  clientes = lerJSON(clientesKey(filaAtualId), []).map(normalizarCliente);

  // garante ordenação por número
  clientes.sort((a,b) => a.num - b.num);
}

function itemTemplate(item){
  return `
    <div class="queue-item" data-num="${item.num}">
      <div class="left">
        <div class="tag-num">#${pad3(item.num)}</div>
        <div class="info">
          <div class="name">${item.nome}</div>
          <div class="meta">
            <span><i class="bi bi-clock"></i> ${item.hora}</span>
            <span>•</span>
            <span>${item.tempo}</span>
            <span>•</span>
            <span>${item.estimativa}</span>
          </div>
        </div>
      </div>

      <div class="right">
        ${statusPill(item.status)}
        <button class="more-btn" title="Alternar status (simulação)">
          <i class="bi bi-three-dots-vertical"></i>
        </button>
      </div>
    </div>
  `;
}

function render(){
  queueCountLabel.textContent = `Aguardando (${clientes.length})`;

  if (!filaAtualId){
    queueList.innerHTML = `<p style="opacity:.6;font-size:12px">Selecione uma fila para visualizar os clientes.</p>`;
    return;
  }

  if (!clientes.length){
    queueList.innerHTML = `<p style="opacity:.6;font-size:12px">Nenhum cliente na fila.</p>`;
    return;
  }

  queueList.innerHTML = clientes.map(itemTemplate).join("");

  // Alterna status "no raio" / "fora" e salva
  queueList.querySelectorAll(".more-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const card = e.currentTarget.closest(".queue-item");
      const num = parseInt(card.dataset.num, 10);
      const idx = clientes.findIndex(q => q.num === num);
      if (idx === -1) return;

      clientes[idx].status = clientes[idx].status === "no_raio" ? "fora" : "no_raio";

      // salva de volta no storage mantendo o formato {num,...}
      salvarJSON(clientesKey(filaAtualId), clientes);

      render();
    });
  });
}

function popularSelectFilas(){
  const filas = obterFilasCriadas();

  filaSelect.innerHTML = "";

  if (!filas.length){
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Nenhuma fila criada";
    filaSelect.appendChild(opt);
    filaAtualId = "";
    clientes = [];
    render();
    return;
  }

  filas.forEach(f => {
    const opt = document.createElement("option");
    opt.value = f.id;
    opt.textContent = `${f.nome}${f.ativa ? "" : " (inativa)"}`;
    filaSelect.appendChild(opt);
  });

  const salvo = localStorage.getItem(FILA_SELECIONADA_KEY);
  const existe = filas.some(f => f.id === salvo);
  filaAtualId = existe ? salvo : filas[0].id;

  filaSelect.value = filaAtualId;
  localStorage.setItem(FILA_SELECIONADA_KEY, filaAtualId);

  carregarClientes();
  render();
}

filaSelect.addEventListener("change", () => {
  filaAtualId = filaSelect.value;
  localStorage.setItem(FILA_SELECIONADA_KEY, filaAtualId);
  carregarClientes();
  render();
});

// Atualizar: recarrega do localStorage
btnRefresh.addEventListener("click", () => {
  carregarClientes();
  render();
});

// Init
popularSelectFilas();
render();
