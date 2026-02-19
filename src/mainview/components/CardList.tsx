import
{
  FocusContext,
  useFocusable,
} from "@noriginmedia/norigin-spatial-navigation";
import { FrontEndId, GameMeta } from "../../shared/constants";
import GameCard, { GameCardParams } from "./GameCard";
import { JSX, useState } from "react";
import classNames from "classnames";
import { twMerge } from "tailwind-merge";

export interface GameMetaExtra extends GameMeta
{
  preview?: GameCardParams['preview'];
  badges?: JSX.Element[];
  focusKey: string;
}

export function CardList (data: {
  id: string;
  type?: string;
  games: GameMetaExtra[];
  grid?: boolean;
  onSelectGame?: (id: string) => void;
  onGameFocus?: (id: string) => void;
  className?: string;
})
{
  const { ref, focusKey } = useFocusable({
    focusKey: data.id,
  });

  function BuildGame (g: GameMetaExtra, i: number)
  {
    let preview: GameCardParams['preview'] = g.preview;
    if (!preview && g.previewUrl)
    {
      preview = g.previewUrl;
    }
    return (
      <GameCard
        key={g.id}
        type={data.type}
        index={i}
        focusKey={g.focusKey}
        data-index={i}
        title={g.title}
        subtitle={g.subtitle ?? ""}
        onFocus={() =>
        {
          g.onFocus?.();
          data.onGameFocus?.(g.id);
          (document.querySelector(":root") as HTMLElement).style.setProperty('--selected-card-offset', `${i}s`);
        }}
        onAction={() =>
        {
          g.onSelect?.();
          data.onSelectGame?.(g.id);
        }}
        preview={preview}
        badges={g.badges}
        id={g.id}
      />
    );
  }

  return (
    <ul
      title="Games"
      id={`card-list-${data.id}`}
      ref={ref}
      save-child-focus="session"
      className={twMerge("my-6 items-center justify-center-safe h-(--game-card-height) ",
        data.grid ? "card-grid h-fit gap-5" : 'card-list gap-6',
        data.className
      )}
      onKeyDown={(e) =>
      {
        e.preventDefault();
        e.stopPropagation();
      }}
      style={{ scrollbarWidth: "none" }}
    >
      <FocusContext.Provider value={focusKey}>
        {data.games.map(BuildGame)}
      </FocusContext.Provider>
    </ul>
  );
}
