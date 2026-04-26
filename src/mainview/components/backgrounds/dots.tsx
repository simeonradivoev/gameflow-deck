import { Ref, RefObject } from 'react';
import './dots.css';

export default function DotsLoading (data: { ref?: Ref<any>; })
{
    return <div ref={data.ref} className="flex gap-3 justify-center animation_alternate items-center pt-8">
        <div className="ball size-6"></div>
        <div className="ball size-6"></div>
        <div className="ball size-6"></div>
    </div>;
}