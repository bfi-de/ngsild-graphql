import { Resolution, FindOptions } from "./index.js";
import { Config } from "./config.js";
import { Context } from "./context.js";

import fetch, { HeadersInit } from "node-fetch";
import { Conditions } from "./conditions.js";
import { ContextUtils } from "./contextUtils.js";

// WIP
// TODO unique entity id missing in this API?
// TODO implement filtering
export class CapriTwinResolution implements Resolution {

    /*
    * Values are list of subtypes, sepearated by ",", including the target type
    * Key: full type id, value: shortened type ids
    */
    private readonly subTypes: Record<string, string>; // FIXME remove?
    private readonly queryHeaders: HeadersInit = Object.freeze({
        Accept: "application/json",
        "Content-Type": "application/json"
    });

    constructor(
        private readonly config: Config, 
        typeHierarchy: Record<string, string|Array<string>>, 
        private readonly context: Context) {
        this.subTypes = ContextUtils.parseSubTypes(typeHierarchy, context); // FIXME
    }

    // FIXME there is no preferred entityId field!
    //FIXME do we need to include the typeId in the context key, besides the entityId? 
    findOne(context: Record<string, any>, fullTypeId: string, entityId?: string): Promise<any> {
        if (!fullTypeId && !entityId)
            throw new Error("Type or entity id must be provided");
        if (!entityId)
            return this.find(context, fullTypeId, {limit: 1}).then(arr => arr.length > 0 ? arr[0] : null);
        if (context?.cache && context.cache[entityId])
            return Promise.resolve(context.cache[entityId]);
        const url = this.config.capriTwinApiUrl + "/records-get";
        const body: Record<string, any> = {
            table: fullTypeId, // TODO likely need some sort of translation here
            //fields: [], // TODO which fields exist at all?? Required or optional?
            limit: 1 // ?
        };
        if (entityId) {
            body.where = {
                condition: "AND",
                fields: [{
                    condition: "=",
                    fields: ["id", entityId], // FIXME there is no preferred entityId field!
                }]
            };
        }

        return fetch(url, {
            headers: this.queryHeaders,
            method: "POST",
            body: JSON.stringify(body)
        })
        .then(resp => {
            if (!resp.ok)
                throw new Error(resp.status + ": " + resp.statusText);
            return resp.json();
        }).then(json => {
            context.cache = context.cache || {};
            context.cache[entityId] = json;
            return json;
        });
    }

    async find(context: Record<string, any>, fullTypeId: string, options?: FindOptions): Promise<any[]> {
        const limit: number = isFinite(options?.limit) && options?.limit > 0 ? options.limit : 10;
        let queryLimit: number = limit
        let offset: number = isFinite(options?.offset) ? options.offset : 0;
        const results: Array<any> = [];
        let size: number = 0;
        let cnt: number = 0;
        const url = this.config.capriTwinApiUrl + "/records-get";
        while (true) {
            const body: Record<string, any> = {
                table: fullTypeId.indexOf("/") >= 0 ? fullTypeId.substring(fullTypeId.lastIndexOf("/") + 1) : fullTypeId,
                //fields: [], // TODO which fields exist at all?? Required or optional?
                limit: queryLimit, // ?
                offset: offset
            };
            const resultInternal: [Array<Record<string, any>>, number] = await fetch(url, {
                headers: this.queryHeaders,
                method: "POST",
                body: JSON.stringify(body)
            })
            .then(resp => {
                if (!resp.ok)
                    throw new Error(resp.status + ": " + resp.statusText);
                return resp.json();
            }).then(async (allEntities: Array<Record<string, any>>) => {
                /*
                context.cache = context.cache || {};
                context.cache[entityId] = json;
                */ // TODO
                allEntities
                    .filter(entity => entity.id)
                    .forEach(entity => context.cache[entity.id] = entity);
                const filteredEntities: Array<any> = await this.filterEntities(allEntities, options?.filter, context);
                return [filteredEntities, allEntities.length] as [Array<Record<string, any>>, number];
            });
            const entities: Array<Record<string, any>> = resultInternal[0];
            const totalNumber: number = resultInternal[1];
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

    private async filterEntities(entities: Array<Record<string, any>>, filter: Record<string, any>, context?: any): Promise<Array<any>> {
        if (!filter)
            return entities;
        const filterConditions: Array<[string, any]> = Object.entries(filter);
        const result: Array<any> = [];
        entityLoop: for (const entity of entities) {
            for (const filterEntry of filterConditions) {
                const accept: boolean = await this.accept(entity, filterEntry, context);
                //console.log("    - accepted", accept);
                if (!accept)
                    continue entityLoop;
            }
            result.push(entity);
        }
        return result;
    }

    private async accept(entity: Record<string, any>, filterEntry: [string, Record<string, any>], context: any): Promise<boolean> {
        const key: string = filterEntry[0];
        const actualValue0: any = entity[key];
        let actualValue = actualValue0; 
        // TODO what about relationships in this API?
        /*
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
        */
        const condition: Record<string, any> = filterEntry[1];
        const isLeaveCondition: boolean = Conditions.isLeaveCondition(condition);
        if (!isLeaveCondition) { // this is either a relationship which we need to resolve, or a complex object and we need to look at nested props
            const deepCondition: Record<string, Record<string, any>> = condition;
            /*
            const isPropertyValue: boolean = actualValue0?.type === "Property" && typeof actualValue === "object";
            if (isPropertyValue) {
                */
                // case: nested condition on object
                for (const cond of Object.entries(deepCondition)) {
                    const accepted: boolean = await this.accept(actualValue, cond, context);
                    if (!accepted)
                        return false;
                }
                return true;
                /*
            }
            // TODO relationships
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
            */
        }
        const accepted: boolean = Object.entries(condition).find(cond => !Conditions.acceptFilterCondition(actualValue, cond)) === undefined;
        return accepted;
    }

}