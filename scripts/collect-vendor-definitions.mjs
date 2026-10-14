import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);
const root = path.resolve("build/vendor-sources");
await fs.mkdir(root, { recursive: true });
const seeds = [
  [
    "Createkeebs",
    "https://createkeebs.com/blogs/news/keyboard-firmware-download",
  ],
  [
    "Createkeebs",
    "https://epomaker.com/blogs/via-json/epomaker-createkeebs-high65-v2-json-file",
  ],
  ["Createkeebs / Luminkey", "https://www.luminkey.com/pages/user-guide"],
  ["Meletrix", "https://meletrix.com/pages/firmwares"],
  ["Meletrix", "https://meletrix.com/pages/zoom65-user-manual"],
  [
    "Meletrix / Wuque Studio",
    "https://cannonkeys.com/pages/wuque-and-meletrix-product-guide",
  ],
  ["Qwertykeys / Owlab", "https://www.qwertykeys.com/pages/fw"],
  ["Wind Studio", "https://windstudio.store/pages/download"],
  [
    "Wind Studio",
    "https://windstudio.store/pages/wind-x80-classic-software-guide",
  ],
  ["Wind Studio", "https://windstudio.store/pages/wind-x80-software-guide"],
  ["Wuque Studio", "https://shop.wuquestudio.com/pages/firmwares"],
  ["Wuque Studio", "https://shop.wuquestudio.com/pages/user-manual"],
  ["Wuque Studio", "https://shop.wuquestudio.com/products/gb-soonmammoth75"],
  ["Wuque Studio", "https://shop.wuquestudio.com/products/ikki68-aurora-r2"],
  ["NIZ", "https://www.nizkeyboard.com/pages/firmware-upgrade"],
];
const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
const hash = (b) => crypto.createHash("sha256").update(b).digest("hex");
const sources = [],
  downloads = [],
  visited = new Set();
