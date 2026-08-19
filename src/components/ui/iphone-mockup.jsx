import React from "react";

const DEVICE_SPECS = {
  x: {
    w: 375,
    h: 812,
    radius: 50,
    bezel: 12,
    topSafe: 47,
    bottomSafe: 34,
    notch: { w: 210, h: 35, r: 18 },
  },
  14: {
    w: 390,
    h: 844,
    radius: 56,
    bezel: 12,
    topSafe: 47,
    bottomSafe: 34,
    notch: { w: 225, h: 33, r: 18 },
  },
  "14-pro": {
    w: 393,
    h: 852,
    radius: 56,
    bezel: 12,
    topSafe: 59,
    bottomSafe: 34,
    island: { w: 126, h: 37, r: 20 },
  },
  15: {
    w: 393,
    h: 852,
    radius: 56,
    bezel: 12,
    topSafe: 59,
    bottomSafe: 34,
    island: { w: 126, h: 37, r: 20 },
  },
  "15-pro": {
    w: 393,
    h: 852,
    radius: 56,
    bezel: 12,
    topSafe: 59,
    bottomSafe: 34,
    island: { w: 126, h: 37, r: 20 },
  },
  plain: {
    w: 390,
    h: 844,
    radius: 56,
    bezel: 12,
    topSafe: 16,
    bottomSafe: 16,
  },
};

const PRESET_COLORS = {
  black: "#0b0b0d",
  midnight: "#0b0c10",
  silver: "#d7d8dc",
  starlight: "#f1eee9",
  "space-black": "#1c1e22",
  gold: "#f2dfb3",
  blue: "#2b4fa8",
  pink: "#ffbfd1",
  titanium: "#837a72",
  "natural-titanium": "#a69a8a",
  green: "#2b622e",
  red: "#c81f2f",
};

function shade(hex, pct) {
  const h = hex.trim();
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
  if (!m) return hex;
  const r = parseInt(m[1], 16),
    g = parseInt(m[2], 16),
    b = parseInt(m[3], 16);
  const k = (100 + pct) / 100;
  const to = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `#${to(r).toString(16).padStart(2, "0")}${to(g).toString(16).padStart(2, "0")}${to(b).toString(16).padStart(2, "0")}`;
}

