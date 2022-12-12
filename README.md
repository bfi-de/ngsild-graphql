# NGSI-LD GraphQL interface

## Introduction

This repository provides a GraphQL interface for FIWARE/NGSI-LD context brokers. Instead of using the NGSI-LD API directly, it allows application developers to specify their data requirements in terms of GraphQL templates. Multiple NGSI-LD entities linked by relationships can thus be retrieved in a single query, instead of one query per entity. A rudimentary visualization tool is included, as well. Note: this is alpha software, not meant for a production deployment, yet.

Zenodo link: [![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.7428717.svg)](https://doi.org/10.5281/zenodo.7428717)

## Run samples

The repository contains two small sample setups, each including a data model and sample data. If you are looking for a pre-built docker image instead, see [Run with Docker](#run-with-docker).
Running the samples requires docker and docker-compose, as well as cloning the repository. 

The Buildings data model covers rooms, storeys and buildings, the Steel model includes certain entities relevant to the steel production, including production equipment, such as a continuous casting machine, and physical items, such as steel bars. The building model is inspired by the [Building Topology Ontology (BOT)](https://www.semantic-web-journal.net/content/bot-building-topology-ontology-w3c-linked-building-data-group-0), whereas the steel model is loosely based on the [SAREF4INMA ontology](https://saref.etsi.org/saref4inma).

### Using the provided compose file

Use one of the provided start scripts:

```
./runBuildings.sh
```

or 

```
./runSteel.sh
```

to run a FIWARE context broker with the data model and some sample data defined in the folder *modelBuilding* or *modelSteel*.
Use `./stop.sh` to stop the system. 

**Note**: when switching between the models it will be necessary to do some cleanup. Before restarting the other sample delete all volumes, for instance using the command 
```
docker volume prune
```
Beware that this deletes all docker volumes not currently in use. Furthermore, remove the visualization container, since it will need to be rebuilt:

```
docker image rm ngsild-graphql_ngsild-viz
```

## Run with Docker

Note: like the app itself, the Docker images are not meant to be used in a production deployment, yet.

For this setup it is not required to clone the repository.

The basic command to run the provided docker image (https://github.com/bfi-de/ngsild-graphql/pkgs/container/ngsild-graphql), with some Windows- and Docker Desktop specific optimizations, is:

```bash
MSYS_NO_PATHCONV=1 docker run --rm -d --name ngsild-graphql -p 4000:4000 \
    -v $(pwd)/model:/usr/src/app/model:ro \
    -e BASE_FOLDER=/usr/src/app/model \
    -e NGSI_BASE_URL=http://host.docker.internal:1026 \
    -e CONTEXT_URL_BROKER=http://host.docker.internal/ngsi-context.jsonld \
    -e CONTEXT_URL=http://host.docker.internal/ngsi-context.jsonld \
    -e CORS_ORIGIN=_ALL \
    ghcr.io/bfi-de/ngsild-graphql
```

The *model* folder must contain a model specification similar to the json spec files in the two sample scenarios provided in the repository, and the context provider and context broker must be accessible at the specified urls. The Graphiql frontend will then be available at
http://localhost:4000/graphiql

**Configurations** can be set via env vars (e.g. add to the docker run command via `-e`, as shown above):

* **BASE_FOLDER**=/usr/src/app/model
* **NGSI_BASE_URL**=http://localhost:1026  (the URL under which the context broker API is available) 
* **CONTEXT_URL_BROKER**=http://context/ngsi-context.jsonld (the URL under which the context broker can access the context provider; the default value is adapted to a Docker compose setup)
* **CONTEXT_URL**=<empty> (the URL under which the context provider is accessible to this app; e.g. http://context/ngsi-context.jsonld in a Docker setup)
* **FILTERED_FILE_NAMES**=sample (filenames in the models folder that are omitted from the schema parsing)
* **FILTERED_FOLDER_NAMES**=<empty> (folder names in the models folder that are omitted from the schema parsing)
* **CORS_ORIGIN**=<empty>  (CORS settings. Set to *_ALL* to enable CORS for origins)
* **CORS_MAX_AGE**=86400   (CORS max age in secdonds; only relevant if CORS_ORIGIN is set)
 
The value shown is the default value, if not specified explicitly.

Likewise, for the visualization tool:

```bash
MSYS_NO_PATHCONV=1 docker run --rm -d --name ngsild-graphql-viz -p 8080:8080 \
    -v $(pwd)/config.json:/usr/src/app/assets/config.json
    ghcr.io/bfi-de/ngsild-graphql-viz
```
where we assume the existence of a file *config.json* in the current folder, with content 

```json
{
    "server": "http://localhost:4000/graphql",
    "initialLayout": "custom",
    "initialQuery": "{__n  Rooms {__n    id__n    type__n    isRoomOf {__n      id__n      type__n      ceilingHeight__n      isStoreyOf {__n        id__n        type__n        constructed__n      }__n    }__n  }__n}",
    "initialGroups": [["Building"], ["Storey"], ["Room"]]
}
```
Here `server` refers to the GraphQL endpoint from the other container, as it is accessible from the user's browser, the other settings are adapated to the Buildings sample data model. The frontend will then be available at http://localhost:8080, see [below](#ngsild-viz).


## Frontends

### GraphQL 

The standard graphql development frontend is availalbe at *http://localhost:4000/graphql*. It allows you send a GraphQL query to the server. Some potential queries for the buildings sample setup:

* List all buildings, together with the year of construction:
    ```
    Buildings {
      id
      constructed
    }
    ```

* List all rooms, together with the storeys they are located in and the buildings:
    ```
    {
      Rooms {
        id
        isRoomOf {
          id
          isStoreyOf {
            id
          }
        }
      }
    }
    ```

* Filter for rooms in buildings constructed after 1920 (change to 1900 to see how the result set changes):
    ```
    {
      Rooms(filter: {isRoomOf: {isStoreyOf: {constructed:{geq: 1920}}}}) {
        id
        isRoomOf {
          isStoreyOf {
            id
            constructed
          }
        }
      }
    }
    ``` 

* Filter for rooms in storeys for which the ceilingHeight is provided:
    ```
    {
      Rooms(filter: {isRoomOf: {ceilingHeight:{exists: true}}}) {
        id
        isRoomOf {
          id
          ceilingHeight
        }
      }
    }
    ``` 

### Voyager

The [graphQL-Voyager](https://github.com/IvanGoncharov/graphql-voyager) frontend is available at *http://localhost:4000/voyager*. It provides a visualization of the generated GraphQL schema.

### ngsild-viz

This is a visualization tool for the NGSI-LD property graph, available at http://localhost:8080/. It provides a form for GraphQL queries, very similar to the GraphQL standard frontend, and visualizes the response from the server as a graph.


## Folder structure

* *modelBuilding* and *modelSteel*: Contains the respective data model in terms of JSON schema defitions (*.json, except *sample.json*), some sample data (*sample.json*), and the context files *ngsi-context.json* and *json-context.jsonld*. There is also a Swagger/OpenAPI definition file: *openapi.yml*. 
* *ngsild-graphql*: Contains the source code for the GraphQL interface
* *ngsild-viz*: Contains the source code for the graph visualization

## Run Swagger server

In one of the model subfolders, run

```
docker run -d --rm --name swagger -p 8080:8080 -v ${PWD}:/model -e SWAGGER_JSON=/model/openapi.yml swaggerapi/swagger-ui
```

In the git Bash on Windows, prepend `MSYS_NO_PATHCONV=1 `.


## GraphQL model introspection

To query class names:
```
{
  __schema {
    types {
      name
    }
  }
}
```

To query fields on a class:
```
{
  __type(name: "Room") {
    name
    fields {
      name
      type {
        name
        kind
      }
    }
  }
}
```

### Download generated GraphQL schema

```
npx apollo client:download-schema --endpoint=http://localhost:4000/graphql schema.json
```
Note that this may need some pinned dev dependencies: https://github.com/apollographql/apollo-tooling/issues/2415


