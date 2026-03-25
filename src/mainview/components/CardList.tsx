import
{
  FocusContext,
  useFocusable,
} from "@noriginmedia/norigin-spatial-navigation";
import { GameMeta } from "../../shared/constants";
import CardElement, { GameCardFocusHandler, GameCardParams } from "./CardElement";
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
  finalElement?: JSX.Element;
  saveChildFocus?: 'session' | 'local';
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
      <CardElement
        key={g.id}
        type={data.type}
        index={i}
        focusKey={g.focusKey}
        data-index={i}
        title={g.title}
        subtitle={g.subtitle ?? ""}
        srcset={g.previewSrcset}
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
      save-child-focus={data.saveChildFocus}
      className={twMerge("items-center justify-center-safe h-full",
        data.grid ? "grid h-fit sm:gap-2 md:gap-5 auto-rows-min grid-cols-[repeat(auto-fill,var(--game-card-width))]" :
          'landscape:grid landscape:grid-flow-col landscape:auto-cols-min auto-rows-[1fr] sm:gap-2 md:gap-4 portrait:grid portrait:auto-rows-min portrait:grid-cols-[repeat(auto-fill,var(--game-card-width))] *:portrait:aspect-8/10 *:landscape:aspect-8/12 sm:landscape:max-h-84 md:max-h-128!',
        data.className
      )}
      onKeyDown={(e) =>
      {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <FocusContext.Provider value={focusKey}>
        {data.games.map(BuildCard)}
        {data.finalElement}
      </FocusContext.Provider>
    </ul>
  );
}
