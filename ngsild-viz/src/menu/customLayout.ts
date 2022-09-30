import { HtmlUtils } from "./htmlUtils.js";
import { GroupsMenu } from "./groupsMenu.js";

export class CustomLayoutMenu {

    static readonly CLASS_IDENTIFIER: string = "custom-menu";

    #groupsSelector: GroupsMenu;
    // state
    #visible: boolean = false;

    /**
     * @param parent a display: grid element with three columns
     */
    constructor(private readonly parent: HTMLElement) {
        const grouped: HTMLDivElement = HtmlUtils.createElement("div", { text: "Groups", parent: parent, clzz: CustomLayoutMenu.CLASS_IDENTIFIER, title: "Specify entity types to be grouped in the same row"});
        const groupsTag: string = GroupsMenu.register();
        const groupsSelector: GroupsMenu = document.createElement(groupsTag) as any;
        this.#groupsSelector = groupsSelector;
        groupsSelector.classList.add(CustomLayoutMenu.CLASS_IDENTIFIER);
        parent.appendChild(groupsSelector);
        const filler = document.createElement("div");
        filler.classList.add(CustomLayoutMenu.CLASS_IDENTIFIER);
        parent.appendChild(filler);
    }

    isVisible(): boolean {
        return this.#visible;
    }

    show() {
        this.#visible = true;
        this.parent.querySelectorAll("." + CustomLayoutMenu.CLASS_IDENTIFIER).forEach(el => (el as HTMLElement).hidden = false);
    }

    hide() {
        this.#visible = false;
        this.parent.querySelectorAll("." + CustomLayoutMenu.CLASS_IDENTIFIER).forEach(el => (el as HTMLElement).hidden = true);
    }

    setGroups(groups: Array<Array<string>>) {
        this.#groupsSelector.setGroups(groups);
    }

    getSelectedGroups(): Array<Array<string>> {
        return this.#groupsSelector.getGroups();
    }

}