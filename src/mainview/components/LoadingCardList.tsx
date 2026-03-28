import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { twMerge } from 'tailwind-merge';
import CardElement from './CardElement';


export default function LoadingCardList (data: { id: string, placeholderCount: number, grid?: boolean; className?: string; })
{

    const { ref, focusKey } = useFocusable({
        focusKey: data.id,
        forceFocus: true,
        autoRestoreFocus: true
    });

    return (
        <ul
            ref={ref}
            title="Games"
            id={`card-list-placeholder`}
            save-child-focus="session"
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
            style={{ scrollbarWidth: "none" }}
        >
            <FocusContext.Provider value={focusKey}>
                {new Array(data.placeholderCount).fill(1).map((g, i) =>
                {
                    return <CardElement
                        key={i}
                        index={i}
                        focusKey={`loading-card-${i}`}
                        data-index={i}
                        title={""}
                        subtitle={""}
                        onFocus={(id, node, details) =>
                        {

                        }}
                        preview={<div className='flex justify-center items-center portrait:aspect-8/10 landscape:aspect-8/12'>
                            <span className="loading loading-spinner loading-xl"></span>
                        </div>}
                        id={`loading-card-${i}`}
                    />;
                })}
            </FocusContext.Provider>

        </ul>
    );
}
