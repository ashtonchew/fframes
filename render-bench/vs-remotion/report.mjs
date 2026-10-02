export const engines = [
  "fframes",
  "fframes-gpu",
  "remotion-ffmpeg",
  "remotion-mediabunny",
];
const labels = {
  fframes: "fframes CPU (tiny-skia)",
  "fframes-gpu": "fframes + Skia GPU",
  "remotion-ffmpeg": "Remotion + FFmpeg",
  "remotion-mediabunny": "Remotion + MediaBunny",
};

export function summarize(records, plan) {
  const results = Object.fromEntries(
    engines.map(engine => {
      const runs = records.filter(r => r.engine === engine);
      const complete =
        runs.length === plan.rounds &&
        new Set(runs.map(r => r.round)).size === plan.rounds;
      const skipped =
        engine === "fframes-gpu" &&
        complete &&
        runs.every(r => r.status === "skipped");
      const valid =
        complete &&
        runs.every(
          r =>
            r.status === "ok" &&
            r.video?.frames === plan.frames &&
            Number.isFinite(r.export_ms) &&
            r.export_ms > 0 &&
            (engine === "remotion-mediabunny"
              ? r.encoder === "webcodecs-h264"
              : ["libx264", "h264_videotoolbox"].includes(r.encoder))
        );
      const timings = runs.map(r => r.export_ms).sort((a, b) => a - b);
      return [
        engine,
        {
          status: skipped ? "skipped" : valid ? "complete" : "incomplete",
          export_median_ms: valid
            ? timings[Math.floor(timings.length / 2)]
            : null,
          ...(skipped ? { reason: runs[0].reason } : {}),
        },
      ];
    })
  );
  return {
    status: Object.values(results).every(r => r.status !== "incomplete")
      ? "complete"
      : "incomplete",
    pipelines: results,
  };
}

export function markdown(report) {
  const result = report.summary.pipelines;
  const speedup = (engine, baseline) => {
    const time = result[engine].export_median_ms;
    const reference = result[baseline].export_median_ms;
    return time && reference ? `${(reference / time).toFixed(2)}×` : "n/a";
  };
  const rows = engines.map(engine => {
    const run = result[engine];
    const encoder =
      report.records.find(r => r.engine === engine && r.status === "ok")
        ?.encoder ?? "n/a";
    const time =
      run.status === "skipped"
        ? `skipped: ${run.reason}`
        : run.export_median_ms == null
          ? "incomplete"
          : `${(run.export_median_ms / 1000).toFixed(3)} s`;
    return `| ${labels[engine]} | ${encoder} | ${time} | ${speedup(engine, "remotion-ffmpeg")} | ${speedup(engine, "remotion-mediabunny")} |`;
  });
  return [
    "# fframes vs Remotion + FFmpeg and Remotion + MediaBunny",
    "",
    "One 1000×1000 scene: 99,000 rectangles and 1,000 changing text digits in 20 panels with blur, glow and shadows. 100 text nodes have seeded animated blur, hue-shifting glow or moving shadows; 10,000 rectangles smoothly resize between 16 and 28 pixels. Both Remotion paths share the same scene: one keyed component with its own useCurrentFrame hook per drawable node and per animated text filter, with a memoized parent tree. This deliberately stresses 100,100 frame-hook subscriptions. Results describe this workload, not Remotion videos in general.",
    "",
    "Median of three complete 600-frame (20-second) H.264 MP4 exports, each after a three-frame MP4 warm-up. Includes rendering, pixel conversion, encoder setup, encoding, draining, muxing and file writes. Compilation, media preparation, browser launch, bundling and warm-up are excluded. MediaBunny writes to the browser’s origin-private file system; copying the completed file to the host for validation is excluded. Output frame counts and durations are checked after timing.",
    "",
    "| Pipeline | Encoder | Complete MP4 export | Speedup vs Remotion + FFmpeg | Speedup vs Remotion + MediaBunny |",
    "|---|---|---:|---:|---:|",
    ...rows,
    "",
    "30 fps, 8 Mbps target, GOP 30, one rendering pipeline, no audio. CPU uses x264 medium. Skia GPU and Remotion + FFmpeg require hardware VideoToolbox on macOS and use x264 elsewhere; native encoders use one codec thread. MediaBunny uses WebCodecs H.264 with prefer-hardware; Chrome controls encoder selection and threading. Hardware preference does not prove which encoder Chrome selected. Equal bitrate targets do not guarantee equal image quality. Browser executables and versions are recorded separately for each Remotion path.",
    "",
  ].join("\n");
}
