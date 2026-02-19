import React, { MouseEventHandler } from "react";
import SvgIcon, { IconType } from "./SvgIcon";
import classNames from "classnames";
import { twMerge } from "tailwind-merge";

export default function ShortcutPrompt (data: {
  icon: IconType;
  label?: string;
  className?: string;
  onClick?: MouseEventHandler;
})
{
  return (
    <span
      onClick={data.onClick}
      className={twMerge(
        "flex md:gap-2 bg-base-100 text-base-content neutral-content md:pl-2 md:pr-3 md:py-1.5 rounded-full items-center md:text-lg drop-shadow-sm ring-[1px] ring-base-content/10 drop-shadow-black/30",
        "sm:text-sm",
        data.className,
        classNames({
          "hover:bg-base-300 cursor-pointer": !!data.onClick,
        })
      )}
    >
      <SvgIcon className="md:size-8 sm:size-6" icon={data.icon} />
      {data.label}
    </span>
  );
}
