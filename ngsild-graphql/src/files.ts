import { readdirSync } from "fs";
import merge from "json-schema-merge-allof/src/index.js";
import $RefParser from "@apidevtools/json-schema-ref-parser/lib/index.js";
import { Config } from "./config.js";

export class FileUtils {

    /**
     * Returns [json schemas, hierarchies]
     * @param config 
     */
    static async parseFiles(config: Config): Promise<[Array<Record<string, any>>, Record<string, string|Array<string>>]> {
        const files: Array<string> = [];
        FileUtils.getFiles(config.baseFolder, files, config.filteredFileNames, config.filteredFolderNames);
        const parser: $RefParser = new $RefParser();
        const jsonSchemas: Array<Record<string, any>> = [];
        for (const file of files) {
            const jsonSchemaCompiled: Record<string, any> = merge(await parser.dereference(file, {}), { resolvers: {
                "x-extends": (values: Array<any>, path: Array<string>, _, __) => FileUtils.mergeExtensions(values)
            }});
            jsonSchemas.push(jsonSchemaCompiled);
        }
        // jsonSchemas.forEach(schema => console.log(" SCHEMA ", schema.title, ", extends: ", schema["x-extends"]));
        const clearFileEnding = (id: string): string => {
            const lastDot: number = id.lastIndexOf(".");
            return lastDot >= 0 ? id.substring(0, lastDot) : id;
        }
        const hierarchies: Record<string, string|Array<string>> = Object.fromEntries(jsonSchemas
            .filter(schema => schema["x-extends"] && schema["$id"])
            .map(schema => [clearFileEnding(schema["$id"]), schema["x-extends"]]));
        return [jsonSchemas, hierarchies];
    }

    private static getFiles(folder: string, files: Array<string>, filteredFileNames: ReadonlyArray<string>, filteredFolderNames: ReadonlyArray<string>) {
        const files0: Array<string> = readdirSync(folder, {withFileTypes: true})
            .filter(item => !item.isDirectory())
            .map(item => item.name)
            .filter(item => item.toLowerCase().endsWith(".json"))
            .filter(item => filteredFileNames.indexOf(item.substring(0, item.length-5)) < 0)
            .map(f => folder + "/" + f);
        files.push(...files0);
        readdirSync(folder, {withFileTypes: true})
            .filter(item => item.isDirectory())
            .map(item => item.name)
            .filter(dir => filteredFolderNames.indexOf(dir) < 0)
            .forEach(dir => FileUtils.getFiles(folder + "/" + dir, files, filteredFileNames, filteredFolderNames))
    }


    private static mergeExtensions(values: string|Array<any>): Array<string> {
        if (typeof values === "string")
            return [values];
        if (!(values?.length > 0) || !values.find(entry => typeof entry !== "string"))
            return values;
        const result: Array<string> = [];
        for (const value of values) {
            if (typeof value === "string")
                result.push(value);
            else if (Array.isArray(value))
                result.push(...value);
        }
        return result;
    }

}