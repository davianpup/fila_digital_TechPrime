from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from jsondb import load_db, save_db, ensure_fila_structs, new_fila_dict, new_cliente_dict
from datetime import datetime, timezone

app = FastAPI(title="ANDA Filas API (JSON)", version="1.1")

# Libera acesso do seu front (HTML/JS) para a API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # em produção, coloque seu domínio
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

# ---------- Models ----------
class FilaCreate(BaseModel):
    id: str = Field(..., min_length=3, max_length=32)  # ex: fila_8F2K9
    nome: str
    endereco: str
    raio_m: int = 500
    tempo_medio_min: int = 15
    capacidade_max: int | None = None
    ativa: bool = True
    msg_boas_vindas: str | None = None
    horario_func: str | None = None
    observacoes: str | None = None

class EntrarFilaBody(BaseModel):
    nome: str = Field(..., min_length=1, max_length=120)

class AtualizarStatusBody(BaseModel):
    status: str  # aguardando/atendendo/finalizado/cancelado

# ---------- Endpoints ----------
@app.get("/api/filas")
def listar_filas():
    db = load_db()
    filas = list(db["filas"].values())
    # ordena por created_at desc (string ISO funciona)
    filas.sort(key=lambda f: f.get("created_at") or "", reverse=True)
    return filas

@app.post("/api/filas")
def criar_fila(body: FilaCreate):
    db = load_db()
    fid = body.id

    if fid in db["filas"]:
        raise HTTPException(status_code=409, detail="Já existe uma fila com esse id.")

    fila = new_fila_dict(body.model_dump())
    db["filas"][fid] = fila
    ensure_fila_structs(db, fid)

    save_db(db)
    return {"ok": True, "id": fid}

@app.post("/api/filas/{fila_id}/entrar")
def entrar_na_fila(fila_id: str, body: EntrarFilaBody):
    """
    Cliente entra na fila (celular) com nome.
    (Substitui a antiga procedure sp_entrar_fila do MySQL)
    Retorna: {cliente_id, senha_num, senha_codigo, pessoas_a_frente}
    """
    db = load_db()

    fila = db["filas"].get(fila_id)
    if not fila:
        raise HTTPException(status_code=404, detail="Fila não encontrada.")
    if not fila.get("ativa", True):
        raise HTTPException(status_code=400, detail="Fila está inativa.")

    ensure_fila_structs(db, fila_id)
    clientes = db["fila_clientes"][fila_id]

    # capacidade (conta aguardando + atendendo)
    cap = fila.get("capacidade_max")
    if cap is not None:
        ativos = sum(1 for c in clientes if c.get("status") in ("aguardando", "atendendo"))
        if ativos >= int(cap):
            raise HTTPException(status_code=400, detail="Fila lotada.")

    # próxima senha
    max_senha = max([int(c.get("senha_num", 0)) for c in clientes] or [0])
    senha_num = max_senha + 1

    pessoas_a_frente = sum(
        1 for c in clientes
        if c.get("status") == "aguardando" and int(c.get("senha_num", 0)) < senha_num
    )

    novo = new_cliente_dict(db, fila_id, body.nome, senha_num)
    clientes.append(novo)

    fila["updated_at"] = _now_iso()
    save_db(db)

    return {
        "cliente_id": novo["id"],
        "senha_num": novo["senha_num"],
        "senha_codigo": novo["senha_codigo"],
        "pessoas_a_frente": pessoas_a_frente
    }

@app.get("/api/filas/{fila_id}/clientes")
def listar_clientes(fila_id: str, status: str | None = None):
    """
    Fila ao Vivo: lista clientes (por status ou todos)
    """
    db = load_db()
    if fila_id not in db["filas"]:
        raise HTTPException(status_code=404, detail="Fila não encontrada.")

    ensure_fila_structs(db, fila_id)
    clientes = list(db["fila_clientes"][fila_id])

    if status:
        clientes = [c for c in clientes if c.get("status") == status]
        clientes.sort(key=lambda c: int(c.get("senha_num", 0)))
    else:
        clientes = [c for c in clientes if c.get("status") in ("aguardando", "atendendo")]
        # atendendo primeiro
        def _key(c):
            return (0 if c.get("status") == "atendendo" else 1, int(c.get("senha_num", 0)))
        clientes.sort(key=_key)

    # devolve apenas os campos usados no front
    out = []
    for c in clientes:
        out.append({
            "id": c["id"],
            "nome": c["nome"],
            "senha_num": c["senha_num"],
            "senha_codigo": c["senha_codigo"],
            "status": c["status"],
            "entrou_em": c.get("entrou_em"),
            "chamado_em": c.get("chamado_em"),
        })
    return out

