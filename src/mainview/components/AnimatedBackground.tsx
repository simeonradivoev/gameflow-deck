
import classNames from 'classnames';
import { CSSProperties, JSX, Ref, useEffect, useRef, useState } from 'react';
import { twMerge } from 'tailwind-merge';
import { useSessionStorage } from 'usehooks-ts';
import { mobileCheck, useLocalSetting } from '../scripts/utils';
import { AnimatedBackgroundContext } from '../scripts/contexts';

export function AnimatedBackground (data: {
    children?: any;
    backgroundKey?: string;
    backgroundUrl?: string | URL;
    ref?: Ref<HTMLDivElement>;
    className?: string;
    animated?: boolean,
    scrolling?: boolean;
    style?: CSSProperties;
})
{
    const animateBackground = useLocalSetting('backgroundAnimation');
    const [backgroundUrl, setBackgroundUrl] = data.backgroundKey ?
        useSessionStorage<string | undefined>(
            data.backgroundKey,
            data.backgroundUrl ? (data.backgroundUrl instanceof URL ? data.backgroundUrl.href : data.backgroundUrl) : undefined,
        )
        : useState<string | undefined>();

    const [lastBackgroundUrl, setLastBackgroundUrl] = useState<string | undefined>(undefined);
    const backgroundElementRef = useRef<HTMLDivElement>(null);

    useEffect(() =>
    {
        const lastBg = backgroundUrl;

        if (data.backgroundUrl != backgroundUrl)
        {
            setBackgroundUrl(data.backgroundUrl ? (data.backgroundUrl instanceof URL ? data.backgroundUrl.href : data.backgroundUrl) : undefined);
            setLastBackgroundUrl(lastBg);
        }
    }, [data.backgroundUrl]);

    let finalBackgroundUrl: URL | undefined;
    try
    {
        finalBackgroundUrl = backgroundUrl ? new URL(backgroundUrl) : undefined;
    } catch { }

    let finalLastBackgroundUrl: URL | undefined;
    try
    {
        finalLastBackgroundUrl = lastBackgroundUrl ? new URL(lastBackgroundUrl) : undefined;
    } catch { }

    const blur = useLocalSetting('backgroundBlur');
    if (blur)
    {
        if (!finalBackgroundUrl?.searchParams.has('blur'))
        {
            finalBackgroundUrl?.searchParams.set('blur', String(24));
        }

        if (!finalLastBackgroundUrl?.searchParams.has('blur'))
        {
            finalLastBackgroundUrl?.searchParams.set('blur', String(24));
        }

        finalBackgroundUrl?.searchParams.set('height', String(320));
        finalLastBackgroundUrl?.searchParams.set('height', String(320));
    }

    useEffect(() =>
    {
        if (finalBackgroundUrl && backgroundElementRef.current)
        {
            const finalBackgroundImg = new Image();
            finalBackgroundImg.addEventListener('load', e =>
            {
                if (backgroundElementRef.current)
                {
                    backgroundElementRef.current.style.backgroundImage = `url('${finalBackgroundUrl.href}')`;
                    backgroundElementRef.current.style.opacity = "1";
                    backgroundElementRef.current.style.backgroundSize = "100%";
                }
            });
            finalBackgroundImg.src = finalBackgroundUrl.href;
        }


    }, [finalBackgroundUrl]);

    const isMobile = mobileCheck();

    function handleSetBackground (url: string)
    {

        setLastBackgroundUrl(backgroundUrl);
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
                style={data.style}
                className={twMerge("relative w-full h-full flex flex-col", data.scrolling ? "overflow-y-scroll animate-bg-zoom-scroll" : "overflow-hidden", data.className)}

            >
                {!data.scrolling && <div className='absolute top-0 left-0 right-0 bottom-0 overflow-hidden'>
                    <div className='fixed bg-base-100 top-0 left-0 right-0 bottom-0 -z-5'></div>
                    {blur && finalLastBackgroundUrl && <img className='absolute w-full h-full object-cover object-center -z-4' src={finalLastBackgroundUrl.href}></img>}
                    {finalBackgroundUrl ? <img
                        key={finalBackgroundUrl?.href}
                        className={'absolute w-full h-full object-cover object-center opacity-0 -z-3'}
                        src={finalBackgroundUrl?.href}
                        onLoad={e => e.currentTarget.classList.add(blur ? "animate-bg-zoom-big" : "animate-bg-zoom")}
                    ></img> : <><div className='mobile:hidden bg-gradient'></div></>}
                    <div className='absolute top-0 left-0 right-0 bottom-0 bg-linear-to-b from-base-100/60 to-base-300/80 -z-2' />
                    <div className='mobile:hidden bg-noise'></div>
                </div>}
                {data.animated && animateBackground && <div className="fixed overflow-hidden top-0 left-0 right-0 bottom-0" style={{ zIndex: -1 }}>
                    {backgroundElements}
                </div>}
                {data.children}
                {!!data.scrolling && <>
                    <div key={finalBackgroundUrl?.href} ref={backgroundElementRef} className='absolute top-0 bottom-0 left-0 right-0' style={data.scrolling ? {
                        backgroundAttachment: 'local',
                        backgroundSize: '105%',
                        opacity: 0,
                        transition: 'all ease-out',
                        backgroundPositionY: 'bottom',
                        backgroundPositionX: 'center',
                        transitionDuration: "400ms",
                        backgroundBlendMode: blur ? 'normal' : 'soft-light',
                        backgroundColor: "var(--color-base-300)",
                    } : {}}></div>
                    <div className='mobile:hidden bg-noise opacity-30 z-1'></div>
                </>}
            </div>
        </AnimatedBackgroundContext >
    );
}