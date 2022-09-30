import "./menu.css";
import hljs from "highlight.js/lib/core";
import "highlight.js/styles/github.css"; /* foundation, github, googlecode */
// @ts-ignore
import hljsDefineGraphQl from "highlightjs-graphql";
import { Config } from "../config.js";
import { Debugger } from "../debug.js";
import { ResponseDebugger } from "./responseDebugger.js";
import { CustomLayoutMenu } from "./customLayout.js";
import { HtmlUtils } from "./htmlUtils.js";
import { GraphOptions, GraphStyleOptions, NoteOptions } from "../graph/model.js";
hljsDefineGraphQl(hljs);

export class Menu {

    private static readonly CYTOSCAPE_LAYOUTS: Array<SelectOption> = [
        { id: "grid", description: "Place elements in a well-spaced grid (default)" },
        { id: "circle", description: "Place elements in a circle" },
        { id: "concentric", description: "Positions nodes in concentric circles" },
        { id: "breadthfirst", description: "Puts nodes in a hierarchy, based on a breadthfirst traversal of the graph. It is best suited to trees and forests in its default top-down mode, and it is best suited to DAGs in its circle mode" },
        { id: "cose", description: "The Compound Spring Embedder (cose) layout uses a physics simulation to lay out graphs." },
        { id: "random", description: "Random nodes positioning." },
        { id: "preset", description: "Manual positioning. Requires the \"position\" field to be present in the result nodes." },
        { id: "null", description: "puts all nodes at (0, 0). It’s useful for debugging purposes." },
        { id: "custom", description: "TODO" }
    ];

    graph: any; /*Graph*/
    readonly #mainElement: HTMLElement;
    readonly #codeContainer: HTMLElement;
    readonly #buttonMenu: HTMLElement;
    readonly #optionsGrid: HTMLElement;
    // state
    #visible: boolean = true;

    readonly #codeBlock: HTMLElement;
    readonly #input: HTMLTextAreaElement;
    readonly #server: HTMLInputElement;
    readonly #responseDebugger: ResponseDebugger|null;
    readonly #submitButton: HTMLInputElement;
    readonly #cancelButton: HTMLInputElement;
    readonly #resetGraphButton: HTMLInputElement;
    readonly #fitGraphButton: HTMLInputElement;
    readonly #downloadButton: HTMLInputElement;
    readonly #storeUrlButton: HTMLInputElement;
    readonly #clearButton: HTMLInputElement;
    readonly #toggleNotesButton: HTMLInputElement;
    readonly #toggleMenuButton: HTMLInputElement;
    readonly #errorsField: HTMLDivElement;

    readonly #layoutSelector: HTMLSelectElement;
    readonly #styleMenuOpener: HTMLInputElement;
    readonly #noteMenuOpener: HTMLInputElement;

    // created on demand
    #customLayoutMenu: CustomLayoutMenu;

    // state
    #active: boolean = false;
    #controller: AbortController|undefined;

