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
      className={twMerge(
        "flex md:gap-2 bg-base-100 text-base-content neutral-content md:pl-2 md:pr-3 md:py-1.5 rounded-full items-center md:text-lg drop-shadow-sm ring-[1px] ring-base-content/10 drop-shadow-black/30",
        "sm:text-sm sm:p-1",
        "xs:text-xs sm:p-1",
        data.className,
        classNames({
          "hover:bg-base-300 cursor-pointer": !!data.onClick,
        })
      )}
    >
      {data.icon && <SvgIcon className="md:size-8 sm:size-6 xs:size-2" icon={data.icon} />}
      {data.label}
    </div>
  );
}
