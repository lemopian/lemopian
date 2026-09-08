// Populates the BLOG-POST-LIST block in README.md with the Seven Mile posts I signed.
// Authorship comes from <dc:creator>, emitted per author by seven-mile-editorial's rss().
import { readFileSync, writeFileSync } from "node:fs";

const FEED = process.env.FEED_URL ?? "https://sevenmile.tech/blog/feed.xml";
const AUTHOR = process.env.FEED_AUTHOR ?? "PA";
const MAX = Number(process.env.MAX_POSTS ?? 5);
const README = "README.md";
const START = "<!-- BLOG-POST-LIST:START -->";
const END = "<!-- BLOG-POST-LIST:END -->";

const fail = (message) => {
  console.error(`update-blog-posts: ${message}`);
  process.exit(1);
};

// The feed having nothing for me yet is an expected state, not a broken one:
// leave the README alone and stay green. A feed that cannot be read is a failure.
const skip = (message) => {
  console.warn(`update-blog-posts: ${message} — leaving the list untouched`);
  process.exit(0);
};

const entities = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'" };
const decode = (text) => text.replace(/&(amp|lt|gt|quot|apos|#39);/g, (_, name) => entities[name]);

const tag = (item, name) => {
  const match = item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return match ? decode(match[1]).trim() : "";
};

let feed;
try {
  const response = await fetch(FEED, { headers: { accept: "application/rss+xml" } });
  if (!response.ok) fail(`${FEED} returned ${response.status}`);
  feed = await response.text();
} catch (error) {
  fail(`could not fetch ${FEED}: ${error.cause?.message ?? error.message}`);
}
// The site is a SPA: any unknown path answers 200 with the app shell, so an
// undeployed feed would otherwise read as "no posts" and empty the README.
if (!feed.includes("<rss")) skip(`${FEED} is not an RSS document (is the blog deployed?)`);

const posts = [...feed.matchAll(/<item>([\s\S]*?)<\/item>/g)]
  .map(([, item]) => ({
    title: tag(item, "title"),
    url: tag(item, "link"),
    date: new Date(tag(item, "pubDate")),
    authors: [...item.matchAll(/<dc:creator>([\s\S]*?)<\/dc:creator>/g)].map(([, name]) => decode(name).trim()),
  }))
  .filter((post) => post.authors.includes(AUTHOR))
  .sort((a, b) => b.date - a.date)
  .slice(0, MAX);

if (posts.length === 0) skip(`no post in ${FEED} is signed by ${AUTHOR}`);

const list = posts.map((post) => `- [${post.title}](${post.url})`).join("\n");
const readme = readFileSync(README, "utf8");
const block = new RegExp(`${START}[\\s\\S]*?${END}`);
if (!block.test(readme)) fail(`${README} has no ${START} … ${END} block`);

const updated = readme.replace(block, `${START}\n${list}\n${END}`);
if (updated === readme) {
  console.log("update-blog-posts: already up to date");
} else {
  writeFileSync(README, updated);
  console.log(`update-blog-posts: wrote ${posts.length} post(s) signed by ${AUTHOR}`);
}
