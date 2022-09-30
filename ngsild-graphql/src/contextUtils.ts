import { Config } from "./config.js";
import { Context, getContextObject } from "./context.js";
import fetch, { Response } from "node-fetch";

export class ContextUtils {

    /**
     * Returns the context content as json, and the URL under which the
     * broker can access the context. There are four cases to consider:
     * 
     *  - if both the URL for the broker and the app have been specified (potentially the same URL),
     *     then the context will be queried from the app URL and the returned broker path 
     *     will be the configured one
     *  - if the broker URL has not been specified in the configuration but the URL for the app has, then 
     *     the context will be queried and posted to the broker. The returned URL will point to the 
     *     broker's context path 
     *     (see https://github.com/FIWARE/context.Orion-LD/blob/develop/doc/manuals-ld/contextServer.md)
     *  - if the broker URL has been specified but none for the app, then the broker URL will be posted 
     *     to the broker and subsequently the context content downloaded from the broker
     *  - if no URLs are specified at all, then no context will be available
     * 
     * @param config 
     */
    static async retrieveContext(config: Config): Promise<[Context, string|undefined]> {
        let _ctx: Record<string, any>|null = null; // actual context content
        let brokerUrl: string|undefined = config.contextUrlForBroker; // URL under which the broker will access the content
        if (config.contextUrlInternal) {
            const getContext = async (): Promise<Record<string, any>> => {
                const contextResp: Response = await fetch(config.contextUrlInternal);
                if (!contextResp.ok)
                    throw new Error("Failed to retrieve context from " + config.contextUrlInternal + ": " + contextResp.status + ", " + contextResp.statusText);
                return (await contextResp.json())["@context"];
            }
            _ctx = await ContextUtils.retry(getContext, 20);
        }
        else if (config.contextUrlForBroker) {
            // POST context URL to broker and retrieve content from it
            _ctx = await ContextUtils.getOrCreateContext(config.ngsiBaseUrl, config.contextUrlForBroker);
        }
        if (_ctx && !brokerUrl) {
            // POST context to broker and retrieve broker internal id/URL
            try {
                brokerUrl = await ContextUtils._postContextToBroker(JSON.stringify(_ctx), config.ngsiBaseUrl);
            } catch(e) {} // XXX?
        }
        const context: Context = getContextObject(Object.freeze(_ctx));
        console.log("Context", _ctx);
        return [context, brokerUrl];
    }

    // returns the context content
    private static async getOrCreateContext(baseUrl: string, contextUrlBroker: string): Promise<Record<string, any>> {
        let contextUrl: string = await ContextUtils.getContextByUrl(baseUrl, contextUrlBroker);
        if (!contextUrl) {
            // one would expect the result to be the desired url, but this is not the case for orion-ld (as of 2021-11-22);
            // instead it creates two internal contexts, and we need the other one
            await ContextUtils._postContextToBroker("[\"" + contextUrlBroker + "\"]", baseUrl);
            contextUrl = await ContextUtils.getContextByUrl(baseUrl, contextUrlBroker);
        }
        if (!contextUrl)
            throw new Error("Context for URL " + contextUrlBroker + " not created");
        const ctxResp: Response = await fetch(contextUrl, {
            headers: { Accept: "application/ld+json" }
        });
        if (!ctxResp.ok)
            throw new Error("Failed to retrieve context content from broker " + ctxResp.status + ": " + ctxResp.statusText);
        return (await ctxResp.json())["@context"];
    }

    private static async getContextByUrl(baseUrl: string, contextUrlBroker: string): Promise<string> {
        const contextsUrl: string = baseUrl + "/jsonldContexts?details=true";
        const resp: Response = await fetch(contextsUrl, {
            headers: {
                Accept: "application/json"
            }
        });
        if (!resp.ok)
            throw new Error("Failed to retrieve contexts list from broker " + resp.status + ": " + resp.statusText);
        const contexts: Array<{url: string, id: string}> = await resp.json() as any;
        for (const entry of contexts) {
            if (entry.url === contextUrlBroker)
                return baseUrl + "/jsonldContexts/" + entry.id;
        }
        return undefined;
    }

    /*
     * Returns the URL of the context as served by the broker under the ngsi-ld/v1/jsonldContexts path
     */
    private static async _postContextToBroker(body: string, baseUrl: string): Promise<string> {
        const contextSuffix: string = "/jsonldContexts";
        const contextsUrl: string = baseUrl + contextSuffix;
        const send = async (): Promise<string> => {
            const resp: Response = await fetch(contextsUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: body
            });
            if (!resp.ok || !resp.headers.has("Location"))
                throw new Error("Failed to POST context to broker " + resp.status + ": " + resp.statusText + ", broker url: " + contextsUrl);
            const location: string = resp.headers.get("Location");
            await resp.arrayBuffer();
            const lastIdx: number = location.lastIndexOf(contextSuffix + "/");
            if (lastIdx < 0)
                throw new Error("Failed to parse context location " + location);
            return contextsUrl + "/" + location.substring(lastIdx+contextSuffix.length + 1);
        };
        return ContextUtils.retry(send, 3, 2_000);
    }

    static parseSubTypes(typeHierarchy: Record<string, string|Array<string>>, context: Context): Record<string, string> {
        const hierarchy: Record<string, Set<string>> = {};
        for (const entry of Object.entries(typeHierarchy)) {
            const key: string = entry[0];
            const value: string|Array<string> = entry[1];
            const parents: Array<string> = Array.isArray(value) ? value : [value];
            parents.forEach(parent => {
                if (!(parent in hierarchy))
                    hierarchy[parent] = new Set();
                hierarchy[parent].add(key);
            });
        }
        return Object.fromEntries(Object.entries(hierarchy)
            .map(entry => [entry[0],  context.getShortTerm(entry[0]) + "," + Array.from(entry[1]).map(fullType => context.getShortTerm(fullType)).join(",")]));
    }

    private static async retry<T>(operation: () => Promise<T>, retries: number, waitMillis=100, waitFactor: number=0, err: any = undefined): Promise<T> {
        if (!(retries > 0))
            return Promise.reject(err || "Retries exceeded");
        if (waitFactor > 0)
            await new Promise((resolve, _) => setTimeout(resolve, waitFactor * waitMillis));
        return operation().catch(e => ContextUtils.retry(operation, retries-1, waitMillis, waitFactor+1, e));
    }

}
