// TODO AND/OR
export class Conditions {

    public static isObjectConditionValue(cond: any): boolean {
        const tp: string = typeof cond;
        switch (tp) {
        case "string":
        case "number":
        case "boolean":
        case "undefined":
            return false;
        case "object":
            return !Array.isArray(cond) && cond !== null; // Arrays can only appear in leaves
        default:
            throw new Error("Unexpected condition type " + tp + " in condition " + cond);
        }
    }

    public static isLeaveCondition(condition: Record<string, any>): boolean {
        return Object.values(condition).find(cond => !Conditions.isObjectConditionValue(cond)) !== undefined;
    }

    public static requiresExistence(filter: Record<string, any>): boolean {
        const isLeaveCondition: boolean = Conditions.isLeaveCondition(filter);
        if (isLeaveCondition)
            return Object.entries(filter).find(entry => entry[0] !== "exists" || entry[1]) !== undefined;
        // nested filters
        return Object.values(filter as Record<string, Record<string, any>>).find(entry => Conditions.requiresExistence(entry)) !== undefined;
    }

    public static acceptFilterCondition(value: any, filterCondition: [string, any]): boolean {
        const conditionType: string = filterCondition[0];
        const conditionValue: any = filterCondition[1];
        switch (conditionType) {
        case "exists": // conditionValue of type boolean expected
            return conditionValue ? !!value : !value;
        case "eq":
            return value === conditionValue; // TODO this comparison does not work for arrays, for instance
        case "gt":
            return value > conditionValue;
        case "geq":
            return value >= conditionValue;
        case "lt":
            return value < conditionValue;
        case "leq":
            return value <= conditionValue;
        case "in":
            return Array.isArray(conditionValue) && conditionValue.indexOf(value) >= 0;
        case "startsWith":
            return typeof value === "string" && value.startsWith(conditionValue);
        case "endsWith":
            return typeof value === "string" && value.endsWith(conditionValue);
        case "contains":
            return typeof value === "string" && value.indexOf(conditionValue) >= 0;
        default:
            throw new Error("Unexpected filter condition " + conditionType + ": " + conditionValue);
        }
    }

}
