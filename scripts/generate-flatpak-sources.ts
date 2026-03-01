import { $ } from "bun";

const lockfile = Bun.argv[2] ?? "bun.lockb";
const output = Bun.argv[3] ?? ".config/flatpak/sources.gen.json";

const text = await $`bun ./bun.lockb --hash: 0000000000000000-0000000000000000-0000000000000000-0000000000000000`.text();

interface FlatpakSource
{
    type: "file";
    url: string;
    dest: string;
    "dest-filename": string;
    sha512?: string;
    sha256?: string;
}

const sources: FlatpakSource[] = [];

for (const block of text.split("\n\n"))
{
    const resolved = block.match(/\s+resolved "([^"]+)"/)?.[1];
    const integrity = block.match(/\s+integrity (\S+)/)?.[1];

    if (!resolved || !integrity) continue;

    const [algo, b64] = integrity.split("-");
    const hex = Buffer.from(b64, "base64").toString("hex");
    const url = new URL(resolved);
    const filename = url.pathname.split("/").pop()!;
    const dest = `flatpak-node/npm-cache${url.pathname.replace(filename, "")}`;

    sources.push({
        type: "file",
        url: resolved,
        dest,
        "dest-filename": filename,
        ...(algo === "sha512" ? { sha512: hex } : { sha256: hex }),
    });
}

await Bun.write(output, JSON.stringify(sources, null, 2));
console.log(`Wrote ${sources.length} entries to ${output}`);

export { };
