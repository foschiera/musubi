CREATE CONSTRAINT user_email_unique IF NOT EXISTS
FOR (user:User) REQUIRE user.email IS UNIQUE;

CREATE CONSTRAINT interest_name_unique IF NOT EXISTS
FOR (interest:Interest) REQUIRE interest.name IS UNIQUE;

MERGE (ana:User {email: 'ana@example.com'})
  ON CREATE SET ana.name = 'Ana'
MERGE (bruno:User {email: 'bruno@example.com'})
  ON CREATE SET bruno.name = 'Bruno'
MERGE (carla:User {email: 'carla@example.com'})
  ON CREATE SET carla.name = 'Carla'
MERGE (neo4j:Interest {name: 'Neo4j'})
MERGE (docker:Interest {name: 'Docker'})
MERGE (ana)-[:KNOWS]->(bruno)
MERGE (bruno)-[:KNOWS]->(carla)
MERGE (ana)-[:INTERESTED_IN]->(neo4j)
MERGE (bruno)-[:INTERESTED_IN]->(neo4j)
MERGE (carla)-[:INTERESTED_IN]->(docker);
