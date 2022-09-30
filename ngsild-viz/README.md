# NGSI-LD GraphQL visualization

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

Once the app is running the frontend will be available at *http://localhost:8080*.

## Configuration

Configurations can be set either in the *assets/config.json* file or via URL parameters. There are two template configuration files for the *Buildings* and *Steel* sample data models in the *assets* folder. 

Example config.json:

```json
{
    "server": "http://localhost:4000/graphql",
    "initialLayout": "grid",
    ...
}
```

