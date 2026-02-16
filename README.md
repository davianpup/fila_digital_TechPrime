# fila_digital_TechPrime-gabriel
Este repositório foi criado para dar continuidade ao desenvolvimento após limitações de acesso ao repositório original, permitindo implementar melhorias, ajustes, testes e versionamento independente, com possibilidade de integração futura.
Perfeito 👍
Segue **o MESMO RELATÓRIO**, **sem mudar absolutamente nada do conteúdo**, apenas **formatado como `README.md`**, pronto para colocar direto no GitHub.



---

````md
# RELATÓRIO COMPLETO — Configuração e Execução do Projeto (Windows)

Este documento descreve **passo a passo** como configurar e rodar o projeto **do zero em outra máquina Windows**, incluindo **MySQL**, **FastAPI**, **ngrok**, **link público**, **geração de QR Code** e **teste no celular**.

---

## 0) Pré-requisitos

Antes de começar, instale na máquina:

- **Python 3.11+** (recomendado)  
  ✅ Durante a instalação, marque **“Add Python to PATH”**
- **MySQL Server 8.0+**
- **VS Code** (opcional, mas recomendado)
- **Git** (opcional, se for clonar o repositório)

---

## 1) Baixar o projeto (Git Clone)

Abra o terminal na pasta onde deseja salvar o projeto:

```powershell
git clone <URL_DO_REPOSITORIO>
cd fila_digital_TechPrime
````

Se você baixou em ZIP, apenas extraia e entre na pasta do projeto:

```powershell
cd fila_digital_TechPrime
```

---

## 2) Banco de dados (MySQL)

### 2.1) Iniciar o MySQL (Windows)

Abra **Prompt de Comando ou PowerShell como Administrador** e execute:

```powershell
net start mysql80
```

> ⚠️ Caso o nome do serviço seja diferente, pode ser **MySQL80** ou algo semelhante.

---

### 2.2) Testar conexão

No terminal normal (não precisa ser administrador), execute:

```powershell
mysql -u root -p
```

Digite a senha do MySQL (no padrão do projeto, a senha é **root**).

---

### 2.3) Criar o banco e as tabelas

Dentro do MySQL, cole **EXATAMENTE** o script abaixo (não alterar nada):

```sql
CREATE DATABASE fila_digital;
USE fila_digital;

CREATE TABLE cliente (
    idCliente INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(45) NOT NULL,
    telefone VARCHAR(45),
    status ENUM('ATIVO','INATIVO') DEFAULT 'ATIVO',

    latitude_atual DECIMAL(10,8),
    longitude_atual DECIMAL(11,8),
    ultima_atualizacao DATETIME
);

CREATE TABLE posicao_gps (
    idPosicaoGPS INT AUTO_INCREMENT PRIMARY KEY,
    latitude DECIMAL(10,8) NULL,
    longitude DECIMAL(11,8) NULL,
    data_ultima_atualizacao DATETIME,

    cliente_idCliente INT,
    FOREIGN KEY (cliente_idCliente) REFERENCES cliente(idCliente)
);

CREATE TABLE alertas (
    idAlertas INT AUTO_INCREMENT PRIMARY KEY,
    tipo ENUM('ENTRADA_RAIO','SAIDA_RAIO','OUTRO'),
    mensagem VARCHAR(45),
    data_emissao DATETIME,

    cliente_idCliente INT,
    FOREIGN KEY (cliente_idCliente) REFERENCES cliente(idCliente)
);

CREATE TABLE IF NOT EXISTS estabelecimento (
    idEstabelecimento INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(45) NOT NULL,
    cnpj VARCHAR(18),
    categoria ENUM('CLINICA','BARBEARIA','SALAO','ESTETICA','RESTAURANTE','ACOUGUE','SUPERMERCADO'),
    cidade VARCHAR(45),
    estado VARCHAR(45),
    telefone VARCHAR(15),

    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,

    raio_alerta INT,

    email VARCHAR(120) NOT NULL UNIQUE,
    senha VARCHAR(120) NOT NULL
);

CREATE TABLE caixa (
    idCaixa INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(45)
);

CREATE TABLE atendimento (
    idAtendimento INT AUTO_INCREMENT PRIMARY KEY,
    data_inicio DATETIME NOT NULL,
    data_fim DATETIME NOT NULL,
    status ENUM('AGUARDANDO','EM_ATENDIMENTO','FINALIZADO'),
    servico VARCHAR(45),

    cliente_idCliente INT,
    estabelecimento_idEstabelecimento INT,
    caixa_idCaixa INT,

    FOREIGN KEY (cliente_idCliente) REFERENCES cliente(idCliente),
    FOREIGN KEY (estabelecimento_idEstabelecimento) REFERENCES estabelecimento(idEstabelecimento),
    FOREIGN KEY (caixa_idCaixa) REFERENCES caixa(idCaixa)
);

