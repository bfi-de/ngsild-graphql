import { GraphQLObjectType, GraphQLString, Thunk, GraphQLFieldConfigMap, GraphQLFieldConfig, GraphQLSchema, GraphQLScalarType, GraphQLType, GraphQLInt, GraphQLFloat, GraphQLBoolean, GraphQLList, GraphQLOutputType, GraphQLArgumentConfig, GraphQLUnionType, valueFromAST, GraphQLInputObjectType, GraphQLField, GraphQLInputType} from "graphql/index.js";
import { Config } from "./config.js";
import { Resolution, FindOptions } from "./index.js";

/**
 *  - generates filter property like in https://dgraph.io/docs/graphql/schema/search/
 *      // TODO do we really need to limit the nesting depth?
 */
export class SchemaBuilder {

    private readonly types: Array<GraphType> = [];
    // outer key: target full type name, inner key: fieldname
    private readonly inverseRelationships: Record<string, Record<string, Relationship>> = {};
    private readonly maxFilterNestingLevel: number;

    constructor(
        private readonly _schemas: Array<Record<string, any>>,
        private readonly _resolution: Resolution,
        private readonly config: Config,
        private readonly _hierarchies: Record<string, string|Array<string>>
        //private readonly _contexts: ReadonlyArray<string>
    ) {
        this.maxFilterNestingLevel = config.filterNestingLevel;
    }

    private static getId(schema: Record<string, any>, fullId?: boolean): string|null {
        let id0: string = schema["$id"];
        if (!id0) {
            console.log("Schema is missing $id field ", schema);
            return null;
        }
        if (!fullId) {
            const lastSlash: number = id0.lastIndexOf("/");
            if (lastSlash >= 0 && lastSlash < id0.length-1)
                id0 = id0.substring(lastSlash+1);
        }
        const lastDot: number = id0.lastIndexOf(".");
        if (lastDot > 0)
            id0 = id0.substring(0, lastDot);
        return id0;
    }

    private static getType(value: Record<string, any>): GraphQLOutputType {
        if (!value.type && (value.anyOf || value.oneOf)) { // XXX
            const arr = value.anyOf || value.oneOf;
            value = (arr as Array<any>).find(entry => entry.type?.toLowerCase() === "string")
                || (arr as Array<any>)[0];
        }
        const reportedType: string = value.type;
        switch (reportedType?.toLowerCase()) {
        case "int":
        case "integer":
            return GraphQLInt;
        case "float":
        case "number":
        case "double":
            return GraphQLFloat;
        case "boolean":
        case "bool":
            return GraphQLBoolean;
        case "string":
            return GraphQLString;
        case "array":
            if (value.items) {
                const subType: GraphQLType = SchemaBuilder.getType(value.items);
                if (subType)
                    return new GraphQLList(subType);
            }
            break;
        case "object":
            //  TODO??
        }
        return null;
    }

    private static getCustomType(allTypes: Array<GraphType>, typeId: string): GraphType {
        return allTypes.find(tp => tp.fullId === typeId) || allTypes.find(tp => tp.id === typeId);
    }

    private static isArrayRelationshipType(key: string, obj: Record<string, any>): boolean {
        if (obj?.type !== "array" || !obj.items)
            return false;
        return SchemaBuilder.isSingleRelationshipType(key, obj.items);
    }

    private static isSingleRelationshipType(key: string, value: Record<string, any>) {
        if (key === "id" || key === "type" || key.startsWith("@"))
            return false;
        if (!value.type && (value.anyOf || value.oneOf)) { // XXX
            const arr = value.anyOf || value.oneOf;
            return (arr as Array<any>).find(entry => SchemaBuilder.isNonNestedRelationshipType(entry)) !== undefined;
        }
        return SchemaBuilder.isNonNestedRelationshipType(value);
    }

    private static isNonNestedRelationshipType(value: Record<string, any>): boolean {
        if (!value.type)
            return false;
        if (value["x-ref-type"] || 
            value["@type"] === "@id" || value.type === "@id" /* A JSON-LD @context def, not strictly applicable here */ ||
            (value.type === "string" && value.format === "uri"))
            return true;
        return false;
    }

