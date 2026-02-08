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

export default function GameCard (data: {
  title: string;
  type?: string;
  subtitle: string;
  preview?: string | JSX.Element;
  focusKey: string;
  index: number;
  id: number;
  badge?: JSX.Element;
  onFocus?: (id: number) => void;
  onAction?: () => void;
})
{
  const { ref, focused, focusSelf } = useFocusable({
    focusKey: data.focusKey,
    onFocus: () => data.onFocus?.(data.id),
    onEnterPress: () => data.onAction?.(),
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
      onClick={focused ? data.onAction : focusSelf}
      className={twMerge(
        `game-card game-card-height flex flex-col justify-end`,
        'max-h-(--game-card-height) min-w-(--game-card-width) w-(--game-card-width)',
        "overflow-hidden transition-all duration-200 drop-shadow-lg cursor-pointer",
        focused ?
          `animate-wiggle ring-7 bg-base-content text-base-300 ring-primary drop-shadow-xl drop-shadow-base-300/60 scale-102 z-10` :
          "bg-base-300 text-base-content",
        classNames({
          "h-(--game-card-height)": typeof data.preview === "string"
        })
      )}
    >
      <div className={twMerge("overflow-hidden bg-base-400 h-full rounded-t-xl rounded-b-md transition-all", focused ? "mt-2 mx-2" : "mt-2 mx-2")}>
        {typeof data.preview === "string" ? (
          <img src={data.preview}></img>
        ) : (
          data.preview
        )}</div>

      <div className="h-0 flex pr-2 justify-end items-center">{data.badge}</div>
      <div className="flex flex-col p-4">
        <div className="text-xl font-bold text-nowrap text-ellipsis overflow-hidden">
          {data.title}
        </div>
        <div className="text-s">{data.subtitle}</div>
      </div>
    </li>
  );
}
