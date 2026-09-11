import copy
import json
import os
import unittest
from unittest.mock import Mock, patch

import httpx
from fastapi.testclient import TestClient
from neo4j import GraphDatabase

from history.api import app
from history.collector import Collector, SelectionError, SourceError
from history.store import Store


def fixtures():
    claim = {
        "id": "Q100$place", "rank": "normal",
        "mainsnak": {"snaktype": "value", "datatype": "wikibase-item",
                     "datavalue": {"value": {"id": "Q200"}}},
        "references": [{"snaks": {"P854": [{"datavalue": {"value": "https://example.org/source"}}]}}],
        "qualifiers": {"P580": [{"datavalue": {"value": {"time": "+1789-00-00T00:00:00Z", "precision": 9}}}]},
    }
    date = {"id": "Q100$date", "rank": "normal", "mainsnak": {
        "snaktype": "value", "datatype": "time", "datavalue": {"value": {
            "time": "-0044-03-15T00:00:00Z", "precision": 11, "calendarmodel": "julian",
        }}}}
    return {
        "page": {"query": {"pages": [{"pageid": 10, "ns": 0, "title": "Evento teste",
            "pageprops": {"wikibase_item": "Q100"}, "extract": "Resumo da fonte.",
            "fullurl": "https://pt.wikipedia.org/wiki/Evento_teste", "lastrevid": 7}]}},
        "entity": {"entities": {"Q100": {"id": "Q100", "lastrevid": 8, "claims": {
            "P276": [claim, {**claim, "id": "Q100$old", "rank": "deprecated"}],
            "P585": [date], "P580": [{"mainsnak": {"snaktype": "somevalue"}}],
        }}}},
        "related": {"entities": {"Q200": {"id": "Q200", "labels": {"pt": {"value": "Local"}}}}},
    }


def collect_fixture():
    data = fixtures()
    def respond(request):
        if request.url.params.get("list") == "search":
            result = {"query": {"search": [{"pageid": 10, "title": "Evento teste"}]}}
        elif request.url.params.get("action") == "query":
            result = data["page"]
        elif request.url.params.get("ids") == "Q100":
            result = data["entity"]
        else:
            result = data["related"]
        return httpx.Response(200, json=result)
    return Collector(httpx.Client(transport=httpx.MockTransport(respond)))


class CollectorTests(unittest.TestCase):
    def test_search_returns_selection_not_automatic_import(self):
        self.assertEqual(collect_fixture().search("evento", "pt")[0]["page_id"], 10)

    def test_provenance_and_historical_time_preserved(self):
        event = collect_fixture().collect(10, "pt")
        self.assertEqual(len(event["statements"]), 2)
        place, date = event["statements"]
        self.assertIn("https://example.org/source", place["references_json"])
        self.assertIn("precision", place["qualifiers_json"])
        self.assertEqual(json.loads(date["value_json"])["time"], "-0044-03-15T00:00:00Z")
        self.assertEqual(event["revision_id"], 7)
        self.assertEqual(event["entities"], [{"id": "Q200", "name": "Local"}])

    def test_disambiguation_missing_and_unlinked_rejected(self):
        for page in ({"missing": True}, {"ns": 0, "pageprops": {"disambiguation": ""}},
                     {"ns": 0, "pageprops": {}}):
            collector = collect_fixture()
            collector.get = Mock(return_value={"query": {"pages": [page]}})
            with self.assertRaises(SelectionError):
                collector.collect(10, "pt")

    @patch("history.collector.time.sleep")
    def test_upstream_failure_retried_and_reported(self, sleep):
        handler = Mock(return_value=httpx.Response(503))
        collector = Collector(httpx.Client(transport=httpx.MockTransport(handler)))
        with self.assertRaises(SourceError):
            collector.search("evento", "pt")
        self.assertEqual(handler.call_count, 3)

    def test_permanent_refusal_is_not_retried(self):
        handler = Mock(return_value=httpx.Response(403))
        collector = Collector(httpx.Client(transport=httpx.MockTransport(handler)))
        with self.assertRaisesRegex(SourceError, "403"):
            collector.search("evento", "pt")
        self.assertEqual(handler.call_count, 1)


class ApiTests(unittest.TestCase):
    def setUp(self):
        app.state.collector = collect_fixture()
        app.state.store = Mock()
        app.state.store.save.side_effect = lambda event: event
        self.client = TestClient(app)

    def test_frontend_and_assets_are_served(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn('id="search-form"', response.text)
        self.assertEqual(self.client.get("/assets/app.js").status_code, 200)
        self.assertEqual(self.client.get("/assets/style.css").status_code, 200)

    def test_import_returns_graph_and_saves_once(self):
        response = self.client.post("/events/import", json={"page_id": 10})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], "Q100")
        app.state.store.save.assert_called_once()

    def test_invalid_input_does_not_write(self):
        for body in ({"page_id": -1}, {"page_id": 10, "language": "localhost"}):
            self.assertEqual(self.client.post("/events/import", json=body).status_code, 422)
        app.state.store.save.assert_not_called()

    def test_source_failure_does_not_write(self):
        app.state.collector.collect = Mock(side_effect=SourceError("Falha na fonte"))
        self.assertEqual(self.client.post("/events/import", json={"page_id": 10}).status_code, 502)
        app.state.store.save.assert_not_called()

    def test_not_imported(self):
        app.state.store.read.return_value = None
        self.assertEqual(self.client.get("/events/Q100").status_code, 404)


@unittest.skipUnless(os.getenv("NEO4J_TEST_URI"), "Requer banco Neo4j descartável em NEO4J_TEST_URI")
class StoreIntegrationTests(unittest.TestCase):
    def test_idempotency_updates_and_provenance(self):
        # Explicit opt-in: run against a disposable database only.
        with GraphDatabase.driver(os.environ["NEO4J_TEST_URI"], auth=(
            "neo4j", os.getenv("NEO4J_TEST_PASSWORD", "musubi_dev_password"),
        )) as driver:
            store = Store(driver)
            store.initialize()
            event = collect_fixture().collect(10, "pt")
            store.save(event)
            store.save(event)
            self.assertEqual(store.read("Q100"), event)
            with driver.session() as session:
                record = session.run("""
                    MATCH (:HistoricalEvent {id: 'Q100'})-[:HAS_STATEMENT]->(s:Statement)
                    RETURN count(s) AS total
                """).single()
                self.assertEqual(record["total"], 2)
            updated = copy.deepcopy(event)
            updated["statements"] = updated["statements"][:1]
            store.save(updated)
            with driver.session() as session:
                record = session.run("""
                    MATCH (:HistoricalEvent {id: 'Q100'})-[:HAS_STATEMENT]->(s:Statement)
                    WHERE s.active RETURN count(s) AS total
                """).single()
                self.assertEqual(record["total"], 1)


if __name__ == "__main__":
    unittest.main()