    private static resolveRelationship(source: any, key: string, typeId: string, resolution: Resolution, context: any): Promise<any> {
        let targetId: string|Array<string>;
        if (key in source && source[key]?.type === "Relationship") // complex NGSI-LD representation
            targetId = source[key].object;
        else // simplified representation
            targetId = source[key];
        if (!targetId)
            return Promise.resolve(null);
        // resolve object with targetId
        return typeof targetId === "string" ? resolution.findOne(context, typeId, targetId) : Promise.all(targetId.map(id => resolution.findOne(context, typeId, id)));

    }

    private static parseProperties(
            fullTypeId: string,
            schema: Record<string, any>, // a JSON schema for a single type
            allTypes: Array<GraphType>,  
            resolution: Resolution,
            incomingRelationships?: Record<string, Record<string, Relationship>>): Thunk<GraphQLFieldConfigMap<any, any>> {
        return () => Object.fromEntries(Object.entries({...schema.properties as Record<string, any>, _context: {type: "array", items: {type: "string"}}, ...(incomingRelationships[fullTypeId]||{})}).map((entry: [string, any]) => {
            const key: string = entry[0];
            const value: any = entry[1];
            const singleRelationship: boolean = SchemaBuilder.isSingleRelationshipType(key, value);
            const arrayRelationship: boolean = SchemaBuilder.isArrayRelationshipType(key, value);
            const relationshipType: boolean = singleRelationship||arrayRelationship;
            const isIncomingRelationship: boolean = !relationshipType && !!(value as Relationship).sourceFullId && !!(value as Relationship).targetFullId;
            // TODO this way we can only resolve relationship types where the ["x-ref-type"] field is present
            let type: GraphQLType|undefined;
            if (arrayRelationship) {
                type = SchemaBuilder.getCustomType(allTypes, value.items["x-ref-type"])?.type;
                if (type)
                    type = new GraphQLList(type);
            } else if (singleRelationship) {
                type = SchemaBuilder.getCustomType(allTypes, value["x-ref-type"])?.type;
            } else if (isIncomingRelationship) {
                type = SchemaBuilder.getCustomType(allTypes, (value as Relationship).sourceFullId)?.type;
                if (type)
                    type = new GraphQLList(type);
            } else {
                type = SchemaBuilder.getType(value);   
            }
            if (!type) {
                console.log("Reference type not found for entry", key + " (type:", value.type + "), for schema", (schema.id || schema["$id"] || schema["@id"]));
                return null;
            }
            const config: GraphQLFieldConfig<any,any> = {
                type: type,
                resolve: (source: any, args: any, context: any): any => {
                    if (key === "_context") {// FIXME would be better to query them from the entity!
                        //return Promise.resolve(contexts);
                        const ctx: Array<string> = source ? source["@context"] : null;
                        return ctx?.length > 0 ? ctx : null;
                    }
                    if (relationshipType) {
                        const handler: GraphType = SchemaBuilder.getCustomType(allTypes, arrayRelationship ? value.items["x-ref-type"] : value["x-ref-type"])!;
                        const typeId: string = handler.fullId /* handler.id*/;
                        return SchemaBuilder.resolveRelationship(source, key, typeId, resolution, context)
                            .catch(e => {
                                // in this case, an invalid URL is provided (to a non-existing entity)
                                if (e?.message?.startsWith("404"))
                                    return null;
                                throw e;
                            });
                    }
                    if (isIncomingRelationship) {
                        const rel: Relationship = value;
                        const results = resolution.findByReference(context, rel.originalField, source.id);
                        return results;
                    }
                    if (key in source && source[key]?.type === "Property") // complex ngsi-ld representation
                        return source[key].value;
                    return source[key]; // simplified ngsi-ld representation 
                }
            };
            if (value.description)
                config.description = value.description;
            else if (value.enum instanceof Array)
                config.description = "Enum [" + value.enum.join(", ") + "]";
            return [key, config] as [string, GraphQLFieldConfig<any,any>];
        }).filter(e => e));
    }

