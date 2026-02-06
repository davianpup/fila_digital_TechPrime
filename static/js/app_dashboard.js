// Navegação
function go(url){
  window.location.href = url;
}

// Sidebar mobile
const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");

menuBtn.addEventListener("click", () => {
  sidebar.classList.toggle("open");
});

// Botão chamar
document.getElementById("btnChamar").addEventListener("click", () => {
  const nome = document.getElementById("proximoNome").innerText;

  alert("Chamando: " + nome);

  document.getElementById("atendendo").innerText = 1;
  document.getElementById("fila").innerText =
    parseInt(document.getElementById("fila").innerText) - 1;
});
