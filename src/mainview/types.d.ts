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

  module "@noriginmedia/norigin-spatial-navigation" {
    declare interface FocusDetails
    {
      instant?: boolean;
      sound?: string;
    }
  }

  module "@tanstack/react-router" {
    declare interface HistoryState
    {
      eventType?: string;
    }
  }

}

declare interface FocusEventDetails
{
  focusKey: string;
  instant?: boolean;
  sound?: string;
  nativeEvent?: any;
  event?: Event;
  node: HTMLElement | undefined;
  focusKeyChanged: boolean;
}

declare interface FocusParams
{
  onFocus?: (focusKey: string, node: HTMLElement, details: Record<string, any>) => void;
}

declare interface InteractParamsArgs
{
  event?: Event,
  focusKey?: string;
}

declare interface InteractParams
{
  onAction?: (ctx: InteractParamsArgs) => void;
}

declare interface FilterOption extends FocusParams, InteractParams
{
  label: string;
  selected: boolean;
  icon?: any;
}

declare type EmulatorJsMessage = { type: 'restart'; } |
{ type: 'pause'; paused: boolean; } |
{ type: 'exit'; save?: File; } |
{ type: 'save', save: File, screenshot?: File, type: string; } |
{ type: 'loaded'; } |
{ type: 'requestSave'; };