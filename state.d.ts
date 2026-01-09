declare namespace StateJs {

    type DeepPartial<T> = {
        [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
    };

    export interface StateListen {
        [eventName: string]: (event: Event) => void;
    }
    export type StateForeach<T> = Array<T>;

    export interface StateInstance<T> {
        current(): Readonly<T>;
        update(patch: DeepPartial<T>): void;
        scopeOf(el: HTMLElement): any;
        subState<S>(el: HTMLElement): StateInstance<S>;
    }
}