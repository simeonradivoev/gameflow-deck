import { GameInstallProgress, GameStatusType, RPC_URL, } from "@shared/constants";
import { activeGame, config, customEmulators, db, events, taskQueue } from "../../app";
import { getValidLaunchCommands } from "./launchGameService";
import * as schema from '@schema/app';
import { eq } from "drizzle-orm";
import { getErrorMessage } from "@/bun/utils";
import { getLocalGameMatch } from "./utils";
import { getRomApiRomsIdGet } from "@/clients/romm";
import fs from 'node:fs/promises';
import { ErrorLike } from "elysia/universal";
import { getStoreGameFromId } from "../../store/services/gamesService";
import { cores } from "../../emulatorjs/emulatorjs";
import { host } from "@/bun/utils/host";

class CommandSearchError extends Error
{
    constructor(status: GameStatusType, message: string)
    {
        super(message);
        this.name = status;
    }
}

export async function getLocalGame (source: string, id: string)
{
    const localGames = await db.select({ id: schema.games.id, path_fs: schema.games.path_fs, platform_slug: schema.platforms.es_slug })
        .from(schema.games)
        .where(getLocalGameMatch(id, source))
        .leftJoin(schema.platforms, eq(schema.games.platform_id, schema.platforms.id));

    if (localGames.length > 0)
    {
        return localGames[0];
    }

    return undefined;
}

export async function getValidLaunchCommandsForGame (source: string, id: string)
{
    const localGame = await getLocalGame(source, id);
    if (localGame)
    {
        if (localGame.platform_slug)
        {
            if (localGame.path_fs)
            {

                try
                {
                    const commands = await getValidLaunchCommands({ systemSlug: localGame.platform_slug, customEmulatorConfig: customEmulators, gamePath: localGame.path_fs });

                    if (cores[localGame.platform_slug])
                    {
                        const gameUrl = `${RPC_URL(host)}/api/romm/rom/${source}/${id}`;
                        commands.push({
                            id: 'emulatorjs',
                            label: "Emulator JS", command: `core=${cores[localGame.platform_slug]}&gameUrl=${encodeURIComponent(gameUrl)}`, valid: true, emulator: 'emulatorjs'
                        });
                    }

                    const validCommand = commands.find(c => c.valid);
                    if (validCommand)
                    {
                        return { commands: commands.filter(c => c.valid), gameId: localGame.id, source: source, sourceId: id };
                    }
                    else
                    {
                        return new CommandSearchError('missing-emulator', `Missing One Of Emulators: ${Array.from(new Set(commands.filter(e => e.emulator && e.emulator !== "OS-SHELL").map(e => e.emulator))).join(', ')}`);
                    }
                } catch (error)
                {
                    console.error(error);
                    return new CommandSearchError('error', getErrorMessage(error));
                }

            } else
            {
                return new CommandSearchError('error', 'Missing Path');
            }
        }
        else
        {
            return new CommandSearchError('error', 'Missing Platform');
        }

    }

    return undefined;
}

export default async function buildStatusResponse (source: string, id: string)
{
    let cleanup: (() => void) | undefined;
    let closed = false;
    return new Response(new ReadableStream({
        async start (controller)
        {
            const encoder = new TextEncoder();

            function enqueue (data: GameInstallProgress, event?: 'error' | 'refresh' | 'ping')
            {
                if (closed) return;
                const evntString = event ? `event: ${event}\n` : '';
                controller.enqueue(encoder.encode(`${evntString}data: ${JSON.stringify(data)}\n\n`));
            }

            await sendLatests();

            // seems to help with issue of buffers not flushing, keeping the connection open forcefully
            const keepAlive = setInterval(() =>
            {
                if (closed) return clearInterval(keepAlive);
                try
                {
                    enqueue({}, 'ping');
                } catch
                {
                    closed = true;
                    clearInterval(keepAlive);
                }
            }, 15000);

            const sourceId = `${source}-${id}`;

            async function sendLatests ()
            {
                if (closed) return;
                const localGame = await db.query.games.findFirst({ where: getLocalGameMatch(id, source), columns: { id: true } });
                const activeTask = taskQueue.findJob(`install-rom-${source}-${id}`);
                if (activeTask)
                {
                    enqueue({
                        progress: activeTask.progress,
                        status: activeTask.state as any
                    });

                } else if (activeGame && activeGame.gameId === localGame?.id)
                {
                    enqueue({ status: 'playing' as GameStatusType, details: 'Playing' });
                }
                else
                {
                    const validCommand = await getValidLaunchCommandsForGame(source, id);
                    if (validCommand)
                    {
                        if (validCommand instanceof Error)
                        {
                            enqueue({ status: validCommand.name as GameStatusType, error: validCommand.message });
                        }
                        else
                        {
                            enqueue({ status: 'installed', details: validCommand.commands[0].label, commands: validCommand.commands });
                        }

                    }
                    else if (source === 'romm')
                    {
                        // TODO: Add Caching
                        const remoteGame = await getRomApiRomsIdGet({ path: { id: Number(id) } });
                        const stats = await fs.statfs(config.get('downloadPath'));
                        if (remoteGame.data?.fs_size_bytes && remoteGame.data?.fs_size_bytes > stats.bsize * stats.bavail)
                        {
                            enqueue({ status: 'error', error: "Not Enough Free Space" });
                        } else
                        {
                            enqueue({ status: 'install', details: 'Install' });
                        }

                    } else if (source === 'store')
                    {
                        const storeGame = await getStoreGameFromId(id);
                        const fileResponse = await fetch(storeGame.file, { method: 'HEAD' });
                        const size = Number(fileResponse.headers.get('content-length'));
                        const stats = await fs.statfs(config.get('downloadPath'));

                        if (size > stats.bsize * stats.bavail)
                        {
                            enqueue({ status: 'error', error: "Not Enough Free Space" });
                        } else
                        {
                            enqueue({ status: 'install', details: 'Install' });
                        }
                    }
                }
            }

            const dispose: Function[] = [];
            const handleActiveExit = async (data: { error?: ErrorLike; }) =>
            {
                if (data.error)
                {
                    enqueue({
                        status: 'error',
                        error: data.error
                    }, 'error');
                }
                await sendLatests();
            };
            events.on('activegameexit', handleActiveExit);
            dispose.push(() => events.off('activegameexit', handleActiveExit));
            dispose.push(taskQueue.on('progress', ({ id, progress, state }) =>
            {
                if (id.endsWith(sourceId))
                {
                    enqueue({ progress, status: state as any });
                }
            }));
            dispose.push(taskQueue.on('completed', ({ id }) =>
            {
                if (id.endsWith(sourceId))
                {
                    enqueue({}, 'refresh');
                }
            }));
            dispose.push(taskQueue.on('error', ({ id, error }) =>
            {
                if (id.endsWith(sourceId))
                {
                    enqueue({
                        status: 'error',
                        error: getErrorMessage(error)
                    }, 'error');
                }
            }));

            cleanup = () =>
            {
                closed = true;
                dispose.forEach(f => f());
            };
        },
        cancel ()
        {
            cleanup?.();
            cleanup = undefined;
        },
    }));
}