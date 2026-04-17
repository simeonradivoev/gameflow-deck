export default function LoadingScreen (data: { children?: any; })
{
    return <div className="absolute flex items-center gap-2 justify-center bg-base-300 w-screen h-screen z-100 font-semibold text-2xl text-shadow-lg">
        <div className="absolute w-screen h-screen bg-radial from-base-100 to-base-300 -z-2"></div>
        <div className="bg-noise"></div>
        <div className="bg-dots"></div>
        {data.children}
    </div>;
}