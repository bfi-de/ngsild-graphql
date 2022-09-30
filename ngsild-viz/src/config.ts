import { EdgeLabelLocation, GraphStyleOptions, NoteLocation, NoteOptions, PropertySelector } from "./graph/model.js";

export class Config implements Config0 {

    // GraphQL server
    private static readonly DEFAULT_SERVER: string = "http://localhost:4000/graphql";
    readonly server: string;
    private static readonly DEFAULT_INITIAL_QUERY: string = "{\n  Rooms {\n    id\n  }\n}";
    readonly initialQuery: string;
    readonly initialGroups?: Array<Array<string>>;
    private static readonly DEFAULT_INITIAL_LAYOUT: string = "grid";
    readonly initialLayout: string;
    private static readonly DEFAULT_WHEEL_SENSITIVITY: number = 0.4;
    readonly wheelSensitivity: number;

    readonly initialGraphStyle: GraphStyleOptions;

    private static readonly DEFAULT_NODE_BACKGROUND_COLOR: string = "rgba(58, 126, 207, 1)"; // #3a7ecf
    private static readonly DEFAULT_NODE_TEXT_COLOR: string = "rgba(255, 255, 255, 1)"; // white
    private static readonly DEFAULT_NODE_TEXT_SIZE: number = 20;
    private static readonly DEFAULT_EDGE_LABEL_COLOR: string = "rgba(0, 0, 139, 1)"; // darkblue
    private static readonly DEFAULT_EDGE_LABEL_SIZE: number = 18;
    private static readonly DEFAULT_EDGE_LABEL_LOCATION: EdgeLabelLocation = "optimized";
    private static readonly DEFAULT_EDGE_WIDTH: number = 3;
    private static readonly DEFAULT_NODE_SIZE: number = 100;
    private static readonly DEFAULT_NOTE_BACKGROUND_COLOR: string = "rgba(254, 227, 174, 1)"; 
    private static readonly DEFAULT_NOTE_TEXT_COLOR: string = "rgba(0, 0, 0, 1)"; // black
    private static readonly DEFAULT_NOTE_TEXT_SIZE: number = 20;
    private static readonly DEFAULT_NOTE_LOCATION: NoteLocation = "optimized";

    readonly initialNotesConfig: NoteOptions;

    // debugging
    readonly debug: boolean;
    readonly responseDebugger: boolean;

    constructor(config: Record<string, any>) {
        // init from URL params or config or default values
        const params: URLSearchParams = new URLSearchParams(window.location.search);
        const getOrLower = (key: string): string|null => params.get(key) || params.get(key.toLowerCase());
        const getOrLowerMulti = (key: string): Array<string>|null => params.has(key) ? params.getAll(key) : params.has(key.toLowerCase()) ? params.getAll(key.toLowerCase()) : null;
        this.debug = typeof config.debug === "boolean" ? config.debug : false;
        this.responseDebugger = this.debug && typeof config.responseDebugger === "boolean" ? config.responseDebugger : false;
        this.server = params.get("server") || config.server || Config.DEFAULT_SERVER;
        this.initialQuery = (getOrLower("initialQuery") || config.initialQuery)?.replaceAll("__n", "\n") || Config.DEFAULT_INITIAL_QUERY;
        this.initialGroups = getOrLower("initialGroups")?.split(";")?.map(g => g.split(",")) || config.initialGroups;
        this.initialLayout = getOrLower("initialLayout") || config.initialLayout || Config.DEFAULT_INITIAL_LAYOUT;
        this.wheelSensitivity = parseFloat(getOrLower("wheelSensitivity") || config.wheelSensitivity) || Config.DEFAULT_WHEEL_SENSITIVITY;
        const style: Partial<GraphStyleOptions>|undefined = config.initialGraphStyle;
        const getBorder = (property: string): number => {
            let border: number = parseFloat(getOrLower(property));
            if (!(border >= 0) && style)
                border = (style as any)[property];
            if (!(border >= 0))
                border = 0;
            return border;
        }
        this.initialGraphStyle = Object.freeze({
            nodeBackgroundColor: getOrLower("nodeBackgroundColor") || style?.nodeBackgroundColor || Config.DEFAULT_NODE_BACKGROUND_COLOR,
            nodeTextSize: parseFloat(getOrLower("nodeTextSize")) || style?.nodeTextSize || Config.DEFAULT_NODE_TEXT_SIZE, 
            nodeTextColor: getOrLower("nodeTextColor") || style?.nodeTextColor || Config.DEFAULT_NODE_TEXT_COLOR,
            edgeLabelSize: parseFloat(getOrLower("edgeLabelSize")) || style?.edgeLabelSize || Config.DEFAULT_EDGE_LABEL_SIZE,
            edgeLabelColor: getOrLower("edgeLabelColor") || style?.edgeLabelColor || Config.DEFAULT_EDGE_LABEL_COLOR,
            edgeWidth: parseFloat(getOrLower("edgeWidth")) || style?.edgeWidth || Config.DEFAULT_EDGE_WIDTH,
            nodeSize: parseFloat(getOrLower("nodeSize")) || style?.nodeSize || Config.DEFAULT_NODE_SIZE,
            edgeLabelLocation: (getOrLower("edgeLabelLocation") || style?.edgeLabelLocation || Config.DEFAULT_EDGE_LABEL_LOCATION.toString()) as EdgeLabelLocation,
            noteBackgroundColor: getOrLower("noteBackgroundColor") || style?.noteBackgroundColor || Config.DEFAULT_NOTE_BACKGROUND_COLOR,
            noteTextColor: getOrLower("noteTextColor") || style?.noteTextColor || Config.DEFAULT_NOTE_TEXT_COLOR,
            noteTextSize: parseFloat(getOrLower("noteTextSize")) || style?.noteTextSize || Config.DEFAULT_NOTE_TEXT_SIZE,
            noteLocation: (getOrLower("noteLocation") || style?.noteLocation || Config.DEFAULT_NOTE_LOCATION.toString()) as NoteLocation,
            graphBorderLeft: getBorder("graphBorderLeft"),
            graphBorderRight: getBorder("graphBorderRight")
        });
        const notes: Partial<NoteOptions>|undefined = config.initialNotesConfig;
        this.initialNotesConfig = {
            hiddenProperties: Config.parseSelectors(getOrLower("hiddenProperties")) || notes?.hiddenProperties || [],
            specialPositions: getOrLowerMulti("specialPositions")?.map(pos => Config.parseSpecialPositions(pos))?.filter(pos => pos) || notes?.specialPositions || [],
        }
    }

