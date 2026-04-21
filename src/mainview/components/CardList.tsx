import
{
  FocusContext,
  useFocusable,
} from "@noriginmedia/norigin-spatial-navigation";
import { GameMeta } from "../../shared/constants";
import CardElement, { GameCardParams } from "./CardElement";
import { JSX } from "react";
import { twMerge } from "tailwind-merge";
import { GamePadButtonCode, useShortcuts } from "../scripts/shortcuts";
import { oneShot } from "../scripts/audio/audio";

export interface GameMetaExtra extends GameMeta
{
  preview?: GameCardParams['preview'];
  badges?: JSX.Element[];
  focusKey: string;
}

function LocalCardElement (data: { game: GameMetaExtra, i: number; } & FocusParams & InteractParams)
{
  let preview: GameCardParams['preview'] = data.game.preview;
  if (!preview && data.game.previewUrls)
  {
    preview = data.game.previewUrls;
  }

  const handleAction = (ctx: InteractParamsArgs) =>
  {
    data.game.onSelect?.();
    data.onAction?.({ event, focusKey: data.game.focusKey });
    oneShot('click');
  };

  useShortcuts(data.game.focusKey, () => [{ label: "Select", button: GamePadButtonCode.A, action: event => handleAction({ event, focusKey: data.game.focusKey }) }]);

  return (
    <CardElement
      index={data.i}
      focusKey={data.game.focusKey}
      data-index={data.i}
      title={data.game.title}
      subtitle={data.game.subtitle}
      srcset={data.game.previewSrcset}
      onFocus={(focusKey, node, details) =>
      {
        data.game.onFocus?.(focusKey, node, details);
        data.onFocus?.(focusKey, node, { ...details, id: data.game.id });
      }}
      onAction={handleAction}
      preview={preview}
      badges={data.game.badges}
      id={data.game.id}
    />
  );
}

export function CardList (data: {
  id: string;
  type?: string;
  games: GameMetaExtra[];
  grid?: boolean;
  onSelectGame?: (id: string) => void;
  focus?: string;
  className?: string;
  finalElement?: JSX.Element | JSX.Element[];
  saveChildFocus?: 'session' | 'local';
} & FocusParams)
{
  const { ref, focusKey } = useFocusable({
    focusKey: data.id,
    focusable: data.games.length > 0,
    preferredChildFocusKey: data.focus
  });

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
        {data.games.map((g, i) => <LocalCardElement
          key={g.id} onFocus={data.onFocus} game={g} onAction={() => data.onSelectGame?.(g.id)} i={i} />)}
        {data.finalElement}
      </FocusContext.Provider>
    </ul>
  );
}
