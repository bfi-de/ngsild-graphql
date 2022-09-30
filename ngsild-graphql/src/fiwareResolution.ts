import { Resolution, FindOptions } from "./index.js";
import { Config } from "./config.js";
import fetch, { HeadersInit } from "node-fetch";
import { Context } from "./context.js";
import { Conditions } from "./conditions.js";
import { ContextUtils } from "./contextUtils.js";

/**
 * Uses an externally provided @context to translate full type ids to short type names and v.v.
 */
export class FiwareResolution implements Resolution {

    private static readonly DEFAULT_LIMIT: number = 10;

    /*
    * Values are list of subtypes, sepearated by ",", including the target type
    * Key: full type id, value: shortened type ids
    */
    private readonly subTypes: Record<string, string>;
    private readonly queryHeaders: HeadersInit;

    constructor(
            private readonly config: Config, 
            typeHierarchy: Record<string, string|Array<string>>, 
            private readonly context: Context,
            contextUrlBroker: string|undefined) {
        this.subTypes = ContextUtils.parseSubTypes(typeHierarchy, context);
        this.queryHeaders = {
            Accept: config.useSimplifiedNgsiLdRepresentation ? "application/json" : "application/ld+json"
        };
        if (contextUrlBroker)
            this.queryHeaders.Link = "<" + contextUrlBroker + ">; rel=\"http://www.w3.org/ns/json-ld#context\"; type=\"application/ld+json\"";
    }

    findOne(context: any, fullTypeId?: string, entityId?: string): Promise<any> {
        if (!fullTypeId && !entityId)
            throw new Error("Type or entity id must be provided");
        if (!entityId)
            return this.find(context, fullTypeId, {limit: 1}).then(arr => arr.length > 0 ? arr[0] : null);
        if (context?.cache && context.cache[entityId])
            return Promise.resolve(context.cache[entityId]);
        const url = this.config.ngsiBaseUrl + "/entities/" + encodeURIComponent(entityId); // TODO typeId?
        return fetch(url, {
            headers: this.queryHeaders
        })
        .then(resp => {
            if (!resp.ok)
                throw new Error(resp.status + ": " + resp.statusText);
            const link: string|null = resp.headers.get("Link"); 
            return Promise.all([Promise.resolve(link), resp.json()]) as Promise<[string|null, any]>;
        }).then(linkJson => {
            const link: string = linkJson[0];
            const json = FiwareResolution.fixNestedEntities([linkJson[1]])[0];
            FiwareResolution.attachContexts(link, [json]);
            FiwareResolution.fixContexts([json]);
            context.cache = context.cache || {};
            context.cache[entityId] = json;
            return json;
        });
    }

    async find(context: any, fullTypeId: string, options?: FindOptions): Promise<any[]> {
        return this.findArray(context,fullTypeId, undefined, options);
    }

    async findArray(context: any, fullTypeId: string,targetFilter: string|undefined, options?: FindOptions): Promise<any[]> {
        const limit: number = isFinite(options?.limit) && options?.limit > 0 ? options.limit : FiwareResolution.DEFAULT_LIMIT;
        let queryLimit: number = limit
        let offset: number = isFinite(options?.offset) ? options.offset : 0;
        const results: Array<any> = [];
        let size: number = 0;
        let cnt: number = 0;
        while (true) {
            const resInternal = await this.findInternal(context, fullTypeId, targetFilter, queryLimit, offset, options);
            const entities: Array<any> = resInternal[0];
            const totalNumber: number = resInternal[1];
            const matchingNumber: number = entities.length;
            if (size + matchingNumber <= limit) {
                results.push(...entities);
                size += matchingNumber;
            } else {
                results.push(...entities.slice(0, limit-size));
                size = limit;
                break;
            }
            if (totalNumber <= matchingNumber || size >= limit)
                break;
            offset += totalNumber;
            cnt++;
            if (queryLimit < 100 && ((cnt > 2 && size < 10) || cnt > 10))
                queryLimit = 100; // avoid too many requests
        }
        return results;
    }

    async findByReference(context: Record<string, any>, field: string, targetEntityId: string, options?: FindOptions): Promise<any[]> {
        if (!targetEntityId || !field)
            return Promise.resolve([]);
        return this.findArray(context, undefined, encodeURIComponent(field + "==\"" + targetEntityId +"\""), options);
    } 