    static serializeSpecialPosition(specialPositions: [Array<PropertySelector>, NoteLocation]): string {
        return Config.serializeSelectors(specialPositions[0]) + "=" + specialPositions[1];
    }

    static parseSpecialPositions(specialPositionsString: string): [Array<PropertySelector>, NoteLocation]|undefined {
        if (!specialPositionsString)
            return undefined;
        const mainSplit = specialPositionsString.split("=");
        if (mainSplit.length !== 2)
            return undefined;
        const selectors = Config.parseSelectors(mainSplit[0]);
        if (!selectors)
            return undefined;
        return [selectors, mainSplit[1] as NoteLocation];
    }

    static parseSelectors(selectorsString: string): Array<PropertySelector>|undefined {
        if (!selectorsString)
            return undefined;
        const entries: Array<string> = selectorsString.split(",").map(entry => entry.trim()).filter(entry => entry);
        const selectors: Array<PropertySelector|undefined> = entries.map(entry => Config.parseSelector(entry));
        return selectors.findIndex(s => s === undefined) < 0 ? selectors : undefined;
    }

    private static parseSelector(selector: string): PropertySelector|undefined {
        // @ts-ignore need a modern browser...
        const numColons: number = selector.length - selector.replaceAll(":", "").length;
        if (numColons > 2)
            return undefined;
        if (numColons === 0)
            return { field: selector };
        const firstIdx: number = selector.indexOf(":");
        const firstItem: string = selector.substring(0, firstIdx).trim().toLowerCase();
        const isType: boolean = firstItem === "type";
        const isId: boolean = firstItem === "id";
        const isLabel: boolean = firstItem === "label";
        if (!isType && !isId && !isLabel)
            return undefined;
        const secondIdx: number = selector.indexOf(":", firstIdx+1);
        const identifier: string = secondIdx > 0 ? selector.substring(firstIdx+1, secondIdx).trim() : selector.substring(firstIdx+1);
        const field: string|undefined = secondIdx < selector.length - 1 && secondIdx > 0 ? selector.substring(secondIdx+1).trim() : undefined;
        if (!identifier)
            return undefined;
        return isType ? { type: identifier, field: field } : isId ? { id: identifier, field: field } : {label: identifier, field: field};
    }

    static serializeSelectors(selectors: Array<PropertySelector>): string {
        if (!(selectors.length > 0))
            return "";
        return selectors.map(selector => Config.serializeSelector(selector)).join(", ");
    } 

    private static serializeSelector(selector: PropertySelector): string {
        // @ts-ignore
        const hasPrefix: boolean = !!selector.type || !!selector.id || !!selector.label;
        // @ts-ignore
        const prefix: string|undefined = !!selector.type ? selector.type : !!selector.id ? selector.id : selector.label;
        if (!hasPrefix)
            return selector.field;
        // @ts-ignore
        const isType: boolean = !!selector.type;
        // @ts-ignore
        const isId: boolean = !!selector.id;
        const type = isType ? "type" : isId ? "id" : "label";
        // @ts-ignore
        const identifier = isType ? selector.type : isId ? selector.id : selector.label;
        let result: string = type + ":" + identifier;
        const hasField: boolean = !!selector.field;
        if (hasField)
            result += ":" + selector.field;
        return result;            
    }


}

export interface Config0 {
    readonly initialQuery: string;
    readonly initialGroups?: Array<Array<string>>;
    readonly initialLayout: string;
    readonly server: string;
    readonly initialGraphStyle: Readonly<GraphStyleOptions>;
    readonly initialNotesConfig: Readonly<NoteOptions>;
}


