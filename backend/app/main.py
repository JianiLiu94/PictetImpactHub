import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import companies

app = FastAPI(title="Environmental Impact Dashboard API")

allowed_origins = os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(companies.router)