@app.post("/api/filas/{fila_id}/chamar-proximo")
def chamar_proximo(fila_id: str):
    """
    Atendimento: chama o próximo (primeiro aguardando) e marca como atendendo.
    Também grava em fila_estado.atendendo_cliente_id.
    """
    db = load_db()
    if fila_id not in db["filas"]:
        raise HTTPException(status_code=404, detail="Fila não encontrada.")

    ensure_fila_structs(db, fila_id)
    estado = db["fila_estado"][fila_id]

    if estado.get("atendendo_cliente_id") is not None:
        raise HTTPException(status_code=409, detail="Já existe atendimento em andamento. Finalize antes.")

    clientes = db["fila_clientes"][fila_id]
    aguardando = [c for c in clientes if c.get("status") == "aguardando"]
    aguardando.sort(key=lambda c: int(c.get("senha_num", 0)))

    if not aguardando:
        raise HTTPException(status_code=404, detail="Nenhum cliente aguardando.")

    prox = aguardando[0]
    prox["status"] = "atendendo"
    prox["chamado_em"] = _now_iso()
    estado["atendendo_cliente_id"] = prox["id"]

    db["filas"][fila_id]["updated_at"] = _now_iso()
    save_db(db)

    return {"ok": True, "cliente": {"id": prox["id"], "nome": prox["nome"], "senha_num": prox["senha_num"], "senha_codigo": prox["senha_codigo"]}}

@app.post("/api/filas/{fila_id}/finalizar")
def finalizar_atendimento(fila_id: str):
    """
    Finaliza o cliente atendendo.
    """
    db = load_db()
    if fila_id not in db["filas"]:
        raise HTTPException(status_code=404, detail="Fila não encontrada.")

    ensure_fila_structs(db, fila_id)
    estado = db["fila_estado"][fila_id]
    cid = estado.get("atendendo_cliente_id")

    if cid is None:
        raise HTTPException(status_code=409, detail="Nenhum atendimento em andamento.")

    clientes = db["fila_clientes"][fila_id]
    alvo = next((c for c in clientes if c.get("id") == cid), None)
    if not alvo:
        estado["atendendo_cliente_id"] = None
        save_db(db)
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")

    alvo["status"] = "finalizado"
    alvo["finalizado_em"] = _now_iso()
    estado["atendendo_cliente_id"] = None

    db["filas"][fila_id]["updated_at"] = _now_iso()
    save_db(db)
    return {"ok": True, "finalizado_cliente_id": cid}

@app.post("/api/filas/{fila_id}/cancelar")
def cancelar_atendimento(fila_id: str):
    """
    Cancela o atendimento atual e volta o cliente para 'aguardando' no topo.
    Para "voltar pro topo", coloca senha_num = (menor senha_num atual - 1).
    """
    db = load_db()
    if fila_id not in db["filas"]:
        raise HTTPException(status_code=404, detail="Fila não encontrada.")

    ensure_fila_structs(db, fila_id)
    estado = db["fila_estado"][fila_id]
    cid = estado.get("atendendo_cliente_id")

    if cid is None:
        raise HTTPException(status_code=409, detail="Nenhum atendimento em andamento.")

    clientes = db["fila_clientes"][fila_id]
    alvo = next((c for c in clientes if c.get("id") == cid), None)
    if not alvo:
        estado["atendendo_cliente_id"] = None
        save_db(db)
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")

    aguardando_nums = [int(c.get("senha_num", 0)) for c in clientes if c.get("status") == "aguardando"]
    min_senha = min(aguardando_nums) if aguardando_nums else 1
    novo_num = min_senha - 1

    alvo["status"] = "aguardando"
    alvo["cancelado_em"] = _now_iso()
    alvo["senha_num"] = int(novo_num)
    # mantém senha_codigo original (ou atualiza para refletir a senha_num)
    alvo["senha_codigo"] = str(alvo["senha_num"]).zfill(3)

    estado["atendendo_cliente_id"] = None

    db["filas"][fila_id]["updated_at"] = _now_iso()
    save_db(db)
    return {"ok": True, "cliente_id": cid, "senha_num_novo": novo_num}

