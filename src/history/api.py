import logging
import os
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from neo4j import GraphDatabase
from neo4j.exceptions import Neo4jError, ServiceUnavailable, SessionExpired
from pydantic import BaseModel, Field

from .collector import Collector, SelectionError, SourceError, make_client
from .store import Store


@asynccontextmanager
async def lifespan(app):
    with GraphDatabase.driver(os.getenv("NEO4J_URI", "bolt://localhost:7687"), auth=(
        "neo4j", os.getenv("NEO4J_PASSWORD", "musubi_dev_password"),
    )) as driver, make_client() as client:
        driver.verify_connectivity()
        app.state.store = Store(driver, os.getenv("NEO4J_DATABASE", "neo4j"))
        app.state.store.initialize()
        app.state.collector = Collector(client)
        yield


app = FastAPI(title="Musubi — História", lifespan=lifespan)
WEB_DIR = Path(__file__).resolve().parent.parent / "web"
app.mount("/assets", StaticFiles(directory=WEB_DIR), name="assets")


@app.get("/", include_in_schema=False)
def home():
    return FileResponse(WEB_DIR / "index.html")


Language = Literal["pt", "en", "es"]


class ImportEvent(BaseModel):
    page_id: int = Field(gt=0)
    language: Language = "pt"


@app.exception_handler(SourceError)
async def source_error(request, exc):
    return JSONResponse(status_code=502, content={"detail": str(exc)})


@app.exception_handler(SelectionError)
async def selection_error(request, exc):
    return JSONResponse(status_code=422, content={"detail": str(exc)})


async def database_error(request, exc):
    logging.getLogger(__name__).error("Neo4j request failed: %s", type(exc).__name__)
    return JSONResponse(status_code=503, content={"detail": "Banco de dados indisponível."})


for error in (Neo4jError, ServiceUnavailable, SessionExpired):
    app.add_exception_handler(error, database_error)


@app.get("/search")
def search(request: Request, q: str = Query(min_length=2, max_length=200), language: Language = "pt"):
    return request.app.state.collector.search(q, language)


@app.post("/events/import")
def import_event(body: ImportEvent, request: Request):
    event = request.app.state.collector.collect(body.page_id, body.language)
    return request.app.state.store.save(event)


@app.get("/events/{event_id}")
def get_event(event_id: str, request: Request):
    event = request.app.state.store.read(event_id)
    if event is None:
        raise HTTPException(404, "Evento ainda não importado.")
    return event
