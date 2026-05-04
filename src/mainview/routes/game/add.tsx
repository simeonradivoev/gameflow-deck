import { AutoFocus } from '@/mainview/components/AutoFocus';
import { OptionElement } from '@/mainview/components/ContextDialog';
import GameLookupElement from '@/mainview/components/game/GameLookup';
import { StickyHeaderUI } from '@/mainview/components/Header';
import LoadingScreen from '@/mainview/components/LoadingScreen';
import { Button } from '@/mainview/components/options/Button';
import { PathSettingsOptionBase } from '@/mainview/components/options/PathSettingsOption';
import { FloatingShortcuts } from '@/mainview/components/Shortcuts';
import { oneShot } from '@/mainview/scripts/audio/audio';
import { addManualGameMutation, allGamesInvalidateQuery, gameLookupDetails, platformLookupMatchQuery } from '@/mainview/scripts/queries/romm';
import { GamePadButtonCode, useShortcuts } from '@/mainview/scripts/shortcuts';
import { HandleGoBack } from '@/mainview/scripts/utils';
import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import { ArrowBigRightDash, Check, CirclePlus, CircleQuestionMark, CircleX, FileSearch, FolderOpen, HardDrive } from 'lucide-react';
import { basename } from 'pathe';
import { JSX, useState } from 'react';
import toast from 'react-hot-toast';
import { twMerge } from 'tailwind-merge';
import z from 'zod';


const StateSchema = z.object({
    step: z.number().default(0),
    gameLocation: z.string().optional(),
    selectedGame: z.object({ source: z.string(), id: z.string() }).optional(),
    platformId: z.number().optional(),
    search: z.string().optional()
});

export const Route = createFileRoute('/game/add')({
    component: RouteComponent,
    validateSearch: zodValidator(StateSchema)
});

function FileSelectionField (data: { location: string | undefined, setLocation: (location: string | undefined) => void; })
{
    const [localLocation, setLocalLocation] = useState<string | undefined>(data.location);
    return <PathSettingsOptionBase
        isDirty={false}
        label={"Game Location"}
        id={'game-location'}
        type={'text'}
        save={data.setLocation}
        allowNewFolderCreation={false}
        requireConfirmation={false}
        isDirectoryPicker={false}
        localValue={localLocation}
        setLocalValue={setLocalLocation}
        defaultValue={data.location}
    />;
}

const TAG_REGEX = /\(([^)]+)\)|\[([^\]]+)\]/g;
const EXTENSION_REGEX = /\.(([a-z]+\.)*\w+)$/g;
const LEADING_ARTICLE_PATTERN = /^(a|an|the)\b/g;
const COMMA_ARTICLE_PATTERN = /,\s(a|an|the)\b(?=\s*[^\w\s]|$)/g;
const NON_WORD_SPACE_PATTERN = /[^\w\s]/g;
const MULTIPLE_SPACE_PATTERN = /\s+/g;

function BuildSearch (filePath: string)
{
    const name = basename(filePath);
    const nameWithoutExt = name.replace(EXTENSION_REGEX, "").trim();
    if (!nameWithoutExt) return undefined;
    const nameWithoutTags = nameWithoutExt.replaceAll(TAG_REGEX, "").trim();
    if (TAG_REGEX.test(nameWithoutExt)) console.log("match");
    if (!nameWithoutTags) return undefined;

    // Lower and replace underscores with spaces
    let finalSearch = nameWithoutTags.toLowerCase().replace("_", " ");

    // Remove articles (combined if possible)
    finalSearch = finalSearch.replaceAll(LEADING_ARTICLE_PATTERN, '');
    finalSearch = finalSearch.replaceAll(COMMA_ARTICLE_PATTERN, '');

    // Remove punctuation and normalize spaces in one step
    finalSearch = finalSearch.replaceAll(NON_WORD_SPACE_PATTERN, '');
    finalSearch = finalSearch.replaceAll(MULTIPLE_SPACE_PATTERN, '');

    return nameWithoutTags;
}

const typeIconMap: Record<string, JSX.Element> = {
    new: <CirclePlus />,
    existing: <HardDrive />,
    unknown: <CircleQuestionMark />
};