@app.post("/api/filas/{fila_id}/pular")
def pular_cliente(fila_id: str):
    """
    Pula o primeiro aguardando (manda pro final).
    Implementação: pega o menor senha_num aguardando e coloca senha_num = (maior senha_num aguardando + 1)
    """
    db = load_db()
    if fila_id not in db["filas"]:
        raise HTTPException(status_code=404, detail="Fila não encontrada.")

    ensure_fila_structs(db, fila_id)
    clientes = db["fila_clientes"][fila_id]

    aguardando = [c for c in clientes if c.get("status") == "aguardando"]
    aguardando.sort(key=lambda c: int(c.get("senha_num", 0)))

    if not aguardando:
        raise HTTPException(status_code=404, detail="Nenhum cliente aguardando para pular.")

    primeiro = aguardando[0]
    max_senha = max([int(c.get("senha_num", 0)) for c in aguardando] or [int(primeiro.get("senha_num", 0))])
    novo_num = max_senha + 1

    primeiro["senha_num"] = int(novo_num)
    primeiro["senha_codigo"] = str(primeiro["senha_num"]).zfill(3)

    db["filas"][fila_id]["updated_at"] = _now_iso()
    save_db(db)
    return {"ok": True, "cliente_id": primeiro["id"], "senha_num_novo": novo_num}

@app.get("/api/filas/{fila_id}/cliente/{cliente_id}/status")
def status_cliente(fila_id: str, cliente_id: int):
    """
    Para a tela do cliente: retorna posição (quantos à frente) e estimativa
    """
    db = load_db()
    fila = db["filas"].get(fila_id)
    if not fila:
        raise HTTPException(status_code=404, detail="Fila não encontrada.")

    ensure_fila_structs(db, fila_id)
    clientes = db["fila_clientes"][fila_id]
    c = next((x for x in clientes if int(x.get("id")) == int(cliente_id)), None)
    if not c:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")

    if c.get("status") == "aguardando":
        a_frente = sum(
            1 for x in clientes
            if x.get("status") == "aguardando" and int(x.get("senha_num", 0)) < int(c.get("senha_num", 0))
        )
    else:
        a_frente = 0

    tempo_medio = int(fila.get("tempo_medio_min") or 15)
    estimativa = a_frente * tempo_medio

    return {
        "fila_nome": fila.get("nome"),
        "fila_raio_m": fila.get("raio_m"),
        "cliente": {
            "id": c.get("id"),
            "nome": c.get("nome"),
            "senha_num": c.get("senha_num"),
            "senha_codigo": c.get("senha_codigo"),
            "status": c.get("status"),
        },
        "a_frente": a_frente,
        "tempo_medio_min": tempo_medio,
        "estimativa_min": estimativa
    }

@app.post("/api/filas/{fila_id}/cliente/{cliente_id}/sair")
def sair_da_fila(fila_id: str, cliente_id: int):
    db = load_db()
    fila = db["filas"].get(fila_id)
    if not fila:
        raise HTTPException(status_code=404, detail="Fila não encontrada.")

    ensure_fila_structs(db, fila_id)
    estado = db["fila_estado"][fila_id]
    clientes = db["fila_clientes"][fila_id]

    alvo = next((c for c in clientes if int(c.get("id")) == int(cliente_id)), None)
    if not alvo or alvo.get("status") not in ("aguardando", "atendendo"):
        raise HTTPException(status_code=404, detail="Cliente não encontrado ou já finalizado.")

    alvo["status"] = "cancelado"
    alvo["cancelado_em"] = _now_iso()

    if estado.get("atendendo_cliente_id") == alvo.get("id"):
        estado["atendendo_cliente_id"] = None

    db["filas"][fila_id]["updated_at"] = _now_iso()
    save_db(db)
    return {"ok": True}
