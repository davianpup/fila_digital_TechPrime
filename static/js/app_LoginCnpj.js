const API_BASE = "http://localhost:8010";  // ajuste pro seu IP/porta (ex: http://192.168.56.1:8010)

async function postJSON(url, data) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  let payload = null;
  let rawText = "";
  try { payload = await res.json(); }
  catch { rawText = await res.text().catch(() => ""); }

  if (!res.ok) {
    const msg =
      payload?.detail ||
      payload?.message ||
      rawText?.slice(0, 200) ||
      `Erro ao salvar. (HTTP ${res.status})`;
    throw new Error(msg);
  }
  return payload;
}

// Promessa de geolocalização (se precisar latitude/longitude)
function getGeo() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Geolocalização não suportada."));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => reject(new Error("Não foi possível obter localização.")),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

const form = document.getElementById("form");
const nomeInput = document.getElementById("nome");
const errorEl = document.getElementById("error");
const modalCard = document.getElementById("modalCard");

const overlay = document.getElementById("overlay");
const successName = document.getElementById("successName");
Number = document.getElementById("queueNumber");
const editNameBtn = document.getElementById("editNameBtn");

const helpBtn = document.getElementById("helpBtn");
const helpWrap = document.getElementById("helpWrap");
const helpTip = document.getElementById("helpTip");

/* ===== helpers ===== */
function existe(el) {
  return el !== null && el !== undefined;
}

function shakeModal() {
  if (!existe(modalCard)) return;
  modalCard.classList.remove("shake");
  void modalCard.offsetWidth;
  modalCard.classList.add("shake");
}

function limparErros() {
  if (existe(errorEl)) errorEl.textContent = "";
  if (existe(bizError)) bizError.textContent = "";
  if (existe(signupError)) signupError.textContent = "";
  if (existe(signupError2)) signupError2.textContent = "";
  if (existe(forgotError)) forgotError.textContent = "";
  if (existe(modalCard)) modalCard.classList.remove("has-error");
  if (existe(modalCard) && existe(modeBiz) && !modeBiz.classList.contains("hidden")) {
    modalCard.classList.add("no-close");
  }
}

function nomeValido(nome) {
  return (nome || "").trim().length >= 3;
}

function emailValido(email) {
  const e = (email || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
}

const STORAGE_KEY_BIZ = "andalogo_estabelecimentos";

function getBizDB() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_BIZ) || "{}");
  } catch {
    return {};
  }
}

function setBizDB(db) {
  localStorage.setItem(STORAGE_KEY_BIZ, JSON.stringify(db));
}

function normalizarEmail(email) {
  return (email || "").trim().toLowerCase();
}

/* =========================
   SUCESSO (CLIENTE)
========================= */
function abrirSucesso(nome) {
  if (!existe(overlay)) return;
  if (existe(successName)) successName.textContent = nome;
  if (existe(queueNumber)) queueNumber.textContent = "#001";

  overlay.classList.add("show");
  overlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("lock");
}

function fecharSucesso() {
  if (!existe(overlay)) return;
  overlay.classList.remove("show");
  overlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("lock");
}

if (existe(overlay)) {
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) fecharSucesso();
  });
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (existe(overlay) && overlay.classList.contains("show")) fecharSucesso();
    fecharTooltip();
  }
});

if (existe(editNameBtn)) {
  editNameBtn.addEventListener("click", () => {
    fecharSucesso();
    if (existe(nomeInput)) {
      nomeInput.focus();
      nomeInput.select();
    }
  });
}

/* =========================
   TOOLTIP "COMO FUNCIONA"
========================= */
function abrirTooltip() {
  if (!existe(helpWrap) || !existe(helpBtn) || !existe(helpTip)) return;
  helpWrap.classList.add("open");
  helpBtn.setAttribute("aria-expanded", "true");
  helpTip.setAttribute("aria-hidden", "false");
}

function fecharTooltip() {
  if (!existe(helpWrap) || !existe(helpBtn) || !existe(helpTip)) return;
  helpWrap.classList.remove("open");
  helpBtn.setAttribute("aria-expanded", "false");
  helpTip.setAttribute("aria-hidden", "true");
}

if (existe(helpBtn)) {
  helpBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (helpWrap.classList.contains("open")) fecharTooltip();
    else abrirTooltip();
  });

  document.addEventListener("click", (e) => {
    if (existe(helpWrap) && !helpWrap.contains(e.target)) fecharTooltip();
  });
}

