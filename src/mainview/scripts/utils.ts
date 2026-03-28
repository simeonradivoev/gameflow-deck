import { LocalSettingsSchema, LocalSettingsType } from "@/shared/constants";
import { RefObject, useEffect, useRef, useState } from "react";
import { useLocalStorage } from "usehooks-ts";
import { jobsApi } from "./clientApi";
import { JobsAPIType } from "@/bun/api/rpc";
import { Router } from "..";

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

export function mobileCheck ()
{
  let check = false;
  (function (a) { if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4))) check = true; })(navigator.userAgent || navigator.vendor || (window as any).opera);
  return check;
};

export function useLocalSetting<TKey extends keyof LocalSettingsType> (key: TKey)
{
  const [localValue] = useLocalStorage(key, LocalSettingsSchema.shape[key].parse(undefined), { deserializer: (value) => LocalSettingsSchema.shape[key].parse(JSON.parse(value)) });
  return localValue as LocalSettingsType[TKey];
}

export function useAsyncGenerator<T> (
  generator: AsyncGenerator<T> | undefined,
  deps: any[]
)
{
  const [value, setValue] = useState<T | null>(null);

  useEffect(() =>
  {
    if (!generator)
    {
      setValue(null);
      return;
    }

    let cancelled = false;

    const run = async () =>
    {
      for await (const v of generator)
      {
        if (cancelled) break;
        setValue(v);
      }
    };

    run();

    return () =>
    {
      cancelled = true;
    };
  }, deps);

  return value;
}

export function scrollIntoNearestParent (el: HTMLElement, props?: { behavior?: ScrollBehavior; })
{
  const parent = el.parentElement;
  if (!parent) return;

  const parentRect = parent.getBoundingClientRect();
  const rect = el.getBoundingClientRect();

  // CENTER horizontally
  const left =
    rect.left - parentRect.left +
    parent.scrollLeft -
    parent.clientWidth / 2 +
    rect.width / 2;

  parent.scrollTo({
    left,
    behavior: props?.behavior ?? "smooth"
  });

  // NEAREST vertically
  if (rect.top < parentRect.top)
  {
    parent.scrollTop -= parentRect.top - rect.top;
  } else if (rect.bottom > parentRect.bottom)
  {
    parent.scrollTop += rect.bottom - parentRect.bottom;
  }
}

export function useDragScroll<T extends HTMLElement | null> (ref: RefObject<T>)
{
  useEffect(() =>
  {
    const el = ref.current;
    if (!el) return;

    let isDown = false;
    let isDragging = false;

    let startX = 0;
    let startY = 0;

    let startScrollLeft = 0;
    let startScrollTop = 0;

    const DRAG_THRESHOLD = 5;

    const onMouseDown = (e: MouseEvent) =>
    {
      if (e.button !== 0) return;

      isDown = true;
      isDragging = false;

      startX = e.pageX;
      startY = e.pageY;

      startScrollLeft = el.scrollLeft;
      startScrollTop = el.scrollTop;

      el.style.cursor = "grabbing";
    };

    const onMouseMove = (e: MouseEvent) =>
    {
      if (!isDown) return;

      const dx = e.pageX - startX;
      const dy = e.pageY - startY;

      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)
      {
        isDragging = true;
      }

      el.scrollLeft = startScrollLeft - dx;
      el.scrollTop = startScrollTop - dy;
    };

    const onMouseUp = () =>
    {
      isDown = false;
      el.style.cursor = "";
    };

    const onClick = (e: MouseEvent) =>
    {
      if (isDragging)
      {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    el.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    el.addEventListener("click", onClick, true); // capture phase

    return () =>
    {
      el.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      el.removeEventListener("click", onClick, true);
    };
  }, [ref]);
}

export function scrollIntoViewHandler (params?: ScrollIntoViewOptions)
{
  return (focusKey: string, node: HTMLElement, details: any) =>
  {
    if (details.nativeEvent instanceof PointerEvent) return;
    node.scrollIntoView({ ...params, behavior: details.instant ? 'instant' : 'smooth' });
  };
}

export function useStickyDataAttr<T extends HTMLElement, T2 extends HTMLElement, T3 extends HTMLElement> (ref: RefObject<T | null>, sentinelRef: RefObject<T2 | null>, scrollRef: RefObject<T3 | null>, callback?: (stuck: boolean) => void)
{
  useEffect(() =>
  {
    const el = ref.current;
    const sentinel = sentinelRef.current;
    if (!el || !sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) =>
      {
        el.toggleAttribute("data-stuck", !entry.isIntersecting);
        callback?.(!entry.isIntersecting);
      },
      {
        root: scrollRef.current ?? null,
        threshold: 0,
      }
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [scrollRef.current, callback]);
}

type ExtractField<T, TYPE, K extends string> =
  T extends { type: TYPE; } & Record<K, infer V> ? V : never;

type JobResponse<JOB extends keyof JobsAPIType['~Routes']['api']['jobs']> =
  JobsAPIType['~Routes']['api']['jobs'][JOB]['subscribe']['response'][200];

export function useJobStatus<const JOB extends keyof JobsAPIType['~Routes']['api']['jobs']> (
  id: JOB,
  init?: {
    query?: Record<string, any>,
    onProgress?: (process: number, data: ExtractField<JobResponse<JOB>, "data" | "started" | "progress" | "completed" | "ended", 'data'>) => void,
    onEnded?: (data: ExtractField<JobResponse<JOB>, "completed" | "ended", 'data'>) => void;
    onCompleted?: (data: ExtractField<JobResponse<JOB>, "completed" | "ended", 'data'>) => void;
    onError?: (error: string) => void;
  }
)
{
  type Response = JobResponse<JOB>;
  type DataPayload = ExtractField<Response, 'data' | 'progress' | 'started' | 'ended' | 'completed', 'data'>;

  const ref = useRef<ReturnType<typeof jobsApi.api.jobs[JOB]['subscribe']>>(null);
  const [data, setData] = useState<DataPayload>();
  const [state, setState] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() =>
  {
    const sub = jobsApi.api.jobs[id].subscribe({ query: init?.query });
    ref.current = sub as any;

    sub.subscribe(({ data }) =>
    {
      switch (data.type)
      {
        case 'error':
          setError(data.error);
          setState(undefined);
          setData(undefined);
          init?.onError?.(data.error);
          break;
        case 'ended':
          setState(undefined);
          setData(undefined);
          init?.onEnded?.(data.data as any);
          break;
        case 'completed':
          setState(undefined);
          setData(undefined);
          init?.onCompleted?.(data.data as any);
          break;
        default:
          setData(data.data as DataPayload);
          setState(data.state);
          init?.onProgress?.(data.progress, data.data as any);
      }
    });

    return () =>
    {
      sub.close();
      ref.current = null;
    };
  }, [id, init?.query, init?.onEnded, init?.onCompleted, init?.onProgress, init?.onError]);

  return { data, state, error, wsRef: ref };
}

export function HandleGoBack ()
{
  if (Router.history.canGoBack())
  {
    Router.history.back();
  } else
  {
    Router.navigate({ to: '/', viewTransition: { types: ['zoom-out'] } });
  }
}