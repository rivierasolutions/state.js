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
        onToggleList: { [eventName: string]: (event: Event) => void };
        onButtonClick: { [eventName: string]: (event: Event) => void };
        stateArray: Array<Index.StateForeachContract1>;
        showList: any;
        buttonClass: any;
        someText: any;
        showMVC2: any;
    }
    namespace Index {
        export interface StateForeachContract1 {
            onRemove: { [eventName: string]: (event: Event) => void };
            numberArray: Array<Index.StateForeachContract2>;
            text: any;
            $index: any;
        }
        export interface StateForeachContract2 {
            number: any;
            $index: any;
            numberClass: any;
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
