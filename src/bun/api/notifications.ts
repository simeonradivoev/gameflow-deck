import { Notification } from '@shared/constants';
import { events } from './app';

export default function buildNotificationsStream ()
{
    let cleanup: (() => void) | undefined = undefined;
    return new ReadableStream({
        async start (controller)
        {
            function enqueue (data: Notification, event?: 'notification')
            {
                const evntString = event ? `event: ${event}\n` : '';
                controller.enqueue(`${evntString}data: ${JSON.stringify(data)}\n\n`);
            }

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
        }
    });
}