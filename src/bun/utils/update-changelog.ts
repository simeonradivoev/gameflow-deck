import { semver } from 'bun';

// commit-and-tag-version uses ## for minor releases and ### for patches.
export function getUpdateChangelog (changelog: string, current: string, latest: string)
{
    const headings = [...changelog.matchAll(/^#{1,3} \[?(v?\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?)\]?(?=[\s(]|$).*$/gm)];
    return headings
        .map((heading, index) => ({
            version: heading[1]!,
            body: changelog.slice(heading.index, headings[index + 1]?.index ?? changelog.length).trim()
        }))
        .filter(section => semver.order(section.version, current) > 0 && semver.order(section.version, latest) <= 0)
        .sort((a, b) => semver.order(b.version, a.version))
        .map(section => section.body)
        .join('\n\n');
}
