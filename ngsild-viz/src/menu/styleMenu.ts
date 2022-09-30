import { HtmlUtils } from "./htmlUtils.js";
//import ColorPicker, {} from "toolcool-color-picker";
import "toolcool-color-picker";
import { EdgeLabelLocation, GraphStyleOptions, NoteLocation } from "../graph/model.js";
import { State } from "./state.js";
import { Config } from "../config.js";


export class StyleMenu extends HTMLElement {

    #state0: GraphStyleOptions;
    
    // everything below is quasi readonly
    private state: State<GraphStyleOptions>;

    #pickerNodeBkg: HTMLElement;
    #pickerNodeText: HTMLElement;
    #pickerEdgeLabel: HTMLElement;
    #pickerNoteBkg: HTMLElement;
    #pickerNoteText: HTMLElement;
    #nodeTextSize: HTMLInputElement;
    #edgeLabelSize: HTMLInputElement;
    #edgeWidth: HTMLInputElement;
    #nodeSize: HTMLInputElement;
    #noteTextSize: HTMLInputElement;
    #graphBorderLeft: HTMLInputElement;
    #graphBorderRight: HTMLInputElement;
    #edgeLabelLocation: HTMLSelectElement;
    #noteLocation: HTMLSelectElement;
    #undo: HTMLInputElement;
    #redo: HTMLInputElement;

    // only create elements once the default GraphStyleOptions object has been passed, in a dedicated method, from the config object
    constructor() {
        super();
        const style: HTMLStyleElement = document.createElement("style");
        //style.textContent = ":host { position: relative; display: block; }";
        style.textContent = ".style-menu { display: grid; grid-template-columns: auto auto 1fr; column-gap: 1em; align-content: start; row-gap: 0.75em; min-width: 28em; min-height: 32em; } \n" +
            ".undo-row { display: flex; column-gap: 1em }";
        const shadow: ShadowRoot = this.attachShadow({mode: "open"});
        shadow.appendChild(style);
        HtmlUtils.attachSharedStyles(shadow);
    }

