
import classNames from 'classnames';
import { createContext, JSX, Ref, useContext, useEffect, useState } from 'react';
import { twMerge } from 'tailwind-merge';
import { useSessionStorage } from 'usehooks-ts';

export const AnimatedBackgroundContext = createContext({} as { setBackground: (url: string) => void; });

export function AnimatedBackground (data: {
    children?: any;
    backgroundKey?: string;
    backgroundUrl?: string | URL;
    ref?: Ref<HTMLDivElement>;
    className?: string;
    animated?: boolean,
    scrolling?: boolean;
})
{
    const animateBackground = true;

    const [backgroundUrl, setBackgroundUrl] = data.backgroundKey ? useSessionStorage<string | undefined>(
        data.backgroundKey!,
        data.backgroundUrl ? (data.backgroundUrl instanceof URL ? data.backgroundUrl.href : data.backgroundUrl) : undefined,
    ) : useState<string | undefined>();

    useEffect(() =>
    {
        setBackgroundUrl(data.backgroundUrl ? (data.backgroundUrl instanceof URL ? data.backgroundUrl.href : data.backgroundUrl) : undefined);
    }, [data.backgroundUrl]);

    const finalBackgroundUrl = backgroundUrl ? new URL(backgroundUrl) : undefined;
    const blur = localStorage.getItem('background-blur') !== "false";
    if (blur)
    {
        if (!finalBackgroundUrl?.searchParams.has('blur'))
        {
            finalBackgroundUrl?.searchParams.set('blur', String(24));
        }

        finalBackgroundUrl?.searchParams.set('height', String(320));
    }

    function handleSetBackground (url: string)
    {
        setBackgroundUrl(url);
    }

    const bgColor = "bg-base-content";

    let backgroundElements: JSX.Element | undefined = undefined;
    if (true)
    {
        backgroundElements = <div id="container" className='sm:invisible md:visible'>
            <div id="container-inside">
                <div className={bgColor} id="circle-small"></div>
                <div className={bgColor} id="circle-medium"></div>
                <div className={bgColor} id="circle-large"></div>
                <div className={bgColor} id="circle-xlarge"></div>
                <div className={bgColor} id="circle-xxlarge"></div>
            </div>
        </div>;
    }

    return (
        <AnimatedBackgroundContext value={{ setBackground: handleSetBackground }}>
            <div ref={data.ref}
                className={twMerge("w-full h-full flex flex-col", data.scrolling ? "overflow-y-scroll animate-bg-zoom-scroll" : "overflow-hidden", data.className)}
                style={data.scrolling ? {
                    backgroundImage: `url('${finalBackgroundUrl?.href}')`,
                    backgroundAttachment: 'local',
                    backgroundSize: '100%',
                    backgroundPositionY: 'bottom',
                    backgroundPositionX: 'center',
                    backgroundColor: "var(--color-base-300)",
                } : {}}
            >
                {!data.scrolling && <div className='absolute top-0 left-0 overflow-hidden w-full h-full'>
                    {<img
                        key={finalBackgroundUrl?.href}
                        className={classNames('absolute w-full h-full object-cover object-center opacity-0 -z-3')}
                        src={finalBackgroundUrl?.href}
                        onLoad={e => e.currentTarget.classList.add(blur ? "animate-bg-zoom-big" : "animate-bg-zoom")}
                    ></img>}
                    <div className='absolute w-full h-full bg-linear-to-b from-base-100/60 to-base-300/80 -z-2' />
                </div>}
                {data.animated && animateBackground && <div className="absolute overflow-hidden w-full h-full" style={{ zIndex: -1 }}>
                    {backgroundElements}
                </div>}
                {data.children}
            </div>
        </AnimatedBackgroundContext>
    );
}