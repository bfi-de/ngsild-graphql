import "./responseDebugger.css";
import { HLJSApi } from "highlight.js";
import json from "highlight.js/lib/languages/json";



export class ResponseDebugger {

    readonly #container: HTMLElement;
    readonly #pre: HTMLPreElement;
    readonly #code: HTMLElement;

    constructor(menu: HTMLElement, private readonly hljs: HLJSApi) {
        hljs.registerLanguage("json", json);
        const container = document.createElement("div");
        container.classList.add("response-debugger");
        container.hidden = true;
        this.#pre = document.createElement("pre");
        const code = document.createElement("code");
        this.#pre.appendChild(code);
        this.#code = code;
        container.appendChild(this.#pre);
        menu.appendChild(container);
        this.#container = container;
    }

    set(response: Record<string, any>) {
        this.#code.innerHTML = this.hljs.highlight(JSON.stringify(response, undefined, 4), {language: "json"}).value;
    }

    show() {
        this.#container.hidden = false;
    }

    hide() {
        this.#container.hidden = true;
    }

    toggle() {
        if (this.#container.hidden)
            this.show();
        else
            this.hide();
    }

}