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

// ===== Toast =====
const toast = document.getElementById("toast");
function showToast(msg){
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1500);
}

// ===== Form salvar (mock) =====
const formPerfil = document.getElementById("formPerfil");
formPerfil.addEventListener("submit", (e) => {
  e.preventDefault();

  // Aqui você trocaria por fetch/Apps Script/API
  const payload = {
    nome: document.getElementById("inpNome").value.trim(),
    endereco: document.getElementById("inpEndereco").value.trim(),
    telefone: document.getElementById("inpTelefone").value.trim(),
    tempoMedio: Number(document.getElementById("inpTempoMedio").value || 0)
  };

  console.log("Salvar configurações:", payload);
  showToast("Configurações salvas!");
});

// ===== Preferências (mock salvar local) =====
const prefs = {
  notif: document.getElementById("togNotif"),
  live: document.getElementById("togLive"),
  qr: document.getElementById("togQr"),
};

function loadPrefs(){
  const saved = JSON.parse(localStorage.getItem("prefs") || "{}");
  if (typeof saved.notif === "boolean") prefs.notif.checked = saved.notif;
  if (typeof saved.live === "boolean") prefs.live.checked = saved.live;
  if (typeof saved.qr === "boolean") prefs.qr.checked = saved.qr;
}
function savePrefs(){
  localStorage.setItem("prefs", JSON.stringify({
    notif: prefs.notif.checked,
    live: prefs.live.checked,
    qr: prefs.qr.checked
  }));
  showToast("Preferências salvas!");
}

Object.values(prefs).forEach((el) => {
  el.addEventListener("change", savePrefs);
});

loadPrefs();

// ===== Sair (mock) =====
document.getElementById("btnSair").addEventListener("click", () => {
  // Aqui você faria logout real
  localStorage.removeItem("userEmail");
  showToast("Sessão encerrada!");
  setTimeout(() => {
    window.location.href = "index.html";
  }, 800);
});
