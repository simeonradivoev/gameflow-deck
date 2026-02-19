import classNames from 'classnames';
import React, { createContext, JSX, Ref, useContext, useEffect, useState } from 'react';
import { twMerge } from 'tailwind-merge';
import { useSessionStorage } from 'usehooks-ts';

export const AnimatedBackgroundContext = createContext({} as { setBackground: (url: string) => void; });

export function AnimatedBackground (data: {
    children?: any;
    backgroundKey?: string;
    backgroundUrl?: string;
    ref?: Ref<HTMLDivElement>;
    className?: string;
    animated?: boolean,
})
{
    const blurBackground = true;
    const animateBackground = true;

    const [lastBackgroundUrl, setLastBackgroundUrl] = data.backgroundKey ? useSessionStorage<string | undefined>(
        `${data.backgroundKey!}-last`,
        data.backgroundUrl,
    ) : useState<string | undefined>();

    const [backgroundUrl, setBackgroundUrl] = data.backgroundKey ? useSessionStorage<string | undefined>(
        data.backgroundKey!,
        data.backgroundUrl,
    ) : useState<string | undefined>();

    useEffect(() =>
    {
        setBackgroundUrl(data.backgroundUrl);
    }, [data.backgroundUrl]);

    function handleSetBackground (url: string)
    {
        setLastBackgroundUrl(backgroundUrl);
        setBackgroundUrl(url);
    }

    const bgColor = "bg-base-content";

    let backgroundStyle = (url: string) => `linear-gradient(
      color-mix(in srgb, var(--color-base-300) 60%, transparent), 
      color-mix(in srgb, var(--color-base-100) 80%, transparent)
    ), url('${url}') center / cover`;

    let backgroundElements: JSX.Element | undefined = undefined;
    if (true)
    {
        backgroundElements = <div id="container">
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
                className={twMerge("w-full h-full flex flex-col overflow-hidden", data.className)}
            >
                {!!lastBackgroundUrl && <div className='absolute w-full h-full' style={{ background: backgroundStyle(lastBackgroundUrl), zIndex: -4 }}></div>}
                {!!backgroundUrl && <div key={backgroundUrl} className='absolute w-full h-full animate__animated animate__fadeIn' style={{ background: backgroundStyle(backgroundUrl), zIndex: -3 }}></div>}
                {blurBackground && <div className={"absolute w-full h-full backdrop-blur-3xl"} style={{ zIndex: -2 }}></div>}
                {data.animated && animateBackground && <div className="absolute overflow-hidden w-full h-full" style={{ zIndex: -1 }}>
                    {backgroundElements}
                </div>}
                {data.children}
            </div>
        </AnimatedBackgroundContext>
    );
}