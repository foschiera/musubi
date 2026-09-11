import json


class Store:
    def __init__(self, driver, database="neo4j"):
        self.driver, self.database = driver, database

    def initialize(self):
        with self.driver.session(database=self.database) as session:
            for label, key in (("Entity", "id"), ("Statement", "id"), ("Source", "url")):
                session.run(f"CREATE CONSTRAINT IF NOT EXISTS FOR (n:{label}) REQUIRE n.{key} IS UNIQUE").consume()

    def save(self, event):
        with self.driver.session(database=self.database) as session:
            session.execute_write(self._save, event)
        return event

    @staticmethod
    def _save(tx, event):
        tx.run("""
            MERGE (e:Entity {id: $id}) SET e:HistoricalEvent, e.name = $title,
                e.updated_at = $retrieved_at
            MERGE (s:Source {url: $source_url})
            SET s.title = $title, s.language = $language, s.summary = $summary,
                s.revision_id = $revision_id, s.retrieved_at = $retrieved_at,
                s.license = 'CC BY-SA; see article attribution and license'
            MERGE (e)-[:DOCUMENTED_BY]->(s)
            MERGE (w:Source {url: $wikidata_url})
            SET w.revision_id = $wikidata_revision, w.retrieved_at = $retrieved_at,
                w.license = 'CC0'
            MERGE (e)-[:DOCUMENTED_BY]->(w)
        """, **{k: v for k, v in event.items() if k not in ("statements", "entities")}).consume()
        tx.run("""
            UNWIND $entities AS item
            MERGE (n:Entity {id: item.id}) SET n.name = item.name
        """, entities=event["entities"]).consume()
        # Keep removed claims as inactive history instead of presenting them as current facts.
        tx.run("""
            MATCH (:Entity {id: $id})-[:HAS_STATEMENT]->(s:Statement)
            SET s.active = false
        """, id=event["id"]).consume()
        tx.run("""
            MATCH (e:Entity {id: $id}), (source:Source {url: $source_url})
            UNWIND $statements AS item
            MERGE (s:Statement {id: item.id}) SET s += item,
                s.active = true, s.retrieved_at = $retrieved_at
            MERGE (e)-[:HAS_STATEMENT]->(s)
            MERGE (s)-[:DOCUMENTED_BY]->(source)
            WITH s, item
            OPTIONAL MATCH (s)-[old:VALUE]->() DELETE old
            WITH DISTINCT s, item
            OPTIONAL MATCH (target:Entity {id: item.target_id})
            FOREACH (_ IN CASE WHEN target IS NULL THEN [] ELSE [1] END |
                MERGE (s)-[:VALUE]->(target))
        """, id=event["id"], source_url=event["wikidata_url"],
               statements=event["statements"], retrieved_at=event["retrieved_at"]).consume()
        # Save the complete imported view for the interface, in the same transaction.
        tx.run("MATCH (e:Entity {id: $id}) SET e.snapshot = $snapshot",
               id=event["id"], snapshot=json.dumps(event, ensure_ascii=False)).consume()

    def read(self, event_id):
        with self.driver.session(database=self.database) as session:
            record = session.run("MATCH (e:HistoricalEvent {id: $id}) RETURN e.snapshot AS data",
                                 id=event_id).single()
            return json.loads(record["data"]) if record else None
