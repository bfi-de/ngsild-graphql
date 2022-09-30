import { Config } from "../config.js";
import { NoteLocation, NoteOptions, PropertySelector } from "../graph/model.js";
import { HtmlUtils } from "./htmlUtils.js";
import { NoteLocationMenu } from "./noteLocationMenu.js";
import { State } from "./state.js";

export class NotesMenu extends HTMLElement {

    #state0: NoteOptions;
    
    // everything below is quasi readonly
    private state: State<NoteOptions>;
    #hiddenProps: HTMLInputElement;
    #nodesLocationMenu: NoteLocationMenu;
    #undo: HTMLInputElement;
    #redo: HTMLInputElement;

    // only create elements once the default StateOptions object has been passed, in a dedicated method, from the config object
    constructor() {
        super();
        const style: HTMLStyleElement = document.createElement("style");
        //style.textContent = ":host { position: relative; display: block; }";
        style.textContent = ".notes-menu { display: grid; grid-template-columns: auto auto 1fr; column-gap: 1em; align-content: start; row-gap: 0.75em; min-width: 28em; min-height: 14em; } \n" +
            ".undo-row { display: flex; column-gap: 1em }";
        const shadow: ShadowRoot = this.attachShadow({mode: "open"});
        shadow.appendChild(style);
        HtmlUtils.attachSharedStyles(shadow);
    }

    setConfig(config: Config) {
        if (this.#state0)
            return;
        this.#state0 = NotesMenu.copy(config.initialNotesConfig);
        this.state = new State(this.#state0, this.changed.bind(this));
        this.init(NotesMenu.copy(config.initialNotesConfig));
    }

    private init(initialNotesConfig: NoteOptions) {
        const shadow = this.shadowRoot;

        HtmlUtils.createElement("h2", {clzz: "menu-header", text: "Property note configs", parent: shadow});
        const grid: HTMLElement = HtmlUtils.createElement("div", {clzz: "notes-menu", parent: shadow});

        // hidden properties
        const hiddenTitle: string = "Define hidden properties (comma-separated list). Specify either a single property (e.g. \"height\"), " +
            "or properties for a specific type of nodes in the form \"type:<nodeType>:<field>\" (e.g. \"type:Room:height\"\), " + 
            "or properties for an individual node in the form \"label:<nodeLabel>:<field>\" (e.g. \"label:RoomA1:height\"\). " +
            "For the type and label based selectors the field may actually be omitted, in which case all fields are ignored for the selected nodes (example: \"type:Room\")." 
        HtmlUtils.createElement("div", {text: "Hidden properties:", parent: grid, title: hiddenTitle});
        const hiddenParent = HtmlUtils.createElement("div", {parent: grid});
        const hidden = HtmlUtils.createElement("input", {title: hiddenTitle, parent: hiddenParent})
        hidden.type = "text";
        hidden.placeholder = "label:RoomA1";
        hidden.value = Config.serializeSelectors(initialNotesConfig.hiddenProperties);
        hidden.addEventListener("change", (evt => {
            const value: string = (evt.currentTarget as HTMLInputElement).value;
            const selector: Array<PropertySelector>|undefined = Config.parseSelectors(value);
            if (!selector)
                return;
            if (!HtmlUtils.arraysEqualFirstLevel(selector, this.#state0.hiddenProperties))
                this.state.stateChanged({hiddenProperties: selector});
        }));
        HtmlUtils.createElement("div", {parent: grid})
        this.#hiddenProps = hidden;

        // special notes location
        const nodesLocationTag: string = NoteLocationMenu.register();
        const nodesLocationMenu: NoteLocationMenu = document.createElement(nodesLocationTag) as any;
        nodesLocationMenu.addEventListener("change", (event: CustomEvent<Array<[Array<PropertySelector>, NoteLocation]>>) => {
            const newValue: Array<[Array<PropertySelector>, NoteLocation]> = event.detail;
            const differs: boolean = newValue.length !== this.#state0.specialPositions.length || newValue.findIndex((p, idx) => p[1] !== this.#state0.specialPositions[idx][1]) >= 0 || 
                newValue.findIndex((p, idx) => Config.serializeSelectors(p[0]) !== Config.serializeSelectors(this.#state0.specialPositions[idx][0])) >= 0;
            if (differs)
                this.state.stateChanged({specialPositions: event.detail})
        });
        this.#nodesLocationMenu = nodesLocationMenu;
        HtmlUtils.createElement("div", {text: "Notes location", parent: grid, title: "Modify the position for individual notes."});
        grid.appendChild(nodesLocationMenu);
        grid.appendChild(document.createElement("div"));
        nodesLocationMenu.setProperties(initialNotesConfig.specialPositions);


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
        toDefault.addEventListener("click", () => this.state.stateChanged({...initialNotesConfig}));
        toDefault.type = "button";
        toDefault.value = "Defaults";
        toDefault.title = "Reset settings to their default values";
        this.#undo = undo;
        this.#redo = redo;
    }

    private changed(newState: NoteOptions, options: {redoActive: boolean, undoActive: boolean}) {
        const copy = NotesMenu.copy(newState);
        this.#state0 = copy;
        this.setMenu(newState);
        this.#undo.disabled = !options.undoActive;
        this.#redo.disabled = !options.redoActive;
        this.dispatchEvent(new CustomEvent<NoteOptions>("change", {detail: copy}));
    }

    private setMenu(state: NoteOptions) {
        this.#hiddenProps.value = Config.serializeSelectors(state.hiddenProperties);
        this.#nodesLocationMenu.setProperties(state.specialPositions);
    }

    setParams(params: URLSearchParams) {
        const hidden = Config.serializeSelectors(this.#state0.hiddenProperties);
        if (hidden)
            params.set("hiddenProperties", hidden);
        else
            params.delete("hiddenProperties");
        params.delete("specialPositions");
        this.#state0.specialPositions.map(pos => Config.serializeSpecialPosition(pos))
            .forEach(pos => params.append("specialPositions", pos));
    }

    private static copy(config: NoteOptions): NoteOptions {
        return {...config, hiddenProperties: config.hiddenProperties};
    }

}