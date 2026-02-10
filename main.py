from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr
import mysql.connector
import hashlib

# =====================================================
# FASTAPI (SEU APP ORIGINAL)
# =====================================================

app = FastAPI(title="Fila Digital API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================================================
# STATIC + PÁGINAS (NOVO)
# =====================================================

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/cnpj")
def page_cnpj():
    return FileResponse("templates/cnpj.html")


# =====================================================
# MYSQL (NOVO)
# =====================================================

def get_conn():
    return mysql.connector.connect(
        host="localhost",
        user="root",
        password="root",
        database="fila_digital"  # troque pro seu schema
    )


# =====================================================
# HASH SENHA (NOVO)
# =====================================================

SECRET_KEY = "andalogo_super_secret"

def hash_pass(p: str):
    return hashlib.sha256((p + SECRET_KEY).encode()).hexdigest()


# =====================================================
# MODEL (NOVO)
# =====================================================

class EstabelecimentoCreate(BaseModel):
    nome: str
    cidade: str | None = None
    cnpj: str | None = None
    categoria: str | None = None
    estado: str | None = None
    telefone: str | None = None
    email: EmailStr
    senha: str
    latitude: float | None = None
    longitude: float | None = None
    raio_alerta: int | None = None


# =====================================================
# ENDPOINT CADASTRO MYSQL (NOVO)
# =====================================================

@app.post("/api/estabelecimentos")
def criar_estabelecimento(body: EstabelecimentoCreate):
    try:
        conn = get_conn()
        cur = conn.cursor()

        cur.execute("""
            INSERT INTO estabelecimento
            (nome, cidade, cnpj, categoria, estado, telefone, email, senha, latitude, longitude, raio_alerta)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            body.nome,
            body.cidade,
            body.cnpj,
            body.categoria,
            body.estado,
            body.telefone,
            body.email.lower(),
            hash_pass(body.senha),
            body.latitude,
            body.longitude,
            body.raio_alerta
        ))

        conn.commit()
        new_id = cur.lastrowid

        cur.close()
        conn.close()

        return {"ok": True, "id": new_id}

    except Exception as e:
        print("ERRO AO INSERIR >>>>>>>>>>>>>>>>>>>>>")
        print(repr(e))
        print("<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<")
        raise HTTPException(status_code=400, detail=str(e))

# =====================================================
# AQUI CONTINUA TODO SEU CÓDIGO ANTIGO DAS FILAS
# (não mexi em nada)
# =====================================================
