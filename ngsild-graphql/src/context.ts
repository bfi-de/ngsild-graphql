export interface Context {
    getExpandedTerm(shortName: string): string;
    getShortTerm(expandedTerm: string): string;
    isEmpty(): boolean;
    json(): Record<string, any>;
}

export const getContextObject = (context: Readonly<Record<string, any>>): Context => {
    if (!context)
        return new EmptyContext();
    return new ContextImpl(context);
}

class ContextImpl implements Context{
    
    private readonly namespaces: Map<string, string>;
    private readonly expandedTerms: Map<string, string>;

    constructor(private readonly _context: Readonly<Record<string, any>>) {
        this.namespaces = new Map(Object.entries(_context)
            .filter(entry => {
                if (typeof entry[1] !== "string")
                    return false;
                const lower: string = entry[1].toLowerCase();
                return (lower.startsWith("https://") || lower.startsWith("http://") || lower.startsWith("file://"))
                    && (lower.endsWith("/") || lower.endsWith("#")); // ok?
            }));
        this.expandedTerms = new Map(Object.entries(_context)
            .filter(entry => entry[0] !== "@id" && entry[0] !== "@type" &&  entry[0] !== "id" && entry[0] !== "type" && !this.namespaces.has(entry[0]) && entry[1])
            .map(entry => {
                const value = typeof entry[1] === "string" ? entry[1] : "@id" in entry[1] ? entry[1]["@id"] : "id" in entry[1] ? entry[1].id : null;
                if (!value || typeof value !== "string")
                    return null;
                const lower: string = value.toLowerCase();
                if (lower.startsWith("https://") || lower.startsWith("http://") || lower.startsWith("file://"))
                    return [entry[0], value] as [string, string];
                const firstColon: number = value.indexOf(":");
                if (!firstColon)
                    return [entry[0], value] as [string, string];
                const prefix: string = this.namespaces.get(value.substring(0, firstColon));
                if (prefix)
                    return [entry[0], prefix + value.substring(firstColon + 1)] as [string, string];
                return [entry[0], value] as [string, string];
            })
            .filter(entry => entry));
    }

    public getExpandedTerm(shortName: string): string {
        return this.expandedTerms.get(shortName) || shortName;
    }

    public getShortTerm(expandedTerm: string): string {
        for (const [key, value] of this.expandedTerms) {
            if (value === expandedTerm)
                return key;
        }
        return expandedTerm;
    }

    isEmpty(): boolean {
        return this.expandedTerms.size === 0;
    }

    json() {
        return this._context;
    }

}

class EmptyContext implements Context {
    getExpandedTerm(shortName: string): string {
        return shortName;
    }
    getShortTerm(expandedTerm: string): string {
        return expandedTerm;
    }
    isEmpty(): boolean {
        return true;
    }
    json() {
        return {};
    }
}

