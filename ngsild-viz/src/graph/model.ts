export interface GraphModel {

    graph: Record<string, any>;
    options?: GraphOptions;

}

export interface GraphOptions {

    layout?: string;
    wheelSensitivity?: number;
    typeGroups?: Array<Array<string>>;
    idGroupds?: Array<Array<string>>;

}

export type EdgeLabelLocation = "centered"|"left"|"right"|"optimized";
export type NoteLocation = "left"|"right"|"optimized"|"top"|"bottom"|"top left"|"top right"|"bottom left"|"bottom right";

export interface GraphStyleOptions {
    nodeBackgroundColor: string;
    nodeTextColor: string;
    nodeTextSize: number;
    edgeLabelColor: string;
    edgeLabelSize: number;
    noteBackgroundColor: string;
    noteTextColor: string;
    edgeWidth: number;
    nodeSize: number;
    noteTextSize: number;
    edgeLabelLocation: EdgeLabelLocation;
    noteLocation: NoteLocation;
    graphBorderLeft: number;
    graphBorderRight: number;
}

export interface NoteOptions {
    //notesVisible: boolean; // add button for this?
    hiddenProperties: Array<PropertySelector>;
    // only relevant when noteLocation in GraphStyleOptions is "optimized"
    specialPositions: Array<[Array<PropertySelector>, NoteLocation]>;
}

export type PropertySelector = {
    type: string;
    field?: string; 
} | {
    id: string;
    field?: string;
} | {
    label: string;
    field?: string;
} | {
    field: string;
}

