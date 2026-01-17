declare namespace StateJs {
    type DeepPartial<T> = {
        [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
    };

    export interface StateInstance<T> {
        current(): Readonly<T>;
        update(
            patch: DeepPartial<T> | Array<{ jsonPath: string; value: any }>,
        ): void;
        scopeOf(el: HTMLElement): any;
        create<S>(el: HTMLElement): StateInstance<S>;
        contract(
            namespace?: string,
            className?: string,
            wrap?: boolean,
        ): string;
    }
}
declare namespace StateJs.Generated {
    export interface Index {
        onClearCompleted: { [eventName: string]: (event: Event) => void };
        completedCount: any;
        present: { completed: any; active: any; all: any };
        exactly1Active: any;
        activeCount: any;
        todos: Array<Index.StateForeachContract1>;
        onToggleAll: { [eventName: string]: (event: Event) => void };
        lastToggleAll: any;
        allCount: any;
        onNewTodoInput: { [eventName: string]: (event: Event) => void };
        newTodoName: any;
    }
    namespace Index {
        export interface StateForeachContract1 {
            onEditInput: { [eventName: string]: (event: Event) => void };
            onRemove: { [eventName: string]: (event: Event) => void };
            onEdit: { [eventName: string]: (event: Event) => void };
            content: any;
            onToggle: { [eventName: string]: (event: Event) => void };
            isEdited: any;
            isCompleted: any;
        }
    }
}
interface Document {
    state: StateJs.StateInstance<StateJs.Generated.Index>;
}
interface DocumentEventMap {
    StateLoaded: Event;
    StateUpdated: Event;
}
