import { DownloadJobData } from "@simeonradivoev/gameflow-sdk/shared";
import { IJob, JobContext } from "@simeonradivoev/gameflow-sdk/task-queue";
import { sleep } from "bun";

export class TestDownloadJob implements IJob<DownloadJobData, string>
{
    data: DownloadJobData = {
        speed: 1686,
        downloaded: 0,
        total: 6615841,
        name: "Test Download Job"
    };

    group = "test-download";

    async start (context: JobContext<IJob<DownloadJobData, string>, DownloadJobData, string>): Promise<any>
    {
        for (let i = 0; i < 10; i++)
        {
            await sleep(1000);
            context.setProgress(i / 10 * 100, 'download');
            if (context.abortSignal.aborted) return;
        }
    }
    exposeData (): DownloadJobData
    {
        return this.data;
    }

}