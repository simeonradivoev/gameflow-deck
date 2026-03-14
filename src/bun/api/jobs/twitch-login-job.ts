import { IJob, JobContext } from "../task-queue";
import secrets from "../secrets";
import open from "open";
import z from "zod";
import { delay } from "@/shared/utils";


interface TwitchDevice
{
    device_code: string,
    expires_in: number,
    expires_at: Date,
    started_at: Date,
    interval: number,
    user_code: string,
    verification_uri: string;
}

export default class TwitchLoginJob implements IJob
{
    twitchScopes = "analytics:read:extensions analytics:read:games user:read:email";
    device?: TwitchDevice;
    clientId: string;
    openInBrowser: boolean;
    static id = 'twitch-login-job' as const;
    static dataSchema = z.object({ expires_at: z.date(), started_at: z.date(), url: z.url(), user_code: z.string() }).or(z.undefined());

    constructor(clientId: string, openInBrowser: boolean)
    {
        this.clientId = clientId;
        this.openInBrowser = openInBrowser;
    }

    exposeData = (): z.infer<typeof TwitchLoginJob.dataSchema> => this.device ? ({
        expires_at: this.device.expires_at,
        started_at: this.device.started_at,
        url: this.device.verification_uri,
        user_code: this.device.user_code
    }) : undefined;

    async start (context: JobContext): Promise<any>
    {
        context.setProgress(0, "Retrieving Device");
        let res = await fetch("https://id.twitch.tv/oauth2/device", {
            method: "POST",
            body: new URLSearchParams({
                client_id: this.clientId,
                scopes: this.twitchScopes
            }),
            signal: context.abortSignal
        });

        const device: TwitchDevice = await res.json();
        const expiredTimeout = setTimeout(() => context.abort('expired'), device.expires_in * 1000);
        device.expires_at = new Date(new Date().getTime() + device.expires_in * 1000);
        device.started_at = new Date();
        this.device = device;

        try
        {
            if (this.openInBrowser)
                open(device.verification_uri);
            this.device = device;
            context.setProgress(50, "Waiting For Authentication");

            while (true)
            {
                if (context.abortSignal.aborted) break;
                await delay(device.interval * 1000, context.abortSignal);

                res = await fetch("https://id.twitch.tv/oauth2/token", {
                    method: "POST",
                    body: new URLSearchParams({
                        client_id: this.clientId,
                        scopes: this.twitchScopes,
                        device_code: this.device.device_code,
                        grant_type: "urn:ietf:params:oauth:grant-type:device_code"
                    }),
                    signal: context.abortSignal
                });

                if (res.status === 200)
                {
                    const data: {
                        access_token: string,
                        expires_in: number,
                        refresh_token: string,
                        scope: string[],
                        token_type: string;
                    } = await res.json();

                    secrets.set({ service: 'gamflow_twitch', name: 'access_token', value: data.access_token });
                    secrets.set({ service: 'gamflow_twitch', name: 'refresh_token', value: data.refresh_token });
                    secrets.set({ service: 'gamflow_twitch', name: 'expires_in', value: new Date(new Date().getTime() + data.expires_in).toString() });
                    break;
                }
                else if (res.status !== 400)
                {
                    console.error(res.statusText);
                    break;
                }
            }

        } finally
        {
            clearTimeout(expiredTimeout);
        }
    }

}