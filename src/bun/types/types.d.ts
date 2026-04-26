declare interface ObjectConstructor
{
    /**
     * Groups members of an iterable according to the return value of the passed callback.
     * @param items An iterable.
     * @param keySelector A callback which will be invoked for each item in items.
     */
    groupBy<K extends PropertyKey, T> (
        items: Iterable<T>,
        keySelector: (item: T, index: number) => K,
    ): Partial<Record<K, T[]>>;
}

declare interface MapConstructor
{
    /**
     * Groups members of an iterable according to the return value of the passed callback.
     * @param items An iterable.
     * @param keySelector A callback which will be invoked for each item in items.
     */
    groupBy<K, T> (
        items: Iterable<T>,
        keySelector: (item: T, index: number) => K,
    ): Map<K, T[]>;
}

declare interface AppEventMap
{
    exitapp: [];
    notification: [FrontendNotification];
    focus: [];
}

declare module '*.bat' {
    const content: string;
    export default content;
}

declare module '*.sh' {
    const content: string;
    export default content;
}