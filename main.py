from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr
import mysql.connector
import hashlib
from pathlib import Path
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Optional, Dict, Set
from datetime import datetime
import unicodedata
import asyncio
import json
import random
import string

app = FastAPI(title="Fila Digital API")

# =====================================================
# ✅ CORS
# =====================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================================================
# ✅ NGROK: remover página "Visite o site"
# =====================================================
class NgrokSkipBrowserWarningMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["ngrok-skip-browser-warning"] = "1"
        return response

app.add_middleware(NgrokSkipBrowserWarningMiddleware)

# =====================================================
# ✅ WEBSOCKET MANAGER
# =====================================================
class ConnectionManager:
    def __init__(self):
        self.rooms: Dict[str, Set[WebSocket]] = {}
        self.lock = asyncio.Lock()

    async def connect(self, room: str, websocket: WebSocket):
        await websocket.accept()
        async with self.lock:
            self.rooms.setdefault(room, set()).add(websocket)

    async def disconnect(self, room: str, websocket: WebSocket):
        async with self.lock:
            if room in self.rooms:
                self.rooms[room].discard(websocket)
                if not self.rooms[room]:
                    del self.rooms[room]

    async def broadcast(self, room: str, message: dict):
        data = json.dumps(message, ensure_ascii=False)
        async with self.lock:
            sockets = list(self.rooms.get(room, set()))

        dead = []
        for ws in sockets:
            try:
                await ws.send_text(data)
            except Exception:
                dead.append(ws)

        if dead:
            async with self.lock:
                for ws in dead:
                    self.rooms.get(room, set()).discard(ws)

manager = ConnectionManager()

async def notify_fila_update(fila_id: int, action: str, payload: dict | None = None):
    await manager.broadcast(f"fila:{fila_id}", {
        "type": "fila_update",
        "action": action,
        "fila_id": fila_id,
        "payload": payload or {}
    })

@app.websocket("/ws/fila/{fila_id}")
async def ws_fila(websocket: WebSocket, fila_id: int):
    room = f"fila:{fila_id}"
    await manager.connect(room, websocket)
    try:
        while True:
            # ping do front (mantém vivo)
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(room, websocket)

# =====================================================
# PATHS / STATIC
# =====================================================
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
TEMPLATES_DIR = BASE_DIR / "templates"
ASSETS_DIR = BASE_DIR / "assets"

if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory="static"), name="static")
if TEMPLATES_DIR.exists():
    app.mount("/templates", StaticFiles(directory=str(TEMPLATES_DIR)), name="templates")
if ASSETS_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")

@app.get("/")
def home():
    file_path = TEMPLATES_DIR / "index.html"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="index.html não encontrado em /templates")
    return FileResponse(str(file_path), headers={"ngrok-skip-browser-warning": "1"})

# =====================================================
# MYSQL
# =====================================================
def get_conn():
    return mysql.connector.connect(
        host="localhost",
        user="root",
        password="root",
        database="fila_digital",
        charset="utf8mb4",
        collation="utf8mb4_general_ci",
    )

SECRET_KEY = "andalogo_super_secret"

def hash_pass(p: str) -> str:
    return hashlib.sha256((p + SECRET_KEY).encode()).hexdigest()

# =====================================================
# HELPERS
# =====================================================
def normalize_text_upper_no_accents(s: Optional[str]) -> Optional[str]:
    if s is None:
        return None
    s = s.strip()
    if not s:
        return None
    s = unicodedata.normalize("NFD", s)
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    return s.upper()

VALID_CATEGORIAS = {
    "CLINICA", "BARBEARIA", "SALAO", "ESTETICA", "RESTAURANTE", "ACOUGUE", "SUPERMERCADO"
}

def normalize_categoria(raw: Optional[str]) -> Optional[str]:
    c = normalize_text_upper_no_accents(raw)
    if c is None:
        return None
    if c.startswith("SUPERMERC"):
        c = "SUPERMERCADO"
    if c not in VALID_CATEGORIAS:
        raise HTTPException(status_code=400, detail=f"Categoria inválida. Use: {sorted(VALID_CATEGORIAS)}")
    return c

def gerar_senha_codigo():
    letras = ''.join(random.choices(string.ascii_uppercase, k=3))
    nums = ''.join(random.choices(string.digits, k=3))
    return letras + nums

def status_to_front(s: Optional[str]) -> str:
    return (s or "AGUARDANDO").lower()

