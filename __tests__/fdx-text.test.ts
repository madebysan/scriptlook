import { describe, expect, it } from "vitest";
import { fdxToPlainText } from "@/lib/fdx-text";

const SAMPLE_FDX = `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>
<FinalDraft DocumentType="Script" Template="No" Version="5">
  <Content>
    <Paragraph Type="Scene Heading"><Text>INT. KITCHEN - DAY</Text></Paragraph>
    <Paragraph Type="Action"><Text>MARA pours coffee. </Text><Text Style="Italic">It spills.</Text></Paragraph>
    <Paragraph Type="Character"><Text>MARA</Text></Paragraph>
    <Paragraph Type="Parenthetical"><Text>(quietly)</Text></Paragraph>
    <Paragraph Type="Dialogue"><Text>Not again &amp; not today.</Text></Paragraph>
    <Paragraph>
      <DualDialogue>
        <Paragraph Type="Character"><Text>JON</Text></Paragraph>
        <Paragraph Type="Dialogue"><Text>Morning.</Text></Paragraph>
      </DualDialogue>
    </Paragraph>
    <Paragraph Type="Scene Heading"><Text>EXT. STREET - NIGHT</Text></Paragraph>
  </Content>
  <TitlePage>
    <Content>
      <Paragraph><Text>SPILLED</Text></Paragraph>
      <Paragraph><Text></Text></Paragraph>
      <Paragraph><Text>Written by A. Writer</Text></Paragraph>
    </Content>
  </TitlePage>
</FinalDraft>`;

describe("fdxToPlainText", () => {
  it("reduces Final Draft XML to screenplay lines", () => {
    expect(fdxToPlainText(SAMPLE_FDX)).toBe(
      [
        "SPILLED",
        "Written by A. Writer",
        "",
        "INT. KITCHEN - DAY",
        "",
        "MARA pours coffee. It spills.",
        "",
        "MARA",
        "(quietly)",
        "Not again & not today.",
        "",
        "JON",
        "Morning.",
        "",
        "EXT. STREET - NIGHT",
      ].join("\n"),
    );
  });

  it("keeps scene headings at the start of a line so the slug-line check sees them", () => {
    const headings = fdxToPlainText(SAMPLE_FDX).match(/^\s*(?:INT\.|EXT\.)/gim);
    expect(headings).toHaveLength(2);
  });

  it("returns text that is not Final Draft XML unchanged", () => {
    const plain = "INT. KITCHEN - DAY\n\nMara pours coffee.";
    expect(fdxToPlainText(plain)).toBe(plain);
    const broken = "<FinalDraft><Content><Paragraph>";
    expect(fdxToPlainText(broken)).toBe(broken);
  });
});
