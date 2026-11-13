import { Image, type ImageProps } from "expo-image";

// A 1x1 blurhash of #EEF1EC: a soft, flat tint while a photo downloads.
export const IMAGE_PLACEHOLDER = { blurhash: "00RW9u" };
// A cross-fade, not movement, so it stays on with reduced motion.
export const IMAGE_FADE_MS = 200;

/** Only network photos pop in; bundled assets are already decoded. */
export function isRemoteSource(source: ImageProps["source"]): boolean {
  if (typeof source === "string") return source.length > 0;
  if (Array.isArray(source)) return source.some(isRemoteSource);
  return (
    !!source &&
    typeof source === "object" &&
    "uri" in source &&
    typeof source.uri === "string" &&
    source.uri.length > 0
  );
}

/** expo-image with a placeholder tint and a short fade for network photos. */
export function SaganaImage(props: ImageProps) {
  if (!isRemoteSource(props.source)) return <Image {...props} />;
  return (
    <Image
      placeholder={IMAGE_PLACEHOLDER}
      placeholderContentFit="cover"
      transition={IMAGE_FADE_MS}
      {...props}
    />
  );
}
