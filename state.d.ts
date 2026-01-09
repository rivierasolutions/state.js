declare namespace StateJs {

    type DeepPartial<T> = {
        [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
    };

    interface StateListen {
        [eventName: string]: (event: Event) => void;
    }
    type StateForeach<T> = Array<T & { $index: number }>;
    type StateIf = any;
    type StateContent = any;
    type StateAttr = any;

    interface StateInstance<T> {
        current(): Readonly<T>;
        update(patch: DeepPartial<T>): void;
        scopeOf(el: HTMLElement): any;
        subState<S>(el: HTMLElement): StateInstance<S>;
    }
}

interface Document {
    state: StateEngine.StateInstance<any>;
}

interface DocumentEventMap {
    "StateLoaded": Event;
    "StateUpdated": Event;
}