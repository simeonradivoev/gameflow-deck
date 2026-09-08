import { AutoFocus } from '@/mainview/components/AutoFocus';
import DotsLoading from '@/mainview/components/backgrounds/dots';
import { Button } from '@/mainview/components/options/Button';
import { checkUpdateMutation, hasUpdateQuery, updateMutation } from '@/mainview/scripts/queries/system';
import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { CircleFadingArrowUp, RefreshCcw } from 'lucide-react';
import { MarkdownAsync } from 'react-markdown';

export const Route = createFileRoute('/settings/update')({
    component: RouteComponent,
    pendingComponent: Loading,
    async loader (ctx)
    {
        const data = await ctx.context.queryClient.fetchQuery(hasUpdateQuery);
        return { data: data };
    },
});

function Loading ()
{
    const { ref, focusSelf } = useFocusable({ focusKey: 'updates' });
    return <>
        <DotsLoading ref={ref} />
        <AutoFocus focus={focusSelf} />
    </>;
}

function RouteComponent ()
{
    const { data } = Route.useLoaderData();
    const router = useRouter();
    const update = useMutation(updateMutation);
    const forceCheckUpdate = useMutation({
        ...checkUpdateMutation,
        async onSuccess (data, variables, onMutateResult, context)
        {
            context.client.setQueryData(hasUpdateQuery.queryKey, data);
            await router.invalidate();
        },
    });
    const { ref, focusKey } = useFocusable({ focusKey: 'updates' });
    return <div ref={ref}>
        <FocusContext value={focusKey}>
            <h1 className='text-2xl text-center'>Current version: {data.currentVersion}</h1>
            {data.hasUpdate > 0 && <p className='text-center'>Latest version: {data.version}</p>}
            <div className='flex flex-flex-wrap gap-2'>
                {
                    data.hasUpdate > 0 ?
                        <Button className='gap-3' style='warning' id='update-btn' onAction={() => update.mutate()}><CircleFadingArrowUp /> Update to {data.version}</Button> :
                        <Button className='gap-3' id='update-btn' onAction={() => forceCheckUpdate.mutate()}>{forceCheckUpdate.isPending ? <span className="loading loading-spinner loading-lg"></span> : <RefreshCcw />}Check for Update</Button>
                }
                {<Button className='gap-3' id='force-update-btn' onAction={() => update.mutate()}><CircleFadingArrowUp /> Force Update</Button>}
            </div>
            <div className="divider">{data.hasUpdate > 0 ? `Changes since ${data.currentVersion}` : 'Version Info'}</div>
            {data.changelogUnavailable && <p role='status'>The full changelog is unavailable. Showing the latest release notes.</p>}
            <div className="prose lg:prose-xl">
                <MarkdownAsync components={{
                    a ({ node, children, ...props })
                    {
                        try
                        {
                            new URL(props.href ?? "");
                            // If we don't get an error, then it's an absolute URL.

                            props.target = "_blank";
                            props.rel = "noopener noreferrer";
                        } catch (e) { }

                        return <a {...props}>{children}</a>;
                    },
                }} >{data.info}</MarkdownAsync>
            </div>
        </FocusContext>
    </div>;
}
