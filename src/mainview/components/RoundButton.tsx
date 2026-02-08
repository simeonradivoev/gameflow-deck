import { useFocusable } from "@noriginmedia/norigin-spatial-navigation";
import classNames from "classnames";
import { JSX } from "react";
import { twMerge } from 'tailwind-merge';

export function RoundButton (data: {
  id: string;
  icon: JSX.Element;
  className?: string;
  external?: boolean;
  action?: () => void;
})
{
  const { ref, focused } = useFocusable({
    focusKey: data.id,
    onEnterPress: data.action,
  });
  return (
    <div
      id={data.id}
      ref={ref}
      onClick={data.action}
      className={classNames(twMerge(
        "rounded-full size-14 flex items-center justify-center bg-base-100 text-base-content cursor-pointer transition-all drop-shadow-sm",
        data.className, classNames(data.external === true
          ? {
            "hover:ring-7 hover:ring-primary hover:bg-base-content hover:text-base-300": true,
            "ring-7 ring-primary bg-base-content text-base-100": focused,
          }
          : {
            "hover:bg-primary hover:text-primary-content": true,
            "bg-primary text-primary-content": focused,
          },)),
      )}
    >
      {data.icon}
    </div>
  );
}