# ✅ IMPORTANTE: para posição, NÃO conta EM_ATENDIMENTO como "à frente"
STATUS_PARA_POSICAO = ("AGUARDANDO", "CHAMADO")

def calcular_posicao(conn, fila_id: int, fila_cliente_id: int) -> tuple[int, int]:
    """
    ✅ Cálculo correto e estável:
    - posição/a_frente contam APENAS AGUARDANDO/CHAMADO
    - EM_ATENDIMENTO não conta como "à frente"
    - se o cliente estiver EM_ATENDIMENTO -> (1, 0)
    """
    cur = conn.cursor(dictionary=True)

    cur.execute("""
        SELECT idFilaCliente, status, data_entrada
        FROM fila_cliente
        WHERE idFilaCliente=%s AND fila_idFila=%s
        LIMIT 1
    """, (fila_cliente_id, fila_id))
    meu = cur.fetchone()

    if not meu:
        cur.close()
        return (1, 0)

    meu_status = (meu.get("status") or "").upper()
    minha_data = meu.get("data_entrada")
    meu_id = int(meu.get("idFilaCliente"))

    if meu_status == "EM_ATENDIMENTO":
        cur.close()
        return (1, 0)

    if meu_status not in STATUS_PARA_POSICAO or not minha_data:
        cur.close()
        return (1, 0)

    cur.execute(f"""
        SELECT COUNT(*) AS a_frente
        FROM fila_cliente
        WHERE fila_idFila = %s
          AND status IN ({",".join(["%s"] * len(STATUS_PARA_POSICAO))})
          AND (
                data_entrada < %s
                OR (data_entrada = %s AND idFilaCliente < %s)
              )
    """, (fila_id, *STATUS_PARA_POSICAO, minha_data, minha_data, meu_id))

    a_frente = int((cur.fetchone() or {}).get("a_frente", 0))
    cur.close()
    return (a_frente + 1, a_frente)

# =====================================================
# MODELS
# =====================================================
class EstabelecimentoCreate(BaseModel):
    nome: str
    cidade: Optional[str] = None
    cnpj: Optional[str] = None
    categoria: Optional[str] = None
    estado: Optional[str] = None
    telefone: Optional[str] = None
    email: EmailStr
    senha: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    raio_alerta: Optional[int] = None

class LoginEstabelecimento(BaseModel):
    email: EmailStr
    senha: str

class FilaCreate(BaseModel):
    estabelecimento_id: int
    nome: Optional[str] = None
    status: str

class PublicUrlBody(BaseModel):
    public_url: str

class EntrarFilaBody(BaseModel):
    nome: str
    telefone: Optional[str] = None

class ChamarProximoBody(BaseModel):
    estabelecimento_id: int

class EstabelecimentoUpdate(BaseModel):
    nome: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None
    telefone: Optional[str] = None
    cnpj: Optional[str] = None
    categoria: Optional[str] = None
    raio_alerta: Optional[int] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None    

