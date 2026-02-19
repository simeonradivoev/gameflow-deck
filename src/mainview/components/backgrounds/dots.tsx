import './dots.css';

export default function DotsLoading ()
{
    return <div className="flex gap-3 justify-center animation_alternate items-center pt-8">
        <div className="ball size-6"></div>
        <div className="ball size-6"></div>
        <div className="ball size-6"></div>
    </div>;
}