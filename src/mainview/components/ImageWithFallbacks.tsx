import { RPC_URL } from '@shared/constants';

function resolveImageSource (source: URL, playAnimated: boolean)
{
    if (playAnimated) return source.href;

    const rpcUrl = new URL(RPC_URL(__HOST__));
    if (source.origin === rpcUrl.origin)
    {
        const stillUrl = new URL(source);
        stillUrl.searchParams.set('firstFrame', 'true');
        return stillUrl.href;
    }

    const stillUrl = new URL('/api/romm/image', rpcUrl);
    stillUrl.searchParams.set('url', source.href);
    stillUrl.searchParams.set('firstFrame', 'true');
    const width = source.searchParams.get('width');
    if (width) stillUrl.searchParams.set('width', width);
    return stillUrl.href;
}

export default function ImageWithFallbacks (data: {
    src: URL[];
    draggable?: boolean;
    className?: string;
    playAnimated?: boolean;
})
{
    const handleError = (e: React.SyntheticEvent<HTMLImageElement>) =>
    {
        const img = e.currentTarget;
        const nextIndex = Number(img.dataset.index) + 1;

        if (nextIndex < data.src.length)
        {
            img.dataset.index = String(nextIndex);
            img.src = resolveImageSource(data.src[nextIndex], data.playAnimated !== false);

        }
    };
    return <img
        draggable={data.draggable}
        className={data.className}
        src={resolveImageSource(data.src[0], data.playAnimated !== false)}
        data-index={0}
        onError={handleError}
        onLoad={e =>
        {
            e.currentTarget.dataset.loaded = "true";
        }}
    >

    </img>;
}