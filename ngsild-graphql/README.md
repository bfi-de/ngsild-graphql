# NGSI-LD GraphQL interface

## Run this app

Requires NodeJS.

Install dependencies:

```
npm install
```

Run:

```
npm run start
```

## Frontend

Once the app is running the frontend will be available at *http://localhost:4000/graphql*.

## Configuration

The app uses environment variables for configuration. These can be configured via a *.env* file in this folder. 
The default configuration should be fine for the sample setup.

Sample content of the *.env* file:

```
## The context URL as it can be reached by this app
##  (default: absent, in which case the context will be retrieved from the broker)
CONTEXT_URL=http://localhost:3004/ngsi-context.jsonld

## The context URL as it can be reached by the broker
## The default value is shown below, it is applicable to the docker sample setup
CONTEXT_URL_BROKER=http://context/ngsi-context.jsonld

## JSON schema files representing classes that cannot occur as top-level entities (think of mixins). Default: not present
FILTERED_FILE_NAMES=ChemicalComposition

# Set max filter level (default: 2)
FILTER_NESTING_LEVEL=4
```

## Create a Docker image

See https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry

Build:

```bash
docker build -t ghcr.io/bfi-de/ngsild-graphql .
```

Tag image (adapt version):

```bash
docker tag ghcr.io/bfi-de/ngsild-graphql ghcr.io/bfi-de/ngsild-graphql:0.1.0
```

Publish image:

 * Create a personal access token (classic) here: https://github.com/settings/tokens/new?scopes=write:packages (see https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry#authenticating-to-the-container-registry)


```bash
docker login ghcr.io -u <GITHUB_USER> --password <ACCESS_TOKEN>
docker push ghcr.io/bfi-de/ngsild-graphql:0.1.0
docker push ghcr.io/bfi-de/ngsild-graphql:latest
```

Alternatively, leave out the version tag and provide the `--all-tags` option. Make sure not to overwrite old images this way. See https://docs.docker.com/engine/reference/commandline/push/.  

## Open

* authentication
* paging [limit + offset already available]
* properties of properties/relationships
* better http client than fetch
* ...