export function IPhoneMockup({
  model = "14-pro",
  color = "space-black",
  orientation = "portrait",
  scale = 1,
  bezel,
  radius,
  shadow = true,
  screenBg = "#000",
  wallpaper,
  wallpaperFit = "cover",
  wallpaperPosition = "center",
  showDynamicIsland,
  showNotch,
  islandWidth,
  islandHeight,
  islandRadius,
  notchWidth,
  notchHeight,
  notchRadius,
  safeArea = true,
  safeAreaOverrides,
  showHomeIndicator = true,
  innerShadow = true,
  style,
  className,
  frameStyle,
  screenStyle,
  children,
}) {
  const spec = DEVICE_SPECS[model];
  const W = spec.w;
  const H = spec.h;

  const useIsland =
    typeof showDynamicIsland === "boolean"
      ? showDynamicIsland
      : Boolean(spec.island);
  const useNotch =
    typeof showNotch === "boolean"
      ? showNotch
      : Boolean(spec.notch) && !useIsland;

  const resolvedRadius = radius ?? spec.radius;
  const resolvedBezel = bezel ?? spec.bezel;

  const isLandscape = orientation === "landscape";
  const screenWidth = isLandscape ? H : W;
  const screenHeight = isLandscape ? W : H;

  const outerWidth = screenWidth + resolvedBezel * 2;
  const outerHeight = screenHeight + resolvedBezel * 2;
  const outerRadius = resolvedRadius + resolvedBezel;

  const colorHex = PRESET_COLORS[color] ?? color;
  const frameGradient = colorHex;

  const outerShadow =
    typeof shadow === "string"
      ? shadow
      : shadow
        ? "0 12px 30px rgba(0,0,0,0.35), 0 2px 6px rgba(0,0,0,0.22)"
        : "none";

  const innerShadowCss = innerShadow
    ? "inset 0 0 0 1px rgba(255,255,255,0.03), inset 0 10px 20px rgba(0,0,0,0.35), inset 0 -8px 16px rgba(0,0,0,0.28)"
    : "none";

  const notchSpec = spec.notch;
  const islandSpec = spec.island;
  const finalNotchW = notchWidth ?? notchSpec?.w ?? 0;
  const finalNotchH = notchHeight ?? notchSpec?.h ?? 0;
  const finalNotchR = notchRadius ?? notchSpec?.r ?? 0;
  const finalIslandW = islandWidth ?? islandSpec?.w ?? 0;
  const finalIslandH = islandHeight ?? islandSpec?.h ?? 0;
  const finalIslandR = islandRadius ?? islandSpec?.r ?? 0;

  const insets = {
    top: safeAreaOverrides?.top ?? spec.topSafe,
    bottom: safeAreaOverrides?.bottom ?? spec.bottomSafe,
    left: safeAreaOverrides?.left ?? 0,
    right: safeAreaOverrides?.right ?? 0,
  };

  const cutoutCommon = {
    position: "absolute",
    left: "50%",
    transform: "translateX(-50%)",
    background: "#000",
    zIndex: 2,
    boxShadow: "0 1px 2px rgba(0,0,0,0.7)",
  };

  const contentStyle = safeArea
    ? {
        position: "absolute",
        top: insets.top,
        right: insets.right,
        bottom: insets.bottom,
        left: insets.left,
        overflow: "hidden",
        zIndex: 1,
        display: "flex",
        flexDirection: "column",
      }
    : {
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        zIndex: 1,
        display: "flex",
        flexDirection: "column",
      };

  return (
    <div
      className={className}
      style={{
        boxSizing: "border-box",
        display: "inline-block",
        transform: `scale(${scale})`,
        transformOrigin: "top left",
        ...style,
      }}
    >
      <div
        style={{
          width: outerWidth,
          height: outerHeight,
          borderRadius: outerRadius,
          background: frameGradient,
          padding: resolvedBezel,
          boxSizing: "border-box",
          boxShadow: outerShadow,
          position: "relative",
          overflow: "hidden",
          ...frameStyle,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: resolvedRadius,
            position: "relative",
            overflow: "hidden",
            background: screenBg,
            boxShadow: innerShadowCss,
            ...screenStyle,
          }}
        >
          {wallpaper && (
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: `url(${wallpaper})`,
                backgroundSize: wallpaperFit,
                backgroundPosition: wallpaperPosition,
                backgroundRepeat: "no-repeat",
                zIndex: 0,
              }}
            />
          )}

          {useIsland && finalIslandW > 0 && finalIslandH > 0 && (
            <div
              aria-hidden
              style={{
                ...cutoutCommon,
                top: 12,
                width: finalIslandW,
                height: finalIslandH,
                borderRadius: finalIslandR,
              }}
            />
          )}

          {!useIsland && useNotch && finalNotchW > 0 && finalNotchH > 0 && (
            <div
              aria-hidden
              style={{
                ...cutoutCommon,
                top: 8,
                width: finalNotchW,
                height: finalNotchH,
                borderRadius: finalNotchR,
              }}
            />
          )}

          <div style={contentStyle}>{children}</div>

          {showHomeIndicator && (
            <div
              aria-hidden
              style={{
                position: "absolute",
                bottom: 8,
                left: "50%",
                transform: "translateX(-50%)",
                width: Math.round(screenWidth * 0.34),
                maxWidth: 140,
                height: 5,
                borderRadius: 3,
                background: "rgba(255,255,255,0.55)",
                opacity: 0.9,
                zIndex: 3,
                pointerEvents: "none",
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default IPhoneMockup;