    private static readonly OBJECT_INPUT_FILTER: GraphQLInputObjectType = new GraphQLInputObjectType({
        name: "_ObjectInputFilter",
        fields: {
            exists: { type: GraphQLBoolean }
        }
    });
    private static STRING_INPUT_FILTER: GraphQLInputObjectType = new GraphQLInputObjectType({
        name: "_StringInputFilter",
        fields: {
            exists: { type: GraphQLBoolean },
            eq: { type: GraphQLString },
            in: { type: new GraphQLList(GraphQLString)},
            startsWith: { type: GraphQLString },
            endsWith: { type: GraphQLString },
            contains: { type: GraphQLString },
            geq: { type: GraphQLString },
            gt: { type: GraphQLString },
            leq: { type: GraphQLString },
            lt: { type: GraphQLString }
        }
    });
    private static INT_INPUT_FILTER: GraphQLInputObjectType = new GraphQLInputObjectType({
        name: "_IntInputFilter",
        fields: {
            exists: { type: GraphQLBoolean },
            eq: { type: GraphQLInt },
            in: { type: new GraphQLList(GraphQLInt)},
            geq: { type: GraphQLInt },
            gt: { type: GraphQLInt },
            leq: { type: GraphQLInt },
            lt: { type: GraphQLInt }
        }
    });
    private static FLOAT_INPUT_FILTER: GraphQLInputObjectType = new GraphQLInputObjectType({
        name: "_FloatInputFilter",
        fields: {
            exists: { type: GraphQLBoolean },
            eq: { type: GraphQLFloat },
            in: { type: new GraphQLList(GraphQLFloat)},
            geq: { type: GraphQLFloat },
            gt: { type: GraphQLFloat },
            leq: { type: GraphQLFloat },
            lt: { type: GraphQLFloat }
        }
    });
    private static BOOLEAN_INPUT_FILTER: GraphQLInputObjectType = new GraphQLInputObjectType({
        name: "_IntInputFilter",
        fields: {
            exists: { type: GraphQLBoolean },
            eq: { type: GraphQLBoolean }
        }
    });

    private static inputFilterForType(type: GraphQLOutputType, filterTypesRegistry: Map<string, GraphQLInputObjectType>, maxLevel: number, level: number): GraphQLInputType {
        switch (type) {
        case GraphQLString:
            return SchemaBuilder.STRING_INPUT_FILTER;
        case GraphQLInt:
            return SchemaBuilder.INT_INPUT_FILTER;
        case GraphQLFloat:
            return SchemaBuilder.FLOAT_INPUT_FILTER;
        case GraphQLBoolean:
            return SchemaBuilder.BOOLEAN_INPUT_FILTER;
        default:
            if (level < maxLevel && typeof (type as GraphQLObjectType).getFields === "function") { // TODO max level configurable
                const nestedType: GraphQLInputObjectType = SchemaBuilder.inputFilterTypeForType(type as GraphQLObjectType, filterTypesRegistry, maxLevel, level + 1);
                return nestedType;
            }
            return SchemaBuilder.OBJECT_INPUT_FILTER;
        }
    }

    private static inputFilterTypeForType(type: GraphQLObjectType, filterTypesRegistry: Map<string, GraphQLInputObjectType>, maxLevel: number, level?: number): GraphQLInputObjectType {
        level = level || 0;
        const fields: Record<string, {type: GraphQLInputType}> = Object.fromEntries(Object.entries(type.getFields())
            .filter(entry => entry[0] !== "_context")
            .map(entry => {
                const field: GraphQLField<any,any> = entry[1];
                return [entry[0], { type: SchemaBuilder.inputFilterForType(field.type, filterTypesRegistry, maxLevel, level) }];
            }));
        if (level > 0 && !fields.exists)
            fields["exists"] =  { type: GraphQLBoolean };
        const filterTypeName: string = "_" + type.name + "Filter" + (level > 0 ? "_" + level : "");
        if (filterTypesRegistry.has(filterTypeName))
            return filterTypesRegistry.get(filterTypeName);
        const filterType: GraphQLInputObjectType = new GraphQLInputObjectType({
            name: filterTypeName,
            fields: fields
        });
        filterTypesRegistry.set(filterTypeName, filterType);
        return filterType;
    }

