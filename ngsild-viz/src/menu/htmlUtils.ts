export class HtmlUtils {

    private constructor() {}

    static createElement<K extends keyof HTMLElementTagNameMap>(tag: K, options?: {
            text?: string; 
            title?: string;
            clzz?: string|Array<string>;
            id?: string;
            parent?: HTMLElement | DocumentFragment;
        }): HTMLElementTagNameMap[K] {
        const el: HTMLElementTagNameMap[K] = document.createElement(tag);
        if (options?.text)
            el.innerText = options.text;
        if (options?.title)
            el.title = options.title;
        if (options?.clzz) {
            if (Array.isArray(options.clzz))
                options.clzz.forEach(cl => el.classList.add(cl));
            else 
                el.classList.add(options.clzz);
        }
        if (options?.id)
            el.id = options.id;
        options?.parent?.appendChild(el);
        return el;
    }

    static arraysEqualFirstLevel(a: Array<Record<string, any>>, b: Array<Record<string, any>>) {
        if (a === b)
            return true;
        const aEmpty: boolean = (!(a?.length > 0));
        const bEmpty: boolean = (!(b?.length > 0));
        if (aEmpty)
            return bEmpty;
        else if (bEmpty)
            return false;
        if (a.length !== b.length)
            return false;
        for (let idx=0; idx<a.length; idx++) {
            const aObj = a[idx];
            const bObj = b[idx];
            const aKeys: Array<string> = Object.keys(aObj);
            const bKeys: Array<string> = Object.keys(bObj);
            if (aKeys.length !== bKeys.length)
                return false;
            if (aKeys.find(key => aObj[key] !== bObj[key]) !== undefined)
                return false;
        }
        return true;
    }

    static attachSharedStyles(root?: ShadowRoot): HTMLLinkElement {
        const link = document.createElement("link");
        link.setAttribute("rel", "stylesheet");
        link.setAttribute("href", "assets/sharedStyles.css");
        root?.appendChild(link);
        return link;
    }

}