    /**
     * Returns matching elements plus number of elements returned from backend query
     * @param context 
     * @param fullTypeId 
     * @param limit 
     * @param options 
     */
    findInternal(context: any, fullTypeId: string|undefined, targetFilter: string|undefined, limit: number, offset: number, options?: FindOptions): Promise<[any[], number]> {
        let url: string;
        if (fullTypeId) {
            const typeQuery: string = this.subTypes[fullTypeId] || this.context.getShortTerm(fullTypeId);
            url = this.config.ngsiBaseUrl + "/entities?type=" + encodeURIComponent(typeQuery);
        } else {
            url = this.config.ngsiBaseUrl + "/entities?q=" + targetFilter;
        }
        url += "&limit=" + limit;
        url += "&offset=" + offset;
        return fetch(url, {
            headers: this.queryHeaders
        })
        .then(resp => {
            if (!resp.ok)
                throw new Error(resp.status + ": " + resp.statusText);
            const link: string|null = resp.headers.get("Link"); 
            return Promise.all([Promise.resolve(link), resp.json()]) as Promise<[string|null, Array<any>]>;
        }).then(async linkJson => {
            const link: string = linkJson[0];
            const entities: Array<any> = FiwareResolution.fixNestedEntities(linkJson[1]);
            FiwareResolution.attachContexts(link, entities);
            FiwareResolution.fixContexts(entities);
            context.cache = context.cache || {};
            entities
                .filter(entity => entity.id)
                .forEach(entity => context.cache[entity.id] = entity);
            const filteredEntities: Array<any> = await this.filterEntities(entities, options?.filter, context);
            return [filteredEntities, entities.length] as [Array<any>, number];
        });
    }

    /**
     * Deal with properties of the form 
     * {
     *    "type": "Property",
     *    "value": {
     *        "@type": "DateTime",
     *        "@value": "2021-06-11T10:00:00+02:00"
     *    }  
     * }
     * Convert to standard value form "value": "2021-06-11T10:00:00+02:00"
     * @param entities 
     */
    private static fixNestedEntities(entities: Array<any>): Array<any> {
        for (const entity of entities) {
            if (typeof entity !== "object")
                continue;
            const values: Array<unknown> = Object.values(entity);
            for (const value0 of values) {
                const value: any = value0 as any;
                if (typeof value === "object" && "value" in value && typeof value.value === "object" && "@value" in value.value)
                    value.value = value.value["@value"];
            }
        }
        return entities;
    }

    private async filterEntities(entities: Array<any>, filter: Record<string, any>, context?: any): Promise<Array<any>> {
        if (!filter)
            return entities;
        const filterConditions: Array<[string, any]> = Object.entries(filter);
        const result: Array<any> = [];
        entityLoop: for (const entity of entities) {
            for (const filterEntry of filterConditions) {
                const accept: boolean = await this.accept(entity, filterEntry, context);
                if (!accept)
                    continue entityLoop;
            }
            result.push(entity);
        }
        return result;
    }

    // TODO here we need to know whether the field is a relationship or not
    private async accept(entity: any, filterEntry: [string, Record<string, any>], context: any): Promise<boolean> {
        const key: string = filterEntry[0];
        const actualValue0: any = entity[key];
        let actualValue = actualValue0;
        if (actualValue0?.type) {
            switch(actualValue0.type) {
            case "Property":
                actualValue = actualValue0.value;
                break;
            case "Relationship":
                actualValue = actualValue0.object;
                break;
            default: 
                // ?
            }
            if (actualValue["@value"])
                actualValue = actualValue["@value"];
        }
        const condition: Record<string, any> = filterEntry[1];
        const isLeaveCondition: boolean = Conditions.isLeaveCondition(condition);
        if (!isLeaveCondition) { // this is either a relationship which we need to resolve, or a complex object and we need to look at nested props
            const deepCondition: Record<string, Record<string, any>> = condition;
            const isPropertyValue: boolean = actualValue0?.type === "Property" && typeof actualValue === "object";
            if (isPropertyValue) {
                // case: nested condition on object
                for (const cond of Object.entries(deepCondition)) {
                    const accepted: boolean = await this.accept(actualValue, cond, context);
                    if (!accepted)
                        return false;
                }
                return true;
            }
            const isRelationshipValue: boolean = actualValue0?.type === "Relationship";
            const targetEntity: any = (!isRelationshipValue || !actualValue) ? null : await this.findOne(context, undefined, actualValue);
            if (!targetEntity) { // e.g. value may not be present at all
                // check if somewhere nested in the filter object there is something else than { exists: false }. If so, return false, else true.
                return Object.values(deepCondition).find(cond => Conditions.requiresExistence(cond)) === undefined;
            }
            for (const cond of Object.entries(deepCondition)) {
                const accepted: boolean = await this.accept(targetEntity, cond, context);
                if (!accepted)
                    return false;
            }
            return true;
        }
        const accepted: boolean = Object.entries(condition).find(cond => !Conditions.acceptFilterCondition(actualValue, cond)) === undefined;
        return accepted;
    }


    // by side effects on entities
    private static attachContexts(linkHeader: string, entities: Array<any>) {
        if (!linkHeader)
            return;
        // The Link header typically contains the @context information
        // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Link
        const contexts: Array<string> = linkHeader.split(",")
            .map(l => {
                const firstSemi: number = l.indexOf(";");
                if (firstSemi >= 0)
                    l = l.substring(0, firstSemi);
                return l.trim();
            }).filter(l => l);
        if (contexts.length <= 0)
            return;
        entities.forEach(json => {
            if (!json["@context"])
                json["@context"] = contexts;
        });
    }

    // by side effects on entities
    private static fixContexts(entities: Array<any>) {
        entities.forEach(json => {
            if (typeof json["@context"] === "string")
                json["@context"] = [json["@context"]];
        })
    }

}