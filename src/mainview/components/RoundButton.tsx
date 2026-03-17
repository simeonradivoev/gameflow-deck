import { CSSProperties } from "react";
import { twMerge } from 'tailwind-merge';
import { Button, ButtonStyle } from "./options/Button";

export function RoundButton (data: {
  id: string;
  children?: any;
  className?: string;
  external?: boolean;
  style?: ButtonStyle;
  cssStyle?: CSSProperties;
} & InteractParams & FocusParams)
{
  return (
    <Button cssStyle={data.cssStyle} onFocus={data.onFocus} id={data.id} style={data.style} className={twMerge("rounded-full aspect-square", data.external && "focusable focusable-primary focusable-hover", data.className)} onAction={data.onAction}>
      {data.children}
    </Button>

  );
}