CREATE TABLE fila(
    idFila INT AUTO_INCREMENT  PRIMARY KEY,
    status ENUM('ABERTA','FECHADA'),
    data_criacao DATETIME,
    data_fechamento DATETIME,
    cliente_idCliente INT,
    estabelecimento_idEstabelecimento INT,
    
    FOREIGN KEY (cliente_idCLiente) REFERENCES cliente(idCliente),
    FOREIGN KEY (estabelecimento_idEstabelecimento) REFERENCES estabelecimento(idEstabelecimento)
);

CREATE TABLE qr_code (
    idQRCode INT AUTO_INCREMENT PRIMARY KEY,
    data_criacao DATETIME,

    fila_idFila INT,
    cliente_idCliente INT,
    estabelecimento_idEstabelecimento INT,

    FOREIGN KEY (fila_idFila) REFERENCES fila(idFila),
    FOREIGN KEY (cliente_idCliente) REFERENCES cliente(idCliente),
    FOREIGN KEY (estabelecimento_idEstabelecimento) REFERENCES estabelecimento(idEstabelecimento)
);

ALTER TABLE estabelecimento DROP COLUMN latitude;
ALTER TABLE estabelecimento DROP COLUMN longitude;

ALTER TABLE estabelecimento
  ADD latitude DECIMAL(10,8) NULL,
  ADD longitude DECIMAL(11,8) NULL;

SELECT * FROM estabelecimento;
```

Conferir se as tabelas foram criadas:

```sql
SHOW TABLES;
```

---

### Observação importante (MySQL)

✅ Se a máquina também usar `root/root`, **não precisa mudar nada**.
⚠️ Somente se **não for padrão**, ajustar as credenciais no `.env` (ver seção opcional no final).

---

## 3) Ambiente Python (venv) + dependências

### 3.1) Criar o ambiente virtual

Na pasta do projeto:

**PowerShell:**

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
```

**CMD:**

```bat
py -m venv .venv
.\.venv\Scripts\activate.bat
```

Se ativou corretamente, aparecerá `(.venv)` no terminal.

---

### 3.2) Instalar dependências

Com a venv ativa:

```powershell
pip install fastapi uvicorn mysql-connector-python pydantic python-dotenv
```

Se usar `EmailStr`:

```powershell
pip install "pydantic[email]"
```

---

## 4) Rodar a API FastAPI (porta 8010)

```powershell
uvicorn main:app --reload --host 0.0.0.0 --port 8010
```

Acessos:

* Swagger: `http://127.0.0.1:8010/docs`
* Index: `http://127.0.0.1:8010/`
* Painel QR Code: `http://127.0.0.1:8010/templates/Qr_code.html`

⚠️ **Não usar Live Server**.

---

## 5) Configurar ngrok

### 5.1) Instalação

```powershell
ngrok version
```

---

### 5.2) Authtoken

```powershell
ngrok config add-authtoken SEU_TOKEN_AQUI
ngrok config check
```

---

### 5.3) Criar link público

```powershell
ngrok http 8010
```

---

## 6) Configurar o link público no sistema

Endpoints:

* `POST /api/public-url`
* `GET /api/public-url`

Exemplo POST:

```json
{ "public_url": "https://SEU-LINK.ngrok-free.dev" }
```

---

## 7) Gerar QR Code

* Local: `http://127.0.0.1:8010/templates/Qr_code.html`
* Público: `https://SEU-LINK.ngrok-free.dev/templates/Qr_code.html`

---

## 8) Fluxo do cliente no celular

1. Escaneia QR
2. Login
3. Acompanhar fila
4. Sair da fila → `/templates/saiu.html`

---

## 9) Checklist rápido

* API online?
* Index abre?
* QR lista filas?
* Ngrok ativo?
* Link público atualizado?
* QR regenerado?

---

## 10) IMPORTANTE — Não usar Live Server

Sempre acessar via FastAPI (`http://127.0.0.1:8010/...`).

---

## 11) (Opcional) MySQL via `.env`

`.env.example`:

```
DB_HOST=localhost
DB_USER=root
DB_PASS=root
DB_NAME=fila_digital
DB_PORT=3306
```

---

## 12) Checklist quando o ngrok muda

1. Subir ngrok
2. Atualizar link no sistema
3. Reabrir QR
4. Gerar QR novamente

---

## Conclusão

Seguindo este relatório, qualquer pessoa consegue:

* Subir o banco MySQL
* Rodar a API FastAPI
* Configurar ngrok
* Gerar QR funcional
* Usar o sistema corretamente no celular

```

---
