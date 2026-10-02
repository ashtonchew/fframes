import React, { useEffect, useMemo, useState } from "react";
import {
  interpolate,
  staticFile,
  useCurrentFrame,
  useDelayRender,
} from "remotion";

const rectangles = 99000;
const textNodes = 1000;
const nodes = rectangles + textNodes;
const panels = 20;
const perPanel = nodes / panels;
const textStep = nodes / textNodes;
const textEffects = 100;
const textEffectStep = nodes / textEffects;

const color = (id, frame) =>
  `rgb(${(id * 13 + frame * 17) % 256},${(id * 7 + frame * 29) % 256},${(id * 3 + frame * 43) % 256})`;
function TextEffect({ slot }) {
  const frame = useCurrentFrame();
  let seed = Math.imul(slot + 1, 0x9e3779b1) >>> 0;
  seed = (seed ^ (seed >>> 16)) >>> 0;
  const phase = ((seed % 240) + frame * (1 + 2 * ((seed >>> 16) % 2))) % 240;
  const amount = (120 - Math.abs(phase - 120)) / 120;
  const blur = 0.5 + amount * 2;
  const hue = ((seed % 360) + frame * (1 + ((seed >>> 20) % 5))) % 360;
  let effect;
  switch (seed % 3) {
    case 0:
      effect = <feGaussianBlur stdDeviation={blur} />;
      break;
    case 1:
      effect = (
        <>
          <feGaussianBlur stdDeviation={blur} result="glow" />
          <feColorMatrix
            in="glow"
            type="hueRotate"
            values={hue}
            result="tinted"
          />
          <feMerge>
            <feMergeNode in="tinted" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </>
      );
      break;
    default:
      effect = (
        <feDropShadow
          dx={-3 + amount * 6}
          dy={1 + amount * 3}
          stdDeviation={0.5 + amount}
          floodColor="#000"
          floodOpacity={0.35 + amount * 0.4}
        />
      );
  }
  return (
    <filter
      key={slot}
      id={`node-effect-${slot}`}
      x="-100%"
      y="-100%"
      width="300%"
      height="300%"
      colorInterpolationFilters="sRGB"
    >
      {effect}
    </filter>
  );
}
function rectSize(slot, frame) {
  if (slot % 10 !== 1)
    return [16 + (slot % 4) * 4, 16 + (Math.floor(slot / 4) % 4) * 4];
  const width = interpolate((slot + frame) % 60, [0, 30, 60], [16, 28, 16], {
    easing: t => t * t * (3 - 2 * t),
  });
  return [width, 44 - width];
}
function Cell({ slot }) {
  const frame = useCurrentFrame();
  const id = (slot + frame * 37) % nodes;
  if (slot % textStep === 0) {
    const panel = Math.floor(slot / perPanel);
    const index = (slot % perPanel) / textStep;
    return (
      <text
        key={slot}
        filter={
          slot % textEffectStep === 0 ? `url(#node-effect-${slot})` : undefined
        }
        x={(panel % 5) * 200 + 24 + (index % 10) * 16}
        y={Math.floor(panel / 5) * 250 + 40 + Math.floor(index / 10) * 40}
        fontFamily="DM Sans"
        fontSize="16"
        fill="#fff"
      >
        {(id + frame) % 10}
      </text>
    );
  }
  const [width, height] = rectSize(slot, frame);
  return (
    <rect
      key={slot}
      x={24 + ((slot * 13 + frame * 3) % 128)}
      y={24 + ((slot * 17 + frame * 5) % 176)}
      width={width}
      height={height}
      fill={color(id, frame)}
    />
  );
}
export function GridVideo({ fontCss = "" }) {
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [fontHandle] = useState(() =>
    delayRender("benchmark font", { retries: 0 })
  );
  useEffect(() => {
    const font = new FontFace(
      "DM Sans",
      `url(${staticFile("DMSans-Regular.ttf")})`
    );
    font
      .load()
      .then(loaded => {
        document.fonts.add(loaded);
        continueRender(fontHandle);
      })
      .catch(cancelRender);
  }, [fontHandle, continueRender, cancelRender]);
  const { effects, layers, texts } = useMemo(() => {
    const effects = Array.from({ length: textEffects }, (_, index) => (
      <TextEffect key={index} slot={index * textEffectStep} />
    ));
    const layers = [];
    for (let panel = 0; panel < panels; panel++) {
      const cells = [];
      for (let slot = panel * perPanel; slot < (panel + 1) * perPanel; slot++)
        if (slot % textStep !== 0) cells.push(<Cell key={slot} slot={slot} />);
      layers.push(
        <g
          key={panel}
          transform={`translate(${(panel % 5) * 200} ${Math.floor(panel / 5) * 250})`}
          filter="url(#panel-effects)"
        >
          {cells}
        </g>
      );
    }
    const texts = [];
    for (let slot = 0; slot < nodes; slot += textStep)
      texts.push(<Cell key={slot} slot={slot} />);
    return { effects, layers, texts };
  }, []);
  return (
    <svg
      width="1000"
      height="1000"
      style={{ display: "block", background: "#18202c" }}
    >
      <defs>
        <style>{fontCss}</style>
        {effects}
        <filter
          id="panel-effects"
          x="-40%"
          y="-40%"
          width="180%"
          height="180%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur stdDeviation="8" result="glow" />
          <feColorMatrix
            in="glow"
            type="saturate"
            values="1.8"
            result="bright"
          />
          <feMerge>
            <feMergeNode in="bright" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
          <feDropShadow
            dx="4"
            dy="8"
            stdDeviation="12"
            floodColor="#000"
            floodOpacity="0.7"
          />
        </filter>
      </defs>
      {layers}
      {texts}
    </svg>
  );
}
