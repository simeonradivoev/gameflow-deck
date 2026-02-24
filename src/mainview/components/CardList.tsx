import
{
  FocusContext,
  FocusDetails,
  useFocusable,
} from "@noriginmedia/norigin-spatial-navigation";
import { GameMeta } from "../../shared/constants";
import GameCard, { GameCardFocusHandler, GameCardParams } from "./GameCard";
import { JSX } from "react";
import { twMerge } from "tailwind-merge";
import { GamePadButtonCode, useShortcuts } from "../scripts/shortcuts";

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
  onGameFocus?: GameCardFocusHandler;
  className?: string;
})
{
  const { ref, focusKey } = useFocusable({
    focusKey: data.id,
  });

  function BuildCard (g: GameMetaExtra, i: number)
  {
    let preview: GameCardParams['preview'] = g.preview;
    if (!preview && g.previewUrl)
    {
      preview = g.previewUrl;
    }

    const handleAction = () =>
    {
      g.onSelect?.();
      data.onSelectGame?.(g.id);
    };
    useShortcuts(g.focusKey, () => [{ label: "Select", button: GamePadButtonCode.A, action: handleAction }]);

    return (
      <GameCard
        key={g.id}
        type={data.type}
        index={i}
        focusKey={g.focusKey}
        data-index={i}
        title={g.title}
        subtitle={g.subtitle ?? ""}
        onFocus={(id, node, details) =>
        {
          g.onFocus?.(details);
          data.onGameFocus?.(id, node, details);
        }}
        onAction={handleAction}
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
        data.grid ? "card-grid h-fit gap-5" : 'card-list md:gap-6 sm:gap-2',
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
        {data.games.map(BuildCard)}
      </FocusContext.Provider>
    </ul>
  );
}
