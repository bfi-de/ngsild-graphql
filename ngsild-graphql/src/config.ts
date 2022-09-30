import * as dotenv from "dotenv";
dotenv.config();

export class Config {

    static readonly CORS_ALL: string = "__ALL";
    // possible values: __ALL, or a specific domain; default: empty
    readonly corsOrigin: string;
    private static readonly DEFAULT_CORS_MAX_AGE: number = 86400; // seconds; 1 day
    readonly corsMaxAge: number;

    private static readonly DEFAULT_RESOLUTION_METHOD = "fiware";
    readonly resolutionMethod: "capri"|"fiware";

    private static readonly DEFAULT_PORT: number = 4000;
    readonly port: number;

    // will append /ngsi-ld/v1
    private static readonly DEFAULT_NGSI_BASE_URL: string = "http://localhost:1026";
    readonly ngsiBaseUrl: string;

    private static readonly DEFAULT_BASE_FOLDER: string = "../model";
    readonly baseFolder: string;

    private static readonly DEFAULT_FILTERED_FILE_NAMES: string = "sample";
    readonly filteredFileNames: ReadonlyArray<string>;

    private static readonly DEFAULT_FILTERED_FOLDER_NAMES: string = "";
    readonly filteredFolderNames: ReadonlyArray<string>;

    private static readonly DEFAULT_SIMPLIFIED_REPRESENTATION: boolean = false;
    readonly useSimplifiedNgsiLdRepresentation: boolean;

    private static readonly DEFAULT_FILTER_NESTING_LEVEL: number = 2;
    readonly filterNestingLevel: number;

    readonly reverseRelationshipsDisabled: boolean; // default: false
    // default: empty
    readonly reverseRelationshipMaps: Record<string, string>;
    // default: empty (implying that all are enabled, except when enabledReverseRelationships is set)
    readonly disabledReverseRelationships: ReadonlyArray<string>;
    // default: empty (implying that all are enabled, except the disabled ones)
    readonly enabledReverseRelationships: ReadonlyArray<string>;


    /**
     * Default: false
     * Default context setting if none is specified but contextDisabled is false is:
     * 
     * contextUrlForBroker = http://context/ngsi-context.jsonld
     * contextUrlInternal  = undefined
     */    
    readonly contextDisabled: boolean;
    readonly contextUrlInternal: string|undefined;
    readonly contextUrlForBroker: string|undefined;
    /**
     * Adapted to a docker-compose setup, where the context server is accessible at hostname "context"
     */
    private static readonly DEFAULT_CONTEXT_URL_BROKER: string = "http://context/ngsi-context.jsonld";

    private static readonly DEFAULT_CAPRI_TWIN_API_URL: string = "http://localhost:3002/api";
    readonly capriTwinApiUrl: string;

    /**
     * Provide a visualization of the GraphQL schema under the path /voyager ?
     * Default: true
     */
    readonly showVoyagerGraph: boolean;

    readonly showGraphiql: boolean;

    constructor() {
        this.port = parseInt(process.env.PORT) || Config.DEFAULT_PORT;
        let url = process.env.NGSI_BASE_URL || Config.DEFAULT_NGSI_BASE_URL;
        while (url.endsWith("/"))
            url = url.substring(0, url.length-1);
        this.ngsiBaseUrl = url + "/ngsi-ld/v1";
        this.resolutionMethod = process.env.RESOLUTION_METHOD as any || Config.DEFAULT_RESOLUTION_METHOD;
        let folder: string = process.env.BASE_FOLDER || Config.DEFAULT_BASE_FOLDER;
        while (folder.endsWith("/"))
            folder = folder.substring(0, folder.length-1);
        if (!folder)
            folder = ".";
        this.baseFolder = folder;
        this.filteredFileNames = Object.freeze((process.env.FILTERED_FILE_NAMES || Config.DEFAULT_FILTERED_FILE_NAMES)
            .split(",")
            .map(fl => fl.trim())
            .map(fl => {
                if (fl.toLowerCase().endsWith(".json"))
                    fl = fl.substring(0, fl.length - 5);
                return fl;
            })
            .filter(fl => fl));
        this.filteredFolderNames = Object.freeze((process.env.FILTERED_FOLDER_NAMES || Config.DEFAULT_FILTERED_FOLDER_NAMES)
            .split(",")
            .map(fl => fl.trim())
            .filter(fl => fl));
        this.useSimplifiedNgsiLdRepresentation = process.env.SIMPLIFIED_REPRESENTATION?.toLowerCase() === "true";
        const level: number = parseInt(process.env.FILTER_NESTING_LEVEL);
        this.filterNestingLevel = isFinite(level) ? level : Config.DEFAULT_FILTER_NESTING_LEVEL;
        // context related stuff
        const ctxDisabled: string|undefined = process.env.CONTEXT_DISABLED?.toLowerCase();
        this.contextDisabled = ctxDisabled === "true" || ctxDisabled === "1";
        if (!this.contextDisabled) {
            let ctxInternal: string = process.env.CONTEXT_URL;
            let ctxBroker: string  = process.env.CONTEXT_URL_BROKER;
            if (!ctxInternal && !ctxBroker)
                ctxBroker = Config.DEFAULT_CONTEXT_URL_BROKER;
            this.contextUrlInternal = ctxInternal;
            this.contextUrlForBroker = ctxBroker;
        }
        this.showVoyagerGraph = process.env.SHOW_VOYAGER_GRAPH?.toLowerCase() !== "false";
        this.showGraphiql = process.env.SHOW_GRAPHIQL?.toLowerCase() !== "false";
        this.corsOrigin = process.env.CORS_ORIGIN;
        const corsMaxAge: number = parseInt(process.env.CORS_MAX_AGE);
        this.corsMaxAge = isFinite(corsMaxAge) ? corsMaxAge : Config.DEFAULT_CORS_MAX_AGE;
        let twinUrl = process.env.CAPRI_TWIN_API_URL || Config.DEFAULT_CAPRI_TWIN_API_URL;
        while (twinUrl.endsWith("/"))
            twinUrl = twinUrl.substring(0, twinUrl.length-1);
        this.capriTwinApiUrl = twinUrl;

        this.reverseRelationshipMaps = Object.freeze(Object.fromEntries((process.env.REVERSE_RELATIONSHIPS_MAP || "").split(",")
            .map(el => el.split("="))
            .filter(arr => arr.length === 2)
            .map(([key, value]) => [key.trim(), value.trim()])
            .filter(([key, value]) => key && value)));
        this.enabledReverseRelationships = Object.freeze((process.env.ENABLED_REVERSE_RELATIONSHIPS || "").split(",")
            .filter(e => !!e));
        this.disabledReverseRelationships = Object.freeze((process.env.DISABLED_REVERSE_RELATIONSHIPS || "").split(",")
            .filter(e => !!e));
        this.reverseRelationshipsDisabled = !!process.env.REVERSE_RELATIONSHIPS_DISABLED;
    }

}