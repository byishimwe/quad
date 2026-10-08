import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCreatePostMedia } from "@/components/forms/create-post-modal/useCreatePostMedia";

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  validate: vi.fn(() => ({ valid: true })),
  remove: vi.fn(async () => ({ success: true })),
  successToast: vi.fn(),
  errorToast: vi.fn(),
}));

vi.mock("@/services/uploadService", () => ({
  UploadService: {
    uploadPostMedia: mocks.upload,
    validateFile: mocks.validate,
    deleteFile: mocks.remove,
  },
}));
vi.mock("@/lib/error-handling/toasts", () => ({
  showSuccessToast: mocks.successToast,
  showErrorToast: mocks.errorToast,
}));
vi.mock("@/lib/error-handling/formatters", () => ({
  formatErrorMessage: () => "Upload failed",
}));
vi.mock("@/lib/errorHandling", () => ({ logError: vi.fn() }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function video(name: string): File {
  return new File(["data"], name, { type: "video/mp4", lastModified: 100 });
}

function fileList(...files: File[]): FileList {
  return {
    length: files.length,
    item: (index: number) => files[index] ?? null,
    ...Object.fromEntries(files.map((file, i) => [i, file])),
    [Symbol.iterator]: function* () { yield* files; },
  } as FileList;
}

beforeEach(() => {
  mocks.upload.mockReset();
  mocks.validate.mockClear();
  mocks.remove.mockClear();
  mocks.successToast.mockClear();
  mocks.errorToast.mockClear();
  vi.stubGlobal("URL", Object.assign(URL, {
    createObjectURL: vi.fn(() => "blob:preview"),
    revokeObjectURL: vi.fn(),
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("post composer upload lifecycle", () => {
  it("settles out-of-order uploads without leaving ghost spinners", async () => {
    const first = deferred<{ url: string }>();
    const second = deferred<{ url: string }>();
    mocks.upload.mockImplementation((file: File) =>
      file.name === "first.mp4" ? first.promise : second.promise,
    );
    const { result } = renderHook(() => useCreatePostMedia());

    act(() => result.current.handleFileSelect(fileList(video("first.mp4"), video("second.mp4"))));
    expect(result.current.uploadingFiles).toHaveLength(2);

    await act(async () => second.resolve({ url: "https://example.com/second.mp4" }));
    await waitFor(() => expect(result.current.uploadingFiles).toHaveLength(1));
    expect(result.current.uploadingFiles[0]?.file.name).toBe("first.mp4");

    await act(async () => first.resolve({ url: "https://example.com/first.mp4" }));
    await waitFor(() => expect(result.current.uploadingFiles).toHaveLength(0));
    expect(result.current.uploadedMedia).toHaveLength(2);
  });

  it("deduplicates rapid repeated selections while one request is pending", async () => {
    const upload = deferred<{ url: string }>();
    mocks.upload.mockReturnValue(upload.promise);
    const { result } = renderHook(() => useCreatePostMedia());
    const file = video("repeated.mp4");

    act(() => {
      result.current.handleFileSelect(fileList(file));
      result.current.handleFileSelect(fileList(file));
    });
    expect(result.current.uploadingFiles).toHaveLength(1);
    expect(mocks.upload).toHaveBeenCalledTimes(1);

    await act(async () => upload.resolve({ url: "https://example.com/repeated.mp4" }));
    await waitFor(() => expect(result.current.uploadingFiles).toHaveLength(0));
    expect(result.current.uploadedMedia).toHaveLength(1);
    act(() => result.current.handleFileSelect(fileList(file)));
    expect(mocks.upload).toHaveBeenCalledTimes(1);
  });

  it("marks failed uploads as removable errors instead of infinite progress", async () => {
    mocks.upload.mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() => useCreatePostMedia());
    act(() => result.current.handleFileSelect(fileList(video("fail.mp4"))));
    await waitFor(() => expect(result.current.uploadingFiles[0]?.error).toBe("Upload failed"));
    act(() => result.current.removeUploadingFile(0));
    expect(result.current.uploadingFiles).toHaveLength(0);
  });

  it("ignores late results after a pending item is removed", async () => {
    const upload = deferred<{ url: string }>();
    mocks.upload.mockReturnValue(upload.promise);
    const { result } = renderHook(() => useCreatePostMedia());
    act(() => result.current.handleFileSelect(fileList(video("remove.mp4"))));
    act(() => result.current.removeUploadingFile(0));
    await act(async () => upload.resolve({ url: "https://example.com/orphan.mp4" }));
    expect(result.current.uploadingFiles).toHaveLength(0);
    expect(result.current.uploadedMedia).toHaveLength(0);
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledTimes(1));
  });


  it("can preload existing edit media without starting an upload", () => {
    const { result } = renderHook(() => useCreatePostMedia());
    const item = { url: "https://example.com/existing.jpg", type: "image" as const };
    act(() => result.current.setUploadedMedia([item]));
    expect(result.current.uploadedMedia).toEqual([item]);
    expect(result.current.uploadingFiles).toHaveLength(0);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("resolves an unreadable local image preview without hanging", async () => {
    const previousImage = globalThis.Image;
    class FailedImage {
      onload: ((event: Event) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      naturalWidth = 0;
      naturalHeight = 0;
      set src(_source: string) {
        queueMicrotask(() => this.onerror?.(new Event("error")));
      }
    }
    vi.stubGlobal("Image", FailedImage);
    mocks.upload.mockResolvedValue({ url: "https://example.com/upload.jpg" });
    try {
      const { result } = renderHook(() => useCreatePostMedia());
      const image = new File(["image"], "broken.jpg", { type: "image/jpeg" });
      act(() => result.current.handleFileSelect(fileList(image)));
      await waitFor(() => expect(result.current.uploadingFiles).toHaveLength(0));
      expect(result.current.uploadedMedia).toHaveLength(1);
    } finally {
      vi.stubGlobal("Image", previousImage);
    }
  });

  it("reset callback remains stable when upload state changes", async () => {
    const upload = deferred<{ url: string }>();
    mocks.upload.mockReturnValue(upload.promise);
    const { result } = renderHook(() => useCreatePostMedia());
    const reset = result.current.resetMediaState;
    act(() => result.current.handleFileSelect(fileList(video("stable.mp4"))));
    expect(result.current.resetMediaState).toBe(reset);
    await act(async () => upload.resolve({ url: "https://example.com/stable.mp4" }));
    expect(result.current.resetMediaState).toBe(reset);
    act(() => result.current.resetMediaState());
    expect(result.current.uploadedMedia).toHaveLength(0);
  });
});
