
// TODO limited size undo chain?
export class State<T> {

    readonly #undoStack: Array<T> = [];
    readonly #redoStack: Array<T> = [];

    constructor(private readonly options: T, private readonly listener?: (newState: T, options: {redoActive: boolean, undoActive: boolean}) => void) {

    }

    stateChanged(newState: Partial<T>, options?: {keepRedoStack?: boolean, skipUndoStack?: boolean}) {
        if (!options?.skipUndoStack)
            this.#undoStack.push({...this.options});
        Object.assign(this.options, newState);
        if (!options?.keepRedoStack)
            this.#redoStack.splice(0, this.#redoStack.length);
        if (this.listener)
            this.listener({...this.options}, {redoActive: this.#redoStack.length > 0, undoActive: this.#undoStack.length > 0});
    }

    redo() {
        const l: number = this.#redoStack.length;
        if (l === 0)
            return;
        const last: T = this.#redoStack.pop();
        this.stateChanged(last, {keepRedoStack: true});
    }

    undo() {
        const l: number = this.#undoStack.length;
        if (l === 0)
            return;
        const last: T = this.#undoStack.pop();
        this.#redoStack.push({...this.options});
        this.stateChanged(last, {skipUndoStack: true, keepRedoStack: true});
    }

}
