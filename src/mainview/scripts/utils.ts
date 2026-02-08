import { doesFocusableExist, getCurrentFocusKey } from "@noriginmedia/norigin-spatial-navigation";
import { RefObject, useEffect } from "react";

export function selfFocusSmart (shouldFocus: boolean, focusSelf: () => void)
{
  if (shouldFocus && (!getCurrentFocusKey() || !doesFocusableExist(getCurrentFocusKey())))
  {
    console.log("Self Focus");
    focusSelf();
  }
}

export type ScrollSaveParams = {
  id: string;
  ref: RefObject<HTMLElement>;
  storage?: "session" | "local";
  shouldSave?: boolean;
};
export function useScrollSave (data: ScrollSaveParams)
{
  useEffect(() =>
  {
    const storage = data.storage === "local" ? localStorage : sessionStorage;
    const key = `scroll-${data.id}`;
    const element = data.ref.current;
    if (element)
    {
      if (storage.getItem(key))
      {
        const scrollData = JSON.parse(storage.getItem(key)!);
        element.scrollLeft = scrollData.x;
        element.scrollTop = scrollData.y;
      }
    }

    function scrollHandler (e: Event)
    {
      if (!data.shouldSave || data.shouldSave === true)
      {
        const currentTarget = e.currentTarget as HTMLElement;
        storage.setItem(
          key,
          JSON.stringify({
            x: currentTarget.scrollLeft,
            y: currentTarget.scrollTop,
          }),
        );
      }

    }

    element?.addEventListener("scrollend", scrollHandler);

    return () => element?.removeEventListener("scrollend", scrollHandler);
  }, [data.id, data.ref.current, data.storage]);

  return { ref: data.ref };
}
