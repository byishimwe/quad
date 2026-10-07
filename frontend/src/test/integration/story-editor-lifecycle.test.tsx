import { StrictMode, useEffect, useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { EditorContent } from "@tiptap/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useStoryEditor } from "@/pages/create-story/useStoryEditor";

function StoryEditorHarness() {
  const editor = useStoryEditor();
  const [html, setHtml] = useState("loading");

  useEffect(() => {
    if (!editor) return;

    const update = () => {
      if (!editor.isDestroyed) setHtml(editor.getHTML());
    };

    update();
    editor.on("update", update);
    return () => editor.off("update", update);
  }, [editor]);

  return (
    <>
      <EditorContent editor={editor} />
      <output aria-label="editor html">{html}</output>
    </>
  );
}

describe("story editor lifecycle", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stays usable through React Strict Mode remounts without duplicate extensions", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    render(
      <StrictMode>
        <StoryEditorHarness />
      </StrictMode>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("editor html")).toHaveTextContent("<p></p>");
    });

    expect(
      warn.mock.calls.some(([message]) =>
        String(message).includes("Duplicate extension names"),
      ),
    ).toBe(false);
  });
});
