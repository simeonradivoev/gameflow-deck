export default function ImageWithFallbacks (data: {
    src: URL[];
    draggable?: boolean;
    className?: string;
})
{
    const handleError = (e: React.SyntheticEvent<HTMLImageElement>) =>
    {
        const img = e.currentTarget;
        const nextIndex = Number(img.dataset.index) + 1;

        if (nextIndex < data.src.length)
        {
            img.dataset.index = String(nextIndex);
            img.src = data.src[nextIndex].href;

        }
    };
    return <img
        draggable={data.draggable}
        className={data.className}
        src={data.src[0].href}
        data-index={0}
        onError={handleError}
        onLoad={e =>
        {
            e.currentTarget.dataset.loaded = "true";
        }}
    >

    </img>;
}