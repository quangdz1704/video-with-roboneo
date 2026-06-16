import type { GenerationMode, PromptPack } from "./types";

export interface PromptInput {
  brief: string;
  mood: string;
  duration: number;
  hasVideo: boolean;
  mode?: GenerationMode;
}

const negativePrompt =
  "low quality, blurry, distorted face, face flicker, inconsistent identity, extra fingers, broken hands, duplicated limbs, bad anatomy, outfit changing, watermark, text artifacts, jitter, frame tearing, low resolution, uncanny face";

export function generatePromptPack(input: PromptInput): PromptPack {
  const mode = input.mode || "motion_reference";
  const motion = input.hasVideo
    ? "Use the uploaded video only as motion, rhythm, camera framing, and movement reference. Do not copy watermarks, logos, protected faces, or copyrighted elements."
    : "Create smooth, purposeful movement with a strong opening pose, readable action, and a loopable final pose.";

  const consistency =
    "Preserve the same face identity, hairstyle, outfit, body proportions, skin tone, and visual style across all frames. Keep hands, facial features, clothing, and accessories stable.";

  const tiktok =
    mode === "text_to_image"
      ? "Strong thumbnail impact, centered focal subject, clear product or outfit visibility, high contrast at phone size, and safe space for TikTok UI on the right and bottom."
      : "Fast hook in the first second, centered subject, full-body visibility when needed, clear outfit or product visibility, loopable ending, and safe space for TikTok UI on the right and bottom.";

  const taskIntro: Record<GenerationMode, string> = {
    motion_reference:
      "Create a vertical 9:16 TikTok-ready AI video using the provided character reference image and motion reference video.",
    text_to_image:
      "Create a high-quality vertical 9:16 TikTok-ready image from the text description. Do not create a video.",
    text_to_video:
      "Create a vertical 9:16 TikTok-ready AI video directly from the text description. No reference asset is required.",
    image_to_video:
      "Animate the provided reference image into a vertical 9:16 TikTok-ready AI video while preserving its subject and visual identity.",
  };

  const output =
    mode === "text_to_image"
      ? "Vertical 9:16, 1080x1920, high-resolution JPG or PNG."
      : `Vertical 9:16, 1080x1920, ${input.duration} seconds, MP4-ready.`;

  const referenceSection =
    mode === "motion_reference"
      ? `Motion reference:\n${motion}\n\nCharacter consistency:\n${consistency}`
      : mode === "image_to_video"
        ? `Image animation:\nUse the uploaded image as the visual source. Preserve the subject, composition, colors, clothing, product details, and identity while adding natural motion.\n\nCharacter consistency:\n${consistency}`
        : "";

  const style =
    mode === "text_to_image"
      ? `${input.mood || "Modern and energetic"}, high-quality, clean lighting, intentional composition, crisp details, stable anatomy, natural hands, polished social media look.`
      : `${input.mood || "Modern and energetic"}, high-quality, clean lighting, smooth motion, natural hands, stable anatomy, realistic clothing movement, polished social media look.`;

  const variations =
    mode === "text_to_image"
      ? [
          "cinematic lighting, premium editorial composition, rich detail.",
          "bright color palette, bold social-media composition, playful energy.",
          "minimal studio background, product-focused framing, clean commercial look.",
        ]
      : [
          "cinematic camera movement, dramatic lighting, premium fashion-commercial finish.",
          "playful pacing, bright color palette, expressive movement, seamless loop.",
          "minimal studio background, product-focused framing, clean commercial motion.",
        ];

  const mainPrompt = `${taskIntro[mode]}

Scene/action:
${input.brief.trim() || "A confident character performs a short, engaging social video action."}

${referenceSection}

Style:
${style}

TikTok optimization:
${tiktok}

Output:
${output}`;

  return {
    mainPrompt,
    negativePrompt,
    motionReferencePrompt: motion,
    characterConsistencyPrompt: consistency,
    tiktokOptimizationPrompt: tiktok,
    caption: `${input.brief.slice(0, 90) || "Made with RoboNeo"} ✨`,
    hashtags: ["#AIvideo", "#TikTokCreator", "#RoboNeo", "#DigitalCreator"],
    variations: variations.map(
      (variation) => `${mainPrompt}\n\nVariation: ${variation}`,
    ),
    finalPrompt: `${mainPrompt}\n\nNegative prompt:\n${negativePrompt}`,
  };
}
