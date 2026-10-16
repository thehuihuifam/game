const { chromium } = require("playwright");
const fs = require("fs"),
  os = require("os"),
  path = require("path"),
  zlib = require("zlib"),
  cp = require("child_process");
exports.launch = async () => {
  const c = require("@sparticuz/chromium").default;
  if (fs.existsSync(".cache/fonts/NotoSansKR.ttf")) {
    fs.mkdirSync("/tmp/fonts", { recursive: true });
    fs.copyFileSync(".cache/fonts/NotoSansKR.ttf", "/tmp/fonts/NotoSansKR.ttf");
  }
  const root = path.dirname(require.resolve("@sparticuz/chromium"));
  const dir = path.join(os.tmpdir(), "neon-browser-libs");
  fs.mkdirSync(dir, { recursive: true });
  const tar = path.join(dir, "libs.tar");
  fs.writeFileSync(
    tar,
    zlib.brotliDecompressSync(
      fs.readFileSync(path.join(root, "../bin/al2023.tar.br")),
    ),
  );
  cp.execFileSync("tar", ["xf", tar, "-C", dir]);
  return chromium.launch({
    executablePath: await c.executablePath(),
    args: c.args,
    headless: true,
    env: {
      ...process.env,
      FONTCONFIG_PATH: "/tmp/fonts",
      LD_LIBRARY_PATH:
        path.join(dir, "lib") + ":" + (process.env.LD_LIBRARY_PATH || ""),
    },
  });
};
