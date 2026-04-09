import { RPC_URL } from "@/shared/constants";
import { Clock, CloudUpload, Save } from "lucide-react";
import { useEffect } from "react";
import toast, { ToastOptions } from "react-hot-toast";


const customIconMap = {
    save: <Save />,
    upload: <CloudUpload />,
    clock: <Clock />
};

export default function Notifications (data: {})
{
    useEffect(() =>
    {
        const es = new EventSource(`${RPC_URL(__HOST__)}/api/system/notifications`);
        es.addEventListener('notification', (e) =>
        {
            const notification = JSON.parse(e.data) as FrontendNotification;
            const options: ToastOptions = {
                removeDelay: notification.duration,
                style: {
                    borderRadius: "64px"
                }
            };
            if (notification.icon) options.icon = customIconMap[notification.icon];
            if (notification.type === 'error')
            {
                toast.error(notification.message, options);
            } else if (notification.type === 'success')
            {
                toast.success(notification.message, options);
            } else
            {
                toast.custom(notification.message, options);
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