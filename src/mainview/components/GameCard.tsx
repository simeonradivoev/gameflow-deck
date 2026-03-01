import { FocusDetails, useFocusable } from "@noriginmedia/norigin-spatial-navigation";
import classNames from "classnames";
import { JSX } from "react";
import { twMerge } from "tailwind-merge";
import useActiveControl from "../scripts/gamepads";

export function GameCardSkeleton ()
{
  return (
    <li className="game-card bg-base-100/80 p-4 z-0 mx-2 max-h-(--game-card-height) min-w-(--game-card-width) w-(--game-card-width)">
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
  type?: string;
  subtitle: string | JSX.Element;
  preview?: string | JSX.Element | ((p: { focused: boolean; }) => JSX.Element);
  focusKey: string;
  index: number;
  id: string;
  badges?: JSX.Element[];
  className?: string;
  onFocus?: GameCardFocusHandler;
  onBlur?: (id: string) => void;
  onAction?: () => void;
  clickFocuses?: boolean;
}

export default function GameCard (data: GameCardParams)
{
  const { ref, focused, focusSelf } = useFocusable({
    focusKey: data.focusKey,
    onFocus: (l, p, detals) => data.onFocus?.(data.id, ref.current as any, detals),
    onEnterPress: () => data.onAction?.(),
    onBlur: () => data.onBlur?.(data.id)
  });
  const { isMouse, isPointer } = useActiveControl();

  return (
    <li
      id={`game-entry-${data.id}`}
      key={data.id}
      data-index={data.id}
      role="button"
      ref={ref}
      style={{
        scrollSnapAlign: "center"
      }}
      onFocus={focusSelf}
      onDoubleClick={data.onAction}
      onClick={() =>
      {
        focusSelf();
        data.onAction?.();
      }}
      className={twMerge(
        `game-card bg-base-300 game-card-height flex flex-col justify-end z-5 ring-primary`,
        'max-h-(--game-card-height) min-w-(--game-card-width) w-(--game-card-width)',
        "overflow-hidden transition-all duration-200 drop-shadow-lg cursor-pointer",
        classNames({
          "focused animate-wiggle ring-7 bg-base-content text-base-300 drop-shadow-xl drop-shadow-black/30 scale-102 z-10": focused && !isPointer,
          "group hover:focused hover:animate-wiggle sm:hover:ring-4 md:hover:ring-7 hover:bg-base-content hover:text-base-300 hover:drop-shadow-xl hover:drop-shadow-black/30 hover:scale-102 hover:z-10": isMouse,
          "h-(--game-card-height)": typeof data.preview === "string"
        }),
        data.className
      )}
    >
      <div className={twMerge(
        "overflow-hidden bg-base-400 h-full rounded-t-xl rounded-b-md transition-all",
        focused ? "sm:mt-1 sm:mx-1" : "sm:mt-1 sm:mx-1",
        focused ? "md:mt-2 md:mx-2" : "md:mt-2 md:mx-2",
      )}>
        {typeof data.preview === "string" ? (
          <img className={classNames("object-cover w-full h-full", { "animate-rotate-small": focused && !isPointer })} src={data.preview} ></img>
        ) : (
          typeof data.preview === 'function' ? data.preview({ focused }) : data.preview
        )}</div>

      <div className="h-0 flex pr-2 justify-end items-center sm:gap-1 md:gap-2">
        {data.badges?.map((b, i) =>
          <div key={i}
            className={
              twMerge("bg-base-100 text-base-content drop-shadow-lg overflow-hidden rounded-full p-1 sm:last:mr-1 md:last:mr-4 transition-colors",
                classNames({
                  "bg-primary text-primary-content": focused && !isPointer,
                  "group-hover:bg-primary group-hover:text-primary-content": isPointer
                }))}
          >
            {b}
          </div>)
        }
      </div>
      <div className="flex flex-col sm:p-2 md:p-4">
        <div className="md:text-xl sm:text-sm font-bold text-nowrap text-ellipsis overflow-hidden">
          {data.title}
        </div>
        <div className="sm:text-xs md:text-sm text-nowrap">{data.subtitle}</div>
      </div>
    </li >
  );
}
