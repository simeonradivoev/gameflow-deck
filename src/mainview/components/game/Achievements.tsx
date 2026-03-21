import { FrontEndGameTypeDetailed, FrontEndGameTypeDetailedAchievement } from "@/shared/constants";
import { useFocusable } from "@noriginmedia/norigin-spatial-navigation";
import { Medal } from "lucide-react";

function Achievement (data: { index: number, achievement: FrontEndGameTypeDetailedAchievement; } & FocusParams)
{
    const { ref, focusKey } = useFocusable({ focusKey: `achievement-${data.index}`, onFocus: (l, p, details) => data.onFocus?.(focusKey, ref.current, details) });
    return <div ref={ref} className="flex focusable focusable-primary gap-4 p-4 bg-base-300 rounded-3xl items-center scroll-mb-16 scroll-mt-32">
        <div data-unlocked={!!data.achievement.date} data-hardcore={!!data.achievement.date_hardcode} className="data-[unlocked=true]:ring-4 aspect-square data-[unlocked=true]:ring-offset-4 ring-accent ring-offset-warning rounded-2xl overflow-hidden">
            <img className="scale-110" src={data.achievement.badge_url} />
        </div>

        <div className="flex gap-2 sm:flex-col md:flex-row grow justify-between sm:items-start md:items-center">
            <div>
                <div className="flex gap-2">
                    {data.achievement.type === 'win_condition' && <Medal />}
                    <p className="font-semibold">{data.achievement.title}</p>
                </div>
                <p className="text-base-content/60">{data.achievement.description}</p>
            </div>
            {!!data.achievement.date && <div className="bg-base-100 rounded-3xl px-4 p-1">{data.achievement.date.toDateString()}</div>}
        </div>
    </div>;
}

export default function Achievements (data: { game: FrontEndGameTypeDetailed; })
{
    const handleFocus = (key: string, node: HTMLElement, details: any) =>
    {
        node.scrollIntoView({ behavior: details?.instant ? 'instant' : 'smooth', block: 'nearest' });
    };
    return <div className="grid sm:grid-cols-1 md:grid-cols-3 px-4 gap-2">
        {data.game.achievements?.entires.map((a, i) => <Achievement index={i} onFocus={handleFocus} key={i} achievement={a} />)}
    </div>;
}