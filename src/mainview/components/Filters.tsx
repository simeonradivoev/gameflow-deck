import
{
  FocusContext,
  setFocus,
  useFocusable,
} from "@noriginmedia/norigin-spatial-navigation";
import SvgIcon from "./SvgIcon";
import { twMerge } from "tailwind-merge";
import { useEffect } from "react";
import { GamePadButtonCode, useShortcuts } from "../scripts/shortcuts";
import { oneShot } from "../scripts/audio/audio";

function FilterCat (
  data: {
    id: string;
    children?: any;
    active: boolean;
  } & FilterOption & FocusParams,
)
{
  const { ref, focusSelf } = useFocusable({
    focusKey: data.id,
    onFocus: (l, p, details) =>
    {
      data.onFocus?.(data.id, ref.current, details);
    },
    onEnterPress: data.onAction
  });

  return (
    <li
      aria-selected={data.active}
      ref={ref}
      onClick={e => focusSelf({ event: e.nativeEvent })}
      data-sound-category={data.active ? undefined : "filter"}
      className={"sm:text-sm sm:px-2 flex md:px-4 items-center justify-center rounded-full transition-all md:text-lg focusable focusable-primary hover:not-focused:not-aria-selected:bg-base-content/40 not-focused:cursor-pointer aria-selected:bg-base-content aria-selected:text-base-300 aria-selected:drop-shadow aria-selected:cursor-default active:bg-accent! active:text-accent-content! active:ring-offset-7 active:ring-offset-base-content select-none gap-1"}
    >
      {data.icon ? <><div className="sm:portrait:px-2">{data.icon}</div><div className="sm:portrait:hidden md:inline">{data.children ?? data.label}</div></> : <div>{data.children ?? data.label}</div>}

    </li>
  );
}

export function FilterUI (data: {
  id: string;
  options: Record<string, FilterOption>;
  setSelected: (id: string) => void;
  containerClassName?: string;
  className?: string;
  rootFocusKey?: string;
  showShortcuts?: boolean;
})
{
  const defaultFocus = Object.entries(data.options).filter(o => o[1].selected)[0]?.[0];
  const { ref, focusKey, hasFocusedChild } = useFocusable({
    focusKey: data.id,
    saveLastFocusedChild: false,
    autoRestoreFocus: false,
    preferredChildFocusKey: `${data.id}-${defaultFocus}`,
    trackChildren: true
  });

  if (data.rootFocusKey)
  {
    useShortcuts(data.rootFocusKey, () => [
      {
        action: (e) =>
        {
          const filterKeys = Object.keys(data.options);
          const filterIndex = Math.max(0, filterKeys.findIndex(f => data.options[f].selected));
          const selectedFilterIndex = Math.min(filterIndex + 1, filterKeys.length - 1);
          const newFilter = filterKeys[selectedFilterIndex];
          if (!data.options[newFilter].selected)
          {
            data.setSelected(newFilter);
            oneShot('selectFilter');
          } else
          {
            oneShot('invalidNavigation');
          }
        },
        button: GamePadButtonCode.R1
      },
      {
        action: (e) =>
        {
          const filterKeys = Object.keys(data.options);
          const filterIndex = Math.max(0, filterKeys.findIndex(f => data.options[f as any].selected));
          const selectedFilterIndex = Math.max(0, filterIndex - 1,);
          const newFilter = filterKeys[selectedFilterIndex];
          if (!data.options[newFilter].selected)
          {
            data.setSelected(newFilter);
            oneShot('selectFilter');
          } else
          {
            oneShot('invalidNavigation');
          }
        },
        button: GamePadButtonCode.L1
      }], [data.options]);
  }

  useEffect(() =>
  {
    if (hasFocusedChild)
    {
      setFocus(`${data.id}-${defaultFocus}`, { instant: true });
    }
  }, [hasFocusedChild, defaultFocus, data.id]);

  return (
    <div
      ref={ref}
      className={data.containerClassName}
      style={{ viewTransitionName: `filter-${data.id}` }}
    >
      <FocusContext.Provider value={focusKey}>
        <ul className={twMerge("flex flex-row bg-base-100 rounded-full p-1 drop-shadow-sm sm:portrait:h-12 sm:landscape:h-9 md:h-14!", data.className)}>
          {!!data.rootFocusKey && (data.showShortcuts ?? true) && <li className=" flex px-4 items-center justify-center rounded-full">
            <SvgIcon className="sm:size-5 md:size-8" icon="steamdeck_button_l1_outline" />
          </li>}
          {Object.entries(data.options)?.map(([id, option]) => (
            <FilterCat
              id={`${data.id}-${id}`}
              key={id}
              onFocus={() =>
              {
                if (!option.selected)
                  data.setSelected(id);
              }}
              active={option.selected}
              {...option}
            />
          ))}
          {!!data.rootFocusKey && (data.showShortcuts ?? true) && <li className="flex px-4 items-center justify-center rounded-full">
            <SvgIcon className="sm:size-5 md:size-8" icon="steamdeck_button_r1_outline" />
          </li>}
        </ul>
      </FocusContext.Provider>
    </div>

  );
}
