# fframes vs Remotion + FFmpeg and Remotion + MediaBunny

```sh
./render-bench/vs-remotion/run.sh
```

Requires Rust, Node.js, ffprobe and Chrome with H.264 WebCodecs support
(`CHROME_PATH` or `--chrome PATH`) for MediaBunny. The FFmpeg path uses Remotion's
headless Chrome; override it with `FFMPEG_CHROME_PATH` or `--ffmpeg-chrome PATH`.
MP4 files and results go to `out/`; use `--out DIR` to choose a directory.
On macOS, the runner prevents idle sleep until it exits.

One command runs four pipelines: fframes CPU, fframes + Skia GPU,
Remotion + FFmpeg (`renderMedia`), and Remotion + MediaBunny (`renderMediaOnWeb`).
Both Remotion paths import the same component from `scene.jsx`.

One fixed 1000×1000 scene: 99,000 rectangles and 1,000 changing DM Sans text
digits in 20 panels with blur, glow and shadows. 100 text nodes have seeded
animated blur, hue-shifting glow or moving shadows. 10,000 rectangles smoothly
resize between 16 and 28 pixels. All rectangles move and change color; all text
digits change every frame. Rust and JavaScript use the same animation math.
Every Remotion node is a keyed component with its own `useCurrentFrame()` hook;
the 100 animated text filters also read their own frame. The parent memoizes the
component tree. Resizing uses `interpolate()`; the only React effect loads the
font. This deliberately stresses 100,100 frame-hook subscriptions. Results apply
to this workload, not Remotion videos in general.
fframes uses its built-in `CpuRenderingBackend` (tiny-skia) and Skia GPU when
hardware is available. Both have 100,000-entry text caches. CPU keeps its default
20-layer cache; Skia GPU uses 100,000 geometry entries with 51.2 MB per generation.

The only timing is wall-clock time to finish a 600-frame (20-second) H.264 MP4: scene rendering,
pixel conversion, encoder setup, encoding, draining, muxing and file writes.
The result is the median of three rounds, each after a three-frame MP4 warm-up.
Each pipeline has a ten-minute limit including warm-up.
Compilation, media loading, browser launch, bundling and warm-up are excluded.
Remotion's web renderer uses MediaBunny to write to the browser's origin-private
file system. Copying that file to the host for verification is excluded.
Completed files are checked for 600 frames and 20 seconds of video after timing.

Settings: 30 fps, 8 Mbps target, GOP 30, 8-bit 4:2:0, one rendering pipeline,
no audio. Native encoders use one codec thread: CPU uses x264 medium; Skia GPU
and Remotion + FFmpeg require hardware VideoToolbox on macOS and use x264 elsewhere. GPU is skipped
when no hardware device is available. MediaBunny uses WebCodecs H.264 with
`prefer-hardware`; Chrome controls encoder selection and threading. This preference
does not prove which encoder Chrome selected. Equal bitrate targets do not
guarantee equal image quality.

`results.json` contains timings, output metadata, settings and versions;
`results.md` contains all four rows and speedups against each Remotion pipeline.
Browser versions are recorded separately. Generated results are ignored.

Historical M5 Max results from the previous 100,000-node implementation, which
used 30-frame exports, unkeyed lists and 12 dependent effect/state updates per element. These three-run medians
from two separate host sessions do **not** measure the current implementation.

| Session    | fframes CPU | fframes + Skia GPU | Remotion + FFmpeg | Remotion + MediaBunny |
| ---------- | ----------: | -----------------: | ----------------: | --------------------: |
| FFmpeg     |     8.373 s |            1.435 s |         102.803 s |                     — |
| MediaBunny |     8.436 s |            1.514 s |                 — |             112.274 s |

Remotion 4.0.529 in both runs. The FFmpeg run used Chrome headless shell
149.0.7790.0; the MediaBunny run used Chrome 155.0.8059.27 and MediaBunny 1.56.1.
Raw measurements: [FFmpeg](measurements/m5-max-ffmpeg.json),
[MediaBunny](measurements/m5-max-mediabunny.json).
