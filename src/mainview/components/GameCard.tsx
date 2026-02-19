import { useFocusable } from "@noriginmedia/norigin-spatial-navigation";
import classNames from "classnames";
import { JSX, useEffect } from "react";
import { twMerge } from "tailwind-merge";

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
  onFocus?: (id: string) => void;
  onBlur?: (id: string) => void;
  onAction?: () => void;
  clickFocuses?: boolean;
}

export default function GameCard (data: GameCardParams)
{
  const { ref, focused, focusSelf } = useFocusable({
    focusKey: data.focusKey,
    onFocus: () => data.onFocus?.(data.id),
    onEnterPress: () => data.onAction?.(),
    onBlur: () => data.onBlur?.(data.id)
  });

  useEffect(() =>
  {
    if (focused)
    {
      (ref.current as HTMLElement).scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: 'center'
      });
    }
  }, [focused]);

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
        `game-card game-card-height flex flex-col justify-end z-5`,
        'max-h-(--game-card-height) min-w-(--game-card-width) w-(--game-card-width)',
        "overflow-hidden transition-all duration-200 drop-shadow-lg cursor-pointer",
        focused ?
          `focused animate-wiggle ring-7 bg-base-content text-base-300 ring-primary drop-shadow-xl drop-shadow-black/30 scale-102 z-10` :
          "bg-base-300 hover:bg-base-100 hover:scale-102 text-base-content",
        classNames({
          "h-(--game-card-height)": typeof data.preview === "string"
        }),
        data.className
      )}
    >
      <div className={twMerge("overflow-hidden bg-base-400 h-full rounded-t-xl rounded-b-md transition-all", focused ? "mt-2 mx-2" : "mt-2 mx-2")}>
        {typeof data.preview === "string" ? (
          <img width={5192} height={5192} className={classNames({ "animate-rotate-small": focused })} src={data.preview} ></img>
        ) : (
          typeof data.preview === 'function' ? data.preview({ focused }) : data.preview
        )}</div>

      <div className="h-0 flex pr-2 justify-end items-center">
        {data.badges?.map(b =>
          <div
            className={
              twMerge("bg-base-100 text-base-content drop-shadow-lg overflow-hidden rounded-full p-1 mr-4 transition-colors",
                classNames({ "bg-primary text-primary-content": focused }))}
          >
            {b}
          </div>)
        }
      </div>
      <div className="flex flex-col p-4">
        <div className="text-xl font-bold text-nowrap text-ellipsis overflow-hidden">
          {data.title}
        </div>
        <div className="text-s">{data.subtitle}</div>
      </div>
    </li >
  );
}
