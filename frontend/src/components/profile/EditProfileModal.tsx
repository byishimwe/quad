import { useState, useRef } from "react";
import type { ChangeEvent } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  processProfileImage,
  processCoverImage,
  revokePreviewUrl,
} from "@/lib/imageUtils";
import { showErrorToast, showSuccessToast } from "@/lib/error-handling/toasts";
import { UploadService } from "@/services/uploadService";

import { CoverImageSection } from "./edit-profile/CoverImageSection";
import { EditProfileActions } from "./edit-profile/EditProfileActions";
import { EditProfileFields } from "./edit-profile/EditProfileFields";
import { EditProfileModalHeader } from "./edit-profile/EditProfileModalHeader";
import { ProfileImageSection } from "./edit-profile/ProfileImageSection";
import { UploadErrorAlert } from "./edit-profile/UploadErrorAlert";

// Validation schema
const editProfileSchema = z.object({
  firstName: z
    .string()
    .min(1, "First name is required")
    .max(50, "First name must be less than 50 characters"),
  lastName: z
    .string()
    .min(1, "Last name is required")
    .max(50, "Last name must be less than 50 characters"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be less than 30 characters")
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Username can only contain letters, numbers, and underscores",
    ),
  bio: z.string().max(500, "Bio must be less than 500 characters").optional(),
});

type EditProfileFormData = z.infer<typeof editProfileSchema>;

interface User {
  _id: string;
  clerkId: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profileImage?: string;
  coverImage?: string;
  bio?: string;
  isVerified?: boolean;
}

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onSave: (
    data: EditProfileFormData & {
      profileImageUrl?: string | null;
      coverImageUrl?: string | null;
    },
  ) => Promise<void>;
}

export function EditProfileModal({
  isOpen,
  onClose,
  user,
  onSave,
}: EditProfileModalProps) {
  const profileImageInputRef = useRef<HTMLInputElement>(null);
  const coverImageInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
    control,
  } = useForm<EditProfileFormData>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: {
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      username: user.username,
      bio: user.bio || "",
    },
  });

  // Image upload state
  const [profileImage, setProfileImage] = useState<{
    file: File | null;
    preview: string | null;
    processing: boolean;
  }>({
    file: null,
    preview: user.profileImage || null,
    processing: false,
  });

  const [coverImage, setCoverImage] = useState<{
    file: File | null;
    preview: string | null;
    processing: boolean;
  }>({
    file: null,
    preview: user.coverImage || null,
    processing: false,
  });

  const [uploadError, setUploadError] = useState<string | null>(null);

  // Watch bio for character count
  const bioValue = useWatch({ control, name: "bio" }) || "";

  // Handle profile image upload
  const handleProfileImageChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setProfileImage((prev) => ({ ...prev, processing: true }));

    try {
      // Validate file
      const validation = UploadService.validateFile(file, "image");
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Process image locally first for preview
      const processed = await processProfileImage(file);

      // Clean up previous preview
      if (profileImage.preview) {
        revokePreviewUrl(profileImage.preview);
      }

      // Upload to backend
      const uploadResult = await UploadService.uploadProfileImage(
        processed.file,
      );
      if (!uploadResult || !uploadResult.url) {
        throw new Error("Upload failed: Missing URL in response");
      }

      setProfileImage({
        file: processed.file,
        preview: uploadResult.url, // Use uploaded URL for preview
        processing: false,
      });

      showSuccessToast("Profile image uploaded");
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "Failed to process image",
      );
      setProfileImage((prev) => ({ ...prev, processing: false }));

      showErrorToast(error);
    }

    // Reset input
    event.target.value = "";
  };

  // Handle cover image upload
  const handleCoverImageChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setCoverImage((prev) => ({ ...prev, processing: true }));

    try {
      // Validate file
      const validation = UploadService.validateFile(file, "image");
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Process image locally first for preview
      const processed = await processCoverImage(file);

      // Clean up previous preview
      if (coverImage.preview) {
        revokePreviewUrl(coverImage.preview);
      }

      // Upload to backend
      const uploadResult = await UploadService.uploadCoverImage(processed.file);
      if (!uploadResult || !uploadResult.url) {
        throw new Error("Upload failed: Missing URL in response");
      }

      setCoverImage({
        file: processed.file,
        preview: uploadResult.url, // Use uploaded URL for preview
        processing: false,
      });

      showSuccessToast("Cover image uploaded");
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "Failed to process image",
      );
      setCoverImage((prev) => ({ ...prev, processing: false }));

      showErrorToast(error);
    }

    // Reset input
    event.target.value = "";
  };

  // Handle form submission
  const onSubmit = async (data: EditProfileFormData) => {
    try {
      await onSave({
        ...data,
        profileImageUrl: profileImage.preview,
        coverImageUrl: coverImage.preview,
      });

      showSuccessToast("Profile updated");

      handleClose();
    } catch (error) {
      showErrorToast(error);
    }
  };

  // Handle modal close
  const handleClose = () => {
    // Clean up preview URLs
    if (profileImage.preview) {
      revokePreviewUrl(profileImage.preview);
    }
    if (coverImage.preview) {
      revokePreviewUrl(coverImage.preview);
    }

    // Reset state
    setProfileImage({
      file: null,
      preview: user.profileImage || null,
      processing: false,
    });
    setCoverImage({
      file: null,
      preview: user.coverImage || null,
      processing: false,
    });
    setUploadError(null);
    reset();
    onClose();
  };

  const displayName =
    user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : user.firstName || user.username;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-background border rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto scrollbar-hide">
        <div className="p-6">
          <EditProfileModalHeader onClose={handleClose} />

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Cover Image Section */}
            <CoverImageSection
              src={coverImage.preview || user.coverImage || null}
              processing={coverImage.processing}
              inputRef={coverImageInputRef}
              onChange={handleCoverImageChange}
              onRemove={() => {
                if (coverImage.preview) revokePreviewUrl(coverImage.preview);
                setCoverImage({ file: null, preview: null, processing: false });
                showSuccessToast("Cover image removed");
              }}
            />

            {/* Profile Image Section */}
            <ProfileImageSection
              src={profileImage.preview || user.profileImage || null}
              displayInitial={displayName}
              processing={profileImage.processing}
              inputRef={profileImageInputRef}
              onChange={handleProfileImageChange}
              onRemove={() => {
                if (profileImage.preview)
                  revokePreviewUrl(profileImage.preview);
                setProfileImage({
                  file: null,
                  preview: null,
                  processing: false,
                });
                showSuccessToast("Profile image removed");
              }}
            />

            {/* Upload Error */}
            <UploadErrorAlert error={uploadError} />

            {/* Form Fields */}
            <EditProfileFields
              register={register}
              errors={errors}
              bioValue={bioValue}
            />

            {/* Form Dirty Check */}
            {(() => {
              const hasImageChanges =
                profileImage.preview !== (user.profileImage || null) ||
                coverImage.preview !== (user.coverImage || null);
              const isActuallyDirty = isDirty || hasImageChanges;

              return (
                <EditProfileActions
                  isSubmitting={isSubmitting}
                  profileProcessing={profileImage.processing}
                  coverProcessing={coverImage.processing}
                  onCancel={handleClose}
                  disabled={!isActuallyDirty}
                />
              );
            })()}
          </form>
        </div>
      </div>
    </div>
  );
}