    setConfig(config: Config) {
        if (this.#state0)
            return;
        this.#state0 = {...config.initialGraphStyle};
        this.state = new State(this.#state0, this.changed.bind(this));
        this.init(this.#state0);
    }

    private init(initialGraphStyle: GraphStyleOptions) {
        const shadow = this.shadowRoot;
        HtmlUtils.createElement("h2", {clzz: "menu-header", text: "Styles", parent: shadow});
        
        const grid: HTMLElement = HtmlUtils.createElement("div", {clzz: "style-menu", parent: shadow});
        // node background color
        HtmlUtils.createElement("div", {text: "Node color:", parent: grid, title: "Select the node background color"});
        const pickerNodeBkg /*: ColorPicker*/ = HtmlUtils.createElement("toolcool-color-picker" as any, {parent: grid, title: "Select the node background color"});
        pickerNodeBkg.color = initialGraphStyle.nodeBackgroundColor;
        pickerNodeBkg.style="height: 1em;"

        pickerNodeBkg.addEventListener("change", (evt: any) => {
            if (evt.detail.rgba !== this.#state0.nodeBackgroundColor) {
                this.state.stateChanged({nodeBackgroundColor: evt.detail.rgba});
            }
        });
        HtmlUtils.createElement("div", {parent: grid});
        
        // node text color
        HtmlUtils.createElement("div", {text: "Node text color:", parent: grid, title: "Select the node text color"});
        const pickerNodeText /*: ColorPicker*/ = HtmlUtils.createElement("toolcool-color-picker" as any, {parent: grid, title: "Select the node text color"});
        pickerNodeText.color = initialGraphStyle.nodeTextColor;
        pickerNodeText.addEventListener("change", (evt: any) => {
            if (evt.detail.rgba !== this.#state0.nodeTextColor) {
                this.state.stateChanged({nodeTextColor: evt.detail.rgba});
            }
        });
        HtmlUtils.createElement("div", {parent: grid});


        // edge label color
        HtmlUtils.createElement("div", {text: "Edge label color:", parent: grid, title: "Select the edge label color"});
        const pickerEdgeLabel /*: ColorPicker*/ = HtmlUtils.createElement("toolcool-color-picker" as any, {parent: grid, title: "Select the edge label color"});
        pickerEdgeLabel.color = initialGraphStyle.edgeLabelColor;
        pickerEdgeLabel.addEventListener("change", (evt: any) => {
            if (evt.detail.rgba !== this.#state0.edgeLabelColor) {
                this.state.stateChanged({edgeLabelColor: evt.detail.rgba});
            }
        });
        HtmlUtils.createElement("div", {parent: grid});

        // note background color
        HtmlUtils.createElement("div", {text: "Note color:", parent: grid, title: "Select the properties note color"});
        const pickerNoteBkg /*: ColorPicker*/ = HtmlUtils.createElement("toolcool-color-picker" as any, {parent: grid, title: "Select the properties note color"});
        pickerNoteBkg.color = initialGraphStyle.noteBackgroundColor;
        pickerNoteBkg.addEventListener("change", (evt: any) => {
            if (evt.detail.rgba !== this.#state0.noteBackgroundColor) {
                this.state.stateChanged({noteBackgroundColor: evt.detail.rgba});
            }
        });
        HtmlUtils.createElement("div", {parent: grid});

        // note text color
        HtmlUtils.createElement("div", {text: "Note text color:", parent: grid, title: "Select the properties note text color"});
        const pickerNoteText /*: ColorPicker*/ = HtmlUtils.createElement("toolcool-color-picker" as any, {parent: grid, title: "Select the properties note text color"});
        pickerNoteText.color = initialGraphStyle.noteTextColor;
        pickerNoteText.addEventListener("change", (evt: any) => {
            if (evt.detail.rgba !== this.#state0.noteTextColor) {
                this.state.stateChanged({noteTextColor: evt.detail.rgba});
            }
        });
        HtmlUtils.createElement("div", {parent: grid});

         // node size
         HtmlUtils.createElement("div", {text: "Node size:", parent: grid, title: "Select the node size, in px"});
         const nodeSizeParent = HtmlUtils.createElement("div", {parent: grid});
         const nodeSize: HTMLInputElement = HtmlUtils.createElement("input", {parent: nodeSizeParent, title: "Select the node size, in px"});
         nodeSize.type = "number";
         nodeSize.min = "0";
         nodeSize.value = initialGraphStyle.nodeSize + "";
         nodeSize.addEventListener("change", evt => {
             const size: number = parseFloat((evt.currentTarget as HTMLInputElement).value);
             if (!isFinite(size))
                 return;
             if (size !== this.#state0.nodeSize)
                 this.state.stateChanged({nodeSize: size});
         });
         HtmlUtils.createElement("div", {parent: grid});

        // node text size
        HtmlUtils.createElement("div", {text: "Node text size:", parent: grid, title: "Select the node text size"});
        const nodeTextSizeParent = HtmlUtils.createElement("div", {parent: grid});
        const nodeTextSize: HTMLInputElement = HtmlUtils.createElement("input", {parent: nodeTextSizeParent, title: "Select the node text size"});
        nodeTextSize.type = "number";
        nodeTextSize.min = "0";
        nodeTextSize.value = initialGraphStyle.nodeTextSize + "";
        nodeTextSize.addEventListener("change", evt => {
            const size: number = parseFloat((evt.currentTarget as HTMLInputElement).value);
            if (!isFinite(size))
                return;
            if (size !== this.#state0.nodeTextSize)
                this.state.stateChanged({nodeTextSize: size});
        });
        HtmlUtils.createElement("div", {parent: grid});

        // edge label size
        HtmlUtils.createElement("div", {text: "Edge label size:", parent: grid, title: "Select the edge label size"});
        const edgeLabelSizeParent = HtmlUtils.createElement("div", {parent: grid});
        const edgeLabelSize: HTMLInputElement = HtmlUtils.createElement("input", {parent: edgeLabelSizeParent, title: "Select the edge label size"});
        edgeLabelSize.type = "number";
        edgeLabelSize.min = "0";
        edgeLabelSize.value = initialGraphStyle.edgeLabelSize + "";
        edgeLabelSize.addEventListener("change", evt => {
            const size: number = parseFloat((evt.currentTarget as HTMLInputElement).value);
            if (!isFinite(size))
                return;
            if (size !== this.#state0.edgeLabelSize)
                this.state.stateChanged({edgeLabelSize: size});
        });
        HtmlUtils.createElement("div", {parent: grid});

        // edge width
        HtmlUtils.createElement("div", {text: "Edge width:", parent: grid, title: "Select the edge width, in px"});
        const edgeWidthParent = HtmlUtils.createElement("div", {parent: grid});
        const edgeWidth: HTMLInputElement = HtmlUtils.createElement("input", {parent: edgeWidthParent, title: "Select the edge width, in px"});
        edgeWidth.type = "number";
        edgeWidth.min = "0";
        edgeWidth.value = initialGraphStyle.edgeWidth + "";
        edgeWidth.addEventListener("change", evt => {
            const size: number = parseFloat((evt.currentTarget as HTMLInputElement).value);
            if (!isFinite(size))
                return;
            if (size !== this.#state0.edgeWidth)
                this.state.stateChanged({edgeWidth: size});
        });
        HtmlUtils.createElement("div", {parent: grid});

        // note text size
        HtmlUtils.createElement("div", {text: "Note text size:", parent: grid, title: "Select the properties note text size"});
        const noteTextSizeParent = HtmlUtils.createElement("div", {parent: grid});
        const noteTextSize: HTMLInputElement = HtmlUtils.createElement("input", {parent: noteTextSizeParent, title: "Select the properties note text size"});
        noteTextSize.type = "number";
        noteTextSize.min = "0";
        noteTextSize.value = initialGraphStyle.noteTextSize + "";
        noteTextSize.addEventListener("change", evt => {
            const size: number = parseFloat((evt.currentTarget as HTMLInputElement).value);
            if (!isFinite(size))
                return;
            if (size !== this.#state0.noteTextSize)
                this.state.stateChanged({noteTextSize: size});
        });
        HtmlUtils.createElement("div", {parent: grid});

        this.#pickerNodeBkg = pickerNodeBkg;
        this.#pickerNodeText = pickerNodeText;
        this.#pickerEdgeLabel = pickerEdgeLabel;
        this.#nodeTextSize = nodeTextSize;
        this.#edgeLabelSize = edgeLabelSize;
        this.#edgeWidth = edgeWidth;
        this.#nodeSize = nodeSize;
        this.#pickerNoteBkg = pickerNoteBkg;
        this.#pickerNoteText = pickerNoteText;
        this.#noteTextSize = noteTextSize;

        // Graph border left
        HtmlUtils.createElement("div", {text: "Graph border left:", parent: grid, title: "Add some offset to the graph on the left, in px"});
        const graphBorderLeftParent = HtmlUtils.createElement("div", {parent: grid});
        const graphBorderLeft: HTMLInputElement = HtmlUtils.createElement("input", {parent: graphBorderLeftParent, title: "Add some offset to the graph on the left, in px"});
        graphBorderLeft.type = "number";
        graphBorderLeft.min = "0";
        graphBorderLeft.value = initialGraphStyle.graphBorderLeft + "";
        graphBorderLeft.addEventListener("change", evt => {
            const border: number = parseFloat((evt.currentTarget as HTMLInputElement).value);
            if (!(border >= 0))
                return;
            if (border !== this.#state0.graphBorderLeft)
                this.state.stateChanged({graphBorderLeft: border});
        });
        HtmlUtils.createElement("div", {parent: grid});
        this.#graphBorderLeft = graphBorderLeft;
        // Graph border right
        HtmlUtils.createElement("div", {text: "Graph border right:", parent: grid, title: "Add some offset to the graph on the right, in px"});
        const graphBorderRightParent = HtmlUtils.createElement("div", {parent: grid});
        const graphBorderRight: HTMLInputElement = HtmlUtils.createElement("input", {parent: graphBorderRightParent, title: "Add some offset to the graph on the right, in px"});
        graphBorderRight.type = "number";
        graphBorderRight.min = "0";
        graphBorderRight.value = initialGraphStyle.graphBorderRight + "";
        graphBorderRight.addEventListener("change", evt => {
            const border: number = parseFloat((evt.currentTarget as HTMLInputElement).value);
            if (!(border >= 0))
                return;
            if (border !== this.#state0.graphBorderRight)
                this.state.stateChanged({graphBorderRight: border});
        });
        HtmlUtils.createElement("div", {parent: grid});
        this.#graphBorderRight = graphBorderRight;

        HtmlUtils.createElement("div", {text: "Edge label location", parent: grid, title: "Select how the edge label is positioned relative to the edge itself"});
        const edgeLabelLocationParent = HtmlUtils.createElement("div", {parent: grid});
        const edgeLabelLocation = HtmlUtils.createElement("select", {parent: edgeLabelLocationParent, title: "Select how the edge label is positioned relative to the edge itself"});
        ["centered", "left", "right", "optimized"].forEach(location => {
            const title = location === "optimized" ? "Heuristic optimization aiming to place the label next to the edge, without overlapping it. Only applicable for custom grid layout" :
                location;
            const opt = HtmlUtils.createElement("option", {parent: edgeLabelLocation, title: title, text: location});
            opt.value = location;
        });
        edgeLabelLocation.value = initialGraphStyle.edgeLabelLocation;
        edgeLabelLocation.addEventListener("change", evt => {
            const selected: EdgeLabelLocation = (evt.currentTarget as HTMLSelectElement).value as any;
            if (selected && selected !== this.#state0.edgeLabelLocation)
                this.state.stateChanged({edgeLabelLocation: selected});
        });
        edgeLabelLocation.addEventListener("click", evt => evt.stopPropagation());
        this.#edgeLabelLocation = edgeLabelLocation;
        HtmlUtils.createElement("div", {parent: grid});

        HtmlUtils.createElement("div", {text: "Note location", parent: grid, title: "Select how the property notes are positioned relative to the node"});
        const noteLocationParent = HtmlUtils.createElement("div", {parent: grid});
        const noteLocation = HtmlUtils.createElement("select", {parent: noteLocationParent, title: "Select how the property notes are positioned relative to the node"});
        ["optimized", "left", "right", "top", "bottom", "top left", "top right", "bottom left", "bottom right"].forEach(location => {
            const title = location === "optimized" ? "Heuristic optimization for placing the notes." :
                location;
            const opt = HtmlUtils.createElement("option", {parent: noteLocation, title: title, text: location});
            opt.value = location;
        });
        noteLocation.value = initialGraphStyle.noteLocation;
        noteLocation.addEventListener("change", evt => {
            const selected: NoteLocation = (evt.currentTarget as HTMLSelectElement).value as any;
            if (selected && selected !== this.#state0.noteLocation)
                this.state.stateChanged({noteLocation: selected});
        });
        noteLocation.addEventListener("click", evt => evt.stopPropagation());
        this.#noteLocation = noteLocation;
        HtmlUtils.createElement("div", {parent: grid});

        const undoRow: HTMLElement = HtmlUtils.createElement("div", {parent: shadow, clzz: "undo-row"});
        const undo: HTMLInputElement = HtmlUtils.createElement("input", {parent: undoRow});
        undo.type = "button";
        undo.value = "Undo";
        undo.disabled = true;
        undo.addEventListener("click", this.state.undo.bind(this.state));
        const redo: HTMLInputElement = HtmlUtils.createElement("input", {parent: undoRow});
        redo.type = "button";
        redo.value = "Redo";
        redo.disabled = true;
        redo.addEventListener("click", this.state.redo.bind(this.state));
        const toDefault: HTMLInputElement = HtmlUtils.createElement("input", {parent: undoRow});
        redo.type = "button";
        redo.value = "Redo";
        toDefault.addEventListener("click", () => this.state.stateChanged({...initialGraphStyle}));
        toDefault.type = "button";
        toDefault.value = "Defaults";
        toDefault.title = "Reset settings to their default values";
        this.#undo = undo;
        this.#redo = redo;
    }

    private changed(newState: GraphStyleOptions, options: {redoActive: boolean, undoActive: boolean}) {
        this.#state0 = newState;
        this.setMenu(newState);
        this.#undo.disabled = !options.undoActive;
        this.#redo.disabled = !options.redoActive;
        this.dispatchEvent(new CustomEvent<GraphStyleOptions>("change", {detail: newState}));
    }

    private setMenu(state: GraphStyleOptions) {
        const setColor = (picker: HTMLElement&{rgba: string, color: string}, color: string) => {
            if (color && color !== picker.rgba)
                picker.color = color;
        };
        setColor(this.#pickerNodeBkg as any, state.nodeBackgroundColor);
        setColor(this.#pickerNodeText as any, state.nodeTextColor);
        setColor(this.#pickerEdgeLabel as any, state.edgeLabelColor);
        setColor(this.#pickerNoteBkg as any, state.noteBackgroundColor);
        setColor(this.#pickerNoteText as any, state.noteTextColor);
        const setSize = (inp: HTMLInputElement, size: number) => {
            const value: string = size + "";
            if (value !== inp.value)
                inp.value = value;
        }
        setSize(this.#nodeTextSize, state.nodeTextSize);
        setSize(this.#edgeLabelSize, state.edgeLabelSize);
        setSize(this.#edgeWidth, state.edgeWidth);
        setSize(this.#nodeSize, state.nodeSize);
        setSize(this.#noteTextSize, state.noteTextSize);
        const setBorder = (inp: HTMLInputElement, border: number) => {
            if (border >= 0 && inp.value !== border + "")
                inp.value = border + "";
        }
        setBorder(this.#graphBorderLeft, state.graphBorderLeft);
        setBorder(this.#graphBorderRight, state.graphBorderRight);
        this.#edgeLabelLocation.value = state.edgeLabelLocation;
        this.#noteLocation.value = state.noteLocation;
    }

    setParams(params: URLSearchParams) {
        Object.entries(this.#state0).forEach(([key, value]) => params.set(key, value));
        if (this.#state0.graphBorderLeft === 0)
            params.delete("graphBorderLeft");
        if (this.#state0.graphBorderRight === 0)
            params.delete("graphBorderRight");
    }

}