# =====================================================
# ESTABELECIMENTO
# =====================================================
@app.post("/api/estabelecimentos")
def criar_estabelecimento(body: EstabelecimentoCreate):
    try:
        categoria = normalize_categoria(body.categoria) if body.categoria else None
        conn = get_conn()
        cur = conn.cursor()

        cur.execute("""
            INSERT INTO estabelecimento
            (nome, cnpj, categoria, cidade, estado, telefone, latitude, longitude, raio_alerta, email, senha)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            body.nome.strip(),
            (body.cnpj or None),
            categoria,
            (body.cidade or None),
            (body.estado or None),
            (body.telefone or None),
            body.latitude,
            body.longitude,
            body.raio_alerta,
            body.email.lower().strip(),
            hash_pass(body.senha),
        ))

        conn.commit()
        new_id = cur.lastrowid
        cur.close()
        conn.close()
        return {"ok": True, "idEstabelecimento": new_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/login-estabelecimento")
def login_estabelecimento(body: LoginEstabelecimento):
    try:
        conn = get_conn()
        cur = conn.cursor(dictionary=True)

        cur.execute("""
            SELECT idEstabelecimento, nome, email
            FROM estabelecimento
            WHERE email = %s AND senha = %s
            LIMIT 1
        """, (body.email.lower().strip(), hash_pass(body.senha)))

        row = cur.fetchone()
        cur.close()
        conn.close()

        if not row:
            raise HTTPException(status_code=401, detail="Email ou senha inválidos")

        return {
            "ok": True,
            "estabelecimento_id": row["idEstabelecimento"],
            "nome": row["nome"],
            "email": row["email"],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/estabelecimentos/{estab_id}")
def get_estabelecimento(estab_id: int):
    try:
        conn = get_conn()
        cur = conn.cursor(dictionary=True)

        cur.execute("""
            SELECT
                idEstabelecimento AS id,
                nome,
                email,
                telefone,
                cidade,
                estado,
                cnpj,
                categoria,
                latitude,
                longitude,
                raio_alerta
            FROM estabelecimento
            WHERE idEstabelecimento = %s
            LIMIT 1
        """, (estab_id,))

        row = cur.fetchone()
        cur.close()
        conn.close()

        if not row:
            raise HTTPException(status_code=404, detail="Estabelecimento não encontrado")

        # garante categoria em formato consistente
        if row.get("categoria"):
            row["categoria"] = str(row["categoria"]).upper()

        return row

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.put("/api/estabelecimentos/{estab_id}")
def update_estabelecimento(estab_id: int, body: EstabelecimentoUpdate):
    try:
        conn = get_conn()
        cur = conn.cursor(dictionary=True)

        # existe?
        cur.execute("""
            SELECT idEstabelecimento
            FROM estabelecimento
            WHERE idEstabelecimento = %s
            LIMIT 1
        """, (estab_id,))
        if not cur.fetchone():
            cur.close(); conn.close()
            raise HTTPException(status_code=404, detail="Estabelecimento não encontrado")

        # normalizações
        nome = (body.nome.strip() if body.nome is not None else None)
        cidade = (body.cidade.strip() if body.cidade is not None else None)
        estado = (body.estado.strip() if body.estado is not None else None)
        telefone = (body.telefone.strip() if body.telefone is not None else None)
        cnpj = (body.cnpj.strip() if body.cnpj is not None else None)

        categoria = None
        if body.categoria is not None:
            categoria = normalize_categoria(body.categoria)

        # monta update dinâmico (só atualiza o que veio)
        fields = []
        values = []

        def add(col, val):
            fields.append(f"{col}=%s")
            values.append(val)

        if body.nome is not None: add("nome", nome if nome else None)
        if body.cidade is not None: add("cidade", cidade if cidade else None)
        if body.estado is not None: add("estado", estado if estado else None)
        if body.telefone is not None: add("telefone", telefone if telefone else None)
        if body.cnpj is not None: add("cnpj", cnpj if cnpj else None)
        if body.categoria is not None: add("categoria", categoria)
        if body.raio_alerta is not None: add("raio_alerta", body.raio_alerta)
        if body.latitude is not None: add("latitude", body.latitude)
        if body.longitude is not None: add("longitude", body.longitude)

        if not fields:
            cur.close(); conn.close()
            return {"ok": True, "detail": "Nada para atualizar."}

        values.append(estab_id)

        cur2 = conn.cursor()
        cur2.execute(f"""
            UPDATE estabelecimento
            SET {", ".join(fields)}
            WHERE idEstabelecimento = %s
        """, tuple(values))
        conn.commit()
        cur2.close()
        cur.close()
        conn.close()

        return {"ok": True}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# =====================================================
# FILAS
# =====================================================
@app.get("/api/filas")
def listar_filas(estabelecimento_id: Optional[int] = Query(default=None)):
    try:
        conn = get_conn()
        cur = conn.cursor(dictionary=True)

        if estabelecimento_id:
            cur.execute("""
                SELECT idFila, nome, status, data_criacao, data_fechamento, estabelecimento_idEstabelecimento
                FROM fila
                WHERE estabelecimento_idEstabelecimento = %s
                ORDER BY idFila DESC
            """, (estabelecimento_id,))
        else:
            cur.execute("""
                SELECT idFila, nome, status, data_criacao, data_fechamento, estabelecimento_idEstabelecimento
                FROM fila
                ORDER BY idFila DESC
            """)

        rows = cur.fetchall()
        cur.close()
        conn.close()

        resp = []
        for r in rows:
            status = (r.get("status") or "").upper()
            resp.append({
                "idFila": r["idFila"],
                "id": r["idFila"],
                # ✅ usa o nome REAL do banco; fallback só se estiver vazio/NULL
                "nome": (r.get("nome") or f"Fila #{r['idFila']}"),
                "ativa": status == "ABERTA",
                "status": status,
                "data_criacao": r.get("data_criacao").isoformat() if r.get("data_criacao") else None,
                "data_fechamento": r.get("data_fechamento").isoformat() if r.get("data_fechamento") else None,
                "estabelecimento_id": r.get("estabelecimento_idEstabelecimento"),
            })
        return resp
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/filas")
async def criar_fila(body: FilaCreate):
    try:
        status = (body.status or "").upper().strip()
        if status not in ("ABERTA", "FECHADA"):
            raise HTTPException(status_code=400, detail="status deve ser ABERTA ou FECHADA")

        if not body.estabelecimento_id or body.estabelecimento_id <= 0:
            raise HTTPException(status_code=400, detail="estabelecimento_id inválido")

        # ✅ salva o nome (se vier vazio, grava NULL)
        nome = (body.nome or "").strip() or None

        conn = get_conn()
        cur = conn.cursor()

        cur.execute("""
            INSERT INTO fila (nome, status, data_criacao, estabelecimento_idEstabelecimento)
            VALUES (%s, %s, %s, %s)
        """, (nome, status, datetime.now(), body.estabelecimento_id))

        conn.commit()
        new_id = cur.lastrowid
        cur.close()
        conn.close()

        await notify_fila_update(new_id, "FILA_CRIADA", {"idFila": new_id, "status": status})
        return {"ok": True, "idFila": new_id, "status": status}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# =====================================================
# PUBLIC URL (NGROK)
# =====================================================
PUBLIC_BASE_URL = ""

@app.get("/api/public-url")
def get_public_url():
    return {"public_url": PUBLIC_BASE_URL}

@app.post("/api/public-url")
def set_public_url(body: PublicUrlBody):
    global PUBLIC_BASE_URL
    url = (body.public_url or "").strip().rstrip("/")
    if not (url.startswith("https://") or url.startswith("http://")):
        raise HTTPException(status_code=400, detail="URL inválida. Use http:// ou https://")
    PUBLIC_BASE_URL = url
    return {"ok": True, "public_url": PUBLIC_BASE_URL}

# =====================================================
# CLIENTE ENTRAR NA FILA (SEM TELEFONE)
# =====================================================
@app.post("/api/fila/{fila_id}/entrar")
@app.post("/api/filas/{fila_id}/entrar")
async def entrar_na_fila(fila_id: int, body: EntrarFilaBody):
    try:
        nome = (body.nome or "").strip()
        if not nome or len(nome) < 3:
            raise HTTPException(status_code=400, detail="Nome inválido (mínimo 3 caracteres).")

        conn = get_conn()
        cur = conn.cursor(dictionary=True)

        cur.execute("""
            SELECT idFila, estabelecimento_idEstabelecimento, status
            FROM fila
            WHERE idFila = %s
            LIMIT 1
        """, (fila_id,))
        fila = cur.fetchone()
        if not fila:
            cur.close(); conn.close()
            raise HTTPException(status_code=404, detail="Fila não encontrada.")
        if (fila.get("status") or "").upper() != "ABERTA":
            cur.close(); conn.close()
            raise HTTPException(status_code=400, detail="Fila está FECHADA.")

        cur2 = conn.cursor()
        cur2.execute("""
            INSERT INTO cliente (nome, telefone, status)
            VALUES (%s, %s, 'ATIVO')
        """, (nome, None))
        conn.commit()
        cliente_id = int(cur2.lastrowid)
        cur2.close()

        senha_codigo = gerar_senha_codigo()
        cur2 = conn.cursor()
        cur2.execute("""
            INSERT INTO fila_cliente (fila_idFila, cliente_idCliente, status, senha_codigo, data_entrada)
            VALUES (%s, %s, 'AGUARDANDO', %s, %s)
        """, (fila_id, cliente_id, senha_codigo, datetime.now()))
        conn.commit()
        fila_cliente_id = int(cur2.lastrowid)
        cur2.close()

        posicao, a_frente = calcular_posicao(conn, fila_id, fila_cliente_id)

        cur.close()
        conn.close()

        await notify_fila_update(fila_id, "CLIENTE_ENTROU", {
            "cliente_id": cliente_id,
            "fila_cliente_id": fila_cliente_id,
            "nome": nome,
            "posicao": posicao,
            "a_frente": a_frente,
        })

        return {
            "ok": True,
            "fila_id": fila_id,
            "cliente_id": cliente_id,
            "fila_cliente_id": fila_cliente_id,
            "senha_codigo": senha_codigo,
            "posicao": posicao,
            "a_frente": a_frente,
            "status": "aguardando",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# =====================================================
# SAIR DA FILA
# =====================================================
@app.post("/api/fila/{fila_id}/cliente/{cliente_id}/sair")
@app.post("/api/filas/{fila_id}/cliente/{cliente_id}/sair")
async def sair_da_fila(fila_id: int, cliente_id: int):
    try:
        conn = get_conn()
        cur = conn.cursor(dictionary=True)

        cur.execute("""
            SELECT idFilaCliente
            FROM fila_cliente
            WHERE fila_idFila = %s
              AND cliente_idCliente = %s
              AND status IN ('AGUARDANDO','CHAMADO','EM_ATENDIMENTO')
            ORDER BY idFilaCliente DESC
            LIMIT 1
        """, (fila_id, cliente_id))
        row = cur.fetchone()
        if not row:
            cur.close(); conn.close()
            return {"ok": True, "detail": "Cliente não estava ativo na fila."}

        fila_cliente_id = int(row["idFilaCliente"])

        cur2 = conn.cursor()
        cur2.execute("""
            UPDATE fila_cliente
            SET status = 'SAIU', data_saida = %s
            WHERE idFilaCliente = %s
        """, (datetime.now(), fila_cliente_id))
        conn.commit()
        cur2.close()

        cur.close(); conn.close()

        await notify_fila_update(fila_id, "CLIENTE_SAIU", {"cliente_id": cliente_id, "fila_cliente_id": fila_cliente_id})
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# =====================================================
# STATUS DO CLIENTE (✅ POSIÇÃO CORRETA)
# =====================================================
@app.get("/api/fila/{fila_id}/cliente/{cliente_id}/status")
@app.get("/api/filas/{fila_id}/cliente/{cliente_id}/status")
def status_cliente_fila(fila_id: int, cliente_id: int):
    try:
        conn = get_conn()
        cur = conn.cursor(dictionary=True)

        cur.execute("""
            SELECT fc.idFilaCliente, fc.status, fc.data_entrada, fc.senha_codigo,
                   f.nome AS fila_nome
            FROM fila_cliente fc
            JOIN fila f ON f.idFila = fc.fila_idFila
            WHERE fc.fila_idFila = %s
              AND fc.cliente_idCliente = %s
              AND fc.status IN ('AGUARDANDO','CHAMADO','EM_ATENDIMENTO')
            ORDER BY fc.idFilaCliente DESC
            LIMIT 1
        """, (fila_id, cliente_id))
        meu = cur.fetchone()

        if not meu:
            cur.close(); conn.close()
            raise HTTPException(status_code=404, detail="Cliente não está ativo nessa fila.")

        fila_cliente_id = int(meu["idFilaCliente"])
        posicao, a_frente = calcular_posicao(conn, fila_id, fila_cliente_id)

        cur.close()
        conn.close()

        tempo_medio_min = 12
        estimativa_min = int(a_frente) * tempo_medio_min

        return {
            "fila_id": fila_id,
            "fila_nome": meu.get("fila_nome") or f"Fila #{fila_id}",
            "fila_raio_m": 500,
            "tempo_medio_min": tempo_medio_min,
            "estimativa_min": estimativa_min,
            "posicao": int(posicao),
            "a_frente": int(a_frente),
            "cliente": {
                "id": cliente_id,
                "fila_cliente_id": fila_cliente_id,
                "status": status_to_front(meu.get("status")),
                "senha_codigo": meu.get("senha_codigo")
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# =====================================================
# ATENDIMENTO (compatível com seu JS: /status, /chamar, /finalizar, /cancelar, /pular)
# =====================================================
def _fila_get_status(conn, fila_id: int):
    cur = conn.cursor(dictionary=True)

    cur.execute("SELECT idFila, status FROM fila WHERE idFila=%s LIMIT 1", (fila_id,))
    fila = cur.fetchone()
    if not fila:
        cur.close()
        raise HTTPException(status_code=404, detail="Fila não encontrada")

    cur.execute("""
        SELECT fc.idFilaCliente, c.nome
        FROM fila_cliente fc
        JOIN cliente c ON c.idCliente = fc.cliente_idCliente
        WHERE fc.fila_idFila = %s AND fc.status = 'EM_ATENDIMENTO'
        ORDER BY fc.data_entrada ASC, fc.idFilaCliente ASC
        LIMIT 1
    """, (fila_id,))
    atual = cur.fetchone()

    cur.execute("""
        SELECT COUNT(*) AS total
        FROM fila_cliente
        WHERE fila_idFila = %s AND status = 'AGUARDANDO'
    """, (fila_id,))
    aguardando_total = int((cur.fetchone() or {}).get("total", 0))

    cur.execute("""
        SELECT fc.idFilaCliente, c.nome
        FROM fila_cliente fc
        JOIN cliente c ON c.idCliente = fc.cliente_idCliente
        WHERE fc.fila_idFila = %s AND fc.status='AGUARDANDO'
        ORDER BY fc.data_entrada ASC, fc.idFilaCliente ASC
        LIMIT 1
    """, (fila_id,))
    proximo = cur.fetchone()

    cur.close()

    prox_obj = None
    if proximo:
        prox_obj = {"fila_cliente_id": int(proximo["idFilaCliente"]), "nome": proximo["nome"], "posicao": 1}

    atual_obj = None
    if atual:
        atual_obj = {"fila_cliente_id": int(atual["idFilaCliente"]), "nome": atual["nome"]}

    return {
        "fila_id": int(fila["idFila"]),
        "fila_status": (fila.get("status") or "").upper(),
        "aguardando_total": aguardando_total,
        "tempo_medio_min": 15,
        "atual": atual_obj,
        "proximo": prox_obj
    }

@app.get("/api/filas/{fila_id}/atendimento/status")
def atendimento_status(fila_id: int):
    conn = get_conn()
    try:
        return _fila_get_status(conn, fila_id)
    finally:
        conn.close()

@app.post("/api/filas/{fila_id}/atendimento/chamar")
async def atendimento_chamar(fila_id: int):
    conn = get_conn()
    try:
        cur = conn.cursor(dictionary=True)

        cur.execute("""
            SELECT idFilaCliente FROM fila_cliente
            WHERE fila_idFila=%s AND status='EM_ATENDIMENTO'
            LIMIT 1
        """, (fila_id,))
        if cur.fetchone():
            cur.close()
            raise HTTPException(status_code=400, detail="Já existe um cliente em atendimento.")

        cur.execute("""
            SELECT fc.idFilaCliente, c.nome
            FROM fila_cliente fc
            JOIN cliente c ON c.idCliente = fc.cliente_idCliente
            WHERE fc.fila_idFila=%s AND fc.status='AGUARDANDO'
            ORDER BY fc.data_entrada ASC, fc.idFilaCliente ASC
            LIMIT 1
        """, (fila_id,))
        prox = cur.fetchone()
        if not prox:
            cur.close()
            raise HTTPException(status_code=400, detail="Não há clientes aguardando.")

        fila_cliente_id = int(prox["idFilaCliente"])
        nome = prox["nome"]

        cur2 = conn.cursor()
        cur2.execute("""
            UPDATE fila_cliente
            SET status='EM_ATENDIMENTO'
            WHERE idFilaCliente=%s
        """, (fila_cliente_id,))
        conn.commit()
        cur2.close()
        cur.close()

        await notify_fila_update(fila_id, "CHAMOU_PROXIMO", {"fila_cliente_id": fila_cliente_id, "nome": nome})
        return {"ok": True, "cliente": {"fila_cliente_id": fila_cliente_id, "nome": nome, "posicao": 1}}
    finally:
        conn.close()

@app.post("/api/filas/{fila_id}/atendimento/finalizar")
async def atendimento_finalizar(fila_id: int):
    conn = get_conn()
    try:
        cur = conn.cursor(dictionary=True)

        cur.execute("""
            SELECT fc.idFilaCliente, fc.cliente_idCliente, c.nome
            FROM fila_cliente fc
            JOIN cliente c ON c.idCliente = fc.cliente_idCliente
            WHERE fc.fila_idFila=%s AND fc.status='EM_ATENDIMENTO'
            ORDER BY fc.data_entrada ASC, fc.idFilaCliente ASC
            LIMIT 1
        """, (fila_id,))
        row = cur.fetchone()

        if not row:
            cur.close()
            raise HTTPException(status_code=400, detail="Não há cliente em atendimento.")

        fila_cliente_id = int(row["idFilaCliente"])
        cliente_id = int(row["cliente_idCliente"])
        cliente_nome = row["nome"]

        cur2 = conn.cursor()
        cur2.execute("""
            UPDATE fila_cliente
            SET status='FINALIZADO', data_saida=%s
            WHERE idFilaCliente=%s
        """, (datetime.now(), fila_cliente_id))
        conn.commit()
        cur2.close()
        cur.close()

        await notify_fila_update(fila_id, "ATENDIMENTO_FINALIZADO", {
            "fila_cliente_id": fila_cliente_id,
            "cliente_id": cliente_id,
            "nome": cliente_nome
        })

        await notify_fila_update(fila_id, "FINALIZOU", {
            "fila_cliente_id": fila_cliente_id,
            "cliente_id": cliente_id,
            "nome": cliente_nome
        })

        return {"ok": True}
    finally:
        conn.close()

@app.post("/api/filas/{fila_id}/atendimento/cancelar")
async def atendimento_cancelar(fila_id: int):
    conn = get_conn()
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT idFilaCliente
            FROM fila_cliente
            WHERE fila_idFila=%s AND status='EM_ATENDIMENTO'
            ORDER BY data_entrada ASC, idFilaCliente ASC
            LIMIT 1
        """, (fila_id,))
        row = cur.fetchone()
        if not row:
            cur.close()
            raise HTTPException(status_code=400, detail="Não há cliente em atendimento.")

        fila_cliente_id = int(row["idFilaCliente"])

        cur2 = conn.cursor()
        cur2.execute("""
            UPDATE fila_cliente
            SET status='AGUARDANDO', data_entrada=%s
            WHERE idFilaCliente=%s
        """, (datetime.now(), fila_cliente_id))
        conn.commit()
        cur2.close()
        cur.close()

        await notify_fila_update(fila_id, "CANCELOU", {"fila_cliente_id": fila_cliente_id})
        return {"ok": True}
    finally:
        conn.close()