/* =========================
   MODOS (LOGIN / CNPJ)
========================= */
const modeClient = document.getElementById("modeClient"); // só existe no login.html
const modeBiz = document.getElementById("modeBiz");       // existe no cnpj.html
const modeForgot =
  document.getElementById("modeForgot") ||
  document.getElementById("modeBizForgot") ||
  document.getElementById("bizForgot");

const modeBizSignup = document.getElementById("modeBizSignup");

/* botões */
const signupBtn = document.getElementById("signupBtn");
const goLoginBtn = document.getElementById("goLoginBtn");
const forgotBtn = document.getElementById("forgotBtn");
const backLoginBtn = document.getElementById("backLoginBtn");

/* login estab */
const bizEmail = document.getElementById("bizEmail");
const bizPass = document.getElementById("bizPass");
const togglePass = document.getElementById("togglePass");
const btnBiz = document.getElementById("btnBiz");
const bizError = document.getElementById("bizError");

/* forgot */
const forgotEmail = document.getElementById("forgotEmail");
const forgotError = document.getElementById("forgotError");
const btnForgot = document.getElementById("btnForgot");

/* close (cnpj) */
const cnpjCloseBtn = document.getElementById("cnpjCloseBtn");

/* cadastro 2 etapas */
const signupStep1 = document.getElementById("signupStep1");
const signupStep2 = document.getElementById("signupStep2");

const stepDot1 = document.getElementById("stepDot1");
const stepDot2 = document.getElementById("stepDot2");
const stepLine = document.getElementById("stepLine");
const stepperText = document.getElementById("stepperText");

const btnSignupContinue = document.getElementById("btnSignupContinue");
const goPrevStepBtn = document.getElementById("goPrevStepBtn");
const signupBackToLogin1 = document.getElementById("signupBackToLogin1");

const signupError = document.getElementById("signupError");
const signupError2 = document.getElementById("signupError2");

/* etapa 1 */
const signupBizName = document.getElementById("signupBizName");
const signupBizCnpj = document.getElementById("signupBizCnpj");
const signupBizCategory = document.getElementById("signupBizCategory");
const signupBizCity = document.getElementById("signupBizCity");
const signupBizUF = document.getElementById("signupBizUF");
const signupBizPhone = document.getElementById("signupBizPhone");

/* etapa 2 */
const signupBizEmail = document.getElementById("signupBizEmail");
const signupBizPass = document.getElementById("signupBizPass");
const signupBizPass2 = document.getElementById("signupBizPass2");
const toggleSignupPass = document.getElementById("toggleSignupPass");

const signupQueueName = document.getElementById("signupQueueName");
const signupAvgTime = document.getElementById("signupAvgTime");
const signupMaxRadius = document.getElementById("signupMaxRadius");
const signupCapacity = document.getElementById("signupCapacity");

const btnSignupBiz = document.getElementById("btnSignupBiz");

function mostrarApenas(target) {
  if (!existe(target)) return;

  const modos = [modeClient, modeBiz, modeForgot, modeBizSignup].filter(existe);
  modos.forEach((m) => m.classList.add("hidden"));
  target.classList.remove("hidden");

  if (target !== modeClient) fecharTooltip();

  if (existe(modalCard)) {
    if (target === modeBiz) modalCard.classList.add("no-close");
    else modalCard.classList.remove("no-close");
  }

  limparErros();
}

function abrirModoBiz() { if (existe(modeBiz)) mostrarApenas(modeBiz); }
function abrirModoForgot() { if (existe(modeForgot)) mostrarApenas(modeForgot); }
function abrirModoBizSignup() {
  if (!existe(modeBizSignup)) return;
  mostrarApenas(modeBizSignup);
  mostrarSignupEtapa(1);
}

/* ===== cadastro 2 etapas ===== */
function marcarStepper(etapa) {
  if (!existe(stepDot1) || !existe(stepDot2) || !existe(stepLine) || !existe(stepperText)) return;

  if (etapa === 1) {
    stepperText.textContent = "Etapa 1 de 2";
    stepDot1.classList.add("active");
    stepDot1.classList.remove("done");
    stepDot2.classList.remove("active", "done");
    stepLine.classList.remove("filled");
  } else {
    stepperText.textContent = "Etapa 2 de 2";
    stepDot1.classList.remove("active");
    stepDot1.classList.add("done");
    stepDot2.classList.add("active");
    stepLine.classList.add("filled");
  }
}

