# Simple Example

This repo serves as a simple example of how one can use [my message db connector](https://github.com/stetsmando/message-db-connector-ts) library to create event-sourced applications.
This is by no means exhaustive, but can serve as a starting point. If you're interested for any reason, feel free to download the code and take a look. Also, reach out to me if you have questions.

## Prerequisites

1. You need a way to run TypeScript (I'm using [deno](https://deno.com/)

2. Docker installed locally so you can run [MessageDb](https://github.com/message-db/message-db)

## Getting Started

1. Clone the Repo
```bash
gh repo clone stetsmando/message-db-connector-ts
```

2. Install deps
```bash
# deno
deno install
```

3. Start MessageDb & ElasticSearch
```bash
# Build message-db container
docker build -t message-db .

# Run the containers
docker compose up
```

4. Create the ElasticSearch Index Mapping
```bash
curl -X PUT "http://localhost:9200/drones" -H 'Content-Type: application/json' -d'
{
  "mappings": {
  "properties": {
      "partnerId": { "type": "keyword" },
      "faaId": { "type": "keyword" },
      "model": { "type": "keyword" },
      "make": { "type": "keyword" },
      "basePrice": { "type": "float" },
      "totalPrice": { "type": "float" },
      "weightInGrams": { "type": "integer" },
      "options": { "type": "keyword" }
      }
    }
}
'
```

5. Start the application
```bash
deno run --allow-env --allow-read --allow-net --check src/main.ts
```
6. Seed Inventory Data
```bash
./upload_test_csv.sh drone_inventory.csv
```
7. Verify that you have search results in elastic search
```bash
curl -X GET "localhost:9200/drones/_search?pretty&size=10" -H 'Content-Type: application/json' -d'
{
  "query": { "match_all": {} }
}
'
```
## Missing Items Still Needed
- [ ] Full test suite
- [ ] Api based searching
- [ ] Persistent storage in a relational db (Postgres) for the Listings