function Overview (data: {})
{
    const navigate = useNavigate();
    const router = useRouter();
    const state = Route.useSearch();
    const { data: game } = useQuery(gameLookupDetails(state.selectedGame?.source, state.selectedGame?.id));
    const { data: platform } = useQuery(platformLookupMatchQuery(state.selectedGame?.source, state.platformId));
    const addGame = useMutation({
        ...addManualGameMutation,
        onError (error, variables, onMutateResult, context)
        {
            toast.error(error.message);
        },
        async onSuccess (data, variables, onMutateResult, context)
        {
            if (data.id === null) return;
            await context.client.invalidateQueries(allGamesInvalidateQuery);
            navigate({
                to: '/game/$source/$id', params: {
                    source: data.source, id: String(data.id)
                }, replace: true
            });
        },
    });

    if (!game) return <div>Select A Game</div>;

    return <div className='flex flex-col items-center'>
        <div className="divider">Preview</div>
        <div className='flex gap-4'>
            <div>{!!game[0].coverUrl && <img className='w-xs rounded-2xl' src={game[0].coverUrl}></img>}</div>
            <div className='flex flex-col gap-2'>
                <div className='text-3xl font-semibold'> {game[0].name}</div>
                <div> {game[0].summary}</div>
                <div className='flex gap-4 items-center'>
                    <div> {platform?.details.name}</div>
                    <ArrowBigRightDash className='size-10' />
                    <div className='flex gap-2 items-center'>
                        {!!platform?.match.coverUrl && <img className='size-8' src={platform?.match.coverUrl}></img>}
                        <div> {platform?.match.name}</div>
                        <div> {platform?.match.family_name}</div>
                        <FileSearch />
                        {!!platform?.match.type && typeIconMap[platform?.match.type]}
                        <div> {platform?.match.type}</div>
                    </div>
                </div>
                <div className='flex gap-2'><FolderOpen />{state.gameLocation}</div>
            </div>
        </div>
        <div className="divider">Actions</div>
        <div className='flex gap-2'>
            <Button id="add-game-btn" style='primary' type='button' className='gap-2 focusable focusable-primary' onAction={e =>
            {
                if (!state.selectedGame || !state.platformId || !state.gameLocation) return;
                addGame.mutate({
                    source: state.selectedGame.source,
                    id: state.selectedGame.id,
                    gamePath: state.gameLocation,
                    platformId: state.platformId
                });
            }} ><CirclePlus /> Add Game</Button>
            <Button id="cancel-btn" style='warning' type='button' className='gap-2 focusable focusable-primary' onAction={e =>
            {
                HandleGoBack(router, e.event);
            }} ><CircleX /> Cancel</Button>
        </div>
    </div>;
}

function PlatformEntry (data: {
    id: string,
    displayName: string,
    platformSource: string,
    platformId: number;
})
{
    const state = Route.useSearch();
    const { data: match, isFetching: matchIsFetching } = useQuery({ ...platformLookupMatchQuery(data.platformSource, data.platformId), staleTime: 1000 * 60 * 60 });
    const navigate = useNavigate();
    const handleAction = () =>
    {
        navigate({ to: '/game/add', search: { ...state, platformId: data.platformId, step: 3 }, replace: true });
        oneShot('openGeneric');
    };

    return <OptionElement action={handleAction} className="list-row" id={data.id} content={
        <div className='flex items-center gap-2'>
            <div>{data.displayName}</div>
            <div className="flex gap-2 divider divider-horizontal items-center"></div>
            {matchIsFetching ? <span className="loading loading-spinner loading-lg"></span> : match && <>

                {match.match.coverUrl ? <img className='size-8' src={match.match.coverUrl}></img> : <CircleQuestionMark />}
                <div className='flex gap-2'>{match.match.name} - {!!match.match.type && typeIconMap[match.match.type]} {match.match.type}</div>
            </>}
        </div>
    } type={'primary'} />;
}

function PlatformSelection (data: {})
{
    const state = Route.useSearch();
    const { data: game, isFetching } = useQuery({ ...gameLookupDetails(state.selectedGame?.source, state.selectedGame?.id), staleTime: 1000 * 60 * 60 });
    if (isFetching) return <span className="loading loading-spinner loading-lg"></span>;
    if (!game) return <div>Select A Game</div>;
    return <ul className='flex flex-col gap-2'>
        {game[0].platforms.map((p, i) => <PlatformEntry key={i} displayName={p.displayName} platformSource={game[0].source} platformId={p.id} id={p.slug} />)}
    </ul>;
}

function Lookup ()
{
    const state = Route.useSearch();
    const [search, setSearch] = useState<string | undefined>(state.search);
    const navigate = useNavigate();
    const handleSetSelectedGame = (source: string, id: string) =>
    {
        navigate({ to: '/game/add', search: { ...state, selectedGame: { source, id }, platformId: undefined, search, step: 2 }, replace: true });
        oneShot('openGeneric');
    };
    return <GameLookupElement
        showPlatforms
        selected={state.selectedGame}
        search={search}
        setSearch={setSearch}
        onSelect={l =>
        {
            handleSetSelectedGame(l.source, l.id);
        }} />;
}

const StepDetails = [{ label: "Select Location" }, { label: "Find Match" }, { label: "Select Platform" }, { label: "Confirm" }];

function Location ()
{

    const state = Route.useSearch();
    const navigate = useNavigate();
    const handleSetLocation = (location: string | undefined) =>
    {
        if (!location) return;
        navigate({
            to: '/game/add', search: {
                ...state,
                gameLocation: location,
                search: BuildSearch(location),
                selectedGame: undefined,
                platformId: undefined,
                step: 1
            }, replace: true
        });
        oneShot('openGeneric');
    };
    return <div className='flex flex-col gap-4 items-stretch'>
        <div className="divider"><FolderOpen className='size-12' /> Select Game Rom</div>
        <FileSelectionField location={state.gameLocation ?? ''} setLocation={handleSetLocation} />
        <div className='flex justify-center text-base-content/60'>
            Select The Rom File from your local storage
        </div>
    </div>;
}

