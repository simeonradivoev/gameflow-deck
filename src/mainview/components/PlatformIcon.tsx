import { Globe } from 'lucide-react';

export default function PlatformIcon (data: { className?: string; slug?: string | null; src: string; })
{
    if (data.slug === 'web')
    {
        return <Globe aria-hidden className={data.className} />;
    }

    return <img alt='' className={data.className} src={data.src} />;
}