async function get(url, kind = "page") {
  const key = hash(url),
    file = path.join(root, key + (kind === "page" ? ".html" : ".download"));
  try {
    return await fs.readFile(file);
  } catch {}
  const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw Error(`HTTP ${response.status}`);
  const length = Number(response.headers.get("content-length"));
  if (length > 25 * 1024 * 1024)
    throw Error("Archive exceeds 25 MiB; review separately.");
  const data = Buffer.from(await response.arrayBuffer());
  if (data.length > 25 * 1024 * 1024) throw Error("Download exceeds 25 MiB.");
  await fs.writeFile(file, data);
  return data;
}
function parse(text) {
  return JSON.parse(text.replace(/^\uFEFF/, ""));
}
function definitions(value) {
  if (
    value?.matrix &&
    value?.layouts?.keymap &&
    value.vendorId !== undefined &&
    value.productId !== undefined
  )
    return [value];
  if (Array.isArray(value)) return value.flatMap(definitions);
  return [];
}
async function save(brand, url, page, label, data) {
  const text = data.toString("utf8");
  let defs;
  try {
    defs = definitions(parse(text));
  } catch {
    throw Error("Not valid definition JSON");
  }
  if (!defs.length) throw Error("JSON is not a VIA/Vial keyboard definition");
  for (const d of defs) {
    const filename = label.replace(/\.(json|JSON).*$/, "");
    const name = typeof d.name === "string" ? d.name : filename;
    const entry = { brand, url, page, label, name, sha256: hash(data) };
    downloads.push({ definition: d, source: entry });
    sources.push({ ...entry, status: "downloaded" });
    await fs.writeFile(
      path.join(root, entry.sha256 + ".json"),
      JSON.stringify(d, null, 2),
    );
  }
}
async function download(brand, url, page, label) {
  const key = "file:" + url;
  if (visited.has(key)) return;
  visited.add(key);
  try {
    const data = await get(url, "file");
    if (data[0] === 0x50 && data[1] === 0x4b) {
      const zip = path.join(root, hash(url) + ".zip");
      await fs.writeFile(zip, data);
      const script = `Add-Type -AssemblyName System.IO.Compression.FileSystem; $z=[IO.Compression.ZipFile]::OpenRead($args[0]); try { $items=@(); foreach($e in $z.Entries){if($e.FullName -match '\\.json$' -and $e.Length -lt 2097152){$r=[IO.StreamReader]::new($e.Open()); try{$items+=@{name=$e.FullName; text=$r.ReadToEnd()}}finally{$r.Dispose()}}}; ConvertTo-Json -InputObject $items -Compress -Depth 5 } finally {$z.Dispose()}`;
      const scriptPath = path.join(root, "read-zip-json.ps1");
      await fs.writeFile(scriptPath, script);
      const { stdout } = await run(
        "powershell.exe",
        ["-NoProfile", "-File", scriptPath, zip],
        { maxBuffer: 12 * 1024 * 1024 },
      );
      for (const e of JSON.parse(stdout || "[]"))
        try {
          await save(brand, url, page, e.name, Buffer.from(e.text));
        } catch {}
      sources.push({ brand, url, page, label, status: "archive inspected" });
    } else await save(brand, url, page, label, data);
  } catch (error) {
    sources.push({
      brand,
      url,
      page,
      label,
      status: "unavailable",
      reason: String(error.message),
    });
  }
}
async function folder(brand, url, page, depth = 0) {
  const id = /\/folders\/([\w-]+)/.exec(url)?.[1];
  if (!id || visited.has("folder:" + id) || depth > 4) return;
  visited.add("folder:" + id);
  try {
    const text = (
      await get("https://drive.google.com/drive/folders/" + id)
    ).toString("utf8");
    const items = [
      ...text.matchAll(/data-id="([\w-]+)"[^>]*data-tooltip="([^"]+)"/g),
    ].map((m) => ({ id: m[1], name: decode(m[2]) }));
    sources.push({
      brand,
      url,
      page,
      status: "folder inspected",
      files: items.map((i) => i.name),
    });
    for (const item of items) {
      if (
        /\.json\b/i.test(item.name) ||
        (/\.zip\b/i.test(item.name) && brand !== "NIZ")
      )
        await download(
          brand,
          "https://drive.google.com/uc?export=download&id=" + item.id,
          page,
          item.name,
        );
      else if (
        /\bfolder$/i.test(item.name) &&
        !/plate|build|refresh|manual|图片|图纸/i.test(item.name)
      )
        await folder(
          brand,
          "https://drive.google.com/drive/folders/" + item.id,
          page,
          depth + 1,
        );
    }
  } catch (error) {
    sources.push({
      brand,
      url,
      page,
      status: "unavailable",
      reason: String(error.message),
    });
  }
}
async function page(brand, url) {
  try {
    const text = (await get(url)).toString("utf8");
    const links = [
      ...text.matchAll(
        /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
      ),
    ].map((m) => ({
      url: new URL(decode(m[1]).trim(), url).href,
      label: decode(m[2].replace(/<[^>]*>/g, "").trim()),
    }));
    for (const link of links) {
      if (/drive\.google\.com\/drive\/(?:mobile\/)?folders\//.test(link.url))
        await folder(brand, link.url, url);
      else if (/\.json(?:\?|$)|\.zip(?:\?|$)/i.test(link.url))
        await download(
          brand,
          link.url,
          url,
          link.label || decode(new URL(link.url).pathname.split("/").at(-1)),
        );
      else if (
        /drive\.google\.com\/file\/d\//.test(link.url) &&
        /json/i.test(link.label)
      ) {
        const id = /\/d\/([\w-]+)/.exec(link.url)?.[1];
        await download(
          brand,
          "https://drive.google.com/uc?export=download&id=" + id,
          url,
          link.label,
        );
      }
    }
    sources.push({
      brand,
      url,
      status: "page inspected",
      links: links.filter((l) => /drive\.google|\.json|\.zip/.test(l.url)),
    });
  } catch (error) {
    sources.push({
      brand,
      url,
      status: "unavailable",
      reason: String(error.message),
    });
  }
  console.log(
    brand,
    downloads.filter((d) => d.source.brand === brand).length,
    "definitions",
  );
}
// Independent vendor pages can be fetched together; each page's dependent folders remain sequential.
await Promise.allSettled(seeds.map(([brand, url]) => page(brand, url)));
for (const id of [
  "1it3rVRHVNjkBVmKcB34QaVINyLwuyR-h",
  "1wMzL9lPKHam9UAqgEnZieB4jR_zcjNU8",
  "1-2UKGoVQ1fpqto_VNkC6JDYKGuQCQFVs",
  "1r-6LXOsyXQNznMs7s93yK_GQ2ik7RW7-",
  "1czYcobzRjg3ATJf6tEjQYnf8a4uOUkxg",
])
  await folder(
    "Createkeebs",
    "https://drive.google.com/drive/folders/" + id,
    seeds[0][1],
  );
await fs.writeFile(
  path.join(root, "collected.json"),
  JSON.stringify(downloads, null, 2),
);
await fs.writeFile(
  path.join(root, "report.json"),
  JSON.stringify(sources, null, 2),
);
console.log(
  "Collected",
  downloads.length,
  "definitions; unavailable",
  sources.filter((s) => s.status === "unavailable").length,
);
