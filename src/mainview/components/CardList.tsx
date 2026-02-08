import
{
  FocusContext,
  useFocusable,
} from "@noriginmedia/norigin-spatial-navigation";
import { GameMeta } from "../../shared/constants";
import GameCard, { GameCardSkeleton } from "./GameCard";
import { JSX, useEffect, useMemo, useState } from "react";
import { useLocalStorage } from "usehooks-ts";
import { useScrollSave } from "../scripts/utils";
import classNames from "classnames";

export interface GameMetaExtra extends GameMeta
{
  preview?: JSX.Element;
  badge?: JSX.Element;
  focusKey: string;
}

export function CardList (data: {
  id: string;
  type?: string;
  games: GameMetaExtra[];
  grid?: boolean;
  onSelectGame?: (id: number) => void;
  onGameFocus?: (id: number) => void;
})
{
  const { ref, focusKey } = useFocusable({
    focusKey: data.id,
  });

  function BuildGame (g: GameMetaExtra, i: number)
  {
    let preview: JSX.Element | string | undefined = g.preview;
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
          data.onGameFocus?.(g.id);
        }}
        onAction={() => data.onSelectGame?.(g.id)}
        preview={preview}
        badge={g.badge}
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
      className={classNames("my-6 items-center justify-center-safe h-(--game-card-height) ",
        data.grid ? "card-grid h-fit gap-5" : 'card-list gap-6'
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
