import { Menu } from "./menu/menu.js"
import { Config } from "./config.js";
import { Debugger } from "./debug.js";

async function main() {
    const config: Config = new Config(await fetch("./assets/config.json").then(resp => resp.json()));
    console.log("config", config);
    const debug: Debugger|null = config.debug ? { config: config } : null;
    (document.querySelector("textarea#query") as HTMLTextAreaElement).value = config.initialQuery
    const menu: Menu = new Menu(config, debug);
    import("./graph/graph.js")
        .then(module => module.Graph)
        .then(Graph => {
            const graphTag: string = Graph.register();
            const graph: any = document.createElement(graphTag);
            graph.setStyleOptions(config.initialGraphStyle);
            graph.setNoteOptions(config.initialNotesConfig);
            menu.setGraph(graph);
            document.querySelector("#graph").appendChild(graph);
        });
    if (debug)
        (window as any).d = debug;
    const dialg = document.querySelector("dialog");
    if (!dialg.showModal) // only load the dialog polyfill if native dialog is not available
        import("dialog-polyfill").then(module => module.default.registerDialog(dialg));
}
main();
