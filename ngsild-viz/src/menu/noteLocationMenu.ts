import { Config } from "../config.js";
import { NoteLocation, PropertySelector } from "../graph/model.js";
import { HtmlUtils } from "./htmlUtils.js";

// mostly copied from groupsMenu
export class NoteLocationMenu extends HTMLElement {

    private static readonly INPUT_CLASS: string = "node-selector";
    #root: HTMLElement;
    readonly #inputBuffer: Array<HTMLElement> = [];

    public static register(): string {
        if (!customElements.get("note-location-menu"))
            customElements.define("note-location-menu", NoteLocationMenu);
        return "note-location-menu";
    }

    connectedCallback() {
        if (this.shadowRoot)
            return;
        const shadow: ShadowRoot = this.attachShadow({mode: "open"});
        const style = document.createElement("style");
        style.innerHTML = ".input-grid { display: grid; grid-template-columns: auto auto auto 1fr; column-gap: 1em; row-gap: 0.5em; align-items: center; } .group-ctrl:hover { cursor: pointer; }"; 
        shadow.appendChild(style);
        HtmlUtils.attachSharedStyles(shadow);
        const root: HTMLDivElement = document.createElement("div");
        root.classList.add("input-grid");
        this.#root = root;
        this.#inputBuffer.forEach(el => root.appendChild(el));
        this.#inputBuffer.splice(0, this.#inputBuffer.length);
        shadow.appendChild(root);
        this._addRow(); // create one row of input fields
        this.checkMinuses(false);
    }

     // we assume here, that no properties have been set before. Otherwise we'd need to clear the existing selection first
    setProperties(props: Array<[Array<PropertySelector>, NoteLocation]>) {
        const rows = Array.from(this.shadowRoot.querySelectorAll("input[type=text]." + NoteLocationMenu.INPUT_CLASS));
        for (let idx=0; idx<rows.length-1; idx++) { // keep last row
            let el = rows[idx];
            for (let i=0; i<4; i++) {
                const el2 = el.nextElementSibling;
                el.remove();
                el = el2;
            }
        }
        let i: HTMLInputElement = this.shadowRoot.querySelector("input[type=text]:last-of-type." + NoteLocationMenu.INPUT_CLASS);
        for (const [selectors, location] of props) {
            const sel: string = Config.serializeSelectors(selectors);
            i.value = sel;
            i.nextElementSibling.querySelector("select").value = location;
            i = this._addRow(i.nextElementSibling.nextElementSibling.nextElementSibling as HTMLElement);
        }
        this.checkMinuses(true);
    }

    getProperties(): Array<[Array<PropertySelector>, NoteLocation]> {
        const allInputs: Array<HTMLInputElement> = Array.from(this.#root.querySelectorAll("input." + NoteLocationMenu.INPUT_CLASS));
        return allInputs.map(input => {
            const selector: string = input.value;
            const selectors =  Config.parseSelectors(selector);
            const selectedPosition: NoteLocation = input.nextElementSibling.querySelector("select").value as NoteLocation;
            if (!(selectors?.length > 0) || !selectedPosition)
                return undefined;
            return [selectors, selectedPosition] as [Array<PropertySelector>, NoteLocation];
        }).filter(arr => arr);
    }

    private checkMinuses(addedOrRemoved: boolean): void {
        const allInputs: Array<HTMLInputElement> = Array.from(this.#root.querySelectorAll("input." + NoteLocationMenu.INPUT_CLASS));
        const length: number = allInputs.length;
        if (addedOrRemoved) {
            // add minuses where they are missing
            allInputs.forEach(i => (i.nextElementSibling.nextElementSibling.querySelector(".group-ctrl-minus") as HTMLElement).hidden = false);
        } else {
            if (length >= 2)
                return;
            // remove all minuses
            allInputs.forEach(i => (i.nextElementSibling.nextElementSibling.querySelector(".group-ctrl-minus") as HTMLElement).hidden = true);
        }
    } 

    private _addRow(prev?: HTMLElement) {
        const elements: Array<HTMLElement> = [];
        const i: HTMLInputElement = document.createElement("input");
        i.classList.add(NoteLocationMenu.INPUT_CLASS);
        i.type = "text";
        i.placeholder = "type:Room";
        i.title = "Specify either a single property (e.g. \"height\"), which will select all nodes having this property, " +
        "or properties for a specific type of nodes in the form \"type:<nodeType>\" (e.g. \"type:Room\"\), " + 
        "or properties for an individual node in the form \"label:<nodeLabel>\" (e.g. \"label:RoomA1\"\). " +
        "The position of the notes for the selected nodes will be adapted accordingly";
        const selectorParent = document.createElement("div");
        const selector = HtmlUtils.createElement("select", {parent: selectorParent, title: "Select position"});
        ["optimized", "left", "right", "top", "bottom", "top left", "top right", "bottom left", "bottom right"].forEach(location => {
            const title = location === "optimized" ? "Heuristic optimization for placing the notes." :
                location;
            const opt = HtmlUtils.createElement("option", {parent: selector, title: title, text: location});
            opt.value = location;
        });
        selector.value = "top"; // ?
        const listener = () => {
            const selectors = Config.parseSelectors(i.value);
            const position = selector.value;
            if (position && (selectors || i.value.trim().length === 0))
                this.dispatchEvent(new CustomEvent<Array<[Array<PropertySelector>, NoteLocation]>>("change", {detail: this.getProperties()}))
        };
        selector.addEventListener("change", listener);
        i.addEventListener("change", listener);
        selector.addEventListener("click", evt => evt.stopPropagation());

        const plusMinusContainer: HTMLDivElement = document.createElement("div");
        const minus = HtmlUtils.createElement("div", {text: "-", title: "Remove line", clzz: ["group-ctrl", "group-ctrl-minus"]});
        const plus = HtmlUtils.createElement("div", {text: "+", title: "Add a new line below", clzz: "group-ctrl"});
        minus.addEventListener("click", (event: Event) => {
            const slf: HTMLElement = (event.currentTarget as HTMLElement).parentElement; 
            const placeholder = slf.nextElementSibling;
            const selector = slf.previousElementSibling;
            const inpt = selector.previousElementSibling;
            inpt.remove();
            selector.remove();
            slf.remove();
            placeholder.remove();
            this.checkMinuses(false);
        });
        plus.addEventListener("click", (event: Event) => {
            this._addRow((event.currentTarget as HTMLElement).parentElement.nextElementSibling as HTMLElement);
            this.checkMinuses(true);
        })
        plusMinusContainer.appendChild(minus);
        plusMinusContainer.appendChild(plus);
        elements.push(i);
        elements.push(selectorParent);
        elements.push(plusMinusContainer);
        elements.push(document.createElement("div"));
        if (prev) {
            const refElement: Element = prev.nextElementSibling;
            elements.forEach(el => prev.parentElement.insertBefore(el, refElement));
        }
        else if (this.#root)
            elements.forEach(el => this.#root.appendChild(el));
        else
            this.#inputBuffer.push(...elements);
        return i;
    }



}