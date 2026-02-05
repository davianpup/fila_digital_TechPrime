const form = document.getElementById("form");
const nomeInput = document.getElementById("nome");
const errorEl = document.getElementById("error");
const modalCard = document.getElementById("modalCard");

const overlay = document.getElementById("overlay");
const successName = document.getElementById("successName");
const queueNumber = document.getElementById("queueNumber");
const editNameBtn = document.getElementById("editNameBtn");

const helpBtn = document.getElementById("helpBtn");
const helpWrap = document.getElementById("helpWrap");
const helpTip = document.getElementById("helpTip");

/* ===== helpers ===== */
function existe(el) {
  return el !== null && el !== undefined;
}

function nomeValido(nome) {
  return (nome || "").trim().length >= 3;
}

function shakeModal() {
  modalCard.classList.remove("shake");
  void modalCard.offsetWidth; // reflow
  modalCard.classList.add("shake");
}

function abrirSucesso(nome) {
  successName.textContent = nome;
  queueNumber.textContent = "#001"; // por enquanto fixo

  overlay.classList.add("show");
  overlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("lock");
}

function fecharSucesso() {
  overlay.classList.remove("show");
  overlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("lock");
}

/* =========================
   CLIENTE
========================= */
nomeInput.addEventListener("input", () => {
  if (nomeInput.value.trim().length >= 3) {
    errorEl.textContent = "";
    modalCard.classList.remove("has-error");
  }
});

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const nome = nomeInput.value.trim();

  if (!nomeValido(nome)) {
    errorEl.textContent = "Digite um nome válido (mínimo de 3 caracteres).";
    modalCard.classList.add("has-error");
    shakeModal();
    nomeInput.focus();
    return;
  }

  errorEl.textContent = "";
  modalCard.classList.remove("has-error");
  abrirSucesso(nome);
});

// Clicar fora fecha sucesso
overlay.addEventListener("click", (e) => {
  if (e.target === overlay) fecharSucesso();
});

// ESC fecha (sucesso)
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && overlay.classList.contains("show")) {
    fecharSucesso();
  }
});

// Editar nome: fecha e volta pro input
editNameBtn.addEventListener("click", () => {
  fecharSucesso();
  nomeInput.focus();
  nomeInput.select();
});

/* =========================
   TOOLTIP "COMO FUNCIONA"
========================= */
function abrirTooltip() {
  helpWrap.classList.add("open");
  helpBtn.setAttribute("aria-expanded", "true");
  helpTip.setAttribute("aria-hidden", "false");
}

function fecharTooltip() {
  helpWrap.classList.remove("open");
  helpBtn.setAttribute("aria-expanded", "false");
  helpTip.setAttribute("aria-hidden", "true");
}

helpBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  if (helpWrap.classList.contains("open")) fecharTooltip();
  else abrirTooltip();
});

// clicar fora fecha tooltip
document.addEventListener("click", (e) => {
  if (!helpWrap.contains(e.target)) fecharTooltip();
});

// ESC fecha tooltip
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") fecharTooltip();
});

/* =========================
   MODO CLIENTE / ESTABELECIMENTO
========================= */
const modeClient = document.getElementById("modeClient");
const modeBiz = document.getElementById("modeBiz");

const bizBtn = document.getElementById("bizBtn");
const backClientBtn = document.getElementById("backClientBtn");

const bizEmail = document.getElementById("bizEmail");
const bizPass = document.getElementById("bizPass");
const togglePass = document.getElementById("togglePass");
const btnBiz = document.getElementById("btnBiz");
const bizError = document.getElementById("bizError");
const forgotBtn = document.getElementById("forgotBtn");

function abrirModoBiz() {
  if (!existe(modeClient) || !existe(modeBiz)) return;

  modeClient.classList.add("hidden");
  modeBiz.classList.remove("hidden");

  // fecha tooltip no outro modo
  if (existe(helpWrap)) fecharTooltip();

  // limpa erros e estado visual
  if (existe(errorEl)) errorEl.textContent = "";
  if (existe(bizError)) bizError.textContent = "";
  modalCard.classList.remove("has-error");

  if (existe(bizEmail)) setTimeout(() => bizEmail.focus(), 50);
}

function abrirModoClient() {
  if (!existe(modeClient) || !existe(modeBiz)) return;

  modeBiz.classList.add("hidden");
  modeClient.classList.remove("hidden");

  if (existe(bizError)) bizError.textContent = "";
  if (existe(errorEl)) errorEl.textContent = "";
  modalCard.classList.remove("has-error");

  setTimeout(() => nomeInput.focus(), 50);
}

// Alternar modos
if (existe(bizBtn)) bizBtn.addEventListener("click", abrirModoBiz);
if (existe(backClientBtn)) backClientBtn.addEventListener("click", abrirModoClient);

// Mostrar/ocultar senha
if (existe(togglePass) && existe(bizPass)) {
  togglePass.addEventListener("click", () => {
    const isPass = bizPass.type === "password";
    bizPass.type = isPass ? "text" : "password";
    togglePass.setAttribute("aria-label", isPass ? "Ocultar senha" : "Mostrar senha");
  });
}