function mostrarSignupEtapa(etapa) {
  if (!existe(signupStep1) || !existe(signupStep2)) return;

  if (etapa === 1) {
    signupStep1.classList.remove("hidden");
    signupStep2.classList.add("hidden");
    marcarStepper(1);
    if (existe(signupBizName)) setTimeout(() => signupBizName.focus(), 60);
  } else {
    signupStep1.classList.add("hidden");
    signupStep2.classList.remove("hidden");
    marcarStepper(2);
    if (existe(signupBizEmail)) setTimeout(() => signupBizEmail.focus(), 60);
  }
}

/* ===== máscaras simples ===== */
function onlyDigits(v) { return (v || "").replace(/\D/g, ""); }

function maskCNPJ(v) {
  const d = onlyDigits(v).slice(0, 14);
  let out = d;
  if (d.length > 2) out = d.slice(0,2) + "." + d.slice(2);
  if (d.length > 5) out = out.slice(0,6) + "." + out.slice(6);
  if (d.length > 8) out = out.slice(0,10) + "/" + out.slice(10);
  if (d.length > 12) out = out.slice(0,15) + "-" + out.slice(15);
  return out;
}

function maskPhone(v) {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
}

if (existe(signupBizPhone)) {
  signupBizPhone.addEventListener("input", () => {
    signupBizPhone.value = maskPhone(signupBizPhone.value);
    if (existe(signupError)) signupError.textContent = "";
    if (existe(modalCard)) modalCard.classList.remove("has-error");
  });
}

/* ===== botões de navegação ===== */
if (existe(signupBtn)) signupBtn.addEventListener("click", abrirModoBizSignup);
if (existe(goLoginBtn)) goLoginBtn.addEventListener("click", abrirModoBiz);

if (existe(forgotBtn)) forgotBtn.addEventListener("click", abrirModoForgot);
if (existe(backLoginBtn)) backLoginBtn.addEventListener("click", abrirModoBiz);

if (existe(signupBackToLogin1)) signupBackToLogin1.addEventListener("click", abrirModoBiz);

if (existe(cnpjCloseBtn)) {
  cnpjCloseBtn.addEventListener("click", () => {
    // fecha e volta pro login do estabelecimento
    abrirModoBiz();
  });
}

if (existe(goPrevStepBtn)) {
  goPrevStepBtn.addEventListener("click", () => {
    mostrarSignupEtapa(1);
  });
}

/* ===== etapa 1 -> etapa 2 ===== */
function validarEtapa1() {
  const name = existe(signupBizName) ? signupBizName.value.trim() : "";
  const cnpj = existe(signupBizCnpj) ? onlyDigits(signupBizCnpj.value) : "";
  const cat = existe(signupBizCategory) ? signupBizCategory.value.trim() : "";
  const city = existe(signupBizCity) ? signupBizCity.value.trim() : "";
  const uf = existe(signupBizUF) ? signupBizUF.value.trim() : "";
  const phone = existe(signupBizPhone) ? onlyDigits(signupBizPhone.value) : "";

  if (!name || name.length < 3) return "Digite o nome do estabelecimento.";
  if (!cnpj || cnpj.length !== 14) return "Digite um CNPJ válido.";
  if (!cat) return "Selecione a categoria do estabelecimento.";
  if (!city || city.length < 2) return "Digite a cidade.";
  if (!uf || uf.length !== 2) return "Selecione a UF.";
  if (!phone || phone.length < 10) return "Digite um telefone/WhatsApp válido.";

  return "";
}

if (existe(btnSignupContinue)) {
  btnSignupContinue.addEventListener("click", () => {
    const msg = validarEtapa1();
    if (msg) {
      if (existe(signupError)) signupError.textContent = msg;
      if (existe(modalCard)) modalCard.classList.add("has-error");
      shakeModal();
      return;
    }

    if (existe(signupError)) signupError.textContent = "";
    if (existe(modalCard)) modalCard.classList.remove("has-error");
    mostrarSignupEtapa(2);
  });
}