@app.post("/api/filas/{fila_id}/atendimento/pular")
async def atendimento_pular(fila_id: int):
    conn = get_conn()
    try:
        cur = conn.cursor(dictionary=True)

        cur.execute("""
            SELECT idFilaCliente FROM fila_cliente
            WHERE fila_idFila=%s AND status='EM_ATENDIMENTO'
            LIMIT 1
        """, (fila_id,))
        if cur.fetchone():
            cur.close()
            raise HTTPException(status_code=400, detail="Finalize/cancele o atendimento antes de pular.")

        cur.execute("""
            SELECT idFilaCliente
            FROM fila_cliente
            WHERE fila_idFila=%s AND status='AGUARDANDO'
            ORDER BY data_entrada ASC, idFilaCliente ASC
            LIMIT 1
        """, (fila_id,))
        row = cur.fetchone()
        if not row:
            cur.close()
            raise HTTPException(status_code=400, detail="Não há clientes aguardando.")

        fila_cliente_id = int(row["idFilaCliente"])

        cur2 = conn.cursor()
        cur2.execute("""
            UPDATE fila_cliente
            SET data_entrada=%s
            WHERE idFilaCliente=%s
        """, (datetime.now(), fila_cliente_id))
        conn.commit()
        cur2.close()
        cur.close()

        await notify_fila_update(fila_id, "PULOU", {"fila_cliente_id": fila_cliente_id})
        return {"ok": True}
    finally:
        conn.close()

