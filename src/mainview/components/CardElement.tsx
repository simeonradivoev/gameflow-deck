import { FocusDetails, useFocusable } from "@noriginmedia/norigin-spatial-navigation";
import classNames from "classnames";
import { JSX } from "react";
import { twMerge } from "tailwind-merge";
import useActiveControl from "../scripts/gamepads";
import { oneShot } from "../scripts/audio/audio";

export function GameCardSkeleton ()
{
  return (
    <li className="game-card bg-base-100/80 p-4 z-0 mx-2 min-w-(--game-card-width) w-(--game-card-width)">
      <div className="flex flex-col gap-4">
        <div className="skeleton h-60 w-full opacity-40"></div>
        <div className="skeleton h-4 w-full opacity-40"></div>
        <div className="skeleton h-4 w-28 opacity-40"></div>
      </div>
    </li>
  );
}

export type GameCardFocusHandler = (id: string, node: HTMLElement, details: FocusDetails) => void;

export interface GameCardParams
{
  title: string;
  subtitle: string | JSX.Element;
  preview?: string | JSX.Element | ((p: { focused: boolean; }) => JSX.Element);
  srcset?: string;
  focusKey: string;
  index: number;
  id: string;
  badges?: JSX.Element[];
  className?: string;
  onFocus?: GameCardFocusHandler;
  onBlur?: (id: string) => void;
  clickFocuses?: boolean;
  previewClassName?: string;
}

export default function CardElement (data: GameCardParams & InteractParams)
{
  const handleAction = () =>
  {
    data.onAction?.();
    oneShot('click');
  };
  const { ref, focused, focusSelf } = useFocusable({
    focusKey: data.focusKey,
    onFocus: (l, p, details) => data.onFocus?.(data.id, ref.current as any, details),
    onEnterPress: handleAction,
    onBlur: () => data.onBlur?.(data.id),
  });
  const { isPointer } = useActiveControl();

  return (
    <li
      id={`game-entry-${data.id}`}
      key={data.id}
      data-index={data.id}
      role="button"
      ref={ref}
      style={{
        scrollSnapAlign: isPointer ? "center" : "none"
      }}
      onFocus={focusSelf}
      onClick={() =>
      {
        focusSelf();
        handleAction();
      }}
      className={twMerge(
        "relative game-card light:bg-base-100 dark:bg-base-300 flex flex-col z-5 overflow-hidden transition-all duration-200 not-mobile:drop-shadow-lg cursor-pointer focusable focusable-primary focusable-hover select-none focused focused:not-control-mouse:animate-wiggle focused:not-control-mouse:bg-base-content focused:not-control-mouse:text-base-300 focused:not-control-mouse:drop-shadow-lg focused:not-control-mouse:drop-shadow-black/30 focused:not-control-mouse:scale-102 focused:not-control-mouse:z-10 group control-mouse:hover:bg-base-200 h-full [--tw-border-style:inset] border-2 border-base-content/5 backdrop-opacity-0 active:bg-base-content! active:text-base-100 active:transition-none",
        data.className
      )}
    >
      <div id="preview" className={twMerge(
        "overflow-hidden bg-base-400 rounded-t-xl rounded-b-md transition-all",
        focused ? "sm:mt-1 sm:mx-1" : "sm:mt-1 sm:mx-1",
        focused ? "md:mt-2 md:mx-2" : "md:mt-2 md:mx-2",
        classNames({ "h-full": typeof data.preview === "string" })
      )}>
        {typeof data.preview === "string" ? (
          <img draggable={false} srcSet={data.srcset} className={classNames("object-cover aspect-3/4", data.previewClassName, { "animate-rotate-small": focused && !isPointer })} src={data.preview} ></img>
        ) : (
          typeof data.preview === 'function' ? data.preview({ focused }) : data.preview
        )}
      </div>

      <div className="h-0 flex pr-2 justify-end items-center sm:gap-1 md:gap-2 z-2">
        {data.badges?.map((b, i) =>
          <div key={i}
            className={
              twMerge("bg-base-100 text-base-content not-mobile:not-in-focused:drop-shadow-lg sm:border-3 md:border-6 border-base-300 in-focused:border-base-content overflow-hidden rounded-full sm:last:mr-1 md:last:mr-4 transition-colors",
                classNames({
                  "bg-primary text-primary-content": focused && !isPointer,
                  "group-hover:bg-primary group-hover:text-primary-content": isPointer
                }))}
          >
            {b}
          </div>)
        }
      </div>
      <div className="flex flex-col sm:p-2 grow md:p-4 justify-center">
        <div className="md:text-xl sm:text-sm font-bold text-nowrap text-ellipsis overflow-hidden">
          {data.title}
        </div>
        <div className="sm:text-xs md:text-sm text-nowrap">{data.subtitle}</div>
      </div>
    </li >
  );
}
