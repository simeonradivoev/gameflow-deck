import "virtual:svg-icons/register";
import { StaticAssetPath } from "../gen/static-icon-assets.gen";

type OnlySvgIcon<T extends string> = T extends `${infer Rest}.svg`
  ? Rest
  : never;
type StripSvg<T extends string> = T extends `${infer Rest}.svg` ? Rest : T;
type ReplaceSlash<T extends string> = T extends `${infer Left}/${infer Right}`
  ? `${Left}-${ReplaceSlash<Right>}`
  : T;
type IconName<T extends string> = ReplaceSlash<StripSvg<OnlySvgIcon<T>>>;
export type IconType = IconName<StaticAssetPath>;

export default function SvgIcon ({
  icon,
  prefix = "icon",
  className,
  ...props
}: {
  icon: IconType;
  prefix?: string;
  className?: string;
})
{
  const symbolId = `#${prefix}-${icon}`;

  return (
    <svg className={className} {...props} aria-hidden="true">
      <use href={symbolId} />
    </svg>
  );
}