/* ===== etapa 2 (final) ===== */
function validarEtapa2() {
  const email = existe(signupBizEmail) ? signupBizEmail.value.trim() : "";
  const pass1 = existe(signupBizPass) ? signupBizPass.value : "";
  const pass2 = existe(signupBizPass2) ? signupBizPass2.value : "";

  if (!emailValido(email)) return "Digite um email de acesso válido.";
  if (!pass1 || pass1.length < 8) return "A senha deve ter no mínimo 8 caracteres.";
  if (pass1 !== pass2) return "As senhas não coincidem.";

  return "";
}

/* ==========================================================
   ✅ CADASTRO ESTABELECIMENTO (AGORA SALVA NO MYSQL)
   - Mantém todo seu fluxo/validações/UX
   - Remove duplicidade: só existe ESTE handler
========================================================== */
if (existe(btnSignupBiz)) {
  btnSignupBiz.addEventListener("click", async () => {
    const msg = validarEtapa2();
    if (msg) {
      if (existe(signupError2)) signupError2.textContent = msg;
      if (existe(modalCard)) modalCard.classList.add("has-error");
      shakeModal();
      return;
    }

    try {
      if (existe(signupError2)) signupError2.textContent = "";
      if (existe(modalCard)) modalCard.classList.remove("has-error");

      // tenta pegar geo, mas NÃO bloqueia se falhar
      let geo = { latitude: null, longitude: null };
      try {
        geo = await getGeo();
      } catch {
        // sem permissão / sem suporte: segue com null
      }

      const payload = {
        nome: signupBizName?.value?.trim() || "",
        cidade: signupBizCity?.value?.trim() || null,
        cnpj: signupBizCnpj?.value?.trim() || null,
        categoria: signupBizCategory?.value?.trim() || null,
        estado: signupBizUF?.value?.trim() || null,
        telefone: signupBizPhone?.value?.trim() || null,
        email: signupBizEmail?.value?.trim() || "",
        senha: signupBizPass?.value || "",
        latitude: geo.latitude,
        longitude: geo.longitude,
        raio_alerta: null,
      };

      // chama API (FastAPI)
      await postJSON(`${API_BASE}/api/estabelecimentos`, payload);

      // (opcional) mantém seu localStorage pra não quebrar login local existente
      // Se você quiser que o login também vá pro MySQL depois, eu ajusto.
      const db = getBizDB();
      const emailNorm = normalizarEmail(payload.email);
      if (!db[emailNorm]) {
        db[emailNorm] = {
          senha: payload.senha, // atenção: isso é só pra compatibilidade com seu login local atual
          nome: payload.nome || "",
          cnpj: payload.cnpj || "",
          categoria: payload.categoria || "",
          cidade: payload.cidade || "",
          uf: payload.estado || "",
          telefone: payload.telefone || "",
          criadoEm: new Date().toISOString(),
        };
        setBizDB(db);
      }

      // volta pro login
      abrirModoBiz();
      if (existe(bizEmail)) bizEmail.value = normalizarEmail(payload.email);
      if (existe(bizPass)) bizPass.value = "";
      if (existe(bizError)) bizError.textContent = "Conta criada no banco! Faça login.";

    } catch (e) {
      if (existe(signupError2)) signupError2.textContent = e.message || "Erro ao cadastrar.";
      if (existe(modalCard)) modalCard.classList.add("has-error");
      shakeModal();
    }
  });
}

/* =========================
   OLHO (LOGIN)
========================= */
if (existe(togglePass) && existe(bizPass)) {
  togglePass.addEventListener("click", () => {
    const isPass = bizPass.type === "password";
    bizPass.type = isPass ? "text" : "password";
    togglePass.setAttribute("aria-label", isPass ? "Ocultar senha" : "Mostrar senha");
  });
}

/* =========================
   OLHO (CADASTRO)
========================= */
if (existe(toggleSignupPass) && existe(signupBizPass)) {
  toggleSignupPass.addEventListener("click", () => {
    const isPass = signupBizPass.type === "password";
    signupBizPass.type = isPass ? "text" : "password";
    toggleSignupPass.setAttribute("aria-label", isPass ? "Ocultar senha" : "Mostrar senha");
  });
}

