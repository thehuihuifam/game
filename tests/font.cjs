// Optional Korean font for headless screenshots only; never loaded by index.html.
const fs = require("fs"),
  cp = require("child_process");
fs.mkdirSync(".cache/fonts", { recursive: true });
const blob = JSON.parse(
  cp.execFileSync(
    "gh",
    [
      "api",
      "repos/google/fonts/git/blobs/b386890ba945e1f39448a6b59f20c5d194f58808",
    ],
    { encoding: "utf8", maxBuffer: 30 * 1024 * 1024 },
  ),
);
fs.writeFileSync(
  ".cache/fonts/NotoSansKR.ttf",
  Buffer.from(blob.content, "base64"),
);
console.log(
  "Noto Sans KR cached. License: https://github.com/google/fonts/blob/main/ofl/notosanskr/OFL.txt",
);
