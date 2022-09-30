import { HtmlUtils } from "./htmlUtils.js";

export class GroupsMenu extends HTMLElement {

    private static readonly INPUT_CLASS: string = "group-input";
    //#shadowRoot: ShadowRoot;
    #root: HTMLDivElement;
    readonly #inputBuffer: Array<HTMLElement> = [];

    public static register(): string {
        if (!customElements.get("groups-menu"))
            customElements.define("groups-menu", GroupsMenu);
        return "groups-menu";
    }

    connectedCallback() {
        if (this.shadowRoot)
            return;
        const shadow: ShadowRoot = this.attachShadow({mode: "open"});
        const style = document.createElement("style");
        style.innerHTML = ".input-grid { display: grid; grid-template-columns: auto auto 1fr; column-gap: 1em; row-gap: 0.5em; } .group-ctrl:hover { cursor: pointer; }"; 
        shadow.appendChild(style);
        HtmlUtils.attachSharedStyles(shadow);
        const root: HTMLDivElement = document.createElement("div");
        root.classList.add("input-grid");
        this.#root = root;
        this.#inputBuffer.forEach(el => root.appendChild(el));
        this.#inputBuffer.splice(0, this.#inputBuffer.length);
        shadow.appendChild(root);
        this._addInput(); // create one row of input fields
        this.checkMinuses(false);
    }

    private checkMinuses(addedOrRemoved: boolean): void {
        const allInputs: Array<HTMLInputElement> = Array.from(this.#root.querySelectorAll("input"));
        const length: number = allInputs.length;
        if (addedOrRemoved) {
            // add minuses where they are missing
            allInputs.forEach(i => (i.nextElementSibling.querySelector(".group-ctrl-minus") as HTMLElement).hidden = false);
        } else {
            if (length >= 2)
                return;
            // remove all minuses
            allInputs.forEach(i => (i.nextElementSibling.querySelector(".group-ctrl-minus") as HTMLElement).hidden = true);
        }
    } 

    private _addInput(prev?: HTMLElement): HTMLInputElement {
        const elements: Array<HTMLElement> = [];
        const i: HTMLInputElement = document.createElement("input");
        i.classList.add(GroupsMenu.INPUT_CLASS);
        i.type = "text";
        i.placeholder = "EntityType";
        i.title = "A comma separated list of item types, to be positioned in the same row. Example: \"Building, Room, Storey\".";
        const plusMinusContainer: HTMLDivElement = document.createElement("div");
        const minus = HtmlUtils.createElement("div", {text: "-", title: "Remove group", clzz: ["group-ctrl", "group-ctrl-minus"]});
        const plus = HtmlUtils.createElement("div", {text: "+", title: "Add a new group below", clzz: "group-ctrl"});
        minus.addEventListener("click", (event: Event) => {
            const slf: HTMLElement = (event.currentTarget as HTMLElement).parentElement; 
            const placeholder = slf.nextElementSibling;
            const inpt = slf.previousElementSibling;
            inpt.remove();
            slf.remove();
            placeholder.remove();
            this.checkMinuses(false);
        });
        plus.addEventListener("click", (event: Event) => {
            this._addInput((event.currentTarget as HTMLElement).parentElement.nextElementSibling as HTMLElement);
            this.checkMinuses(true);
        })
        plusMinusContainer.appendChild(minus);
        plusMinusContainer.appendChild(plus);
        elements.push(i);
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

    getGroups(): Array<Array<string>> {
        if (!this.shadowRoot)
            return [];
        return (Array.from(this.shadowRoot.querySelectorAll("input[type=text]." + GroupsMenu.INPUT_CLASS))  as Array<HTMLInputElement>)
            .map(input => input.value)
            .map(value => value.split(",").map(val => val.trim()).filter(val => val))
            .filter(arr => arr.length > 0);
    }

    // we assume here, that no groups have been set before. Otherwise we'd need to clear the existing selection first
    setGroups(groups: Array<Array<string>>) {
        let i: HTMLInputElement = this.shadowRoot.querySelector("input[type=text]:last-of-type." + GroupsMenu.INPUT_CLASS);
        for (const group of groups) {
            i.value = group.join(", ");
            i = this._addInput(i.nextElementSibling.nextElementSibling as HTMLElement);
        }
        this.checkMinuses(true);
    }

}