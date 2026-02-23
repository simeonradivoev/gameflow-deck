import { Notification } from '@shared/constants';
import { events } from './app';

export default function buildNotificationsStream ()
{
    let closed = false;
    let cleanup: (() => void) | undefined = undefined;
    return new ReadableStream({
        async start (controller)
        {

            const encoder = new TextEncoder();
            function enqueue (data: Notification, event?: 'notification')
            {
                const evntString = event ? `event: ${event}\n` : '';
                controller.enqueue(encoder.encode(`${evntString}data: ${JSON.stringify(data)}\n\n`));
            }

            // seems to help with issue of buffers not flushing, keeping the connection open forcefully
            const keepAlive = setInterval(() =>
            {
                if (closed) return clearInterval(keepAlive);
                try
                {
                    controller.enqueue(encoder.encode(`: ping\n\n`));
                } catch
                {
                    closed = true;
                    clearInterval(keepAlive);
                }
            }, 15000);

            const notificationHandler = (notification: Notification) =>
            {
                enqueue(notification, 'notification');
            };
            events.on('notification', notificationHandler);
            cleanup = () => events.removeListener('notification', notificationHandler);
        },
        cancel: () =>
        {
            cleanup?.();
            closed = true;
        }
    });
}