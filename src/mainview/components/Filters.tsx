import
{
  FocusContext,
  useFocusable,
} from "@noriginmedia/norigin-spatial-navigation";
import SvgIcon from "./SvgIcon";
import { twMerge } from "tailwind-merge";

function FilterCat (
  data: {
    id: string;
    children?: any;
    active: boolean;
    hasFocusedPeer: boolean;
  } & FilterOption & FocusParams,
)
{
  const { ref, focusSelf } = useFocusable({
    focusKey: data.id,
    onFocus: (l, p, details) => data.onFocus?.(data.id, ref.current, details),
    onEnterPress: data.onAction
  });

  return (
    <li
      aria-selected={data.active}
      ref={ref}
      onClick={focusSelf}
      className={"sm:text-sm sm:px-2 flex md:px-4 items-center justify-center rounded-full transition-all md:text-lg focusable focusable-primary hover:not-focused:not-aria-selected:bg-base-content/40 not-focused:cursor-pointer aria-selected:bg-base-content aria-selected:text-base-300 aria-selected:drop-shadow aria-selected:cursor-default active:bg-accent! active:text-accent-content! active:ring-offset-7 active:ring-offset-base-content select-none"}
    >
      {data.children ?? data.label}
    </li>
  );
}

export function FilterUI (data: {
  id: string;
  options: Record<string, FilterOption>;
  setSelected: (id: string) => void;
  containerClassName?: string;
  className?: string;
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

  return (
    <div
      ref={ref}
      className={data.containerClassName}
    >
      <FocusContext.Provider value={focusKey}>
        <ul className={twMerge("flex flex-row bg-base-100 rounded-full p-1 drop-shadow-sm sm:portrait:h-12 sm:landscape:h-9 md:h-14!", data.className)}>
          <li className=" flex px-4 items-center justify-center rounded-full">
            <SvgIcon className="sm:size-5 md:size-8" icon="steamdeck_button_l1_outline" />
          </li>
          {Object.entries(data.options)?.map(([id, option]) => (
            <FilterCat
              hasFocusedPeer={hasFocusedChild}
              id={`${data.id}-${id}`}
              key={id}
              onFocus={() => data.setSelected(id)}
              active={option.selected}
              {...option}
            />
          ))}
          <li className="flex px-4 items-center justify-center rounded-full">
            <SvgIcon className="sm:size-5 md:size-8" icon="steamdeck_button_r1_outline" />
          </li>
        </ul>
      </FocusContext.Provider>
    </div>

  );
}
