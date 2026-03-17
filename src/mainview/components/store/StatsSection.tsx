
import queries from "@/mainview/scripts/queries";
import { useQuery } from "@tanstack/react-query";
import { Joystick, LibraryBig, Save, TriangleAlert } from "lucide-react";

interface StatsSectionProps
{
    romCount: number;
    missingCount: number;
}

export function StatsSection ({
    romCount,
    missingCount,
}: StatsSectionProps)
{

    const { data: stats } = useQuery(queries.store.storeGetStatsQuery);

    return (
        <section className="px-6 pt-3 pb-4">
            <div className="stats stats-horizontal w-full rounded-2xl text-shadow-sm">
                <div className="stat">
                    <div className="stat-figure text-2xl text-primary  shadow-2xl"><Joystick /></div>
                    <div className="stat-value text-xl font-black text-primary  shadow-2xl">{stats?.storeEmulatorCount}</div>
                    <div className="stat-desc ">Emulators Available</div>
                </div>
                <div className="stat">
                    <div className="stat-figure text-2xl text-secondary"><Save /></div>
                    <div className="stat-value text-xl font-black text-secondary">{romCount.toLocaleString()}+</div>
                    <div className="stat-desc">ROMs in Store</div>
                </div>
                <div className="stat">
                    <div className="stat-figure text-2xl text-success"><LibraryBig /></div>
                    <div className="stat-value text-xl font-black text-success">{stats?.gameCount}</div>
                    <div className="stat-desc">Your Library</div>
                </div>
                <div className="stat">
                    <div className="stat-figure text-2xl text-warning"><TriangleAlert /></div>
                    <div className="stat-value text-xl font-black text-warning">{missingCount}</div>
                    <div className="stat-desc">Missing Emulators</div>
                </div>
            </div>
        </section>
    );
}