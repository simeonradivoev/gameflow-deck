import { MouseEventHandler } from "react";
import SvgIcon, { IconType } from "./SvgIcon";
import classNames from "classnames";
import { twMerge } from "tailwind-merge";

export default function ShortcutPrompt (data: {
  id: string;
  icon?: IconType;
  label?: string;
  className?: string;
  onClick?: MouseEventHandler;
})
{
  return (
    <div
      onClick={data.onClick}
      style={{ viewTransitionName: data.id }}
      className={twMerge("xs:text-xs sm:p-1 sm:text-sm",
        "flex md:gap-2 bg-base-100 text-base-content neutral-content md:pl-2 md:pr-3 md:py-1.5 rounded-full items-center md:text-lg drop-shadow-sm ring-[1px] ring-base-content/10 drop-shadow-black/30 active:text-base-300 active:bg-base-content",
        data.className,
        classNames({
          "hover:bg-base-300 cursor-pointer": !!data.onClick,
        })
      )}
    >
      {data.icon && <SvgIcon className="size-6 portrait:size-6 md:size-8" icon={data.icon} />}
      {data.label}
    </div>
  );
}
