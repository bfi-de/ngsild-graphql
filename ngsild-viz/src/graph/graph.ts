import cytoscape, { EdgeDataDefinition, EdgeDefinition, NodeCollection, NodeDefinition } from "cytoscape";
import popper from "cytoscape-popper";
import { EdgeLabelLocation, GraphModel, GraphOptions, GraphStyleOptions, NoteLocation, NoteOptions, PropertySelector } from "./model.js";
cytoscape.use(popper);

export class Graph extends HTMLElement {

    /**
    * This specifies the attributes for which we'll get an attributeChangedCallback
    */
    static get observedAttributes() {
        return [
            "collapsed", // can also be set via a property
        ];
    }

    private static readonly EDGE_ID_SEPARATOR: string = "__ED__";
    private static readonly LABEL_KEY: string = "__LABEL";
    private static readonly LABEL_DISPLAY_KEY: string = "__LABEL_DISPLAY";
    private static readonly TYPEGROUP_KEY: string = "__TYPEGROUP";
    // for unknown node ids
    private static readonly ID_PREFIX: string = "node_";
    private static readonly NOTE_CLASS_IDENTIFIER: string = "graph-note";
    private static ID_CNT: number = 0;

    #graphModel: GraphModel;
    #properties: Map<string, Record<string, any>>;
    #graphOptions: GraphOptions;
    #graphStyle: GraphStyleOptions;
    #noteOptions: NoteOptions;
    #graphContainer: HTMLElement;
    #graph: cytoscape.Core;
    #notesVisible: boolean = true;

    public static register(): string {
        customElements.define("ngsild-graph", Graph);
        return "ngsild-graph";
    }

    #collapsed: boolean = false;

    public get collapsed(): boolean {
        return this.#collapsed;
    }
    
