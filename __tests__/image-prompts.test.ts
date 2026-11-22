import { describe, expect, it } from "vitest";
import {
  DEFAULT_IMAGE_PROMPTS,
  GESTURE_DRAW_TRIGGER,
  NO_TEXT_INSTRUCTION,
  buildFalGesturePrompt,
} from "@/lib/image-prompts";

describe("buildFalGesturePrompt", () => {
  it("leads with the LoRA trigger and the default style, then the subject", () => {
    const prompt = buildFalGesturePrompt("storyboard", undefined, "Mara pours coffee.");
    expect(prompt.startsWith(`${GESTURE_DRAW_TRIGGER}. ${DEFAULT_IMAGE_PROMPTS.storyboard}. Mara pours coffee`)).toBe(true);
  });

  it("ends every prompt with the text ban, without doubling the full stop", () => {
    for (const kind of ["storyboard", "portrait", "prop", "location", "poster"] as const) {
      const prompt = buildFalGesturePrompt(kind, undefined, "A brass key on a chain.");
      expect(prompt.endsWith(`A brass key on a chain. ${NO_TEXT_INSTRUCTION}`)).toBe(true);
      expect(prompt).not.toContain("..");
    }
  });

  it("does not repeat the text ban when the subject already carries it", () => {
    const subject = `Prompt context location name: Harbour. A grey quay at dawn. ${NO_TEXT_INSTRUCTION}`;
    const prompt = buildFalGesturePrompt("location", undefined, subject);
    expect(prompt.split(NO_TEXT_INSTRUCTION)).toHaveLength(2);
    expect(prompt.endsWith(subject)).toBe(true);
  });

  it("uses a custom style in place of the default", () => {
    const prompt = buildFalGesturePrompt("prop", "loose charcoal sketch", "A walkman");
    expect(prompt).toBe(`${GESTURE_DRAW_TRIGGER}. loose charcoal sketch. A walkman. ${NO_TEXT_INSTRUCTION}`);
  });
});