    build(): GraphQLSchema {
        for (let schema of this._schemas) {
            const type: GraphType|null = this._build(schema);
            if (type)
                this.types.push(type);
        }
        const singleQueryFields: Thunk<GraphQLFieldConfigMap<any, any>> = Object.fromEntries(this.types.map(tp => [tp.id, {
            type: tp.type,
            args: { id: { type: GraphQLString, description: "The entity id" }},
            resolve: (_source: undefined, args: {id: string}, context: any): Promise<any> => this._resolution.findOne(context, tp.fullId /*tp.id*/, args?.id)
        }]));
        const filterTypesRegistry: Map<string, GraphQLInputObjectType> = new Map();
        const multipleQueryFields: Thunk<GraphQLFieldConfigMap<undefined, any>> = Object.fromEntries(this.types.map(tp => [SchemaBuilder._pluralize(tp.id), {
            type: new GraphQLList(tp.type),
            args: { 
                limit: { type: GraphQLInt, description: "The maximum number of entities to return" },
                offset: { type: GraphQLInt, description: "The entity id to start with (excluded)" },
                filter: { type: SchemaBuilder.inputFilterTypeForType(tp.type, filterTypesRegistry, this.maxFilterNestingLevel), description: "Filter based on attribute values." }
            },
            resolve: (_source: undefined, args: FindOptions, context: any): Promise<Array<any>> => 
                    this._resolution.find(context, tp.fullId /*tp.id*/, args)
        }]));
        const queryType: GraphQLObjectType = new GraphQLObjectType({
            name: "Query",
            fields: {...singleQueryFields, ...multipleQueryFields}
        });
        const schema = new GraphQLSchema({query: queryType});
        return schema;
    }

    _build(schema0: Record<string, any>): GraphType|null {
        if (!schema0?.properties) {
            console.log("Schema is missing properties", schema0)
            return null;
        }
        const id: string = SchemaBuilder.getId(schema0);
        if (!id)
            return null;
        const fullTypeId: string = SchemaBuilder.getId(schema0, true);
        if (this._resolution && !this.config.reverseRelationshipsDisabled)
            this.parseRelationships(fullTypeId, schema0, this.inverseRelationships); // by side-effects: add relationship targets for this type to this.relationships map
        const type = new GraphQLObjectType({
            name: id,
            // note: this returns a function, so it is ok if not all types are present yet in this.types at the time of creation
            fields: SchemaBuilder.parseProperties(fullTypeId, schema0, this.types, this._resolution, this.inverseRelationships)
        });
        return {
            id: id,
            fullId: fullTypeId,
            type: type,
        };  
    }

    private parseRelationships(sourceTypeId: string, schema: Record<string, any>, relationships: Record<string, Record<string, Relationship>>) {
        Object.entries(schema.properties).forEach(([key, value]: [string, any]) => {
            if (key in this.config.disabledReverseRelationships || (this.config.enabledReverseRelationships.length > 0 && this.config.enabledReverseRelationships.indexOf(key) < 0))
                return;
            const singleRelationship: boolean = SchemaBuilder.isSingleRelationshipType(key, value);
            const arrayRelationship: boolean = SchemaBuilder.isArrayRelationshipType(key, value);
            if (!singleRelationship && !arrayRelationship)  
                return;
            let type: string = arrayRelationship ? value.items["x-ref-type"] : value["x-ref-type"];
            if (!type)
                return;
            if (type.indexOf("/") < 0) { // need to make sure that type is the full type id of the target
                const targetSchema = this._schemas.find(schema => SchemaBuilder.getId(schema, false) === type);
                if (!targetSchema)
                    return;
                type = SchemaBuilder.getId(targetSchema, true);
            }
            if (!(type in relationships))
                relationships[type] = {};
            const newKey: string = this.config.reverseRelationshipMaps[key] || key + "Reverse";
            if (newKey in relationships[type]) { // determine whether the new source type is a subtype of the old; then do not replace it
                const existingSourceType: string = relationships[type][newKey].sourceFullId;
                const hierarchyNew = this._hierarchies[sourceTypeId];
                if (hierarchyNew && hierarchyNew === existingSourceType || (Array.isArray(hierarchyNew) && hierarchyNew.indexOf(existingSourceType) >= 0))
                    return;
            }
            relationships[type][newKey] = { sourceFullId: sourceTypeId, targetFullId: type, field: newKey, originalField: key};
        });
    }

    private static _pluralize(word: string): string {
        if (!word)
            return word;
        if (word.endsWith("y"))
            return word.substring(0, word.length-1) + "ies";
        return word + "s";
    }

}

interface GraphType {
    id: string;
    fullId: string;
    type: GraphQLObjectType;
}

interface Relationship {
    // note: in principle multiple sources are feasible for the same field and target => make this an Array?
    sourceFullId: string;
    targetFullId: string;
    field: string;  // e.g. partOfReverse
    originalField: string; // e.g. partOf
}