function Details (data: {})
{

    const { ref, focusKey } = useFocusable({ focusKey: 'add-game-details-section' });
    const state = Route.useSearch();
    const step = state.step ?? 0;
    return <div ref={ref} className='flex flex-col gap-2 p-4'>
        <FocusContext value={focusKey}>
            {step === 0 && <Location />}
            {step === 1 && <Lookup />}
            {step === 2 && <PlatformSelection />}
            {step === 3 && <Overview />}
        </FocusContext>

    </div>;
}

function getStepDetails (index: number, state: z.infer<typeof StateSchema>)
{
    let completed = index < state.step;
    if (index === 0 && state.gameLocation) completed = true;
    if (index === 1 && state.selectedGame) completed = true;
    if (index === 2 && state.platformId) completed = true;
    if (index === 3 && state.gameLocation && state.selectedGame && state.platformId) completed = true;
    let canNavigate = index <= state.step;
    if (index === 1 && state.gameLocation) canNavigate = true;
    if (index === 2 && state.selectedGame) canNavigate = true;
    if (index === 3 && state.platformId) canNavigate = true;
    return { completed, canNavigate };
}

function Step (data: { index: number; label: string; })
{
    const navigate = useNavigate();
    const handleGoToStep = (step: number) =>
    {
        navigate({ to: '/game/add', search: { ...state, step: step }, replace: true });
        oneShot('openGeneric');
    };
    const state = Route.useSearch();
    const step = state.step ?? 0;
    const { canNavigate, completed } = getStepDetails(data.index, state);

    const { ref } = useFocusable({
        focusKey: `step-${data.index}`,
        focusable: canNavigate,
        onFocus: () =>
        {
            if (step === data.index) return;
            navigate({ to: '/game/add', search: { ...state, step: data.index }, replace: true });
            oneShot('openGeneric');
        }
    });
    return <li ref={ref} aria-disabled={!canNavigate} onClick={e =>
    {
        if (!canNavigate) return;
        handleGoToStep(data.index);
    }} className={twMerge("step not-aria-disabled:cursor-pointer", data.index <= step ? "step-primary" : "")}>
        <span className="step-icon in-focused:ring-7 in-focused:ring-base-content in-aria-disabled:text-base-content/40!">{completed ? <Check /> : <CircleQuestionMark />}</span>
        {data.label}
    </li>;
}

function Steps ()
{
    const state = Route.useSearch();
    const step = state.step ?? 0;
    const { ref, focusKey } = useFocusable({ focusKey: "steps", preferredChildFocusKey: `step-${step}`, saveLastFocusedChild: false });
    return <ul ref={ref} className="steps pt-2" style={{ viewTransitionName: 'steps' }}>
        <FocusContext value={focusKey}>
            {StepDetails.map((s, i) => <Step key={i} index={i} label={s.label} />)}
        </FocusContext>
    </ul>;
}

function RouteComponent ()
{
    const navigate = useNavigate();
    const state = Route.useSearch();
    const step = state.step ?? 0;
    const router = useRouter();
    const queryClient = useQueryClient();
    const isAddingGame = queryClient.isMutating(addManualGameMutation) > 0;

    const { ref, focusKey, focusSelf } = useFocusable({ focusKey: 'add-game-page', preferredChildFocusKey: 'steps' });

    const handleReturnStep = (e: Event) =>
    {
        if (step <= 0)
        {
            HandleGoBack(router, e);
        } else
        {
            const newStep = step - 1;
            navigate({ to: '/game/add', search: { ...state, step: newStep }, replace: true });
        }
    };

    const handleStepNavigation = (newStep: number) =>
    {
        if (step === newStep) return;
        const { canNavigate } = getStepDetails(newStep, state);
        if (!canNavigate) return;
        navigate({ to: '/game/add', search: { ...state, step: newStep }, replace: true });
        oneShot('openGeneric');
    };

    useShortcuts(focusKey, () => [
        { button: GamePadButtonCode.B, label: step === 0 ? "Cancel" : "Prev Step", action: handleReturnStep },
        { button: GamePadButtonCode.Y, label: "Cancel", action: e => HandleGoBack(router, e) },
        {
            button: GamePadButtonCode.L1, label: "Prev Step", action (e)
            {
                handleStepNavigation(Math.max(step - 1, 0));
            },
        },
        {
            button: GamePadButtonCode.R1, label: "Next Step", action (e)
            {
                handleStepNavigation(Math.min(step + 1, 3));
            },
        }
    ], [step]);

    return <div ref={ref}>
        <FocusContext value={focusKey}>
            <div className='absolute w-screen h-screen overflow-y-scroll'>
                <StickyHeaderUI className='bg-base-300' ref={ref} />
                <div className='flex justify-center mt-8'>
                    <Steps />
                </div>
                <Details />
                <FloatingShortcuts />
            </div>
        </FocusContext>
        <AutoFocus focus={focusSelf} />
        {isAddingGame && <LoadingScreen>
            <div className='flex gap-3'>
                <span className="loading loading-spinner loading-lg"></span>
                <div>Adding Game</div>
            </div>
        </LoadingScreen>}
    </div>;
}
