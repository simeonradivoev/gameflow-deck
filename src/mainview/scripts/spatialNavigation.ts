import
{
  FocusDetails,
  getCurrentFocusKey,
  init,
  SpatialNavigation,
  useFocusable,
  UseFocusableConfig,
  UseFocusableResult,
} from "@noriginmedia/norigin-spatial-navigation";
import { RefObject, useEffect, useState } from "react";
import { Router } from "..";
import { RouteIds } from "@tanstack/react-router";

init({
  shouldFocusDOMNode: false,
  throttle: 200
});

let addFocusable = SpatialNavigation.addFocusable.bind(SpatialNavigation);
let updateFocusable = SpatialNavigation.updateFocusable.bind(SpatialNavigation);
let sortSiblingsByPriority = SpatialNavigation.sortSiblingsByPriority.bind(SpatialNavigation);
let removeFocusable = SpatialNavigation.removeFocusable.bind(SpatialNavigation);
let setFocus = SpatialNavigation.setFocus.bind(SpatialNavigation);

type SaveFocusType = "session" | "local";

type HistorySourceType = "settings" | 'details' | 'launch' | 'game-list' | 'store-details';
const historySourceMap = new Map<string, { to: string, search?: Record<string, any>; }>();

export function SaveSource (id: HistorySourceType, init?: { url?: string, search?: Record<string, any>; })
{
  let finalUrl = init?.url ?? location.hash.replaceAll(/#|(\?.+)/g, '');
  if (finalUrl)
  {
    historySourceMap.set(id, { to: finalUrl, search: init?.search });
  }
}

export function HasSource (id: HistorySourceType)
{
  return historySourceMap.has(id);
}

export function PopSource (id: HistorySourceType)
{
  if (!historySourceMap.has(id))
  {
    return { to: undefined, search: undefined };
  }
  const source = historySourceMap.get(id);
  historySourceMap.delete(id);
  return source ?? { to: undefined, search: undefined };
}

export function PopNavigateSource (id: HistorySourceType, fallback: RouteIds<typeof Router.routeTree>)
{
  const { to, search } = PopSource(id);
  Router.navigate({ to: to ?? fallback, viewTransition: { types: ['zoom-out'] }, search });
}

export function GetFocusedElement (focusKey: string)
{
  return (SpatialNavigation as any).focusableComponents[focusKey]?.node as HTMLElement | undefined;
}

export function GetFocusedTree (leaf: string): string[]
{
  const tree: string[] = [];
  let component = (SpatialNavigation as any).focusableComponents[leaf];
  while (component)
  {
    tree.push(component.focusKey);

    if (component.parentFocusKey && !tree.includes(component.parentFocusKey))
    {
      component = (SpatialNavigation as any).focusableComponents[component.parentFocusKey];
    }
    else
    {
      break;
    }
  }

  return tree;
}

export function dispatchFocusedEvent (event: Event, override?: Element | Window)
{
  const focusedElement = GetFocusedElement(getCurrentFocusKey());
  const finalTarget = override ?? focusedElement ?? window;
  return finalTarget.dispatchEvent(event);
}

export interface FocusEventMap
{
  'focuschanged': Event;
}

export function useFocusEventListener<K extends keyof FocusEventMap, O extends HTMLElement> (eventName: K, handler: (event: FocusEventMap[K]) => void, element?: RefObject<O | null | undefined>): void
{
  useEffect(() =>
  {
    const finalElement = element ? element.current : window;
    finalElement?.addEventListener(eventName, handler);

    return () => finalElement?.removeEventListener(eventName, handler);
  }, [eventName, handler, element?.current]);
}

export function useGlobalFocus ()
{
  const [focused, setFocused] = useState<string | undefined>(undefined);
  useEffect(() =>
  {
    const handler = () => setFocused(getCurrentFocusKey());
    window.addEventListener('focuschanged', handler);

    return () => window.removeEventListener('focuschanged', handler);
  }, []);

  return focused;
}

SpatialNavigation.setFocus = (newFocusKey, focusDetails) =>
{
  setFocus(newFocusKey, focusDetails);
  dispatchFocusedEvent(new CustomEvent<FocusDetails>('focuschanged', { bubbles: true, detail: focusDetails }));
};


SpatialNavigation.updateFocusable = (key, data) =>
{
  updateFocusable(key, data);
};

SpatialNavigation.sortSiblingsByPriority = (siblings, currentLayout, direction, focusKey) =>
{
  const sorted = sortSiblingsByPriority(siblings, currentLayout, direction, focusKey);
  return sorted.filter(e => e.node.checkVisibility({ visibilityProperty: true }));
};

SpatialNavigation.addFocusable = (toAdd) =>
{
  addFocusable(toAdd);
  const component: {
    lastFocusedChildKey?: string;
    preferredChildFocusKey?: string;
    node: HTMLElement;
    focusKey: string;
    focusableDefault?: boolean;
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

export function useFocusableDynamic<P> (conf?: UseFocusableConfig<P>): UseFocusableResult
{
  const [focusable, setFocusable] = useState(conf?.focusable);
  const result = useFocusable({ ...conf, focusable: focusable && conf?.focusable });
  useEffect(() =>
  {
    const observer = new MutationObserver(() =>
    {
      setFocusable(result.ref.current.checkVisibility({ visibilityProperty: true }));
    });
    observer.observe(result.ref.current, { subtree: true, attributes: true });
    return () => observer.disconnect();
  }, [result.ref.current]);
  return result;
}