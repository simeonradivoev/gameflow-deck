declare const __HOST__: string;
declare const __PUBLIC__: boolean;
declare const __EMULATORS__: Record<string, string>;
declare module "@emulators" {
  const data: Record<string, string>;
  export default data;
}

declare global
{
  module "react" {
    interface HTMLAttributes<T> extends AriaAttributes, DOMAttributes<T>
    {
      // extends React's HTMLAttributes
      "save-child-focus"?: SaveFocusType;
      "save-scroll"?: boolean;
    }
  }
}

declare interface FocusParams
{
  onFocus?: (focusKey: string, node: HTMLElement, details: Record<string, any>) => void;
}

declare interface InteractParams
{
  onAction?: (e?: Event) => void;
}

declare interface FilterOption extends FocusParams, InteractParams
{
  label: string;
  selected: boolean;
  icon?: any;
}