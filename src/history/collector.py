"""Bounded ingestion from Wikimedia, retaining statements instead of guessing facts."""
import json
import os
import re
import time
from datetime import datetime, timezone

import httpx


PROPERTIES = {
    "P31": "instance_of", "P361": "part_of", "P710": "participant",
    "P276": "location", "P17": "country", "P580": "start_time",
    "P582": "end_time", "P585": "point_in_time", "P828": "has_cause",
    "P1542": "has_effect", "P1344": "participated_in",
}


class SourceError(Exception):
    pass


class SelectionError(Exception):
    pass


class Collector:
    def __init__(self, client):
        self.client = client

    def get(self, url, **params):
        for attempt in range(3):
            try:
                response = self.client.get(url, params={
                    "format": "json", "formatversion": 2, **params,
                })
                if response.status_code in (429, 502, 503, 504) and attempt < 2:
                    time.sleep(2 ** attempt)
                    continue
                response.raise_for_status()
                data = response.json()
                if "error" in data:
                    raise SourceError("A fonte Wikimedia retornou um erro.")
                return data
            except httpx.HTTPStatusError as exc:
                # Retrying permanent refusals (e.g. 403) only increases load.
                raise SourceError(f"Wikimedia retornou HTTP {exc.response.status_code}.") from exc
            except (httpx.HTTPError, ValueError) as exc:
                if attempt == 2:
                    raise SourceError("Não foi possível consultar a Wikimedia.") from exc
                time.sleep(2 ** attempt)
        raise SourceError("Fonte indisponível.")

    @staticmethod
    def endpoint(language):
        if language not in ("pt", "en", "es"):
            raise SelectionError("Idioma deve ser pt, en ou es.")
        return f"https://{language}.wikipedia.org/w/api.php"

    def search(self, query, language):
        data = self.get(self.endpoint(language), action="query", list="search",
                        srsearch=query, srnamespace=0, srlimit=10, srprop="")
        return [{"page_id": row["pageid"], "title": row["title"], "language": language}
                for row in data["query"]["search"]]

    def collect(self, page_id, language):
        data = self.get(self.endpoint(language), action="query", pageids=page_id,
                        prop="extracts|pageprops|info", exintro=1, explaintext=1,
                        inprop="url")
        page = data["query"]["pages"][0]
        if "missing" in page or page.get("ns") != 0:
            raise SelectionError("Artigo não encontrado.")
        props = page.get("pageprops", {})
        if "disambiguation" in props:
            raise SelectionError("Selecione um artigo específico, não uma desambiguação.")
        qid = props.get("wikibase_item", "")
        if not re.fullmatch(r"Q[1-9][0-9]*", qid):
            raise SelectionError("Este artigo não possui item correspondente no Wikidata.")
        entity = self.entities([qid], language, "claims|labels|descriptions")[qid]
        statements = []
        for prop, predicate in PROPERTIES.items():
            for claim in entity.get("claims", {}).get(prop, []):
                snak = claim.get("mainsnak", {})
                if claim.get("rank") == "deprecated" or snak.get("snaktype") != "value":
                    continue
                value = snak.get("datavalue", {}).get("value")
                if not isinstance(value, dict):
                    continue
                target = value.get("id") if snak.get("datatype") == "wikibase-item" else None
                if not target and snak.get("datatype") != "time":
                    continue
                statements.append({
                    "id": claim["id"], "property": prop, "predicate": predicate,
                    "rank": claim["rank"], "target_id": target,
                    "value_json": json.dumps(value, ensure_ascii=False),
                    "qualifiers_json": json.dumps(claim.get("qualifiers", {}), ensure_ascii=False),
                    "references_json": json.dumps(claim.get("references", []), ensure_ascii=False),
                    "source_url": f"https://www.wikidata.org/wiki/{qid}#{prop}",
                })
        ids = sorted({s["target_id"] for s in statements if s["target_id"]})
        related = {}
        for start in range(0, len(ids), 50):
            related.update(self.entities(ids[start:start + 50], language, "labels|descriptions"))
        label = lambda e: e.get("labels", {}).get(language, {}).get("value", e["id"])
        return {
            "id": qid, "title": page["title"], "language": language,
            "summary": page.get("extract", ""), "page_id": page["pageid"],
            "source_url": page["fullurl"], "revision_id": page["lastrevid"],
            "wikidata_url": f"https://www.wikidata.org/wiki/{qid}",
            "wikidata_revision": entity.get("lastrevid"),
            "retrieved_at": datetime.now(timezone.utc).isoformat(),
            "statements": statements,
            "entities": [{"id": key, "name": label(value)} for key, value in related.items()],
        }

    def entities(self, ids, language, props):
        return self.get("https://www.wikidata.org/w/api.php", action="wbgetentities",
                        ids="|".join(ids), props=props, languages=language,
                        languagefallback=1)["entities"]


def make_client():
    return httpx.Client(timeout=20, headers={
        "User-Agent": os.getenv("WIKIMEDIA_USER_AGENT", "MusubiHistory/0.1 (local educational prototype)"),
    })
