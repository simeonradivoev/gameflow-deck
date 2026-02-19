import
{
  FocusContext,
  useFocusable,
} from "@noriginmedia/norigin-spatial-navigation";
import SvgIcon from "./SvgIcon";
import classNames from "classnames";

function FilterCat (
  data: {
    id: string;
    children?: any;
    active: boolean;
    onFocus: () => void;
  } & FilterOption,
)
{
  const { ref, focusSelf, focused } = useFocusable({
    focusKey: data.id,
    onFocus: data.onFocus,
    onEnterPress: data.onAction,
  });
  return (
    <li
      ref={ref}
      onClick={focusSelf}
      className={classNames(
        "flex px-4 h-12 items-center justify-center rounded-full transition-all",
        {
          "bg-base-content px-3 text-base-300 drop-shadow cursor-default":
            focused || data.active,
          "ring-primary ring-7": focused,
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
  const { ref, focusKey } = useFocusable({ focusKey: `filter-${data.id}` });
  return (
    <div
      ref={ref}
      className="flex items-center justify-center gap-2"
      save-child-focus="session"
    >
      <FocusContext.Provider value={focusKey}>
        <ul className="flex flex-row bg-base-100 rounded-full p-1 drop-shadow-sm">
          <li className=" flex px-4 h-12 items-center justify-center rounded-full">
            <SvgIcon className="size-8" icon="steamdeck_button_l1_outline" />
          </li>
          {Object.entries(data.options)?.map(([id, option]) => (
            <FilterCat
              id={id}
              key={id}
              onFocus={() => data.setSelected(id)}
              active={id === data.selected}
              {...option}
            />
          ))}
          <li className=" flex px-4 h-12 items-center justify-center rounded-full">
            <SvgIcon className="size-8" icon="steamdeck_button_r1_outline" />
          </li>
        </ul>
      </FocusContext.Provider>
    </div>

  );
}
