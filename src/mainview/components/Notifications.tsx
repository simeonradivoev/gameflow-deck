import { Notification, RPC_URL } from "@/shared/constants";
import { useEffect } from "react";
import toast from "react-hot-toast";

export default function Notifications (data: {})
{
    useEffect(() =>
    {
        const es = new EventSource(`${RPC_URL(__HOST__)}/api/system/notifications`);
        es.addEventListener('notification', (e) =>
        {
            const notification = JSON.parse(e.data) as Notification;
            if (notification.type === 'error')
            {
                toast.error(notification.message);
            } else if (notification.type === 'success')
            {
                toast.success(notification.message);
            } else
            {
                toast.custom(notification.message);
            }
        });

        es.onerror = (event) =>
        {
            const error = (event as any).data?.error;
            if (error)
            {
                toast.error(error);
            }
        };

        return () => es.close();
    }, []);

    return undefined;
}