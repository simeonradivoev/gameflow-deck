import
{
  FocusContext,
  useFocusable,
} from "@noriginmedia/norigin-spatial-navigation";
import SvgIcon from "./SvgIcon";
import classNames from "classnames";
import { useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import useActiveControl from "../scripts/gamepads";

function FilterCat (
  data: {
    id: string;
    children?: any;
    active: boolean;
    onFocus: () => void;
    hasFocusedPeer: boolean;
  } & FilterOption,
)
{
  const { ref, focusSelf, focused } = useFocusable({
    focusKey: data.id,
    onFocus: data.onFocus,
    onEnterPress: data.onAction
  });

  const { filter } = useSearch({ from: '/' });
  useEffect(() =>
  {
    if (filter == data.id && data.hasFocusedPeer)
    {
      focusSelf();
    }
  }, [filter]);

  const { isMouse } = useActiveControl();

  return (
    <li
      ref={ref}
      onClick={focusSelf}
      className={classNames(
        "sm:text-sm sm:px-2",
        "flex md:px-4 items-center justify-center rounded-full transition-all md:text-lg",
        {
          "bg-base-content px-3 text-base-300 drop-shadow cursor-default":
            focused || data.active,
          "ring-primary ring-7": focused && !isMouse,
          "hover:bg-base-content/40 cursor-pointer": !focused,
        },
      )}
    >
      {data.children ?? data.label}
    </li>
  );
}

export function FilterUI (data: {
  id: string;
  options: Record<string, FilterOption>;
  selected: string;
  setSelected: (id: string) => void;
})
{
  const { ref, focusKey, hasFocusedChild } = useFocusable({
    focusKey: `filter-${data.id}`,
    saveLastFocusedChild: false,
    autoRestoreFocus: false,
    preferredChildFocusKey: data.selected,
    trackChildren: true
  });

  return (
    <div
      ref={ref}
      save-child-focus="session"
    >
      <FocusContext.Provider value={focusKey}>
        <ul className="flex flex-row bg-base-100 rounded-full p-1 drop-shadow-sm sm:h-9 md:h-14">
          <li className=" flex px-4 items-center justify-center rounded-full">
            <SvgIcon className="sm:size-5 md:size-8" icon="steamdeck_button_l1_outline" />
          </li>
          {Object.entries(data.options)?.map(([id, option]) => (
            <FilterCat
              hasFocusedPeer={hasFocusedChild}
              id={id}
              key={id}
              onFocus={() => data.setSelected(id)}
              active={id === data.selected}
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
