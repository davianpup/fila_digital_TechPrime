#  ANDA LOGO — Fila Digital Inteligente

O **ANDA LOGO** é uma plataforma de **fila digital via QR Code** que permite ao cliente entrar na fila e circular livremente dentro de um estabelecimento, respeitando um **raio geográfico controlado**, sem perder sua posição.

O sistema utiliza **geolocalização em tempo real**, **WebSockets** para atualização instantânea da fila e **QR Code** para entrada rápida e prática.

---

## 🚀 Tecnologias Utilizadas

### Front-end

* HTML5
* CSS3
* JavaScript (Vanilla)
* API de Geolocalização do Navegador

### Back-end

* Python 3
* Flask
* WebSocket (tempo real)

### Banco de Dados

* MySQL

### Recursos Especiais

* Biblioteca de geração de **QR Code**
* Geolocalização por latitude e longitude
* Comunicação em tempo real (WebSocket)

---

## 📋 Pré-requisitos

Antes de rodar o projeto, é necessário ter:

* Python 3.x (com **Add Python to PATH** marcado)
* MySQL Server
* MySQL Workbench
* Git
* VS Code (editor recomendado)
* Navegador com suporte à API de Geolocalização

---



O banco **fila_digital** foi modelado para representar clientes, filas, atendimentos e controle de localização.

### 📦 Estrutura de Banco de Dados

O banco **fila_digital** foi modelado para representar clientes, filas, atendimentos e controle de localização.
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
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
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

CREATE TABLE estabelecimento (
    idEstabelecimento INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(45) NOT NULL,
    endereco VARCHAR(45),

    latitude DECIMAL(10,8)NOT NULL,
    longitude DECIMAL(11,8)NOT NULL,

    raio_alerta INT
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
```

---



## 📍 Geolocalização (API)

O sistema utiliza a **API de Geolocalização do navegador** para:

* Capturar latitude e longitude do cliente
* Comparar a posição atual com o raio do estabelecimento
* Detectar:

  * Entrada no raio permitido
  * Saída do raio permitido

Esses eventos podem gerar **alertas automáticos**.

---

## 🔄 WebSocket (Tempo Real)

O WebSocket é utilizado para:

* Atualizar posição do cliente em tempo real
* Atualizar fila sem recarregar a página
* Notificar:

  * Mudança de posição na fila
  * Chamada para atendimento
  * Alertas de proximidade

👉 Isso garante uma experiência **fluida e instantânea**.

---

## 📸 QR Code

O QR Code é utilizado como **porta de entrada da fila**:

1. Cliente escaneia o QR Code no local
2. Sistema id#  ANDA LOGO — Fila Digital Inteligente

O **ANDA LOGO** é uma plataforma de **fila digital via QR Code** que permite ao cliente entrar na fila e circular livremente dentro de um estabelecimento, respeitando um **raio geográfico controlado**, sem perder sua posição.

O sistema utiliza **geolocalização em tempo real**, **WebSockets** para atualização instantânea da fila e **QR Code** para entrada rápida e prática.