# =====================================================
# DASHBOARD (VISÃO GERAL)
# =====================================================
@app.get("/api/dashboard/resumo")
def dashboard_resumo(estabelecimento_id: int = Query(...)):
    try:
        if estabelecimento_id <= 0:
            raise HTTPException(status_code=400, detail="estabelecimento_id inválido")

        conn = get_conn()
        cur = conn.cursor(dictionary=True)

        cur.execute("""
            SELECT idEstabelecimento, nome
            FROM estabelecimento
            WHERE idEstabelecimento = %s
            LIMIT 1
        """, (estabelecimento_id,))
        est = cur.fetchone()
        if not est:
            cur.close(); conn.close()
            raise HTTPException(status_code=404, detail="Estabelecimento não encontrado")

        cur.execute("""
            SELECT
              (SELECT COUNT(*)
               FROM fila f2
               JOIN fila_cliente fc2 ON fc2.fila_idFila = f2.idFila
               WHERE f2.estabelecimento_idEstabelecimento = %s
                 AND f2.status = 'ABERTA'
                 AND fc2.status = 'AGUARDANDO'
              ) AS na_fila,

              (SELECT COUNT(*)
               FROM fila f3
               JOIN fila_cliente fc3 ON fc3.fila_idFila = f3.idFila
               WHERE f3.estabelecimento_idEstabelecimento = %s
                 AND f3.status = 'ABERTA'
                 AND fc3.status = 'EM_ATENDIMENTO'
              ) AS atendendo,

              (SELECT COUNT(*)
               FROM fila f4
               JOIN fila_cliente fc4 ON fc4.fila_idFila = f4.idFila
               WHERE f4.estabelecimento_idEstabelecimento = %s
                 AND f4.status = 'ABERTA'
                 AND fc4.status = 'CHAMADO'
              ) AS chamados
        """, (estabelecimento_id, estabelecimento_id, estabelecimento_id))

        totais = cur.fetchone() or {}

        cur.execute("""
            SELECT
              fc.idFilaCliente,
              fc.fila_idFila,
              fc.cliente_idCliente,
              fc.status,
              fc.data_entrada,
              c.nome AS cliente_nome
            FROM fila f
            JOIN fila_cliente fc ON fc.fila_idFila = f.idFila
            JOIN cliente c ON c.idCliente = fc.cliente_idCliente
            WHERE f.estabelecimento_idEstabelecimento = %s
              AND f.status = 'ABERTA'
              AND fc.status = 'AGUARDANDO'
            ORDER BY fc.data_entrada ASC, fc.idFilaCliente ASC
            LIMIT 1
        """, (estabelecimento_id,))
        prox = cur.fetchone()

        cur.close()
        conn.close()

        return {
            "ok": True,
            "estabelecimento": {"id": est["idEstabelecimento"], "nome": est["nome"]},
            "totais": {
                "na_fila": int(totais.get("na_fila") or 0),
                "atendendo": int(totais.get("atendendo") or 0),
                "chamados": int(totais.get("chamados") or 0),
                "tempo_medio_min": 12,
                "no_raio": 0,
            },
            "proximo": (None if not prox else {
                "idFilaCliente": int(prox["idFilaCliente"]),
                "fila_id": int(prox["fila_idFila"]),
                "cliente_id": int(prox["cliente_idCliente"]),
                "nome": prox["cliente_nome"],
                "status": prox["status"],
                "data_entrada": prox["data_entrada"].isoformat() if prox.get("data_entrada") else None
            })
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/dashboard/chamar-proximo")
async def dashboard_chamar_proximo(body: ChamarProximoBody):
    try:
        estabelecimento_id = int(body.estabelecimento_id or 0)
        if estabelecimento_id <= 0:
            raise HTTPException(status_code=400, detail="estabelecimento_id inválido")

        conn = get_conn()
        cur = conn.cursor(dictionary=True)

        cur.execute("""
            SELECT
              fc.idFilaCliente,
              fc.fila_idFila,
              fc.cliente_idCliente,
              c.nome AS cliente_nome
            FROM fila f
            JOIN fila_cliente fc ON fc.fila_idFila = f.idFila
            JOIN cliente c ON c.idCliente = fc.cliente_idCliente
            WHERE f.estabelecimento_idEstabelecimento = %s
              AND f.status = 'ABERTA'
              AND fc.status = 'AGUARDANDO'
            ORDER BY fc.data_entrada ASC, fc.idFilaCliente ASC
            LIMIT 1
        """, (estabelecimento_id,))
        prox = cur.fetchone()

        if not prox:
            cur.close(); conn.close()
            return {"ok": True, "detail": "Ninguém aguardando."}

        fila_cliente_id = int(prox["idFilaCliente"])
        fila_id = int(prox["fila_idFila"])

        cur2 = conn.cursor()
        cur2.execute("""
            UPDATE fila_cliente
            SET status = 'CHAMADO'
            WHERE idFilaCliente = %s
        """, (fila_cliente_id,))
        conn.commit()
        cur2.close()

        cur.close()
        conn.close()

        await notify_fila_update(fila_id, "CLIENTE_CHAMADO", {
            "fila_cliente_id": fila_cliente_id,
            "cliente_id": int(prox["cliente_idCliente"]),
            "nome": prox["cliente_nome"]
        })

        return {
            "ok": True,
            "chamado": {
                "fila_id": fila_id,
                "fila_cliente_id": fila_cliente_id,
                "cliente_id": int(prox["cliente_idCliente"]),
                "nome": prox["cliente_nome"]
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# =====================================================
# MAIN
# =====================================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8010, reload=True)