/* =========================
   ESTABELECIMENTO (LOGIN)
========================= */
if (existe(btnBiz)) {
  btnBiz.addEventListener("click", () => {
    const emailRaw = existe(bizEmail) ? (bizEmail.value || "") : "";
    const pass = existe(bizPass) ? (bizPass.value || "") : "";

    const email = normalizarEmail(emailRaw);

    if (!emailValido(email)) {
      if (existe(bizError)) bizError.textContent = "Digite um email válido.";
      if (existe(modalCard)) modalCard.classList.add("has-error");
      shakeModal();
      bizEmail?.focus();
      return;
    }

    if (!pass || pass.length < 8) {
      if (existe(bizError)) bizError.textContent = "Digite uma senha válida (mínimo 8 caracteres).";
      if (existe(modalCard)) modalCard.classList.add("has-error");
      shakeModal();
      bizPass?.focus();
      return;
    }

    const db = getBizDB();
    const user = db[email];

    if (!user) {
      if (existe(bizError)) bizError.textContent = "E-mail não cadastrado. Clique em “Criar conta”.";
      if (existe(modalCard)) modalCard.classList.add("has-error");
      shakeModal();
      return;
    }

    if (user.senha !== pass) {
      if (existe(bizError)) bizError.textContent = "Senha incorreta.";
      if (existe(modalCard)) modalCard.classList.add("has-error");
      shakeModal();
      bizPass?.focus();
      return;
    }

    // login OK: marca sessão (opcional)
    localStorage.setItem("andalogo_biz_session", JSON.stringify({
      email,
      nome: user.nome || "",
      loginEm: new Date().toISOString()
    }));

    if (existe(bizError)) bizError.textContent = "";
    if (existe(modalCard)) modalCard.classList.remove("has-error");

    window.location.href = "Dashboard.html";
  });
}

/* =========================
   RECUPERAR SENHA
========================= */
if (existe(forgotEmail)) {
  forgotEmail.addEventListener("input", () => {
    if (existe(forgotError)) forgotError.textContent = "";
    if (existe(modalCard)) modalCard.classList.remove("has-error");
  });
}

if (existe(btnForgot)) {
  btnForgot.addEventListener("click", () => {
    const email = existe(forgotEmail) ? (forgotEmail.value || "").trim() : "";

    if (!emailValido(email)) {
      if (existe(forgotError)) forgotError.textContent = "Digite um email válido.";
      if (existe(modalCard)) modalCard.classList.add("has-error");
      shakeModal();
      if (existe(forgotEmail)) forgotEmail.focus();
      return;
    }

    if (existe(forgotError)) forgotError.textContent = "";
    if (existe(modalCard)) modalCard.classList.remove("has-error");
    console.log("Em breve: enviar email de recuperação.");
  });
}

/* =========================
   CLIENTE (login.html)
========================= */
if (existe(nomeInput)) {
  nomeInput.addEventListener("input", () => {
    if (nomeInput.value.trim().length >= 3) {
      if (existe(errorEl)) errorEl.textContent = "";
      if (existe(modalCard)) modalCard.classList.remove("has-error");
    }
  });
}

if (existe(form)) {
  form.addEventListener("submit", (e) => {
    e.preventDefault();

    // só roda no login do cliente
    if (!existe(modeClient) || modeClient.classList.contains("hidden")) return;

    const nome = nomeInput.value.trim();
    if (!nomeValido(nome)) {
      if (existe(errorEl)) errorEl.textContent = "Digite um nome válido (mínimo de 3 caracteres).";
      if (existe(modalCard)) modalCard.classList.add("has-error");
      shakeModal();
      nomeInput.focus();
      return;
    }

    if (existe(errorEl)) errorEl.textContent = "";
    if (existe(modalCard)) modalCard.classList.remove("has-error");
    abrirSucesso(nome);
  });
}

// ====== ESCONDER "X" SOMENTE NO LOGIN (modeBiz) ======
const closeBtn = document.querySelector(".modalClose"); // botão X

function syncCloseButton() {
  if (!existe(closeBtn)) return;

  const isBizLoginVisible = existe(modeBiz) && !modeBiz.classList.contains("hidden");

  // some no login / aparece nas outras telas (criar conta, forgot, etc)
  closeBtn.style.display = isBizLoginVisible ? "none" : "";
}

// roda ao abrir a página
syncCloseButton();

// sempre que trocar de tela, roda de novo
const _mostrarApenasOriginal = typeof mostrarApenas === "function" ? mostrarApenas : null;
if (_mostrarApenasOriginal) {
  mostrarApenas = function (target) {
    _mostrarApenasOriginal(target);
    syncCloseButton();
  };
}
