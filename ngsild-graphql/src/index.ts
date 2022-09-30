import { SchemaBuilder } from "./schemaBuilder.js";
import express from "express/index.js";
import cors, { CorsOptions } from "cors";
import { graphqlHTTP } from "express-graphql";
import { GraphQLSchema, GraphQLScalarType } from "graphql";
import { Config } from "./config.js";
import { FiwareResolution } from "./fiwareResolution.js";
import { Context } from "./context.js";
import { ContextUtils } from "./contextUtils.js";
import { FileUtils } from "./files.js";
import { CapriTwinResolution } from "./capriTwinResolution.js";

export interface FindOptions {
    limit?: number;
    offset?: number;
    filter?: Record<string, Record<string, any>>;
}

export interface Resolution {

    findOne(context: Record<string, any>, typeId: string, entityId?: string): Promise<any>;
    find(context: Record<string, any>, typeId: string, options?: FindOptions): Promise<Array<any>>;
    findByReference?(context: Record<string, any>, field: string, targetEntityId: string, options?: FindOptions): Promise<Array<any>>;

}

async function main() {
    const config: Config = new Config();
    const schemasHierarchies  = await FileUtils.parseFiles(config);
    const hierarchies: Record<string, string|Array<string>> = schemasHierarchies[1];
    const jsonSchemas: Array<Record<string, any>> = schemasHierarchies[0];
    const context: [Context, string|undefined] = await ContextUtils.retrieveContext(config);
    const resolutionMethod: string = config.resolutionMethod?.toLowerCase();
    const resolution: Resolution = resolutionMethod === "capri" ? new CapriTwinResolution(config, hierarchies, context[0]) : 
        new FiwareResolution(config, hierarchies, context[0], context[1]);
    const graphSchemaBuilder: SchemaBuilder = new SchemaBuilder(jsonSchemas, resolution, config, hierarchies);
    const schema: GraphQLSchema = graphSchemaBuilder.build();
    const app = express();
    const graphql = graphqlHTTP({
        schema: schema,
        graphiql: config.showGraphiql,
    });
    if (config.corsOrigin) {
        const corsOptions: CorsOptions = {
            origin: config.corsOrigin === Config.CORS_ALL ? true : config.corsOrigin,
            maxAge: config.corsMaxAge
        };
        app.use("/graphql", cors(corsOptions), graphql);
    } else {
        app.use("/graphql", graphql);
    }
    if (config.showVoyagerGraph)
        app.use("/voyager", express.static("voyager"));
    app.listen(config.port);
    console.log("Base classes: [" + Object.entries(schema.getTypeMap())
        .filter(entry => !entry[0].startsWith("_") && !(entry[1] instanceof GraphQLScalarType))
        .map(entry => entry[0])
        .join(", ") + "]"
    );
    console.log("Running a GraphQL API server at localhost:" + config.port + "/graphql. Resolution: " + config.resolutionMethod);
}
main();

