import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { Table } from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";

import { Callout } from "./extensions/callout";

export function useStoryEditor() {
  return useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4],
        },
        link: {
          openOnClick: false,
          HTMLAttributes: {
            class: "text-blue-500 underline",
          },
        },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Callout,
      Placeholder.configure({
        placeholder: "Start writing your story here...",
      }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class:
          "seamless-field prose dark:prose-invert min-h-[50vh] max-w-none text-foreground text-base md:text-[17px] leading-relaxed md:leading-[1.7]",
      },
    },
  });
}
