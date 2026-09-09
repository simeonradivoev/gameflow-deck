import { Button } from '../options/Button';

export default function StoreLoadError({ id, label, retry }: { id: string; label: string; retry: () => void })
{
    return <div role='status' className='flex flex-wrap items-center justify-center gap-4 p-6'>
        <p>Could not load {label}. Check your connection and try again.</p>
        <Button id={`${id}-retry`} onAction={retry}>Retry</Button>
    </div>;
}