    constructor(private readonly config: Config, debug: Debugger|null) {
        this.#mainElement = document.querySelector("#menu");
        this.#mainElement.classList.add("menu");
        this.#codeContainer = this.#mainElement.querySelector("#codeBlock");
        this.#optionsGrid = this.#mainElement.querySelector("#optionsGrid");

        this.#codeBlock = this.#mainElement.querySelector("pre");
        this.#codeBlock.classList.add("query-block");
        this.#codeBlock.querySelector("code").classList.add("full-width")
        this.#input = this.#mainElement.querySelector("textarea");
        this.#codeBlock.querySelector("code").innerHTML = hljs.highlight(this.#input.textContent, {language: "graphql"}).value;
        this.#input.addEventListener("change", (event: Event) => {
            //  within the textarea it is not possible to style the text. Need some duplicate tag
            // https://css-tricks.com/creating-an-editable-textarea-that-supports-syntax-highlighted-code/
            const highlighted: string = hljs.highlight((event.currentTarget as HTMLTextAreaElement).value, {language: "graphql"}).value;
            this.#codeBlock.querySelector("code").innerHTML = highlighted;
        });
        this.#input.dispatchEvent(new Event("change"));
        this.#input.addEventListener("blur", (event: Event) => {
            if ((event.currentTarget as HTMLTextAreaElement).value.trim()) {
                this.hideEditor();
            }
        });
        this.#codeBlock.addEventListener("click", () => {
            this.showEditor();
            // place cursor in textarea
            this.#input.focus();
            this.#input.setSelectionRange(1, 2);
        });

        this.#responseDebugger = config.responseDebugger ? new ResponseDebugger(this.#codeContainer, hljs) : null;
        const createButton = (legend: string, parent: HTMLElement, title?: string, listener?: () => any, disabled?: boolean): HTMLInputElement => {
            const btn: HTMLInputElement = document.createElement("input");
            btn.type = "button";
            btn.value = legend;
            if (title)
                btn.title = title;
            if (disabled)
                btn.disabled = true;
            btn.addEventListener("click", listener);
            parent.appendChild(btn);
            return btn;
        };
        const buttonRow: HTMLElement = this.#mainElement.querySelector("#buttonMenu");
        this.#buttonMenu = buttonRow;
        buttonRow.classList.add("button-row");
        const submit: HTMLInputElement = createButton("Submit", buttonRow, "Send GraphQL query", () => this.send(server.value));
        this.#submitButton = submit;
        const cancel: HTMLInputElement = createButton("Cancel", buttonRow, "Cancel ongoing query", () => this.cancel(), true);
        this.#cancelButton = cancel;
        const reset: HTMLInputElement = createButton("Reset graph", buttonRow, "Reset graph zoom and pan", () => this.graph?.reset(), true);
        this.#resetGraphButton = reset;
        const fit: HTMLInputElement = createButton("Fit graph", buttonRow, "Fit graph", () => this.graph?.fit(), true);
        this.#fitGraphButton = fit;
        const download: HTMLInputElement = createButton("Download graph", buttonRow, "Downlad a png image", () => this.graph?.download(), true);
        this.#downloadButton = download;
        this.#storeUrlButton = createButton("Store URL", buttonRow, "Store current settings in URL parameters", () => this.toUrl());
        const clearButton = createButton("Clear graph", buttonRow, "Clear graph", () => {
            this.graph?.clearGraph();
            this.#resetGraphButton.disabled = true;
            this.#fitGraphButton.disabled = true;
            this.#downloadButton.disabled = true;
            this.#clearButton.disabled = true;
            this.#toggleNotesButton.disabled = true;
        }, true);
        this.#clearButton = clearButton;
        const toggleNotesButton = createButton("Hide notes", buttonRow, "Hide the notes", () => {
            if (this.graph?.toggleNotes())
                this.#toggleNotesButton.value = "Hide notes";
            else
                this.#toggleNotesButton.value = "Show notes";
        }, true);
        this.#toggleNotesButton = toggleNotesButton;
        const toggleMenuButton = createButton("Hide menu", buttonRow, "Hide the menu and display the graph at almost full-screen", () => this.toggleMenu());
        this.#toggleMenuButton = toggleMenuButton;

        this.#errorsField = this.#mainElement.querySelector("#errors");
        this.#layoutSelector = document.createElement("select");
        this.#layoutSelector.addEventListener("change", evt => {
            const layout: string = (evt.currentTarget as HTMLSelectElement).value;
            const options: GraphOptions = {layout: layout};
            if (layout === "custom") {
                this.showCustomElements(config.initialGroups); // show custom menu // TODO build graph
                options.typeGroups = this.#customLayoutMenu.getSelectedGroups();
            }
            else {
                this.#customLayoutMenu?.hide();
            }
            this.graph?.setGraph(undefined, options);
        })
        Menu.CYTOSCAPE_LAYOUTS.forEach(layout => {
            const opt: HTMLOptionElement = document.createElement("option");
            opt.value = layout.id;
            opt.text = layout.label || layout.id;
            if (layout.description)
                opt.title = layout.description;
            if (layout.id === config.initialLayout)
                opt.selected = true;
            this.#layoutSelector.appendChild(opt);
        });
        const brk = () => this.#mainElement.appendChild(document.createElement("br"));
        brk();
        const optionsGrid: HTMLDivElement = this.#optionsGrid as HTMLDivElement;
        optionsGrid.classList.add("options-grid");
        HtmlUtils.createElement("div", {parent: optionsGrid, text: "Server", title: "Select the server URL" });
        const server: HTMLInputElement = HtmlUtils.createElement("input", {parent: optionsGrid, title: "Select the server URL" });
        server.type = "text";
        server.value = config.server;
        server.addEventListener("change", () => {}); // TODO 
        this.#server = server;
        HtmlUtils.createElement("div", {parent: optionsGrid});

        

        optionsGrid.appendChild(HtmlUtils.createElement("div", { text: "Grid layout", title: "Select the grid type" }));
        const layoutSelectorParent = HtmlUtils.createElement("div");
        layoutSelectorParent.appendChild(this.#layoutSelector);
        optionsGrid.appendChild(layoutSelectorParent);
        optionsGrid.appendChild(HtmlUtils.createElement("div"));
        // style menu opener
        optionsGrid.appendChild(HtmlUtils.createElement("div", { text: "Edit styles", title: "Edit the graph styling" }));
        const styleOpenerParent = HtmlUtils.createElement("div");
        this.#styleMenuOpener = HtmlUtils.createElement("input", {title: "Edit the graph styling", parent: styleOpenerParent});
        this.#styleMenuOpener.type = "button";
        this.#styleMenuOpener.value = "Open menu";
        const modalCloseListener = (evt: MouseEvent) => {
            const dialog: HTMLDialogElement = evt.currentTarget as HTMLDialogElement;
            const rect: DOMRect = dialog.getBoundingClientRect();
            const clickedInDialog = rect.top <= evt.clientY && evt.clientY <= rect.top + rect.height + 15 &&  // some extra space for scroll bars
                rect.left <= evt.clientX &&  evt.clientX <= rect.left + rect.width + 15;
            if (!clickedInDialog) {
                dialog.close();
                dialog.removeEventListener("click", modalCloseListener);
            }
        };
        const styleModalOpener = async () => {
            const dialog: HTMLDialogElement = document.querySelector("dialog#styleMenuDialog") as HTMLDialogElement;
            dialog.showModal();
            if (!customElements.get("ngsildgraphviz-style-menu")) {
                const menuClass = (await import("./styleMenu.js")).StyleMenu; // lazy load StyleMenu and all its dependencies
                customElements.define("ngsildgraphviz-style-menu", menuClass);
                const styleMenu /*: StyleMenu */ = document.querySelector("ngsildgraphviz-style-menu");
                styleMenu.addEventListener("change", (event: CustomEvent<GraphStyleOptions>) => this.graph?.setStyleOptions(event.detail));
                // @ts-ignore
                styleMenu.setConfig(config);
            }
            dialog.addEventListener("click", modalCloseListener);
        }
        this.#styleMenuOpener.addEventListener("click", styleModalOpener);
        optionsGrid.appendChild(styleOpenerParent);
        optionsGrid.appendChild(HtmlUtils.createElement("div"));

        // notes menu opener
        optionsGrid.appendChild(HtmlUtils.createElement("div", { text: "Edit notes", title: "Edit the property notes" }));
        const noteOpenerParent = HtmlUtils.createElement("div");
        this.#noteMenuOpener = HtmlUtils.createElement("input", {title: "Edit the property notes", parent: noteOpenerParent});
        this.#noteMenuOpener.type = "button";
        this.#noteMenuOpener.value = "Open menu";
        const notesModalOpener = async () => {
            const dialog: HTMLDialogElement = document.querySelector("dialog#notesMenuDialog") as HTMLDialogElement;
            dialog.showModal();
            if (!customElements.get("ngsildgraphviz-notes-menu")) {
                const menuClass = (await import("./notesMenu.js")).NotesMenu; // lazy load NotesMenu and all its dependencies
                customElements.define("ngsildgraphviz-notes-menu", menuClass);
                const notesMenu /*: NotesMenu */ = document.querySelector("ngsildgraphviz-notes-menu");
                notesMenu.addEventListener("change", (event: CustomEvent<NoteOptions>) => this.graph?.setNoteOptions(event.detail));
                // @ts-ignore
                notesMenu.setConfig(config);
            }
            dialog.addEventListener("click", modalCloseListener);
        }
        this.#noteMenuOpener.addEventListener("click", notesModalOpener);
        optionsGrid.appendChild(noteOpenerParent);
        optionsGrid.appendChild(HtmlUtils.createElement("div"));

        this.#optionsGrid = optionsGrid;
        //this.#mainElement.appendChild(optionsGrid);
        

        if (debug) {
            debug.menu = () => this.toggleMenu();
            debug.edit = () => this.toggleEditor();
            debug.send = () => this.send(server.value);
            debug.toUrl = () => this.toUrl();
            //debug.graph = graph;
            debug.graph = () => this.graph;
            debug.cyGraph = () => this.graph?.getGraph();
            if (this.#responseDebugger) {
                debug.resp = () => this.#responseDebugger.toggle()
            }

        }
    }

    // expected to be called just once
    setGraph(graph: any) {
        this.graph = graph;
        graph.collapsed = this.#visible;
        this.#layoutSelector.dispatchEvent(new Event("change"));
        const params: URLSearchParams = new URLSearchParams(window.location.search);
        if (params.has("submit"))
            this.#submitButton.dispatchEvent(new Event("click"));
        if (params.has("hidemenu") || params.has("hideMenu"))
            this.#toggleMenuButton.dispatchEvent(new Event("click"))
    }

    private async send(url: string): Promise<Record<string, any>> {
        if (this.#active)
            throw new Error("Loading...");
        this.#active = true;
        this.clearError();
        try {
            this.#submitButton.disabled = true;
            this.#cancelButton.disabled = false;
            return await this._sendInternal(url);
        } catch (e) {
            this.setError(e);
        } finally {
            this.#active = false;
            this.#submitButton.disabled = false;
            this.#cancelButton.disabled = true;
        }
    }

    cancel(): void {
        if (!this.#active)
            return;
        try {
            this.#submitButton.disabled = false;
            this.#cancelButton.disabled = true;
            this.#controller?.abort();
        } finally {
            this.#active = false;
        }
    }

    private setError(text: string) {
        this.#errorsField.textContent = text;
        this.#errorsField.hidden = false;
    }

    private clearError() {
        this.#errorsField.textContent = "";
        this.#errorsField.hidden = true;
    }

    private async _sendInternal(url: string): Promise<Record<string, any>> {
        const body = { query: this.#input.value };
        const controller: AbortController = new AbortController();
        const signal: AbortSignal = controller.signal;
        this.#controller = controller;
        this.clearError();
        const response: Response = await fetch(url, {
            method: "POST",
            body: JSON.stringify(body),
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json"
            },
            signal: signal
        });
        // TODO clear graph on error?
        // TODO store graph query on success?
        if (!response.ok) {
            const content: string = await response.text();
            this.#controller = undefined;
            this.#responseDebugger?.set({ 
                status: response.status,
                statusText: response.statusText,
                error: content
            });
            throw new Error("Query failed: " + response.status + " " + response.statusText + "; " + content);
        }
        const result: GraphQlResult = await response.json();
        this.#controller = undefined;
        this.#responseDebugger?.set(result);
        if (result.errors?.length > 0) {
            /*
            this.setError(JSON.stringify(result.errors, undefined, 4));
            throw new Error("An error occurred: " + result.errors[0].message + " (" + result.errors[0].locations + ")");
            */
           throw JSON.stringify(result.errors, undefined, 4);
        }
        const opts: GraphOptions = {layout: this.#layoutSelector.value, wheelSensitivity: this.config.wheelSensitivity }; // TODO configurable wheel sensitivity?
        if (opts.layout === "custom")
            opts.typeGroups = this.#customLayoutMenu.getSelectedGroups();
        this.graph?.setGraph({ graph: result.data}, opts);
        this.#resetGraphButton.disabled = false;
        this.#fitGraphButton.disabled = false;
        this.#downloadButton.disabled = false;
        this.#clearButton.disabled = false;
        this.#toggleNotesButton.disabled = false;
        this.#toggleNotesButton.value = "Hide notes";
        return result.data;
    }

    show() {
        this.#codeContainer.classList.remove("hidden");
        this.#optionsGrid.classList.remove("hidden");
        this.#buttonMenu.classList.remove("flex-vertical");
        this.#mainElement.classList.remove("menu-hidden");
        this.#toggleMenuButton.value = "Hide menu";
        //this.#mainElement.hidden = false;
        if (this.graph)
            this.graph.collapsed = true;
        this.#visible = true;
    }
    
    hide() {
        this.#codeContainer.classList.add("hidden");
        this.#optionsGrid.classList.add("hidden");
        this.#buttonMenu.classList.add("flex-vertical");
        this.#mainElement.classList.add("menu-hidden");
        this.#toggleMenuButton.value = "Show menu";
        //this.#mainElement.hidden = true;
        if (this.graph)
            this.graph.collapsed = false;
        this.#visible = false;
    }

    showEditor() {
        this.#codeBlock.hidden = true;
        this.#input.hidden = false;
    }

    hideEditor() {
        this.#input.hidden = true;
        this.#codeBlock.hidden = false;
    }

    private isEditorVisible(): boolean {
        return !this.#input.hidden;
    }

    private toggleMenu() {
        if (!this.#visible)
            this.show();
        else
            this.hide();
    }

    private toggleEditor() {
        if (this.isEditorVisible())
            this.hideEditor();
        else
            this.showEditor();
    }

    private showCustomElements(initialGroups?: Array<Array<string>>) {
        if (!this.#customLayoutMenu) {
            this.#customLayoutMenu = new CustomLayoutMenu(this.#optionsGrid);
            if (initialGroups)
                this.#customLayoutMenu.setGroups(initialGroups);
        }
        this.#customLayoutMenu.show();
    }

    // see Config constructor for parameter names
    private toUrl() {
        const url: URL = new URL(window.location.href);
        const params: URLSearchParams = url.searchParams;
        params.set("server", this.#server.value.trim());
        //@ts-ignore
        params.set("initialQuery", this.#input.value.replaceAll("\n", "__n"));
        if (this.#customLayoutMenu) {
            const groups = this.#customLayoutMenu.getSelectedGroups().filter(g => g.length > 0).map(g => g.join(",")).join(";").trim();
            if (groups)
                params.set("initialGroups", groups);
        }
        const layout = this.#layoutSelector.value;
        if (layout)
            params.set("initialLayout", layout);
        const styleMenu = document.querySelector("ngsildgraphviz-style-menu");
        if ((styleMenu as any).setParams)
            (styleMenu as any)?.setParams(params); // by side effects
        const notesMenu = document.querySelector("ngsildgraphviz-notes-menu");
        if ((notesMenu as any).setParams)
            (notesMenu as any)?.setParams(params); // by side effects
        if (this.graph.isShown())
            params.set("submit", "true");
        else
            params.delete("submit");
        if (this.graph.collapsed)
            params.delete("hidemenu");
        else
            params.set("hidemenu", "true");
        window.history.pushState(undefined, undefined, url.toString());
    }

}

interface GraphQlResult {
    data?: Record<string, any>;
    errors?: Array<{message: string, locations?: Array<{line: number, column: number}>}>;
}

interface SelectOption {
    id: string;
    label?: string;        // if absent id will be used as label
    description?: string;  // if present, the title attribute will be set
}