    public set collapsed(collapsed: boolean) {
        this.#collapsed = collapsed;
        if (collapsed)
            this.#graphContainer?.classList?.add("graph-collapsed");
        else
            this.#graphContainer?.classList?.remove("graph-collapsed");
        setTimeout(() => this.#graph?.fit(), 1000);
    }

    download = () => {
        if (!this.#graph)
            return;
        const canvases: Array<HTMLCanvasElement> = Array.from(this.shadowRoot.querySelectorAll("canvas"));
        const last: HTMLCanvasElement = canvases[canvases.length-1];
        const data: string = last.toDataURL("image/png");
        const a = document.createElement("a");
        a.target = "_blank";
        a.download = "graph.png";
        a.href = data;
        a.click();
        a.remove();
    };

    connectedCallback() {
        if (this.shadowRoot)
            return;
        const shadow: ShadowRoot = this.attachShadow({mode: "open"});
        const style = document.createElement("style");
        style.textContent= ".graph { padding-left: 1em; margin-top: 1em; position: relative; width: 95%; height: 95vh; box-sizing: border-box; z-index: 1;}\n " +
            "." + Graph.NOTE_CLASS_IDENTIFIER + " {} \n " +
            ".hidden {display: none;} \n" +
            ".note-grid {display: grid; grid-template-columns: auto auto; column-gap: 0.7em; row-gap: 0.2em; margin: 0.2em; padding: 0.5em; border-style: groove; border-radius: 4px;}\n"; // TODO test
        shadow.appendChild(style);
        const root: HTMLDivElement = document.createElement("div");
        const graphContainer: HTMLElement = document.createElement("div");
        graphContainer.classList.add("graph");
        if (this.#collapsed)
            graphContainer.classList.add("graph-collapsed");
        root.appendChild(graphContainer);
        shadow.appendChild(root);
        this.#graphContainer = graphContainer;
        if (this.#graphModel)
            this.setGraph(this.#graphModel, this.#graphOptions, this.#graphStyle);
    }

    async attributeChangedCallback(name: string, oldValue: string|null, newValue: string|null) {
        if (oldValue === newValue)
            return;
        switch (name) {
        case "collapsed":
            const collapsed: boolean = newValue?.toLowerCase() === "true";
            if (collapsed === this.#collapsed)
                return;
            this.collapsed = collapsed; // call setter defined above
            return;
        }
    }

    clearGraph(): void {
        this.#graph?.destroy();
        this.#graph = undefined;
        this.#graphOptions = undefined;
        this.#graphModel = undefined;
        while (this.#graphContainer?.firstChild)
            this.#graphContainer.firstChild.remove();
        
    }

    isShown(): boolean {
        return !!this.#graph;
    }

    getGraph(): cytoscape.Core {
        return this.#graph;
    }

    setGraph(graph: GraphModel, options?: GraphOptions, style?: GraphStyleOptions, notes?: NoteOptions): void {
        if (graph) {
            this.#graphModel = graph;
            if (style)
                this.#graphStyle = style;
            if (options)
                this.#graphOptions = options;
            if (notes)
                this.#noteOptions = notes;
        }
        graph = graph || this.#graphModel;
        options = options || this.#graphOptions;
        style = style || this.#graphStyle;
        notes = notes || this.#noteOptions;
        if (!this.#graphContainer || !graph)
            return;
        const edgeLabelLocation = style?.edgeLabelLocation || "optimized";
        const [elements, numbersPerGroup, properties] =  Graph.jsonToGraph(graph.graph, options?.typeGroups || [], edgeLabelLocation);
        this.#properties = properties;
        if (options?.layout === "custom") {
            Graph.setCustomNodePositions(elements, numbersPerGroup, options);
            Graph.setCustomEdgePositions(elements);
        }
        const nodeBackgroundColor: string = style?.nodeBackgroundColor || "#3a7ecf";
        const nodeTextColor: string = style?.nodeTextColor || "white";
        const edgeLabelColor: string = style?.edgeLabelColor || "darkblue";
        const nodeFontSize: number = style?.nodeTextSize || 14;
        const edgeLabelSize: number = style?.edgeLabelSize || 14;
        const edgeWidth: number = style?.edgeWidth || 3;
        const nodeSize: number = style?.nodeSize || 85;

        const graphOptions: cytoscape.CytoscapeOptions = {
            container: this.#graphContainer,
            elements: elements,
            style: [
                { 
                    selector: "node", 
                    style: { 
                        label: "data(" + Graph.LABEL_DISPLAY_KEY + ")", 
                        "text-valign": "center",
                        "font-size": nodeFontSize,
                        "text-wrap": "wrap",
                        "color": nodeTextColor,
                        "background-color": nodeBackgroundColor,
                        width: nodeSize,
                        height: nodeSize
                    } 
                },
                {
                    selector: "edge",
                    style: {
                        width: edgeWidth, 
                        "curve-style": "straight" ,
                        "target-arrow-shape": "triangle",
                        "target-arrow-fill": "filled",
                        "color": edgeLabelColor,
                        "font-size": edgeLabelSize,
                        label: "data(name)"
                    }
                },
                {
                    selector: "edge.label-left",
                    style: {
                        "text-margin-x": (element: any) => {
                            return (-(element?._private?.data?.name?.length || 0) * 0.35 * edgeLabelSize) + "px" as any // TODO test for various lengths
                        }
                    }
                },
                {
                    selector: "edge.label-right",
                    style: {
                        "text-margin-x": (element: any) => {
                            return ((element?._private?.data?.name?.length || 0) * 0.35 * edgeLabelSize) + "px" as any  // TODO test for various lengths
                        }
                    }
                }, {
                    selector: "edge.label-top",
                    style: {
                        "text-margin-y": (element: any) => {
                            return edgeLabelSize + "px" as any // TODO test for various lengths
                        }
                    }
                },

            ]
        };
        if (options?.layout)
            graphOptions.layout = {name: options.layout};
        if (options?.layout === "custom") {
            graphOptions.layout.name = "grid";
            (graphOptions.layout as cytoscape.GridLayoutOptions).position = (node: cytoscape.NodeSingular) => {
                return {row: node.data("row"), col: node.data("col")};
            };
        }
        graphOptions.wheelSensitivity = options?.wheelSensitivity || 0.4;
        this.setGraphBorder(style);
        this.#graph = cytoscape(graphOptions);
        this.showNodeProperties(properties, elements, style, notes, options?.layout === "custom");
    }

    fit() {
        this.#graph?.fit(); // or reset?
        //this.showNodeProperties(this.#properties, this.#graph.elements(), this.#graphStyle, this.#graphOptions?.layout === "custom");
    }

    reset() {
        //this.#graph?.reset(); // or reset?
        this.setGraph(this.#graphModel, this.#graphOptions, this.#graphStyle, this.#noteOptions);
    }

    /**
     * Returns true if notes are now visible
     */
    toggleNotes(): boolean {
        const isVisible: boolean = this.#notesVisible;
        this.shadowRoot.querySelectorAll("div." + Graph.NOTE_CLASS_IDENTIFIER).forEach(note => isVisible ? note.classList.add("hidden") : note.classList.remove("hidden"));
        this.#notesVisible = !isVisible;
        return !isVisible;
    }

    setStyleOptions(options: GraphStyleOptions) {
        this.#graphStyle = options;
        this.reset();
    }

    setNoteOptions(options: NoteOptions) {
        this.#noteOptions = options;
        this.reset();
    }
     
    // disturbs note positions, needs to be fixed later
    private setGraphBorder(style: GraphStyleOptions) {
        this.shadowRoot.querySelector("style#borderSettings")?.remove();
        if (!(style.graphBorderLeft > 0) && !(style.graphBorderRight > 0))
            return;
        const styleEl = document.createElement("style");
        styleEl.id = "borderSettings";
        let styleCss: string = ".graph {";
        if (style.graphBorderLeft > 0)
            styleCss += "padding-left: " + style.graphBorderLeft + "px;";
        if (style.graphBorderRight > 0)
            styleCss += "padding-right: " + style.graphBorderRight + "px;";       
        styleCss += "}";
        styleEl.textContent = styleCss;
        this.shadowRoot.appendChild(styleEl);

    }

    private showNodeProperties(properties: Map<string, Record<string, any>>|null, elements: cytoscape.ElementsDefinition, options?: GraphStyleOptions,
            notes?: NoteOptions, customLayout?: boolean) {
        this.clearPropertyNotes();
        this.shadowRoot.querySelector("style#noteGridStyle")?.remove();
        if (!properties || !this.#graph)
            return;
        const nodes = this.#graph.nodes();
        const l: number = nodes.length;
        const addStickyNote = (node: cytoscape.NodeSingular, opts: popper.Options<cytoscape.NodeSingular>) => {
            const nodeAttachment = node.popper(opts);
            node.on("position", nodeAttachment.update);
            this.#graph.on("pan zoom resize", nodeAttachment.update);
        };
        for (const [id, props] of properties) {
            const type: string = props.type;
            const label: string = props[Graph.LABEL_KEY];
            if (notes?.hiddenProperties?.length > 0) {
                for (const selector of notes.hiddenProperties) {
                    if (Graph.selectorMatches(selector, id, type, label)) {
                        const field: string|undefined = selector.field;
                        if (!field || field === "*")
                            properties.delete(id);
                        else {
                            const hasWildcard: boolean = field.indexOf("*") >= 0;
                            if (!hasWildcard) {
                                delete props[field];
                            } else {
                                const keys = Object.keys(props);
                                for (const key of keys) {
                                    if (Graph.matches(field, key))
                                        delete props[key];
                                }
                            }
                        }

                    }
                }
            }
            delete props[Graph.LABEL_KEY];
            if (Object.keys(props).length === 0)
                properties.delete(id);
        }
        const notePlacement: NoteLocation = (options?.noteLocation || "optimized");
        let optimizedPlacement: Map<number, NoteLocation>|undefined;
        if (notePlacement === "optimized" && customLayout) {
            const propertyNodes: Array<number> = nodes.map((node, idx) => [!!properties.get(node.data("id")), idx]).filter(arr => arr[0]).map(arr => arr[1] as number);
            optimizedPlacement = Graph.getPropertyNotePositions(elements, propertyNodes);
        }
        for (let idx=0; idx<l; idx++) {
            const node = nodes[idx];
            const nodeData: Record<string, any> = properties.get(node.data("id"));
            if (!nodeData)
                continue;
            let placement0: NoteLocation = optimizedPlacement?.has(idx) ? optimizedPlacement.get(idx) : notePlacement === "optimized" ? "top" : notePlacement;
            // overwrite placement by individual configuration if necessary
            if (notes?.specialPositions) {
                const type: string = nodeData.type;
                const label: string = node.data(Graph.LABEL_KEY);
                const id: string = node.data("id");
                for (const [selectors, position] of notes.specialPositions) {
                    if (selectors.findIndex(s => Graph.selectorMatches(s, id, type, label) && (!s.field || s.field in nodeData )) >= 0)
                        placement0 = position;
                }
            }
            const placement: string = placement0.replace(" left", "-end").replace(" right", "-start");
            addStickyNote(node, {
                content: () => this.generateNoteHtml(nodeData),
                popper: { 
                    modifiers: [{ name: "flip", enabled: false }, { name: "preventOverflow", enabled: false}],
                    placement: placement
                } as any
            });
        }


        const setNotesStyle = (fontSize: number, offset: string) => {
            const style = document.createElement("style");
            style.id = "noteGridStyle";
            const noteBkg: string = options?.noteBackgroundColor || "rgba(254, 227, 174, 1)";
            const noteTextColor: string = options?.noteTextColor || "black";
            const styleCss = ".note-grid {background-color: " + noteBkg + "; color: " + noteTextColor + "; font-size: " + fontSize + "px; z-index: 1; transform: translate(" + offset + ", 0);}";
            style.textContent = styleCss;
            this.shadowRoot.querySelector("style#noteGridStyle")?.remove();
            this.shadowRoot.appendChild(style);
        };
        const initialFontSize: number = options?.noteTextSize || 20;
         // strange hack necessary to align notes with nodes in case of padding-left for graph
        const initialOffset: string = options.graphBorderLeft > 0 ? (options.graphBorderLeft + "px") : "1em";
        setNotesStyle(initialFontSize, initialOffset);

        this.#graph.on("zoom resize", () => {
            const currentZoomLevel: number = this.#graph.zoom();
            setNotesStyle(initialFontSize * currentZoomLevel, options.graphBorderLeft > 0 ? ((options.graphBorderLeft) + "px") : 
               (0.75/currentZoomLevel) + "em");
        }); // reset font size on zoom

    }

    /**
     * TODO for all relevant nodes determine the position of incoming and outgoing edges as well as the presence of neighboring nodes
     * @param elements 
     * @param nodeIndices 
     * @return Map<key in nodes collection, note placement>
     */
    private static getPropertyNotePositions(elements: cytoscape.ElementsDefinition, nodeIndices: Array<number>): Map<number, NoteLocation> {
        if (nodeIndices.length === 0)
            return new Map();
        const nodes = elements.nodes;
        const edges = elements.edges;
        const infos: Map<number, NodeSpaceInfo> = new Map();
        for (const idx of nodeIndices) {
            const currentNode: NodeDefinition = nodes[idx];
            const id: string = currentNode.data.id;
            const row: number = currentNode.data.row;
            const col: number = currentNode.data.col;
            const incomingEdges: Array<EdgeDefinition> = edges.filter(edge => edge.data.target === id);
            const outgoingEdges: Array<EdgeDefinition> = edges.filter(edge => edge.data.source === id);
            const otherNodes1 = incomingEdges.map(edge => nodes.find(node => node.data.id === edge.data.source)).filter(node => node);
            const otherNodes2 = outgoingEdges.map(edge => nodes.find(node => node.data.id === edge.data.target)).filter(node => node);
            const otherNodes: Array<NodeDefinition> = [...otherNodes1, ...otherNodes2];
            const angles: Array<number> = otherNodes.map(node => {
                const row2: number = node.data.row;
                const col2: number = node.data.col;
                if (col2 === col)
                    return row2 > row ? -1 : 0;
                if (row2 === row)
                    return col2 > col ? 0.5 : -0.5;
                const alpha: number = Math.atan((col2-col)/(row-row2)) / Math.PI; // assuming row spacing equals col spacing
                return  row2 < row ? alpha : (col2 > col ? 1 + alpha : -1 + alpha);
            }).sort((a,b) => a-b);
            let hasLeftNeighbor: boolean = false;
            let hasRightNeighbor: boolean = false;
            for (let idx2=0; idx2<nodes.length; idx2++) {
                if (idx2 === idx)
                    continue;
                const other = nodes[idx2];
                if (other.data.row !== row)
                    continue;
                if (other.data.col === col-1)
                    hasLeftNeighbor = true;
                else if (other.data.col === col+1)
                    hasRightNeighbor = true;
                else 
                    continue;
                if (hasLeftNeighbor && hasRightNeighbor)
                    break;
            }
            let fractionAvailable: number = 0;
            let freeQuadrants: [boolean, boolean, boolean, boolean]; // upper, right, bottom, left
            if (angles.length === 0) {
                fractionAvailable = 1 - (hasLeftNeighbor ? 1 : 0) * 0.25 - (hasRightNeighbor ? 1 : 0) * 0.25;
                freeQuadrants = [true, !hasRightNeighbor, true, !hasLeftNeighbor];
            } else {
                const upperQuadrantFree: boolean = angles.find(angle => angle > -0.35 && angle < 0.35) === undefined;
                const lowerQuadrantFree: boolean = angles.find(angle => angle < -0.65  || angle > 0.65 ) === undefined;
                const leftQuadrantFree: boolean = !hasLeftNeighbor && angles.find(angle => angle > -0.85  && angle < -0.15) === undefined;
                const rightQuadrantFree: boolean = !hasRightNeighbor && angles.find(angle => angle > 0.15 && angle < 0.85 ) === undefined;
                fractionAvailable = [upperQuadrantFree, lowerQuadrantFree, leftQuadrantFree, rightQuadrantFree].filter(bool => bool).length * 0.25;
                freeQuadrants = [upperQuadrantFree, rightQuadrantFree, lowerQuadrantFree, leftQuadrantFree];
            }
            const info: NodeSpaceInfo = {
                edges: angles,
                hasLeftNeighbor: hasLeftNeighbor,
                hasRightNeighbor: hasRightNeighbor,
                fractionAvailable: fractionAvailable,
                freeQuadrants: freeQuadrants
            };
            infos.set(idx, info);
        }
        const nodesInfos: Array<[number, NodeSpaceInfo]> = Array.from(infos.entries()).sort((e1, e2) => e1[1].fractionAvailable - e2[1].fractionAvailable);
        const result: Map<number, NoteLocation> = new Map();
        for (const [idx, info] of nodesInfos) {
            if (info.freeQuadrants[0]) {
                result.set(idx, "top");
                continue;
            }
            else if (info.freeQuadrants[2]) {
                result.set(idx, "bottom");
                continue;
            }
            else if (info.freeQuadrants[3]) {
                result.set(idx, "left");
                continue;
            }
            else if (info.freeQuadrants[1]) {
                result.set(idx, "right");
                continue;
            }
            const upperLeftFree: boolean = info.edges.find(angle => angle > -0.5 && angle < 0) === undefined;
            if (upperLeftFree) {
                result.set(idx, "top left");
                continue;
            }            
            const upperRightFree: boolean = info.edges.find(angle => angle > 0 && angle < 0.5) === undefined;
            if (upperRightFree) {
                result.set(idx, "top right");
                continue;
            }
            const lowerLeftFree: boolean = info.edges.find(angle => angle < -0.5 ) === undefined;
            if (lowerLeftFree) {
                result.set(idx, "bottom left");
                continue;
            }
            const lowerRightFree: boolean = info.edges.find(angle => angle > 0.5) === undefined;
            if (lowerRightFree) {
                result.set(idx, "bottom right");
                continue;
            }
            result.set(idx, "top");

        }
        return result;
    }



    private clearPropertyNotes() {
        this.shadowRoot.querySelectorAll("div." + Graph.NOTE_CLASS_IDENTIFIER).forEach(el => el.remove());
    }

    private generateNoteHtml(note: Record<string, any>): HTMLElement {
        const div = document.createElement("div");
        div.classList.add(Graph.NOTE_CLASS_IDENTIFIER);
        const grid: HTMLDivElement = document.createElement("div");
        grid.classList.add("note-grid");
        Object.entries(note).forEach(keyVal => {
            keyVal.map(s => {
                const c = document.createElement("div");;
                c.innerText = s;
                return c;
            }).forEach(c => grid.appendChild(c));
        })
        div.appendChild(grid);
        this.shadowRoot.appendChild(div);
        return div;
    }

    private static jsonToGraph(
            data: Record<string, any>,
            typeGroups: Array<Array<string>>,
            edgeLabelLocation: EdgeLabelLocation): [cytoscape.ElementsDefinition, Map<number, number>, Map<string, Record<string, any>>|null] {
        const nodes: Array<cytoscape.NodeDefinition> = [];
        const edges: Array<cytoscape.EdgeDefinition> = [];
        const keys = data ? Object.keys(data) : undefined;
        if (!(keys?.length > 0))
            return [{nodes: nodes, edges: edges}, null, null];
        const firstLevel: any = data[keys[0]];
        // key -1: unknown types, other keys: index of group in typeGroups
        const numbersPerGroup: Map<number, number>|null = typeGroups?.length > 0 ? new Map() : null;
        const properties: Map<string, Record<string, any>> = new Map();
        if (Array.isArray(firstLevel))
            firstLevel.forEach(entry => Graph.parse(entry, nodes, edges, typeGroups, numbersPerGroup, edgeLabelLocation, properties));
        else
            Graph.parse(data[keys[0]], nodes, edges, typeGroups, numbersPerGroup, edgeLabelLocation, properties);
        return [{
            nodes: nodes,
            edges: edges
        }, numbersPerGroup, properties];
    }

    private static setCustomNodePositions(elements: cytoscape.ElementsDefinition, numbersPerGroup: Map<number, number>, options?: GraphOptions) {
        const nodes = elements.nodes;
        const maxColumns: number = Math.max(...numbersPerGroup.values());
        let unknownElements: number = 0;
        const typeGroups: Array<Array<string>> = options?.typeGroups || [];
        const idGroups: Array<Array<string>> = options?.idGroupds || []; // TODO unused currently
        const types: number = typeGroups.length;
        const ids: number = idGroups.length;
        // keys: group index in typeGroups, value: number of nodes already placed in grid per group
        const posPerGroups: Map<number, number> = new Map();
        for (const node of nodes) {
            const group: number = node.data[Graph.TYPEGROUP_KEY];
            let row: number = types;
            let colSet: boolean = false;
            let col: number;
            if (group >= 0) {
                row = group;
                if (!posPerGroups.has(group))
                    posPerGroups.set(group, 0);
                const groupCount = posPerGroups.get(group);
                posPerGroups.set(group, groupCount + 1);
                const elementsPerRow: number = numbersPerGroup.get(group);
                const columnsPerNode: number = maxColumns / elementsPerRow;
                col = Math.floor(columnsPerNode/2 + groupCount * columnsPerNode);
                colSet = true;
            }
            if (!colSet)
                col = unknownElements++;
            node.data.row = row;
            node.data.col = col;
        }
    }

    private static setCustomEdgePositions(elements: cytoscape.ElementsDefinition) {
        const nodes = elements.nodes;
        const edges = elements.edges;
        const edgePositions: Map<EdgeDefinition, {source: Position, target: Position}> = new Map();
        for (const edge of edges) { 
            const source = nodes.find(node => node.data.id === edge.data.source);
            const target = nodes.find(node => node.data.id === edge.data.target);
            const posSource = {row: source.data.row, col: source.data.col};
            const posTarget = {row: target.data.row, col: target.data.col};
            // find overlaps
            const overlaps: Array<[EdgeDefinition, boolean, boolean]> = Array.from(edgePositions.entries())
                .map(([edge, {source, target}]) => {
                    const overlapsSameOrientation: boolean = source.row === posSource.row && source.col === posSource.col && target.row === posTarget.row && target.col === posTarget.col;
                    const overlapsReverseOrientation: boolean = !overlapsSameOrientation && source.row === posTarget.row && source.col === posTarget.col && target.row === posSource.row && target.col === posSource.col;
                    return [edge, overlapsSameOrientation, overlapsReverseOrientation] as [EdgeDefinition, boolean, boolean];
                }).filter(([edge, overlapsSameOrientation, overlapsReverseOrientation]) => overlapsReverseOrientation || overlapsSameOrientation);
            edgePositions.set(edge, {source: posSource, target: posTarget});
            if (overlaps.length === 0) {
                const cl = Graph.getCustomEdgePosition(posSource, posTarget);
                if (cl)
                    edge.classes = cl;
                // else: will be set in neighbor based mehtod below
            } else {
                const cl = overlaps[0][0].classes;
                if (cl)
                    edge.classes = cl.indexOf("left") >= 0 ? cl.replace("left", "right") : cl.replace("right", "left");
            }
        }
        if (edges.find(edge => !edge.classes))
            Graph.setCustomEdgePositionsBasedOnNeighbors(elements, edgePositions);
    }

    private static getCustomEdgePosition(source: {row: number, col: number}, target: {row: number, col: number}): string|undefined {
        if (source.row === target.row)
            return "label-top";
        if (source.row < target.row) {
            if (source.col < target.col)
                return "label-right";
            else if (source.col > target.col)
                return "label-left"; 
            // else take into account neighboring edges
            return undefined;
        }
        if (source.col < target.col)
            return "label-left";
        else if (source.col > target.col)
            return "label-right";
        // else take into account neighboring edges
        return undefined;
    }

    // based on neighboring edges' label positioning
    private static setCustomEdgePositionsBasedOnNeighbors(elements: cytoscape.ElementsDefinition, 
            edgePositions: Map<EdgeDefinition, {source: Position, target: Position}>,
            neighbors?: Map<EdgeDefinition, [EdgeDefinition|undefined, number, EdgeDefinition|undefined, number]>) {
        const edges = elements.edges;
        if (!neighbors)
            neighbors = new Map(edges.filter(edge => !edge.classes).map(edge => [edge, Graph.findNeighborEdges(edge, edgePositions)]));
        for (const [edge, [left, leftDistance, right, rightDistance]] of neighbors) { 
            if (!left) {
                edge.classes = "label-left";
            }
            else if (!right && leftDistance !== 0) {
                edge.classes = "label-right";
            }
            else {
                const lc = left?.classes;
                const rc = right?.classes;
                if (leftDistance === 0) {
                    if (lc)
                        edge.classes = lc.indexOf("left") >= 0 ? lc.replace("left", "right") : lc.replace("right", "left");
                    else {
                        edge.classes = "label-left";
                        left.classes = "label-right";
                    }
                }
                else if (!lc || !rc)
                    continue;
                else if (lc.indexOf("left") >= 0)
                    edge.classes = "label-left";
                else if (rc.indexOf("right") >= 0)
                    edge.classes = "label-right";
                else // just guessing
                    edge.classes = "label-left";
            }
        }
        if (edges.find(edge => !edge.classes))
            Graph.setCustomEdgePositionsBasedOnNeighbors(elements, edgePositions, neighbors);
    }

    /**
     * 
     * @param base 
     * @param edgePositions 
     * @returns [left neighbor, right neighbor, collisions]
     */
    private static findNeighborEdges(base: EdgeDefinition, edgePositions: Map<EdgeDefinition, {source: Position, target: Position}>): [EdgeDefinition|undefined, number, EdgeDefinition|undefined, number] {
        const baseSource: Position = edgePositions.get(base).source;
        const baseTarget: Position = edgePositions.get(base).target;
        const row = (baseSource.row + baseTarget.row) / 2;
        const col = (baseSource.col + baseTarget.col) / 2;
        const maxRow = Math.max(baseSource.row, baseTarget.row);
        const minRow = Math.min(baseSource.row, baseTarget.row);
        let leftCand: EdgeDefinition|undefined;
        let rightCand: EdgeDefinition|undefined;
        let leftDistance: number = 1000;
        let rightDistance: number = 1000;
        console.log("Getting distances for edge", base)
        for (const [edge, {source, target}] of edgePositions) {
            if (edge === base)
                continue;
            let distance: number;
            if ((source.row >= maxRow && target.row >= maxRow) ||
                (source.row <= minRow && target.row <= minRow))
                    continue;
            if (source.row === target.row) { // we assume a row hierarchy here, this is hence an exceptional case
                if (source.row === row) {
                    distance = source.col - col;
                } else {
                    continue;
                }
            }
            else {
                const fraction = (row - source.row) / (target.row - source.row);
                const colInterpolated = source.col + fraction * (target.col - source.col);
                distance = colInterpolated - col;
            }
            if (distance <= 0 && (-distance) < leftDistance) {
                leftDistance = -distance;
                leftCand = edge;
            } else if (distance > 0 && distance < rightDistance) {
                rightDistance = distance;
                rightCand = edge;
            }            
        }
        return [leftCand, leftDistance, rightCand, rightDistance];
    }



    // by side-effects
    private static parse(
            data: Record<string, any>, 
            nodes: Array<cytoscape.NodeDefinition>, 
            edges: Array<cytoscape.EdgeDefinition>, 
            typeGroups: Array<Array<string>>,
            numbersPerGroup: Map<number, number>,
            edgeLabelLocation: EdgeLabelLocation,
            properties: Map<string, Record<string, any>>,
            edgeFrom?: cytoscape.NodeDefinition, 
            edgeLabel?: string) {
        let id: string = data.id;
        let node: cytoscape.NodeDefinition = id ? nodes.find(node => node.data.id === id) : undefined;
        if (!node) {
            Graph.setLabelForNode(data);
            Graph.setDisplayLabel(data);
            if (!id)
                id = Graph.ID_PREFIX + Graph.ID_CNT++;
            node = { data: { id: id} };
            const props = {...data };
            ["id", "name", /*"label", Graph.LABEL_KEY */, Graph.LABEL_DISPLAY_KEY].forEach(key => delete props[key]);
            Object.entries(props)
                .filter(([key, value]) => typeof value === "object")
                .map(([key, value]) => key)
                .forEach(key => delete props[key]);
            properties.set(id, props);
            if (Graph.LABEL_KEY in data)
                node.data[Graph.LABEL_KEY] = data[Graph.LABEL_KEY];
            if (numbersPerGroup) {
                const type = data.type;
                let typeIdx: number = -1;
                if (type)
                    typeIdx = typeGroups.findIndex(grp => grp.indexOf(type) >= 0);
                if (!numbersPerGroup.has(typeIdx))
                    numbersPerGroup.set(typeIdx, 0);
                numbersPerGroup.set(typeIdx, numbersPerGroup.get(typeIdx) + 1);
                node.data[Graph.TYPEGROUP_KEY] = typeIdx;
            }
            nodes.push(node);
        }
        if (edgeFrom && edgeLabel) {
            const existing = edges.find(edge => edge.data.source === edgeFrom.data.id && edge.data.target === id);
            if (!existing) {
                const edge: cytoscape.EdgeDefinition = {
                    data: {
                        source: edgeFrom.data.id,
                        target: id,
                        id: edgeFrom.data.id + Graph.EDGE_ID_SEPARATOR + id + Graph.EDGE_ID_SEPARATOR + edgeLabel,
                        name: edgeLabel
                    }
                };
                edges.push(edge);
            }
            /* // see setCustomEdgePositoon 
            if (edgeLabelLocation === "left" || edgeLabelLocation === "right")
                edge.classes = "label-" + edgeLabelLocation;
            else if (edgeLabelLocation === "optimized")
                // TODO at this point we need to know the positioning of source (edgeFrom) and target (node) nodes... is this known already?
                edge.classes = "TODO";
            */
        }
        for (const entry of Object.entries(data)) {
            const key: string = entry[0];
            const value: any = entry[1];
            if (key === "id" || value === null)
                continue;
            const isPrimitive: boolean = (typeof value !== "object" || (Array.isArray(value) && value.findIndex(v => typeof v === "object") === -1))
            if (!isPrimitive) {
                const arr: Array<any> = Array.isArray(value) ? value : [value];
                arr.forEach(val => Graph.parse(val, nodes, edges, typeGroups, numbersPerGroup, edgeLabelLocation, properties, node, key));
            } else {
                // TODO right way to handle data? Likely not!
                node.data[key] = value;
            }

        }
    }

    private static setDisplayLabel(node: Record<string, any>): void {
        if (Graph.LABEL_DISPLAY_KEY in node || !(Graph.LABEL_KEY in node))
            return;
        const label0: string = node[Graph.LABEL_KEY];
        const l: number = label0.length;
        let label: string;
        if (l >= 10) { // TODO configurable?
            let previousLower: boolean = false;
            const jumps: Array<number> = [];
            label = "";
            for (let idx=0; idx<l-1; idx++) {
                const c: string = label0.charAt(idx);
                if (c.toUpperCase() !== c) {
                    previousLower = true;
                } else if (previousLower && !Number.isInteger(Number.parseInt(c))) {
                    jumps.push(idx);
                }
            }
            if (jumps.length > l/5) {
                // TODO too many jumps
            }
            let previousJump: number = 0;
            for (const jump of jumps) {
                label += label0.substring(previousJump, jump) + "\n";
                previousJump = jump;
            }
            label += label0.substring(previousJump);
        } else {
            label = label0;
        }
        node[Graph.LABEL_DISPLAY_KEY] = label; 
    }

    private static setLabelForNode(node: Record<string, any>): void {
        if (Graph.LABEL_KEY in node)
            return;
        for (const key of ["label", "name"]) {
            if (key in node) {
                node[Graph.LABEL_KEY] = node[key];
                return;
            }
        }
        if (typeof node.id === "string") {
            const id: string = node.id;
            let label = id;
            if (label.length >= 10) { // typical ids are of the form "urn:ngsi-ld:EntityType:EntityType3" => display "EntityType3"
                const lastColon: number = label.lastIndexOf(":");
                if (lastColon > 0) 
                    label = label.substring(lastColon+1);
            }
            node[Graph.LABEL_KEY] = label;
        }
    }

    private static selectorMatches(selector0: PropertySelector, nodeId: string, nodeType?: string, label?: string) {
        const selector: Record<string, any> = selector0;
        if (selector.type)
            return Graph.matches(selector.type, nodeType);
        if (selector.id)
            return Graph.matches(selector.id, nodeId);
        if (selector.label)
            return Graph.matches(selector.label, label);
        return true;
    }

    // simple wildcard matching
    private static matches(pattern: string, field: string): boolean {
        if (pattern === "*")
            return true;
        let lastIdx: number = -1;
        let idx: number = pattern.indexOf("*");
        let fieldIdx: number = 0;
        if (idx < 0)
            return field === pattern;
        if (idx > 0) {  // case: pattern does not start with "*"
            if (!field.startsWith(pattern.substring(0, idx)))
                return;
            fieldIdx = pattern.substring(0, idx).length;
        }
        while (idx >= 0 && idx < pattern.length) {
            lastIdx = idx;
            if (lastIdx === pattern.length - 1) // case: pattern ends with "*"
                return true;
            idx = pattern.indexOf("*", idx + 1);
            if (idx < 0) {
                const subpattern: string = pattern.substring(lastIdx+1);
                return field.endsWith(subpattern);
            }
            const subpattern: string = pattern.substring(lastIdx+1, idx);
            const found: number = field.indexOf(subpattern, fieldIdx);
            if (found < 0)
                return false;
            fieldIdx = found + subpattern.length;
        }
        return true;
    }

    private static setPositions(graph: GraphModel, options: GraphOptions) {
        const typeGroups: Array<Array<string>> = options?.typeGroups || [];
        const idGroups: Array<Array<string>> = options?.idGroupds || []; // TODO unused currently
        const types: number = typeGroups.length;
        const ids: number = idGroups.length;
        // key: group index in typeGroups
        const numbersPerGroup: Map<number, number> = new Map();

    }

}

type Position = {row: number, col: number};

interface NodeSpaceInfo {
    /**
     * As fraction of Math.PI. Value range [-1, 1), with -1 = bottom, -1/2 = left, 0 = top, 1/2 = right
     */
    edges: Array<number>;
    hasRightNeighbor: boolean;
    hasLeftNeighbor: boolean;
    freeQuadrants: [boolean, boolean, boolean, boolean]; // upper, right, bottom, left
    // number between 0 and 1
    fractionAvailable: number;
}
