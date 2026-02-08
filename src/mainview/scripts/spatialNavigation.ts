import
{
  init,
  SpatialNavigation,
} from "@noriginmedia/norigin-spatial-navigation";

init({
  shouldFocusDOMNode: false,
  throttle: 200,
});

let addFocusable = SpatialNavigation.addFocusable.bind(SpatialNavigation);
let removeFocusable = SpatialNavigation.removeFocusable.bind(SpatialNavigation);

type SaveFocusType = "session" | "local";

type HistorySourceType = "settings" | 'details';
const historySourceMap = new Map<string, string>();

export function SaveSource (id: HistorySourceType, url: string)
{
  historySourceMap.set(id, url);
}

export function HasSource (id: HistorySourceType)
{
  return historySourceMap.has(id);
}

export function PopSource (id: HistorySourceType)
{
  const source = historySourceMap.get(id);
  historySourceMap.delete(id);
  return source;
}

SpatialNavigation.addFocusable = (toAdd) =>
{
  addFocusable(toAdd);
  const component: {
    lastFocusedChildKey?: string;
    preferredChildFocusKey?: string;
    node: HTMLElement;
    focusKey: string;
  } = (SpatialNavigation as any).focusableComponents[toAdd.focusKey];
  if (component.node?.hasAttribute("save-child-focus"))
  {
    const storageKey = `${component.focusKey}-last-child-focus`;
    const saveChildFocus = component.node.getAttribute(
      "save-child-focus",
    ) as SaveFocusType;

    if (saveChildFocus === "session" && sessionStorage.getItem(storageKey))
    {
      SpatialNavigation.saveLastFocusedChildKey(
        component as any,
        sessionStorage.getItem(storageKey)!,
      );

    } else if (saveChildFocus === "local" && localStorage.getItem(storageKey))
    {
      SpatialNavigation.saveLastFocusedChildKey(
        component as any,
        localStorage.getItem(storageKey)!,
      );
    }
  }
};

// Override remove callback to insert custom functionality like saving to storage
SpatialNavigation.removeFocusable = ({ focusKey }) =>
{
  const component: {
    lastFocusedChildKey?: string;
    node: HTMLElement;
    focusKey: string;
  } = (SpatialNavigation as any).focusableComponents[focusKey];

  if (component)
  {
    if (component.node?.hasAttribute("save-child-focus"))
    {
      const saveChildFocus = component.node.getAttribute(
        "save-child-focus",
      ) as SaveFocusType;
      const storageKey = `${component.focusKey}-last-child-focus`;
      if (saveChildFocus === "session")
      {
        if (component.lastFocusedChildKey)
        {
          sessionStorage.setItem(storageKey, component.lastFocusedChildKey);
        } else
        {
          //sessionStorage.removeItem(storageKey);
        }
      } else if (saveChildFocus === "local")
      {
        if (component.lastFocusedChildKey)
        {
          localStorage.setItem(storageKey, component.lastFocusedChildKey);
        } else
        {
          //localStorage.removeItem(storageKey);
        }
      }
    }

    removeFocusable(component);
  }


};

SpatialNavigation.saveLastFocusedChildKey = (component, focusKey) =>
{
  component.lastFocusedChildKey = focusKey;
};
