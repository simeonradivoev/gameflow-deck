declare const __HOST__: string;

global
{
  declare module "react" {
    interface HTMLAttributes<T> extends AriaAttributes, DOMAttributes<T>
    {
      // extends React's HTMLAttributes
      "save-child-focus"?: SaveFocusType;
      "save-scroll"?: boolean;
    }
  }
}

interface FocusParams
{
  onFocus?: () => void;
}

interface InteractParams
{
  onAction?: () => void;
}

interface FilterOption extends FocusParams, InteractParams
{
  label: string;
}
