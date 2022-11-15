# NGSI-LD GraphQL interface

## Run samples

This requires docker and docker-compose. The repository contains two data models along with small sample datasets. One of them models rooms, storeys and buildings, the other one models certain entities relevant to the steel production, including production equipment, such as a continuous casting machine, and physical items, such as steel bars. The building model is inspired by the [Building Topology Ontology (BOT)](https://www.semantic-web-journal.net/content/bot-building-topology-ontology-w3c-linked-building-data-group-0), whereas the steel model is loosely based on the [SAREF4INMA ontology](https://saref.etsi.org/saref4inma).

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


