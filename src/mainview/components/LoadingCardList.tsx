import classNames from 'classnames';
import { GameCardSkeleton } from './GameCard';

export default function LoadingCardList (data: { placeholderCount: number, grid?: boolean; })
{
    return (
        <ul
            title="Games"
            id={`card-list-placeholder`}
            save-child-focus="session"
            className={classNames("my-6 items-center justify-center-safe h-(--game-card-height) ",
                data.grid ? "card-grid gap-5" : 'card-list gap-6'
            )}
            onKeyDown={(e) =>
            {
                e.preventDefault();
                e.stopPropagation();
            }}
            style={{ scrollbarWidth: "none" }}
        >
            {new Array(data.placeholderCount).fill(1).map(p => <GameCardSkeleton />)}
        </ul>
    );
}