/* =========================
   ESTABELECIMENTO (tremer no erro)
========================= */

// Limpa erro ao digitar (premium)
if (existe(bizEmail)) {
  bizEmail.addEventListener("input", () => {
    if (existe(bizError)) bizError.textContent = "";
    modalCard.classList.remove("has-error");
  });
}

if (existe(bizPass)) {
  bizPass.addEventListener("input", () => {
    if (existe(bizError)) bizError.textContent = "";
    modalCard.classList.remove("has-error");
  });
}

// Entrar no painel (placeholder por enquanto)
if (existe(btnBiz)) {
  btnBiz.addEventListener("click", () => {
    const email = existe(bizEmail) ? (bizEmail.value || "").trim() : "";
    const pass = existe(bizPass) ? (bizPass.value || "").trim() : "";

    // valida email
    if (!email || !email.includes("@")) {
      if (existe(bizError)) bizError.textContent = "Digite um email válido.";
      modalCard.classList.add("has-error");
      shakeModal();
      if (existe(bizEmail)) bizEmail.focus();
      return;
    }

    // valida senha
    if (!pass || pass.length < 3) {
      if (existe(bizError)) bizError.textContent = "Digite uma senha válida.";
      modalCard.classList.add("has-error");
      shakeModal();
      if (existe(bizPass)) bizPass.focus();
      return;
    }

    // ok
    if (existe(bizError)) bizError.textContent = "";
    modalCard.classList.remove("has-error");
    console.log("Em breve: login do estabelecimento.");
  });
}

// Esqueceu a senha? (placeholder)
if (existe(forgotBtn)) {
  forgotBtn.addEventListener("click", () => {
    console.log("Em breve: recuperar senha.");
  });
}

/*!
* Lógica Unificada - ANDA LOGO
*/

window.addEventListener('DOMContentLoaded', event => {

    /* ==========================================
       1. COMPORTAMENTO DA NAVBAR (LANDING PAGE)
       ========================================== */
    var navbarShrink = function () {
        const navbarCollapsible = document.body.querySelector('#mainNav');
        if (!navbarCollapsible) return;
        
        if (window.scrollY === 0) {
            navbarCollapsible.classList.remove('navbar-shrink')
        } else {
            navbarCollapsible.classList.add('navbar-shrink')
        }
    };

    navbarShrink();
    document.addEventListener('scroll', navbarShrink);

    const mainNav = document.body.querySelector('#mainNav');
    if (mainNav) {
        new bootstrap.ScrollSpy(document.body, {
            target: '#mainNav',
            rootMargin: '0px 0px -40%',
        });
    };

    const navbarToggler = document.body.querySelector('.navbar-toggler');
    const responsiveNavItems = [].slice.call(
        document.querySelectorAll('#navbarResponsive .nav-link')
    );
    responsiveNavItems.map(function (responsiveNavItem) {
        responsiveNavItem.addEventListener('click', () => {
            if (window.getComputedStyle(navbarToggler).display !== 'none') {
                navbarToggler.click();
            }
        });
    });

    /* ==========================================
       2. LÓGICA DO FORMULÁRIO E FILA (script.js)
       ========================================== */
    
    // Elementos do DOM (Verifica se existem antes de usar)
    const form = document.getElementById("form");
    const nomeInput = document.getElementById("nome");
    const modalCard = document.getElementById("modalCard");
    const overlay = document.getElementById("overlay");
    const successName = document.getElementById("successName");

    // Helper para verificar existência do elemento
    function existe(el) {
        return el !== null && el !== undefined;
    }

    function shakeModal() {
        if (!existe(modalCard)) return;
        modalCard.classList.remove("shake");
        void modalCard.offsetWidth; // truque para resetar animação
        modalCard.classList.add("shake");
    }

    // Evento de Envio do Formulário da Fila
    if (existe(form)) {
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            const nome = nomeInput.value.trim();

            if (nome.length < 3) {
                shakeModal();
                const errorEl = document.getElementById("error");
                if (existe(errorEl)) errorEl.textContent = "Digite pelo menos 3 letras";
                return;
            }

            // Simulação de entrada na fila
            if (existe(successName)) successName.textContent = nome;
            if (existe(overlay)) overlay.classList.add("show");
            document.body.classList.add("lock");
        });
    }

    /* ==========================================
       3. LÓGICA DE LOGIN (PAINEL BIZ)
       ========================================== */
    const btnBiz = document.getElementById("btnBiz");
    const bizEmail = document.getElementById("bizEmail");
    const bizPass = document.getElementById("bizPass");

    if (existe(btnBiz)) {
        btnBiz.addEventListener("click", () => {
            const email = (bizEmail.value || "").trim();
            const pass = (bizPass.value || "").trim();

            if (!email.includes("@") || pass.length < 3) {
                shakeModal();
                alert("Por favor, verifique suas credenciais.");
                return;
            }

            console.log("Tentativa de login para:", email);
            // Aqui futuramente entra a chamada para o Python/Flask
        });
    }
});