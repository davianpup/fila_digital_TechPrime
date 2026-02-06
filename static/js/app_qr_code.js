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

// ===== API =====
const API_BASE = "http://192.168.205.226:8000";

// ===== Elementos =====
const filaList = document.getElementById("filaList");
const filaNomeTop = document.getElementById("filaNomeTop");
const filaLink = document.getElementById("filaLink");
const btnOpenLink = document.getElementById("btnOpenLink");

const qrBox = document.getElementById("qrBox");
const btnBaixar = document.getElementById("btnBaixar");
const btnCopiar = document.getElementById("btnCopiar");
const btnImprimir = document.getElementById("btnImprimir");
const toast = document.getElementById("toast");

// Instância do QR
let qrInstance = null;

// Estado
let filas = [];
let filaSelecionada = null;
let linkSelecionado = "";

// ===== Helpers =====
function showToast(msg){
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1500);
}

function clearQr(){
  qrBox.innerHTML = "";
  qrInstance = null;
}

function renderQr(text){
  clearQr();
  // a lib qrcodegen.js expõe QRCode (como você já usa)
  qrInstance = new QRCode(qrBox, {
    text,
    width: 230,
    height: 230,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });
}

/**
 * Gera link ABSOLUTO pro cliente, preservando a pasta onde está seu projeto.
 * Ex: se você abrir Qr_code.html em http://192.168.56.1:5500/Projeto/Qr_code.html
 * vai gerar: http://192.168.56.1:5500/Projeto/Fila_cliente.html?filaId=...
 */
function gerarLinkCliente(filaId){
  const url = new URL("Fila_cliente.html", window.location.href);
  url.searchParams.set("filaId", filaId);
  return url.toString();
}

function renderLista(){
  if (!filaList) return;

  if (!filas.length){
    filaList.innerHTML = `<p style="opacity:.6">Nenhuma fila encontrada no banco.</p>`;
    return;
  }

  filaList.innerHTML = filas.map(f => `
    <div class="queue-card ${f.id === filaSelecionada?.id ? "" : "inactive"}" data-id="${f.id}">
      <div>
        <div class="queue-title">${f.nome}</div>
        <div class="queue-sub">${f.endereco}</div>
      </div>
      <span class="badge">${f.ativa ? "Ativa" : "Inativa"}</span>
    </div>
  `).join("");

  filaList.querySelectorAll(".queue-card").forEach(card => {
    card.addEventListener("click", () => {
      const id = card.dataset.id;
      const f = filas.find(x => x.id === id);
      if (!f) return;
      filaSelecionada = f;
      renderTudo();
    });
  });
}

function renderTudo(){
  renderLista();

  if (!filaSelecionada) return;

  linkSelecionado = gerarLinkCliente(filaSelecionada.id);

  filaNomeTop.textContent = filaSelecionada.nome;

  filaLink.textContent = linkSelecionado;
  filaLink.href = linkSelecionado;

  renderQr(linkSelecionado);
}

// ===== Ações =====
btnOpenLink?.addEventListener("click", () => {
  if (!linkSelecionado) return;
  window.open(linkSelecionado, "_blank", "noopener");
});

btnCopiar?.addEventListener("click", async () => {
  if (!linkSelecionado) return;
  try{
    await navigator.clipboard.writeText(linkSelecionado);
    showToast("Link copiado!");
  }catch{
    const temp = document.createElement("textarea");
    temp.value = linkSelecionado;
    document.body.appendChild(temp);
    temp.select();
    document.execCommand("copy");
    temp.remove();
    showToast("Link copiado!");
  }
});

btnBaixar?.addEventListener("click", () => {
  const img = qrBox.querySelector("img");
  const canvas = qrBox.querySelector("canvas");

  let dataUrl = "";
  if (canvas) dataUrl = canvas.toDataURL("image/png");
  else if (img) dataUrl = img.src;

  if (!dataUrl){
    showToast("Não foi possível baixar.");
    return;
  }

  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `QR_${filaSelecionada?.id || "fila"}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  showToast("Baixado!");
});

btnImprimir?.addEventListener("click", () => {
  const img = qrBox.querySelector("img");
  const canvas = qrBox.querySelector("canvas");

  let dataUrl = "";
  if (canvas) dataUrl = canvas.toDataURL("image/png");
  else if (img) dataUrl = img.src;

  if (!dataUrl){
    showToast("Não foi possível imprimir.");
    return;
  }

  const w = window.open("", "_blank", "noopener");
  if (!w) return;
  w.document.write(`
    <html><head><title>Imprimir QR</title></head>
    <body style="display:grid;place-items:center;margin:0;height:100vh">
      <div style="text-align:center;font-family:Arial">
        <h2>${filaSelecionada?.nome || "Fila"}</h2>
        <img src="${dataUrl}" style="width:300px;height:300px"/>
        <p>${linkSelecionado}</p>
      </div>
      <script>window.onload=()=>{window.print();}</script>
    </body></html>
  `);
  w.document.close();
});

// ===== Carregar filas do banco =====
async function carregarFilas(){
  try{
    const res = await fetch(`${API_BASE}/api/filas`);
    if (!res.ok) throw new Error("Falha ao buscar filas");
    filas = await res.json();

    // seleciona a primeira ativa, se existir, senão a primeira
    filaSelecionada = filas.find(f => !!f.ativa) || filas[0] || null;

    renderTudo();
  }catch(err){
    console.error(err);
    filaList.innerHTML = `<p style="opacity:.6">Erro ao carregar filas da API.</p>`;
    showToast("Erro ao carregar filas");
  }
}

carregarFilas();
