import { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

export default function Error (data: ErrorComponentProps)
{
    return <div className='flex flex-col w-full gap-2 h-64 items-center justify-center'>
        <div className='flex gap-2 font-bold text-2xl text-error'><TriangleAlert />Invalid Store. Update App.</div>
        <div className='text-base-content/40'>{data.error.message}</div>
    </div>;
}